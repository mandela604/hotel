const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { ApiError } = require('../middleware/errorHandler');
const { ensureGuest } = require('./guestService');

const ACTIVE_STATUSES = ['reserved', 'checkedin']; // occupies/holds the room

async function getRoomOrThrow(num) {
  const room = await Room.findOne({ num });
  if (!room) throw new ApiError(404, `Room ${num} does not exist`);
  return room;
}

/**
 * Create a new booking for a room. Fails if the room is currently held by
 * another active (reserved/checkedin) booking.
 */
async function createBooking(payload) {
  const room = await getRoomOrThrow(payload.room);

  if (room.currentBooking) {
    const existing = await Booking.findById(room.currentBooking);
    if (existing && ACTIVE_STATUSES.includes(existing.status)) {
      throw new ApiError(409, `Room ${room.num} is already ${existing.status}. Check the guest out or cancel first.`);
    }
  }

  const booking = await Booking.create({
    room: room.num,
    roomType: payload.roomType || room.type,
    guest: payload.guest,
    phone: payload.phone,
    email: payload.email,
    idType: payload.idType,
    idNum: payload.idNum,
    checkin: payload.checkin,
    checkout: payload.checkout,
    rate: payload.rate ?? room.rate,
    discount: payload.discount,
    paid: payload.paid,
    payMethod: payload.payMethod,
    payStatus: payload.payStatus,
    recordedBy: payload.recordedBy,
    adults: payload.adults,
    children: payload.children,
    notes: payload.notes,
    status: payload.status || 'reserved',
  });

  room.status = booking.status === 'checkedin' ? 'checkedin' : 'reserved';
  room.currentBooking = booking._id;
  room.notes = '';
  await room.save();

  await ensureGuest(booking);

  return booking;
}

/** Update an existing booking's editable fields (does not change status). */
async function updateBooking(id, payload) {
  const booking = await Booking.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');

  const editable = [
    'guest', 'phone', 'email', 'idType', 'idNum', 'checkin', 'checkout',
    'rate', 'discount', 'paid', 'payMethod', 'payStatus', 'recordedBy',
    'adults', 'children', 'notes',
  ];
  for (const key of editable) {
    if (payload[key] !== undefined) booking[key] = payload[key];
  }
  await booking.save();
  await ensureGuest(booking);
  return booking;
}

/** Transition a booking's status (reserved -> checkedin -> checkout, or -> cancelled). */
async function setBookingStatus(id, status, { reason } = {}) {
  const booking = await Booking.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');

  const room = await Room.findOne({ num: booking.room });
  if (!room) throw new ApiError(404, `Room ${booking.room} does not exist`);

  booking.status = status;
  if (status === 'cancelled' && reason) booking.cancelReason = reason;
  await booking.save();

  const isCurrent = room.currentBooking && String(room.currentBooking) === String(booking._id);

  if (status === 'checkedin') {
    room.status = 'checkedin';
    room.currentBooking = booking._id;
  } else if (status === 'checkout') {
    room.status = 'checkout'; // needs housekeeping before it can be re-booked
    if (isCurrent) room.currentBooking = booking._id; // keep reference until freed
  } else if (status === 'cancelled') {
    if (isCurrent) {
      room.status = 'available';
      room.currentBooking = null;
    }
  } else if (status === 'reserved') {
    room.status = 'reserved';
    room.currentBooking = booking._id;
  }
  await room.save();

  return booking;
}

/** Free a room after checkout/housekeeping — marks it available for new bookings. */
async function freeRoom(num, { notes = '' } = {}) {
  const room = await getRoomOrThrow(num);
  room.status = 'available';
  room.currentBooking = null;
  room.notes = notes;
  await room.save();
  return room;
}

/** Put a room on/off maintenance directly (no booking involved). */
async function setRoomMaintenance(num, on, notes = '') {
  const room = await getRoomOrThrow(num);
  if (on) {
    room.status = 'maintenance';
    room.notes = notes;
  } else {
    room.status = 'available';
    room.currentBooking = null;
    room.notes = '';
  }
  await room.save();
  return room;
}

module.exports = {
  ACTIVE_STATUSES,
  createBooking,
  updateBooking,
  setBookingStatus,
  freeRoom,
  setRoomMaintenance,
  getRoomOrThrow,
};
