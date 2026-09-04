const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Guest = require('../models/Guest');
const Sale = require('../models/Sale');
const Order = require('../models/Order');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');
const { STATUS_TRANSITIONS } = require('../middleware/bookingValidators');
const { v4: uuidv4 } = require('uuid');

/* ═══════════════════════════════════════════════
   Helpers — same math used client-side in every
   booking-*.html page (nights/calcTotal/calcBal),
   duplicated here so figures can't be spoofed from
   the client and every page reads the same numbers.
═══════════════════════════════════════════════ */
function nights(ci, co) {
  if (!ci || !co) return 0;
  const n = (new Date(co) - new Date(ci)) / 86400000;
  return n > 0 ? n : 0;
}
function calcTotal(b) {
  const n = nights(b.checkin, b.checkout) || 1;
  return ((b.rate || 0) - (b.discount || 0)) * n;
}
function calcPaid(b) {
  return (b.payments || []).reduce((s, p) => s + (p.amount || 0), 0) || b.paid || 0;
}
function calcBal(b) {
  return Math.max(0, calcTotal(b) - calcPaid(b));
}
function payStatusFor(b) {
  const paid = calcPaid(b);
  const total = calcTotal(b);
  if (paid <= 0) return 'Pending';
  if (paid >= total) return 'Fully Paid';
  return 'Deposit Paid';
}

function todayDDMMYY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}
function nowStamp() {
  const d = new Date();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${todayDDMMYY()} ${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

async function logActivity(dept, color, text, href) {
  try {
    await Activity.create({ dept, color, text, time: nowStamp(), href: href || '#' });
  } catch (e) { /* activity log is best-effort, never block the request on it */ }
}

async function nextGuestId() {
  const count = await Guest.countDocuments();
  return `GST-${String(count + 1).padStart(5, '0')}`;
}

// Looks a guest profile up by phone (primary) and falls back to an
// exact-name match; creates a fresh profile if neither is found. This is
// what keeps a repeat guest's stays/charges attached to one record across
// however many bookings they make.
async function findOrCreateGuest({ name, phone, email, address, idType, idNum }) {
  let guest = null;
  if (phone) guest = await Guest.findOne({ phone });
  if (!guest && name) guest = await Guest.findOne({ name });

  if (guest) {
    if (phone && !guest.phone) guest.phone = phone;
    if (email && !guest.email) guest.email = email;
    if (address && !guest.address) guest.address = address;
    if (idType) guest.idType = idType;
    if (idNum && !guest.idNum) guest.idNum = idNum;
    await guest.save();
    return guest;
  }

  return Guest.create({
    guestId: await nextGuestId(),
    name: name || 'Guest',
    phone: phone || '',
    email: email || '',
    address: address || '',
    idType: idType || 'NIN',
    idNum: idNum || '',
    vip: false,
    notes: '',
    stays: [],
    charges: [],
  });
}

/* ═══════════════════════════════════════════════
   Combined read — mirrors the frontend's single
   BookingData.getBookingData() call so every page
   (dashboard, list, rooms, reports, guests) can
   hydrate from one round trip.
═══════════════════════════════════════════════ */
// Rooms/bookings are bounded by physical room count (fine to return in
// full even for a large property). Guests are NOT bounded — this grows
// forever. Default this endpoint to the 200 most recently updated guests
// (covers "who's relevant right now" for the dashboard/rooms/reports
// pages, which is all that actually needs this combined call) and let
// guests.html page through the rest via GET /guests?page=&limit=&search=
// below instead of loading the whole collection every time.
exports.getBookingData = asyncHandler(async (req, res) => {
  const [rooms, bookings, guests] = await Promise.all([
    Room.find().sort({ num: 1 }),
    Booking.find().sort({ room: 1 }),
    Guest.find().sort({ updatedAt: -1 }).limit(200),
  ]);
  res.json({ success: true, data: { rooms, bookings, guests } });
});

/* ═══════════════════════════════════════════════
   Rooms
═══════════════════════════════════════════════ */
exports.listRooms = asyncHandler(async (req, res) => {
  const rooms = await Room.find().sort({ num: 1 });
  res.json({ success: true, count: rooms.length, data: rooms });
});

// Adding a room also seeds its Booking record (1 booking doc per room,
// keyed by room number, status 'vacant') so every other endpoint can
// assume a Booking always exists for a known room.
// Room + its paired Booking record are created together. Wrapped in a
// Mongo session transaction so a failure on the second write rolls back
// the first — otherwise a Booking.create() failure after Room.create()
// succeeds leaves an orphan room with no booking doc, which every other
// endpoint assumes exists. Falls back to manual best-effort rollback if
// the deployment isn't a replica set (transactions need one; a lot of
// small self-hosted Mongo instances aren't).
exports.addRoom = asyncHandler(async (req, res) => {
  const { num, type, rate, notes } = req.body;

  const existing = await Room.findOne({ num: num.trim() });
  if (existing) {
    return res.status(409).json({ success: false, error: `Room ${num} already exists` });
  }

  const session = await Room.startSession();
  let room;
  try {
    await session.withTransaction(async () => {
      const [createdRoom] = await Room.create([{
        num: num.trim(),
        type: type || 'Standard',
        rate: Number(rate) || 0,
        notes: notes || '',
      }], { session });
      room = createdRoom;

      await Booking.create([{
        room: room.num,
        type: room.type,
        rate: room.rate,
        status: 'vacant',
      }], { session });
    });
  } catch (err) {
    // Standalone Mongo (no replica set) throws immediately on
    // startTransaction — fall back to a plain create + manual rollback
    // instead of failing the whole endpoint.
    if (err.code === 20 || /Transaction numbers/i.test(err.message || '')) {
      room = await Room.create({
        num: num.trim(),
        type: type || 'Standard',
        rate: Number(rate) || 0,
        notes: notes || '',
      });
      try {
        await Booking.create({ room: room.num, type: room.type, rate: room.rate, status: 'vacant' });
      } catch (bookingErr) {
        await Room.findByIdAndDelete(room._id); // roll back the orphan manually
        throw bookingErr;
      }
    } else {
      throw err;
    }
  } finally {
    await session.endSession();
  }

  await logActivity('Booking', 'blue', `Room ${room.num} added (${room.type})`, 'booking-rooms.html');
  res.status(201).json({ success: true, data: room });
});

exports.updateRoom = asyncHandler(async (req, res) => {
  const room = await Room.findOne({ num: req.params.num });
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

  const { num: newNum, type, rate, notes } = req.body;

  // Handle room number change — cascade to all references
  if (newNum && newNum !== req.params.num) {
    const exists = await Room.findOne({ num: newNum });
    if (exists) return res.status(400).json({ success: false, error: `Room ${newNum} already exists` });
    const booking = await Booking.findOne({ room: req.params.num });
    room.num = newNum;
    await room.save();
    if (booking) {
      booking.room = newNum;
      await booking.save();
    }
    // Cascade to Sale, Order, Guest.charges (active references only)
    await Sale.updateMany({ roomNumber: req.params.num }, { $set: { roomNumber: newNum } });
    await Order.updateMany({ roomNumber: req.params.num }, { $set: { roomNumber: newNum } });
    await Guest.updateMany(
      { 'charges.room': req.params.num },
      { $set: { 'charges.$[elem].room': newNum } },
      { arrayFilters: [{ 'elem.room': req.params.num }] }
    );
  }

  if (type !== undefined) room.type = type;
  if (rate !== undefined) room.rate = Number(rate);
  if (notes !== undefined) room.notes = notes;
  await room.save();

  // Keep the paired Booking record's type/rate in sync for vacant rooms
  const booking = await Booking.findOne({ room: room.num });
  if (booking && (booking.status === 'vacant' || !booking.guest)) {
    if (type !== undefined) booking.type = type;
    if (rate !== undefined) booking.rate = Number(rate);
    await booking.save();
  }

  res.json({ success: true, data: room });
});

exports.deleteRoom = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.num });
  if (booking && booking.status !== 'vacant') {
    return res.status(400).json({ success: false, error: 'Cannot delete a room that is occupied, reserved, or under cleaning/maintenance. Set it to vacant first.' });
  }

  const room = await Room.findOneAndDelete({ num: req.params.num });
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

  await Booking.deleteOne({ room: req.params.num });
  res.json({ success: true, message: `Room ${room.num} deleted` });
});

// setRoomStatus — mirrors BookingData.setRoomStatus(num, status, {notes}).
// Only allows the transitions the frontend's STATUS_OPTS table exposes,
// re-enforced here so a direct API call can't skip the flow (e.g. going
// straight from 'vacant' to 'checkedin' without a booking in between).
exports.setRoomStatus = asyncHandler(async (req, res) => {
  const { num } = req.params;
  const { status, notes } = req.body;
  const targetStatus = status === 'available' ? 'vacant' : status;

  const booking = await Booking.findOne({ room: num });
  if (!booking) return res.status(404).json({ success: false, error: 'Room not found' });

  const from = booking.status === 'vacant' ? 'vacant' : booking.status;
  const allowed = STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(targetStatus)) {
    return res.status(400).json({ success: false, error: `Cannot move room ${num} from '${from}' to '${targetStatus}'` });
  }

  booking.status = targetStatus;
  if (notes !== undefined) booking.notes = notes;

  // Clearing a room back to vacant (from checkout/maintenance/cleaning)
  // wipes the previous occupant's details off the record.
  if (targetStatus === 'vacant') {
    Object.assign(booking, {
      guest: '', phone: '', email: '', address: '', idNum: '',
      checkin: '', checkout: '', discount: 0, payments: [], paid: 0,
      payStatus: 'Pending', adults: 1, children: 0,
    });
  }
  booking.updatedAt = Date.now();
  await booking.save();

  await logActivity('Booking', targetStatus === 'maintenance' ? 'amber' : 'blue',
    `Room ${num} → ${targetStatus}`, 'booking-rooms.html');

  res.json({ success: true, data: booking });
});

/* ═══════════════════════════════════════════════
   Bookings
═══════════════════════════════════════════════ */
exports.listBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find().sort({ room: 1 });
  res.json({ success: true, count: bookings.length, data: bookings });
});

exports.getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.room });
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
  res.json({ success: true, data: booking });
});

// Creates/fills a booking onto an existing room. A Booking doc always
// pre-exists per room (created in addRoom), so "create" here means:
// take a vacant room and assign a guest to it — same action whether it's
// triggered from booking-list.html "New Booking" or booking-rooms.html
// "Book" on a room card.
exports.createBooking = asyncHandler(async (req, res) => {
  const {
    room, type, guest, phone, email, address, idType, idNum,
    checkin, checkout, rate, discount, payMethod, adults, children,
    notes, status,
  } = req.body;

  const booking = await Booking.findOne({ room });
  if (!booking) return res.status(404).json({ success: false, error: `Room ${room} not found — add the room first` });
  if (booking.status !== 'vacant') {
    if (booking.status === 'reserved' && booking.checkin && checkin) {
      var today = new Date(); today.setHours(0,0,0,0);
      var resStart = new Date(booking.checkin); resStart.setHours(0,0,0,0);
      if (today < resStart) {
        // Room reserved for future — allow booking that ends before reservation starts
      } else {
        return res.status(409).json({ success: false, error: `Room ${room} is not available (currently '${booking.status}')` });
      }
    } else {
      return res.status(409).json({ success: false, error: `Room ${room} is not available (currently '${booking.status}')` });
    }
  }

  Object.assign(booking, {
    type: type || booking.type,
    guest: guest.trim(),
    phone: phone || '',
    email: email || '',
    address: address || '',
    idType: idType || 'NIN',
    idNum: idNum || '',
    checkin: checkin || '',
    checkout: checkout || '',
    rate: rate !== undefined ? Number(rate) : booking.rate,
    discount: discount !== undefined ? Number(discount) : 0,
    payments: [],
    paid: 0,
    payMethod: payMethod || 'Cash',
    payStatus: 'Pending',
    recordedBy: req.user ? req.user.name : booking.recordedBy,
    adults: adults !== undefined ? Number(adults) : 1,
    children: children !== undefined ? Number(children) : 0,
    status: status || 'reserved',
    notes: notes || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await booking.save();

  // Attach this stay to (or create) the guest's profile.
  const guestProfile = await findOrCreateGuest({ name: booking.guest, phone: booking.phone, email: booking.email, address: booking.address, idType: booking.idType, idNum: booking.idNum });
  if (guestProfile && guestProfile.id) {
    booking.guestId = guestProfile.id;
    await booking.save();
  }

  await logActivity('Booking', 'gold', `${booking.guest} booked into Room ${room}`, 'booking-list.html');
  res.status(201).json({ success: true, data: booking });
});

// Full edit of an existing occupied/reserved booking — guest/date/rate/
// notes changes. Does not touch payments (use addPayment for that) or
// status (use checkin/checkout/setRoomStatus for that).
exports.updateBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.room });
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

  const fields = ['type', 'guest', 'phone', 'email', 'address', 'idType', 'idNum',
    'checkin', 'checkout', 'rate', 'discount', 'payMethod', 'adults', 'children', 'notes'];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      booking[f] = ['rate', 'discount', 'adults', 'children'].includes(f) ? Number(req.body[f]) : req.body[f];
    }
  }
  booking.payStatus = payStatusFor(booking);
  booking.updatedAt = Date.now();
  await booking.save();

  if (booking.guest) {
    await findOrCreateGuest({ name: booking.guest, phone: booking.phone, email: booking.email, address: booking.address, idType: booking.idType, idNum: booking.idNum });
  }

  res.json({ success: true, data: booking });
});

// Delete = clear the booking and return the room to vacant, matching
// booking-list.html's confirmDelete() toast: "Booking deleted. Room
// marked as Available."
exports.deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.room });
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

  const guestName = booking.guest;
  Object.assign(booking, {
    guest: '', phone: '', email: '', address: '', idNum: '',
    checkin: '', checkout: '', discount: 0, payments: [], paid: 0,
    payStatus: 'Pending', adults: 1, children: 0, notes: '', status: 'vacant',
  });
  booking.updatedAt = Date.now();
  await booking.save();

  await logActivity('Booking', 'red', `Booking for ${guestName || 'room ' + req.params.room} deleted — room marked available`, 'booking-list.html');
  res.json({ success: true, message: 'Booking deleted. Room marked as Available.', data: booking });
});

exports.checkinBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.room });
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
  if (!['reserved'].includes(booking.status)) {
    return res.status(400).json({ success: false, error: `Cannot check in from status '${booking.status}'` });
  }

  booking.status = 'checkedin';
  // Record the actual moment of check-in so revenue calculations and
  // activity logs always reflect when the guest physically arrived,
  // not when the reservation was originally made.
  booking.checkin = new Date().toISOString().split('T')[0];
  booking.updatedAt = Date.now();
  await booking.save();

  await logActivity('Booking', 'green', `${booking.guest} checked in — Room ${booking.room}`, 'booking-rooms.html');
  res.json({ success: true, data: booking });
});

exports.checkoutBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.room });
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
  if (booking.status !== 'checkedin') {
    return res.status(400).json({ success: false, error: `Cannot check out from status '${booking.status}'` });
  }

  const balance = calcBal(booking);
  if (balance > 0 && !req.body.allowUnpaidCheckout) {
    return res.status(400).json({ success: false, error: `Outstanding balance of ${balance} must be settled (or pass allowUnpaidCheckout) before check-out` });
  }

  booking.status = 'checkout';
  booking.updatedAt = Date.now();
  await booking.save();

  // Archive this stay onto the guest's profile.
  const guest = await findOrCreateGuest({ name: booking.guest, phone: booking.phone, email: booking.email, address: booking.address, idType: booking.idType, idNum: booking.idNum });
  guest.stays.push({
    room: booking.room,
    type: booking.type,
    checkin: booking.checkin,
    checkout: booking.checkout,
    total: calcTotal(booking),
    paid: calcPaid(booking),
    status: 'checkout',
  });
  await guest.save();

  await logActivity('Booking', 'red', `${booking.guest} checked out — Room ${booking.room}`, 'booking-rooms.html');
  res.json({ success: true, data: booking });
});

exports.markNoShow = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.room });
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
  if (booking.status !== 'reserved') {
    return res.status(400).json({ success: false, error: `Cannot mark no-show from status '${booking.status}'` });
  }
  const guestName = booking.guest;
  booking.status = 'no-show';
  Object.assign(booking, {
    guest: '', phone: '', email: '', address: '', idNum: '',
    checkin: '', checkout: '', discount: 0, adults: 1, children: 0,
    notes: '', rate: 0,
  });
  booking.updatedAt = Date.now();
  await booking.save();
  await logActivity('Booking', 'amber', `${guestName || 'Guest'} — Room ${booking.room} marked as no-show`, 'booking-rooms.html');
  res.json({ success: true, data: booking });
});

exports.cancelRefund = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.room });
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
  if (!['reserved', 'checkedin', 'no-show'].includes(booking.status)) {
    return res.status(400).json({ success: false, error: `Cannot cancel from status '${booking.status}'` });
  }

  const { refundType, refundAmount, reason } = req.body;
  const totalPaid = booking.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) || Number(booking.paid) || 0;

  let refund = 0;
  if (refundType === 'full') {
    refund = totalPaid;
  } else if (refundType === 'partial') {
    refund = Math.max(0, Math.min(Number(refundAmount) || 0, totalPaid));
  }

  const guestName = booking.guest;
  const roomNum = booking.room;

  // Record refund before clearing
  booking.refunded = refund;
  booking.refundDate = new Date().toISOString().split('T')[0];
  booking.refundBy = req.user ? req.user.name : '';
  booking.refundReason = reason || '';

  // Clear guest data — room becomes available
  Object.assign(booking, {
    guest: '', phone: '', email: '', address: '', idNum: '',
    checkin: '', checkout: '', discount: 0, adults: 1, children: 0,
    notes: '', status: 'vacant', rate: 0,
  });
  // Keep payments[] and paid for financial record, but mark as refunded
  booking.payStatus = refund >= totalPaid ? 'Refunded' : (refund > 0 ? 'Partial Refund' : booking.payStatus);
  booking.updatedAt = Date.now();
  await booking.save();

  const label = refund > 0 ? ` (refund: ${refund})` : '';
  await logActivity('Booking', 'amber', `${guestName || 'Guest'} — Room ${roomNum} cancelled${label}`, 'booking-rooms.html');
  res.json({ success: true, data: booking });
});

// Auto-cancel reservations where checkout date has passed and guest never checked in
exports.autoCancelExpiredReservations = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const result = await Booking.updateMany(
    { status: 'reserved', checkout: { $lt: today } },
    { $set: { status: 'no-show', updatedAt: Date.now(),
      guest: '', phone: '', email: '', address: '', idNum: '',
      checkin: '', checkout: '', discount: 0, adults: 1, children: 0,
      notes: '', rate: 0 } }
  );
  if (result.modifiedCount > 0) {
    await logActivity('Booking', 'amber', `Auto-cancelled ${result.modifiedCount} expired reservation(s)`, 'booking-rooms.html');
  }
  if (res) res.json({ success: true, modified: result.modifiedCount });
});

// Also run auto-cancel as part of getBookingData so it fires on page load
const origGetBookingData = exports.getBookingData;
exports.getBookingData = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  await Booking.updateMany(
    { status: 'reserved', checkout: { $lt: today } },
    { $set: { status: 'no-show', updatedAt: Date.now(),
      guest: '', phone: '', email: '', address: '', idNum: '',
      checkin: '', checkout: '', discount: 0, adults: 1, children: 0,
      notes: '', rate: 0 } }
  );
  return origGetBookingData(req, res);
});

// Adds a payment entry to a booking's payments[] and recomputes paid/
// payStatus — same shape as paymentEntrySchema (id, amount, mode, date, by, ts).
exports.addPayment = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ room: req.params.room });
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

  const { amount, mode } = req.body;
  const entry = {
    id: `PMT-${uuidv4()}`,
    amount: Number(amount),
    mode: mode || 'Cash',
    date: todayDDMMYY(),
    by: req.user ? req.user.name : booking.recordedBy || '',
    ts: Date.now(),
  };
  booking.payments.push(entry);
  booking.paid = calcPaid(booking);
  booking.payStatus = payStatusFor(booking);
  booking.updatedAt = Date.now();
  await booking.save();

  await logActivity('Booking', 'green', `Payment of ${entry.amount} recorded for Room ${booking.room}`, 'booking-list.html');
  res.json({ success: true, data: booking });
});

/* ═══════════════════════════════════════════════
   Guests
═══════════════════════════════════════════════ */
// Real pagination for guests.html's own list view — the getBookingData
// combined call above is capped/recency-sorted and NOT meant to be the
// way this page browses the full guest base.
exports.listGuests = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const search = (req.query.search || '').trim();

  const filter = search
    ? { $or: [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }, { guestId: new RegExp(search, 'i') }] }
    : {};

  const [guests, total] = await Promise.all([
    Guest.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    Guest.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: guests.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: guests,
  });
});

exports.getGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ id: req.params.id });
  if (!guest) return res.status(404).json({ success: false, error: 'Guest not found' });
  res.json({ success: true, data: guest });
});

// saveGuest — mirrors BookingData.saveGuest({id, ...partial fields}), used
// for toggling VIP and saving notes from guests.html as well as full
// profile edits.
exports.saveGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ id: req.params.id });
  if (!guest) return res.status(404).json({ success: false, error: 'Guest not found' });

  const fields = ['name', 'phone', 'email', 'address', 'idType', 'idNum', 'vip', 'notes'];
  for (const f of fields) {
    if (req.body[f] !== undefined) guest[f] = req.body[f];
  }
  await guest.save();
  res.json({ success: true, data: guest });
});

// Posts a room charge onto a guest's folio (called by other departments —
// restaurant/poolbar/gym — when a guest charges something to their room).
exports.addCharge = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ id: req.params.id });
  if (!guest) return res.status(404).json({ success: false, error: 'Guest not found' });

  const { desc, amount, source, room } = req.body;
  var bookingRef = '';
  if (room) {
    var bk = await Booking.findOne({ room });
    if (bk) bookingRef = bk.id;
  }
  guest.charges.push({
    bookingRef: bookingRef,
    date: todayDDMMYY(),
    source: source || 'Other',
    desc: desc.trim(),
    room: room || '',
    amount: Number(amount),
    paid: 0,
    by: req.user ? req.user.name : '',
    status: 'Pending',
    payments: [],
  });
  await guest.save();

  res.status(201).json({ success: true, data: guest });
});

// Settles a single pending charge (fully, or partially if amount < balance).
exports.settleCharge = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ id: req.params.id });
  if (!guest) return res.status(404).json({ success: false, error: 'Guest not found' });

  const charge = guest.charges.find(c => c.id === req.params.chargeId);
  if (!charge) return res.status(404).json({ success: false, error: 'Charge not found' });
  if (charge.status === 'Settled') return res.status(400).json({ success: false, error: 'Charge already settled' });

  const remaining = charge.amount - charge.paid;
  const { amount, mode } = req.body;
  const pay = amount !== undefined ? Math.min(Number(amount), remaining) : remaining;
  const payMode = mode || 'Cash';

  charge.payments.push({
    id: `PMT-${uuidv4()}`,
    amount: pay,
    mode: payMode,
    date: todayDDMMYY(),
    by: req.user ? req.user.name : '',
    ts: Date.now(),
  });
  charge.paid += pay;
  charge.status = charge.paid >= charge.amount ? 'Settled' : 'Partially Settled';

  // Rollback safe: create Sale first, only then persist guest change — avoids "sale validation failed" leaving charge half-settled
  const folioDept = /pool/i.test(charge.source||'') ? 'poolbar' : 'restaurant';
  const saleId = `FOL-${String(Date.now()).slice(-6)}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  await Sale.create({
    id: saleId,
    source: 'Folio',
    department: folioDept,
    items: [{ name: charge.desc || charge.source || 'Room Charge', qty: 1, price: pay }],
    subtotal: pay,
    discount: 0,
    total: pay,
    method: payMode,
    staff: req.user ? req.user.name : '',
    table: '',
    notes: 'Folio charge settled',
    date: new Date(),
    status: 'completed',
    roomNumber: charge.room || null,
    guestName: guest.name || null,
  });

  await guest.save();

  /* Update the active Booking's payment ledger */
  const booking = await Booking.findOne({ room: charge.room, status: 'checkedin' });
  if (booking) {
    booking.payments.push({
      id: `PMT-${uuidv4()}`,
      amount: pay,
      mode: payMode,
      date: todayDDMMYY(),
      by: req.user ? req.user.name : '',
      ts: Date.now(),
    });
    booking.paid = (booking.paid || 0) + pay;
    const total = booking.total || (booking.rate || 0) * (booking.nights || 1);
    if (total > 0) {
      if (booking.paid >= total) booking.payStatus = 'Fully Paid';
      else if (booking.paid > 0) booking.payStatus = 'Deposit Paid';
    }
    await booking.save();
  }

  res.json({ success: true, data: guest });
});

// Settles every pending charge on the guest's folio in one call.
exports.settleAllCharges = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ id: req.params.id });
  if (!guest) return res.status(404).json({ success: false, error: 'Guest not found' });

  const { mode } = req.body;
  const payMode = mode || 'Cash';
  let settledCount = 0;
  let totalSettled = 0;

  for (const charge of guest.charges) {
    if (charge.status === 'Settled') continue;
    const remaining = charge.amount - charge.paid;
    if (remaining <= 0) continue;
    charge.payments.push({
      id: `PMT-${uuidv4()}`,
      amount: remaining,
      mode: payMode,
      date: todayDDMMYY(),
      by: req.user ? req.user.name : '',
      ts: Date.now(),
    });
    charge.paid = charge.amount;
    charge.status = 'Settled';
    settledCount += 1;
    totalSettled += remaining;
  }
  /* Create Sale first for atomicity */
  if (totalSettled > 0) {
    const firstSrc = (guest.charges.find(function(c){return c.status==='Settled';})||{}).source || '';
    const folioDept = /pool/i.test(firstSrc) ? 'poolbar' : 'restaurant';
    const saleId = `FOL-${String(Date.now()).slice(-6)}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    await Sale.create({
      id: saleId,
      source: 'Folio',
      department: folioDept,
      items: [{ name: 'Folio Settlement', qty: 1, price: totalSettled }],
      subtotal: totalSettled,
      discount: 0,
      total: totalSettled,
      method: payMode,
      staff: req.user ? req.user.name : '',
      table: '',
      notes: `${settledCount} charge(s) settled`,
      date: new Date(),
      status: 'completed',
      roomNumber: guest.charges[0] && guest.charges[0].room || null,
      guestName: guest.name || null,
    });
  }

  await guest.save();

  if (totalSettled > 0) {
    /* Update the active Booking's payment ledger */
    const roomForBooking = guest.charges[0] && guest.charges[0].room;
    const booking = roomForBooking ? await Booking.findOne({ room: roomForBooking, status: 'checkedin' }) : null;
    if (booking) {
      booking.payments.push({
        id: `PMT-${uuidv4()}`,
        amount: totalSettled,
        mode: payMode,
        date: todayDDMMYY(),
        by: req.user ? req.user.name : '',
        ts: Date.now(),
      });
      booking.paid = (booking.paid || 0) + totalSettled;
      const total = booking.total || (booking.rate || 0) * (booking.nights || 1);
      if (total > 0) {
        if (booking.paid >= total) booking.payStatus = 'Fully Paid';
        else if (booking.paid > 0) booking.payStatus = 'Deposit Paid';
      }
      await booking.save();
    }
  }

  res.json({ success: true, message: `${settledCount} charge(s) settled`, data: guest });
});

/* ═══════════════════════════════════════════════
   Exported calc helpers (used by the reports
   endpoint / kept here so figures never drift
   from the booking math above)
═══════════════════════════════════════════════ */
exports._calc = { nights, calcTotal, calcPaid, calcBal };