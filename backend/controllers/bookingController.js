const Booking = require('../models/Booking');
const Room = require('../models/Room');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const bookingService = require('../utils/bookingService');
const { total, balance, toFrontendBooking } = require('../utils/calc');

function serialize(b) {
  const doc = b.toObject ? b.toObject() : b;
  return {
    ...toFrontendBooking(doc),
    id: String(doc._id),
    total: total(doc),
    balance: balance(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/bookings?status=&type=&q=&from=&to=&page=&limit=
exports.listBookings = asyncHandler(async (req, res) => {
  const { status, type, q, from, to, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.roomType = type;
  if (from || to) {
    filter.checkin = {};
    if (from) filter.checkin.$gte = new Date(from);
    if (to) filter.checkin.$lte = new Date(to);
  }
  if (q) {
    filter.$or = [
      { guest: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') },
      { room: new RegExp(q, 'i') },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  const [items, totalCount] = await Promise.all([
    Booking.find(filter).sort({ checkin: -1 }).skip((pageNum - 1) * pageSize).limit(pageSize),
    Booking.countDocuments(filter),
  ]);

  res.json({
    data: items.map(serialize),
    page: pageNum,
    limit: pageSize,
    total: totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  });
});

// GET /api/bookings/:id
exports.getBooking = asyncHandler(async (req, res) => {
  const b = await Booking.findById(req.params.id);
  if (!b) throw new ApiError(404, 'Booking not found');
  res.json(serialize(b));
});

// POST /api/bookings
exports.createBooking = asyncHandler(async (req, res) => {
  const required = ['room', 'guest', 'checkin', 'checkout'];
  for (const f of required) {
    if (!req.body[f]) throw new ApiError(400, `${f} is required`);
  }
  const booking = await bookingService.createBooking(req.body);
  res.status(201).json(serialize(booking));
});

// PUT /api/bookings/:id
exports.updateBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.updateBooking(req.params.id, req.body);
  res.json(serialize(booking));
});

// PATCH /api/bookings/:id/status  { status: 'checkedin'|'checkout'|'reserved'|'cancelled', reason? }
exports.setStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const allowed = ['reserved', 'checkedin', 'checkout', 'cancelled'];
  if (!allowed.includes(status)) throw new ApiError(400, `status must be one of ${allowed.join(', ')}`);
  const booking = await bookingService.setBookingStatus(req.params.id, status, { reason });
  res.json(serialize(booking));
});

// DELETE /api/bookings/:id  — soft delete: cancels the booking and frees the room
exports.cancelBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.setBookingStatus(req.params.id, 'cancelled', { reason: 'Deleted from Bookings list' });
  await bookingService.freeRoom(booking.room);
  res.json({ ok: true, booking: serialize(booking) });
});

// POST /api/bookings/sync
// Bulk-sync compatibility endpoint for the legacy `storage.set('booking-bookings', [...])`
// call pattern used by booking-list.html / booking-rooms.html. Accepts the full
// per-room array (one record per room: guest '' means vacant) and reconciles
// it against real Booking history + Room state, instead of overwriting a blob.
exports.syncBookings = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.bookings;
  if (!Array.isArray(list)) throw new ApiError(400, 'Expected an array of per-room booking records');

  const results = [];
  for (const entry of list) {
    if (!entry || !entry.room) continue;
    results.push(await reconcileRoomEntry(entry));
  }
  res.json(results);
});

async function reconcileRoomEntry(entry) {
  const room = await Room.findOne({ num: entry.room });
  if (!room) return { room: entry.room, skipped: true, reason: 'unknown room' };

  const hasGuest = !!(entry.guest && entry.guest.trim());

  if (!hasGuest) {
    if (entry.status === 'maintenance') {
      await bookingService.setRoomMaintenance(room.num, true, entry.notes || '');
    } else if (room.currentBooking) {
      const current = await Booking.findById(room.currentBooking);
      if (current && current.status !== 'cancelled') {
        await bookingService.setBookingStatus(current._id, 'cancelled', { reason: 'Room vacated via sync' });
      }
      await bookingService.freeRoom(room.num);
    } else if (room.status !== 'available') {
      await bookingService.freeRoom(room.num);
    }
    return { room: room.num, status: 'vacant' };
  }

  // Guest present: find the room's current active/recent booking to update,
  // or create a fresh one if none exists.
  let current = room.currentBooking ? await Booking.findById(room.currentBooking) : null;
  const targetStatus = ['reserved', 'checkedin', 'checkout'].includes(entry.status) ? entry.status : 'reserved';

  if (current && current.status !== 'cancelled') {
    current = await bookingService.updateBooking(current._id, entry);
    if (current.status !== targetStatus) {
      current = await bookingService.setBookingStatus(current._id, targetStatus);
    }
  } else {
    current = await bookingService.createBooking({ ...entry, roomType: entry.type, status: targetStatus });
  }

  return { room: room.num, status: targetStatus, bookingId: String(current._id) };
}
