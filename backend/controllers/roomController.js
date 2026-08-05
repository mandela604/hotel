const Room = require('../models/Room');
const Booking = require('../models/Booking');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const bookingService = require('../utils/bookingService');
const { toFrontendBooking, vacantRecord } = require('../utils/calc');

// GET /api/rooms
exports.listRooms = asyncHandler(async (req, res) => {
  const rooms = await Room.find().sort({ num: 1 });
  res.json(rooms);
});

// GET /api/rooms/with-status
// Returns exactly the shape the frontend's `bookings` array already uses:
// one record per room, either the active booking or a vacant/maintenance
// placeholder. This lets booking-dashboard/rooms/list/reports pages work
// against a single call without any rewrite of their render logic.
exports.roomsWithStatus = asyncHandler(async (req, res) => {
  const rooms = await Room.find().sort({ num: 1 });
  const bookingIds = rooms.map((r) => r.currentBooking).filter(Boolean);
  const bookings = await Booking.find({ _id: { $in: bookingIds } });
  const byId = new Map(bookings.map((b) => [String(b._id), b]));

  const out = rooms.map((room) => {
    const b = room.currentBooking ? byId.get(String(room.currentBooking)) : null;
    if (b && b.status !== 'cancelled') {
      const rec = toFrontendBooking(b);
      rec.status = room.status === 'checkout' ? 'checkout' : rec.status;
      return rec;
    }
    return vacantRecord(room);
  });

  res.json(out);
});

// POST /api/rooms
exports.createRoom = asyncHandler(async (req, res) => {
  const { num, type, rate, status, notes } = req.body;
  if (!num || !type) throw new ApiError(400, 'num and type are required');

  const exists = await Room.findOne({ num });
  if (exists) throw new ApiError(409, `Room ${num} already exists`);

  const room = await Room.create({
    num, type, rate: rate || 0,
    status: status === 'maintenance' ? 'maintenance' : 'available',
    notes: notes || '',
  });
  res.status(201).json(room);
});

// PUT /api/rooms/:num
exports.updateRoom = asyncHandler(async (req, res) => {
  const room = await Room.findOne({ num: req.params.num });
  if (!room) throw new ApiError(404, 'Room not found');

  const { type, rate } = req.body;
  if (type !== undefined) room.type = type;
  if (rate !== undefined) room.rate = rate;
  await room.save();
  res.json(room);
});

// PATCH /api/rooms/:num/status  { status: 'maintenance'|'available', notes }
exports.setRoomStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  if (!['maintenance', 'available'].includes(status)) {
    throw new ApiError(400, "status must be 'maintenance' or 'available'");
  }
  const room = await bookingService.setRoomMaintenance(req.params.num, status === 'maintenance', notes);
  res.json(room);
});

// DELETE /api/rooms/:num
exports.deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findOne({ num: req.params.num });
  if (!room) throw new ApiError(404, 'Room not found');
  if (room.status === 'checkedin' || room.status === 'reserved') {
    throw new ApiError(409, 'Cannot delete a room with an active booking');
  }
  await room.deleteOne();
  res.json({ ok: true });
});

// POST /api/rooms/sync
// Bulk-upsert compatibility endpoint for the legacy `storage.set('booking-rooms', [...])`
// call pattern: accepts the whole [{num,type,rate}] array and upserts each one.
// Never deletes rooms that are missing from the payload (a room removed from
// an old cached array shouldn't silently vanish from inventory).
exports.syncRooms = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.rooms;
  if (!Array.isArray(list)) throw new ApiError(400, 'Expected an array of {num, type, rate}');

  const ops = list
    .filter((r) => r && r.num)
    .map((r) => ({
      updateOne: {
        filter: { num: String(r.num) },
        update: {
          $set: { type: r.type, rate: Number(r.rate) || 0 },
          $setOnInsert: { status: 'available', currentBooking: null, notes: '' },
        },
        upsert: true,
      },
    }));

  if (ops.length) await Room.bulkWrite(ops);
  const rooms = await Room.find().sort({ num: 1 });
  res.json(rooms);
});
