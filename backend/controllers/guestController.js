const mongoose = require('mongoose');
const Guest = require('../models/Guest');
const Booking = require('../models/Booking');
const RoomCharge = require('../models/RoomCharge');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const { total, balance } = require('../utils/calc');

function stayFromBooking(b) {
  return {
    room: b.room,
    type: b.roomType,
    checkin: b.checkin ? new Date(b.checkin).toISOString().split('T')[0] : '',
    checkout: b.checkout ? new Date(b.checkout).toISOString().split('T')[0] : '',
    total: total(b),
    paid: b.paid || 0,
    status: b.status,
  };
}

function chargeOut(c) {
  const o = c.toObject ? c.toObject() : c;
  return {
    id: String(o._id),
    date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
    source: o.source,
    desc: o.desc,
    room: o.room,
    amount: o.amount,
    by: o.by,
    status: o.status,
  };
}

async function computeGuestPayload(guest) {
  const [bookings, charges] = await Promise.all([
    Booking.find({ phone: guest.phone, status: { $ne: 'cancelled' } }).sort({ checkin: -1 }),
    RoomCharge.find({ guestPhone: guest.phone }).sort({ date: -1 }),
  ]);

  const stays = bookings.map(stayFromBooking);
  const roomRevenue = bookings.reduce((s, b) => s + total(b), 0);
  const roomPaid = bookings.reduce((s, b) => s + (b.paid || 0), 0);
  const chargeTotal = charges.reduce((s, c) => s + c.amount, 0);
  const chargeOutstanding = charges.filter((c) => c.status === 'Pending').reduce((s, c) => s + c.amount, 0);
  const outstanding = Math.max(0, roomRevenue - roomPaid) + chargeOutstanding;
  const activeStay = bookings.find((b) => b.status === 'checkedin');

  return {
    id: String(guest._id),
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    idType: guest.idType,
    idNum: guest.idNum,
    vip: guest.vip,
    notes: guest.notes,
    currentRoom: activeStay ? activeStay.room : null,
    stayCount: stays.length,
    returning: stays.length > 1,
    roomRevenue,
    roomPaid,
    chargeTotal,
    chargeOutstanding,
    outstanding,
    spend: roomRevenue + chargeTotal,
    stays,
    charges: charges.map(chargeOut),
  };
}

// GET /api/guests?q=&filter=vip|returning|new|balance&page=&limit=
exports.listGuests = asyncHandler(async (req, res) => {
  const { q, filter, page = 1, limit = 20 } = req.query;
  const match = {};
  if (q) {
    match.$or = [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }];
  }

  const guests = await Guest.find(match).sort({ createdAt: -1 });
  let payloads = await Promise.all(guests.map(computeGuestPayload));

  if (filter === 'vip') payloads = payloads.filter((g) => g.vip);
  else if (filter === 'returning') payloads = payloads.filter((g) => g.returning);
  else if (filter === 'new') payloads = payloads.filter((g) => !g.returning && !g.vip);
  else if (filter === 'balance') payloads = payloads.filter((g) => g.outstanding > 0);

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const start = (pageNum - 1) * pageSize;
  const pageItems = payloads.slice(start, start + pageSize);

  res.json({
    data: pageItems,
    page: pageNum,
    limit: pageSize,
    total: payloads.length,
    totalPages: Math.max(1, Math.ceil(payloads.length / pageSize)),
    kpis: {
      totalGuests: payloads.length,
      vip: payloads.filter((g) => g.vip).length,
      returning: payloads.filter((g) => g.returning).length,
      outstandingGuests: payloads.filter((g) => g.outstanding > 0).length,
      outstandingSum: payloads.reduce((s, g) => s + g.outstanding, 0),
    },
  });
});

// GET /api/guests/:id
exports.getGuest = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid guest id');
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found');
  res.json(await computeGuestPayload(guest));
});

// PATCH /api/guests/:id   { vip?, notes? }
exports.updateGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found');
  if (req.body.vip !== undefined) guest.vip = !!req.body.vip;
  if (req.body.notes !== undefined) guest.notes = req.body.notes;
  await guest.save();
  res.json(await computeGuestPayload(guest));
});

// POST /api/guests/:id/charges
exports.addCharge = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found');

  const { source, desc, room, amount, by, date } = req.body;
  if (!desc || !amount) throw new ApiError(400, 'desc and amount are required');

  const charge = await RoomCharge.create({
    guestPhone: guest.phone,
    guestName: guest.name,
    date: date ? new Date(date) : new Date(),
    source: source || 'Other',
    desc,
    room: room || '',
    amount: Number(amount),
    by: by || '',
    status: 'Pending',
  });

  res.status(201).json(chargeOut(charge));
});

// PATCH /api/guests/:id/charges/:chargeId  { status: 'Settled' }
exports.settleCharge = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found');
  const charge = await RoomCharge.findOne({ _id: req.params.chargeId, guestPhone: guest.phone });
  if (!charge) throw new ApiError(404, 'Charge not found');
  charge.status = 'Settled';
  await charge.save();
  res.json(chargeOut(charge));
});

// PATCH /api/guests/:id/charges/settle-all
exports.settleAllCharges = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found');
  const result = await RoomCharge.updateMany(
    { guestPhone: guest.phone, status: 'Pending' },
    { $set: { status: 'Settled' } }
  );
  res.json({ ok: true, settled: result.modifiedCount });
});
