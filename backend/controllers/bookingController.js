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
const NO_SHOW_FIELDS = {
  guest: '', phone: '', email: '', address: '', idNum: '',
  checkin: '', checkout: '', discount: 0, adults: 1, children: 0,
  notes: '', rate: 0,
};
function calcTotal(b) {
  const n = nights(b.checkin, b.checkout) || 1;
  return Math.max(0, ((b.rate || 0) - (b.discount || 0)) * n);
}
function calcPaid(b) {
  const raw = (b.payments || []).reduce((s, p) => s + (p.amount || 0), 0) || b.paid || 0;
  return Math.max(0, raw - (Number(b.refunded) || 0));
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

exports.getActiveBookingForRoom = asyncHandler(async (req, res) => {
  const room = (req.query.room || '').trim();
  if (!room) return res.status(400).json({ success: false, error: 'room query param required' });
  const booking = await Booking.findOne({ room, status: { $in: ['reserved', 'checkedin'] } }).sort({ createdAt: -1 });
  if (!booking) return res.status(404).json({ success: false, error: 'No active booking for this room' });
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
    stayId: uuidv4(),
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
  booking.checkin = new Date().toISOString().split('T')[0];
  booking.updatedAt = Date.now();

  // Backfill guestId if missing — ensures room charge lookups always work
  if (!booking.guestId && booking.guest) {
    const gp = await findOrCreateGuest({ name: booking.guest, phone: booking.phone, email: booking.email, address: booking.address, idType: booking.idType, idNum: booking.idNum });
    if (gp && gp.id) booking.guestId = gp.id;
  }

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
  booking._guestName = guestName;
  booking.status = 'no-show';
  Object.assign(booking, NO_SHOW_FIELDS);
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
  booking._guestName = guestName;

  // Record refund before clearing
  booking.refunded = refund;
  booking.refundDate = new Date().toISOString().split('T')[0];
  booking.refundBy = req.user ? req.user.name : '';
  booking.refundReason = reason || '';

  // Keep original booking data (rate, dates) for accurate revenue reporting.
  // Only clear guest PII and set status to cancelled.
  Object.assign(booking, {
    guest: '', phone: '', email: '', address: '', idNum: '',
    status: 'cancelled',
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
    { $set: Object.assign({ status: 'no-show', updatedAt: Date.now() }, NO_SHOW_FIELDS) }
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
    { $set: Object.assign({ status: 'no-show', updatedAt: Date.now() }, NO_SHOW_FIELDS) }
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

  /* Update the original Room Charge Sale to completed + paidDate */
  if (charge.originalSaleId) {
    const origSale = await Sale.findOne({ id: charge.originalSaleId });
    if (origSale) {
      origSale.status = 'completed';
      origSale.paidDate = new Date();
      await origSale.save();
    }
  }

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

    /* Update the original Room Charge Sale to completed + paidDate */
    if (charge.originalSaleId) {
      const origSale = await Sale.findOne({ id: charge.originalSaleId });
      if (origSale) {
        origSale.status = 'completed';
        origSale.paidDate = new Date();
        await origSale.save();
      }
    }
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
   GET /reports — filter-aware KPIs + filtered bookings
   All filtering + KPI computation happens server-side
   so figures always match between cards and table.
═══════════════════════════════════════════════ */
exports.getReports = asyncHandler(async (req, res) => {
  const { period, status, payment, staff, dateFrom, dateTo, search, clientDate } = req.query;

  // Build report from Guest.stays[] (historical) + active Bookings (current)
  const [allGuests, activeBookings] = await Promise.all([
    Guest.find({}).select('name phone guestId stays').lean(),
    Booking.find({
      $or: [
        { status: { $in: ['checkedin', 'reserved', 'cleaning', 'maintenance'] } },
        { 'payments.0': { $exists: true } },
      ]
    }).lean(),
  ]);
  console.log(`[Reports] Guests: ${allGuests.length}, ActiveBookings: ${activeBookings.length}, clientDate: ${clientDate}, period: ${period}`);
  console.log(`[Reports] Active bookings:`, activeBookings.map(b => ({ room: b.room, guest: b.guest, status: b.status, checkin: b.checkin })));

  // Flatten Guest stays into booking-shaped objects
  let stays = [];
  for (const g of allGuests) {
    for (const s of (g.stays || [])) {
      const n = nights(s.checkin, s.checkout) || 1;
      stays.push({
        room: s.room, type: s.type, guest: g.name, phone: g.phone || '',
        checkin: s.checkin, checkout: s.checkout,
        rate: n > 0 ? Math.round((s.total || 0) / n) : 0,
        discount: 0,
        total: s.total || 0, paid: s.paid || 0, status: s.status || '',
        recordedBy: '', payStatus: (s.paid || 0) >= (s.total || 0) ? 'Fully Paid' : (s.paid || 0) > 0 ? 'Deposit Paid' : 'Pending',
        refunded: 0, payments: [], notes: '', createdAt: 0,
      });
    }
  }

  // Merge active bookings (some may already be in Guest.stays, skip duplicates by room+checkin)
  const existingKeys = new Set(stays.map(s => s.room + '|' + s.checkin));
  for (const b of activeBookings) {
    const key = b.room + '|' + b.checkin;
    if (!existingKeys.has(key)) {
      stays.push({
        room: b.room, type: b.type, guest: b._guestName || b.guest || '', phone: b.phone || '',
        checkin: b.checkin || '', checkout: b.checkout || '',
        total: calcTotal(b), paid: calcPaid(b), status: b.status || '',
        recordedBy: b.recordedBy || '', payStatus: b.payStatus || 'Pending',
        discount: b.discount || 0, refunded: b.refunded || 0,
        payments: b.payments || [], notes: b.notes || '',
        createdAt: b.createdAt || 0,
      });
    }
  }
  console.log(`[Reports] Total stays after merge: ${stays.length}`);

  // Period shortcut
  let start = null, end = null;
  const baseDay = clientDate ? new Date(clientDate + 'T12:00:00') : new Date();
  const today = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), 0, 0, 0, 0);
  if (period === 'today') {
    start = new Date(today); end = new Date(today);
    end.setHours(23,59,59,999);
  } else if (period === '7d') {
    start = new Date(today); start.setDate(start.getDate() - 6);
    end = new Date(today); end.setHours(23,59,59,999);
  } else if (period === '30d') {
    start = new Date(today); start.setDate(start.getDate() - 29);
    end = new Date(today); end.setHours(23,59,59,999);
  }
  if (dateFrom) { start = new Date(dateFrom); start.setHours(0,0,0,0); }
  if (dateTo) { end = new Date(dateTo); end.setHours(23,59,59,999); }

  const filtered = stays.filter(b => {
    if (status && b.status !== status) return false;
    if (payment && b.payStatus !== payment) return false;
    if (staff && b.recordedBy !== staff) return false;
    if (search) {
      const q = search.toLowerCase().trim();
      const hit = (b.room||'').toLowerCase().includes(q) || (b.guest||'').toLowerCase().includes(q) ||
        (b.type||'').toLowerCase().includes(q) || (b.phone||'').toLowerCase().includes(q) ||
        (b.recordedBy||'').toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (start && end) {
      const ci = b.checkin ? new Date(b.checkin) : null;
      const co = b.checkout ? new Date(b.checkout) : ci;
      if (!ci) return false;
      if (ci > end || (co ? co < start : ci < start)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  console.log(`[Reports] Filtered: ${filtered.length} records (first 3:`, filtered.slice(0,3).map(b => ({room:b.room,guest:b.guest,createdAt:b.createdAt})), ')');

  const totRev = filtered.reduce((s, b) => s + (b.total || 0), 0);
  const totRefunded = filtered.reduce((s, b) => s + (Number(b.refunded) || 0), 0);
  const netRev = totRev - totRefunded;
  const totPaid = filtered.reduce((s, b) => s + (b.paid || 0), 0);
  const totBal = filtered.reduce((s, b) => s + Math.max(0, (b.total || 0) - (b.paid || 0)), 0);
  const nightsCount = filtered.reduce((s, b) => s + (nights(b.checkin, b.checkout) || 0), 0);
  const fullyPaid = filtered.filter(b => b.payStatus === 'Fully Paid').length;

  res.json({
    success: true,
    data: {
      bookings: filtered,
      kpis: {
        totalRevenue: netRev,
        collected: totPaid,
        balanceDue: totBal,
        totalNights: nightsCount,
        fullyPaidCount: fullyPaid,
        totalCount: filtered.length,
        refundedTotal: totRefunded,
      },
    },
  });
});

/* ═══════════════════════════════════════════════
   Exported calc helpers (used by the reports
   endpoint / kept here so figures never drift
   from the booking math above)
═══════════════════════════════════════════════ */
exports._calc = { nights, calcTotal, calcPaid, calcBal };

/* ── Room Payment Report — payment-level transaction rows ── */
exports.getRoomIncome = asyncHandler(async (req, res) => {
  const { period, dateFrom, dateTo, roomType, paymentMethod, paymentType, guestType, clientDate, page: pg, limit: lim } = req.query;
  const pageNum = Math.max(1, parseInt(pg, 10) || 1);
  const pageLimit = Math.min(100, Math.max(1, parseInt(lim, 10) || 20));
  console.log(`[RoomIncome] Query: period=${period} dateFrom=${dateFrom} dateTo=${dateTo} roomType=${roomType} method=${paymentMethod} type=${paymentType} clientDate=${clientDate}`);

  const allBookings = await Booking.find({}).lean();
  console.log(`[RoomIncome] Found ${allBookings.length} bookings`);

  /* ── Flatten each Booking.payments[] into individual transaction rows ── */
  let rows = [];
  let seq = 0;
  for (const b of allBookings) {
    const total = calcTotal(b);
    const payments = b.payments || [];
    let cumulative = 0;

    const isRefunded = Number(b.refunded) > 0;
    const isFullRefund = isRefunded && Number(b.refunded) >= total && total > 0;
    const guestLabel = b._guestName || b.guest || '';

    for (const p of payments) {
      const amtBefore = cumulative;
      cumulative += (p.amount || 0);
      let pType = 'Deposit';
      if (cumulative >= total && total > 0) {
        pType = amtBefore > 0 ? 'Balance Payment' : 'Full Payment';
      } else if (amtBefore > 0) {
        pType = 'Balance Payment';
      }

      if (isRefunded) {
        pType = isFullRefund ? 'Refunded' : 'Partial Refund';
      }

      seq++;
      rows.push({
        sn: seq, date: p.date || '',
        receiptNo: 'RCP-' + String(seq).padStart(5, '0'),
        guest: guestLabel, bookingNo: b.stayId || b.room || '',
        room: b.room || '', roomType: b.type || '',
        paymentType: pType, paymentMethod: p.mode || 'Cash',
        referenceNo: p.id || '', amount: p.amount || 0,
        remarks: isFullRefund
          ? 'Refunded in full'
          : isRefunded
            ? `Refunded: ₦${Number(b.refunded).toLocaleString()}`
            : pType === 'Full Payment' ? 'Full payment' : pType === 'Deposit' ? 'Advance payment' : 'Balance payment',
        cashier: p.by || '',
      });
    }
    if (isRefunded) {
      seq++;
      rows.push({
        sn: seq, date: b.refundDate || '',
        receiptNo: 'RCP-' + String(seq).padStart(5, '0'),
        guest: guestLabel, bookingNo: b.stayId || b.room || '',
        room: b.room || '', roomType: b.type || '',
        paymentType: 'Refund', paymentMethod: 'Refund',
        referenceNo: '', amount: -(Number(b.refunded)),
        remarks: b.refundReason || 'Refund', cashier: b.refundBy || '',
      });
    }
  }
  console.log(`[RoomIncome] Built ${rows.length} transaction rows`);

  /* ── Date filter (on payment date) ── */
  function parseDDMMYY(s) {
    if (!s) return null;
    var parts = s.split(/[/\-.]/);
    if (parts.length < 3) return null;
    var d = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    return new Date(y, m, d);
  }
  if (period && period !== 'all') {
    const base = clientDate ? new Date(clientDate + 'T12:00:00') : new Date();
    const baseDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
    let start, end;
    if (period === 'today') { start = baseDate; end = todayEnd; }
    else if (period === '7d') { start = new Date(baseDate); start.setDate(start.getDate() - 6); end = todayEnd; }
    else if (period === '30d') { start = new Date(baseDate); start.setDate(start.getDate() - 29); end = todayEnd; }
    console.log(`[RoomIncome] Period filter: period=${period} clientDate=${clientDate} start=${start.toISOString()} end=${end.toISOString()}`);
    if (start && end) {
      const sTime = start.getTime(), eTime = end.getTime();
      rows = rows.filter(r => { if (!r.date) return false; var d = parseDDMMYY(r.date); return d && d.getTime() >= sTime && d.getTime() <= eTime; });
    }
  }
  if (dateFrom || dateTo) {
    const sTime = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : 0;
    const eTime = dateTo ? new Date(dateTo + 'T23:59:59.999').getTime() : Date.now();
    rows = rows.filter(r => { if (!r.date) return false; var d = parseDDMMYY(r.date); return d && d.getTime() >= sTime && d.getTime() <= eTime; });
  }
  if (roomType) rows = rows.filter(r => r.roomType === roomType);
  if (paymentMethod) rows = rows.filter(r => r.paymentMethod === paymentMethod);
  if (paymentType) rows = rows.filter(r => r.paymentType === paymentType);
  rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  /* ── KPIs ── */
  const nonRefund = rows.filter(r => r.paymentType !== 'Refund');
  const refundRows = rows.filter(r => r.paymentType === 'Refund');
  const totalPayments = nonRefund.reduce((s, r) => s + r.amount, 0);
  const totalRefunds = Math.abs(refundRows.reduce((s, r) => s + r.amount, 0));
  const netCollections = totalPayments - totalRefunds;
  const txCount = nonRefund.length;
  const cashRows = nonRefund.filter(r => r.paymentMethod === 'Cash');
  const posRows = nonRefund.filter(r => r.paymentMethod === 'POS');
  const transferRows = nonRefund.filter(r => r.paymentMethod === 'Transfer');

  /* ── Summary tables ── */
  const byMethod = {};
  for (const r of nonRefund) {
    if (!byMethod[r.paymentMethod]) byMethod[r.paymentMethod] = { method: r.paymentMethod, count: 0, amount: 0 };
    byMethod[r.paymentMethod].count++; byMethod[r.paymentMethod].amount += r.amount;
  }
  const byType = {};
  for (const r of rows) {
    if (!byType[r.paymentType]) byType[r.paymentType] = { type: r.paymentType, count: 0, amount: 0 };
    byType[r.paymentType].count++; byType[r.paymentType].amount += Math.abs(r.amount);
  }
  const byRoomType = {};
  for (const r of nonRefund) {
    if (!byRoomType[r.roomType]) byRoomType[r.roomType] = { type: r.roomType, count: 0, amount: 0 };
    byRoomType[r.roomType].count++; byRoomType[r.roomType].amount += r.amount;
  }

  const totalCount = rows.length;
  const totalPages = Math.ceil(totalCount / pageLimit) || 1;
  const paged = rows.slice((pageNum - 1) * pageLimit, pageNum * pageLimit);
  console.log(`[RoomIncome] Result: ${totalCount} rows, net=${netCollections}, tx=${txCount}`);

  res.json({
    success: true,
    data: {
      rows: paged,
      kpis: {
        totalPayments, totalRefunds, netCollections, txCount,
        cashTotal: cashRows.reduce((s,r)=>s+r.amount,0), cashCount: cashRows.length,
        posTotal: posRows.reduce((s,r)=>s+r.amount,0), posCount: posRows.length,
        transferTotal: transferRows.reduce((s,r)=>s+r.amount,0), transferCount: transferRows.length,
        refundCount: refundRows.length,
      },
      summary: { methodSummary: Object.values(byMethod).sort((a,b)=>b.amount-a.amount), typeSummary: Object.values(byType).sort((a,b)=>b.amount-a.amount), roomTypeSummary: Object.values(byRoomType).sort((a,b)=>b.amount-a.amount) },
      page: pageNum, pages: totalPages, total: totalCount,
    },
  });
});