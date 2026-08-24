const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

const GymPlan = require('../models/GymPlan');
const GymMember = require('../models/GymMember');
const GymCheckin = require('../models/GymCheckin');
const GymGuest = require('../models/GymGuest');

function actorName(req) {
  return (req.user && (req.user.name || req.user.role)) || 'Gym Attendant';
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function nowStamp() {
  const d = new Date();
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${pad2(h12)}:${pad2(d.getMinutes())} ${ampm}`;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function computeStatus(member) {
  if (!member.planId) return 'expired';
  if (member.status === 'frozen') return 'frozen';
  const days = daysUntil(member.expiry);
  if (days === null) return 'active';
  if (days < 0) return 'expired';
  if (days <= 7) return 'expiring';
  return 'active';
}

/* ═══════════════ Plans ═══════════════ */

exports.listPlans = asyncHandler(async (req, res) => {
  const rows = await GymPlan.find({}).sort({ price: 1 });
  res.json({ success: true, data: rows });
});

exports.createPlan = asyncHandler(async (req, res) => {
  const { name, price, durationDays, notes, color } = req.body;
  const exists = await GymPlan.findOne({ name: new RegExp('^' + name.trim() + '$', 'i') });
  if (exists) throw new ApiError(409, `A plan named "${name}" already exists.`);
  const plan = await GymPlan.create({
    name: name.trim(),
    price: Number(price) || 0,
    durationDays: Number(durationDays) || 30,
    notes: (notes || '').trim(),
    color: color || 'blue',
  });
  res.status(201).json({ success: true, data: plan });
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const plan = await GymPlan.findOneAndUpdate(
    { id: req.params.id },
    req.body,
    { new: true, runValidators: true }
  );
  if (!plan) throw new ApiError(404, 'Plan not found.');
  res.json({ success: true, data: plan });
});

exports.deletePlan = asyncHandler(async (req, res) => {
  const inUse = await GymMember.exists({ planId: req.params.id });
  if (inUse) throw new ApiError(409, 'Cannot delete – members are still on this plan.');
  const plan = await GymPlan.findOneAndDelete({ id: req.params.id });
  if (!plan) throw new ApiError(404, 'Plan not found.');
  res.json({ success: true, data: { deleted: true } });
});

/* ═══════════════ Members ═══════════════ */

exports.listMembers = asyncHandler(async (req, res) => {
  const rows = await GymMember.find({}).sort({ createdAt: -1 });
  res.json({ success: true, data: rows.map((m) => ({ ...m.toObject(), _status: computeStatus(m) })) });
});

exports.createMember = asyncHandler(async (req, res) => {
  const { name, planId, room, phone, joined, expiry, notes, status, totalDue } = req.body;
  const member = await GymMember.create({
    name: name.trim(),
    planId: planId || null,
    room: (room || '').trim(),
    phone: (phone || '').trim(),
    joined: joined || todayISO(),
    expiry: expiry || '',
    notes: (notes || '').trim(),
    status: status || 'active',
    totalDue: Number(totalDue) || 0,
    payments: [],
  });
  res.status(201).json({ success: true, data: member });
});

exports.updateMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ id: req.params.id });
  if (!member) throw new ApiError(404, 'Member not found.');
  const { name, planId, room, phone, joined, expiry, notes, status, totalDue } = req.body;
  if (name !== undefined) member.name = name.trim();
  if (planId !== undefined) member.planId = planId || null;
  if (room !== undefined) member.room = room.trim();
  if (phone !== undefined) member.phone = phone.trim();
  if (joined !== undefined) member.joined = joined;
  if (expiry !== undefined) member.expiry = expiry;
  if (notes !== undefined) member.notes = notes.trim();
  if (status !== undefined) member.status = status;
  if (totalDue !== undefined) member.totalDue = Number(totalDue);
  await member.save();
  res.json({ success: true, data: member });
});

exports.deleteMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findOneAndDelete({ id: req.params.id });
  if (!member) throw new ApiError(404, 'Member not found.');
  res.json({ success: true, data: { deleted: true } });
});

exports.addMemberPayment = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ id: req.params.id });
  if (!member) throw new ApiError(404, 'Member not found.');
  const { amount, mode, by, roomNumber, guestName, guestPhone } = req.body;

  const payment = {
    amount: Number(amount),
    mode: mode || 'Cash',
    by: by || actorName(req),
    date: nowStamp(),
    ts: Date.now(),
    roomNumber: roomNumber || null,
    guestName: guestName || null,
    guestPhone: guestPhone || null,
  };
  member.payments.push(payment);
  await member.save();

  res.status(201).json({
    success: true,
    data: member,
    folioPosted: false,
    ...(payment.mode === 'Room Charge' ? { warning: 'Room Charge recorded locally — Booking-folio integration is not wired up on this backend yet.' } : {}),
  });
});

exports.renewMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ id: req.params.id });
  if (!member) throw new ApiError(404, 'Member not found.');
  member.expiry = req.body.newExpiry;
  member.status = 'active';
  await member.save();
  res.json({ success: true, data: member });
});

/* ═══════════════ Check-ins ═══════════════ */

exports.listCheckins = asyncHandler(async (req, res) => {
  const rows = await GymCheckin.find({}).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data: rows });
});

exports.createCheckin = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ id: req.body.memberId });
  if (!member) throw new ApiError(404, 'Member not found.');

  const status = computeStatus(member);
  if (status === 'expired') throw new ApiError(400, 'Cannot check in – membership expired.');
  if (status === 'frozen') throw new ApiError(400, 'Cannot check in – membership frozen.');

  const time = new Date().toISOString();
  member.checkins = (member.checkins || 0) + 1;
  member.lastCheckin = time;
  await member.save();

  const checkin = await GymCheckin.create({ memberId: member.id, memberName: member.name, time });
  res.status(201).json({ success: true, data: checkin });
});

/* ═══════════════ Guests ═══════════════ */

exports.listGuests = asyncHandler(async (req, res) => {
  const rows = await GymGuest.find({}).sort({ createdAt: -1 });
  res.json({ success: true, data: rows });
});

exports.createGuest = asyncHandler(async (req, res) => {
  const { name, room, phone } = req.body;
  const guest = await GymGuest.create({ name: name.trim(), room: (room || '').trim(), phone: (phone || '').trim() });
  res.status(201).json({ success: true, data: guest });
});

exports.deleteGuest = asyncHandler(async (req, res) => {
  const guest = await GymGuest.findOneAndDelete({ id: req.params.id });
  if (!guest) throw new ApiError(404, 'Guest not found.');
  res.json({ success: true, data: { deleted: true } });
});

/* ═══════════════ Revenue report ═══════════════ */

exports.revenue = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const [members, checkins, plans] = await Promise.all([
    GymMember.find({}),
    GymCheckin.find({}),
    GymPlan.find({}),
  ]);
  // ✅ Key by plan.id (custom id), not _id
  const planMap = {};
  plans.forEach((p) => { planMap[p.id] = p; });

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  };

  const newMembers = members.filter((m) => inRange(m.joined));
  const checkinsInRange = checkins.filter((c) => inRange((c.time || '').split('T')[0]));

  const revenueByPlan = {};
  let totalRevenue = 0;
  newMembers.forEach((m) => {
    const plan = planMap[m.planId] || { id: 'none', name: 'No Plan', price: 0 };
    const key = plan.id;
    if (!revenueByPlan[key]) revenueByPlan[key] = { plan, count: 0, subtotal: 0 };
    revenueByPlan[key].count++;
    revenueByPlan[key].subtotal += plan.price || 0;
    totalRevenue += plan.price || 0;
  });

  const activeMembers = members.filter((m) => {
    if (!m.planId) return false;
    if (m.status === 'frozen') return false;
    const days = daysUntil(m.expiry);
    return days !== null && days >= 0;
  }).length;

  res.json({
    success: true,
    data: {
      period: { from: from || null, to: to || null },
      totalRevenue,
      newMembersCount: newMembers.length,
      checkinsCount: checkinsInRange.length,
      activeMembers,
      revenueByPlan: Object.values(revenueByPlan),
      newMembers,
    },
  });
});