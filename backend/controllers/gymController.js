/**
 * Grace Hotel — Gym Controller (Centralized Gym Module Controller)
 * Handles Members, Plans, Check-ins, Payments, Dashboard Stats, and Gym Reports.
 */

const GymMember = require('../database/models/GymMember');
const GymPlan = require('../database/models/GymPlan');
const GymCheckin = require('../database/models/GymCheckin');
const Payment = require('../database/models/Payment');
const Sale = require('../database/models/Sale');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

/* ═══════════════════════════════════════════
   1. MEMBERS
═══════════════════════════════════════════ */

// GET /api/members (or /api/gym/members)
exports.listMembers = asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
    ];
  }
  const members = await GymMember.find(filter).sort({ name: 1 });
  res.json(members);
});

// GET /api/members/:id
exports.getMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!member) throw new ApiError(404, 'Member not found');
  res.json(member);
});

// POST /api/members
exports.createMember = asyncHandler(async (req, res) => {
  const { name, planId, startDate, endDate, durationDays, phone, email, notes, emergencyContact } = req.body;
  if (!name || !planId) throw new ApiError(400, 'name and planId are required');

  const start = startDate ? new Date(startDate) : new Date();
  let end = endDate ? new Date(endDate) : null;
  if (!end) {
    const days = Number(durationDays) || 30;
    end = new Date(start.getTime() + days * 86400000);
  }

  const member = await GymMember.create({
    name,
    planId,
    startDate: start,
    endDate: end,
    status: 'active',
    phone: phone || '',
    email: email || '',
    notes: notes || '',
    emergencyContact: emergencyContact || '',
  });

  res.status(201).json(member);
});

// PUT /api/members/:id
exports.updateMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!member) throw new ApiError(404, 'Member not found');

  const { name, planId, startDate, endDate, status, phone, email, notes, emergencyContact } = req.body;
  if (name !== undefined) member.name = name;
  if (planId !== undefined) member.planId = planId;
  if (startDate !== undefined) member.startDate = new Date(startDate);
  if (endDate !== undefined) member.endDate = new Date(endDate);
  if (status !== undefined) member.status = status;
  if (phone !== undefined) member.phone = phone;
  if (email !== undefined) member.email = email;
  if (notes !== undefined) member.notes = notes;
  if (emergencyContact !== undefined) member.emergencyContact = emergencyContact;

  await member.save();
  res.json(member);
});

// DELETE /api/members/:id
exports.deleteMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!member) throw new ApiError(404, 'Member not found');
  await member.deleteOne();
  res.json({ ok: true });
});

// POST /api/members/:id/renew
exports.renewMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!member) throw new ApiError(404, 'Member not found');

  const { newEndDate, durationDays, amount, method } = req.body;
  let end = newEndDate ? new Date(newEndDate) : null;
  if (!end) {
    const base = member.endDate > new Date() ? new Date(member.endDate) : new Date();
    const days = Number(durationDays) || 30;
    end = new Date(base.getTime() + days * 86400000);
  }

  member.endDate = end;
  member.status = 'active';
  await member.save();

  if (amount && Number(amount) > 0) {
    await Payment.create({
      memberId: member.id,
      memberName: member.name,
      planId: member.planId,
      amount: Number(amount),
      method: method || 'Cash',
      ref: `RNW-${Date.now()}`,
      notes: `Renewal until ${end.toISOString().split('T')[0]}`,
    });
  }

  res.json(member);
});

// POST /api/members/:id/checkin
exports.checkinMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!member) throw new ApiError(404, 'Member not found');

  if (member.status === 'expired' || member.endDate < new Date()) {
    throw new ApiError(400, 'Cannot check in — membership has expired. Please renew first.');
  }
  if (member.status === 'suspended' || member.status === 'inactive') {
    throw new ApiError(400, `Cannot check in — membership is ${member.status}.`);
  }

  const now = new Date();
  member.visits = (member.visits || 0) + 1;
  member.checkins = (member.checkins || 0) + 1;
  member.lastCheckin = now;
  await member.save();

  const checkin = await GymCheckin.create({
    memberId: member.id,
    memberName: member.name,
    date: now,
    time: now.toTimeString().split(' ')[0],
  });

  res.status(201).json({ member, checkin });
});

// PUT /api/members/:id/status
exports.updateMemberStatus = asyncHandler(async (req, res) => {
  const member = await GymMember.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!member) throw new ApiError(404, 'Member not found');

  const { status } = req.body;
  const allowed = ['active', 'expired', 'suspended', 'inactive'];
  if (!allowed.includes(status)) throw new ApiError(400, `status must be one of: ${allowed.join(', ')}`);

  member.status = status;
  await member.save();
  res.json(member);
});

/* ═══════════════════════════════════════════
   2. PLANS
═══════════════════════════════════════════ */

// GET /api/plans
exports.listPlans = asyncHandler(async (req, res) => {
  const plans = await GymPlan.find().sort({ price: 1 });
  res.json(plans);
});

// GET /api/plans/:id
exports.getPlan = asyncHandler(async (req, res) => {
  const plan = await GymPlan.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!plan) throw new ApiError(404, 'Plan not found');
  res.json(plan);
});

// POST /api/plans
exports.createPlan = asyncHandler(async (req, res) => {
  const { name, price, durationDays, durationMonths, description, benefits, features, notes } = req.body;
  if (!name || price === undefined) throw new ApiError(400, 'name and price are required');

  const plan = await GymPlan.create({
    name,
    price: Number(price),
    durationDays: Number(durationDays) || 30,
    durationMonths: Number(durationMonths) || 1,
    description: description || '',
    benefits: benefits || '',
    features: features || [],
    notes: notes || '',
  });

  res.status(201).json(plan);
});

// PUT /api/plans/:id
exports.updatePlan = asyncHandler(async (req, res) => {
  const plan = await GymPlan.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!plan) throw new ApiError(404, 'Plan not found');

  const { name, price, durationDays, durationMonths, description, benefits, features, notes } = req.body;
  if (name !== undefined) plan.name = name;
  if (price !== undefined) plan.price = Number(price);
  if (durationDays !== undefined) plan.durationDays = Number(durationDays);
  if (durationMonths !== undefined) plan.durationMonths = Number(durationMonths);
  if (description !== undefined) plan.description = description;
  if (benefits !== undefined) plan.benefits = benefits;
  if (features !== undefined) plan.features = features;
  if (notes !== undefined) plan.notes = notes;

  await plan.save();
  res.json(plan);
});

// DELETE /api/plans/:id
exports.deletePlan = asyncHandler(async (req, res) => {
  const plan = await GymPlan.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
  if (!plan) throw new ApiError(404, 'Plan not found');
  await plan.deleteOne();
  res.json({ ok: true });
});

/* ═══════════════════════════════════════════
   3. CHECK-INS
═══════════════════════════════════════════ */

// GET /api/checkins
exports.listCheckins = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const filter = {};
  if (date) {
    const d = new Date(date);
    filter.date = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
  }
  const checkins = await GymCheckin.find(filter).sort({ date: -1 });
  res.json(checkins);
});

// POST /api/checkins
exports.createCheckin = asyncHandler(async (req, res) => {
  const { memberId, memberName, date, time, notes } = req.body;
  if (!memberId) throw new ApiError(400, 'memberId is required');

  const member = await GymMember.findOne({ $or: [{ id: memberId }, { _id: memberId }] });
  if (member) {
    if (member.status === 'expired' || member.endDate < new Date()) {
      throw new ApiError(400, 'Cannot check in — membership has expired.');
    }
    if (member.status === 'suspended' || member.status === 'inactive') {
      throw new ApiError(400, `Cannot check in — membership is ${member.status}.`);
    }

    member.visits = (member.visits || 0) + 1;
    member.checkins = (member.checkins || 0) + 1;
    member.lastCheckin = new Date();
    await member.save();
  }

  const now = new Date();
  const checkin = await GymCheckin.create({
    memberId,
    memberName: memberName || (member ? member.name : 'Member'),
    date: date ? new Date(date) : now,
    time: time || now.toTimeString().split(' ')[0],
    notes: notes || '',
  });

  res.status(201).json(checkin);
});

// GET /api/checkins/member/:memberId
exports.getMemberCheckins = asyncHandler(async (req, res) => {
  const checkins = await GymCheckin.find({ memberId: req.params.memberId }).sort({ date: -1 });
  res.json(checkins);
});

/* ═══════════════════════════════════════════
   4. PAYMENTS
═══════════════════════════════════════════ */

// POST /api/payments
exports.createPayment = asyncHandler(async (req, res) => {
  const { memberId, planId, amount, method, notes } = req.body;
  if (!memberId || amount === undefined) throw new ApiError(400, 'memberId and amount are required');

  const member = await GymMember.findOne({ $or: [{ id: memberId }, { _id: memberId }] });

  const payment = await Payment.create({
    memberId,
    memberName: member ? member.name : '',
    planId: planId || (member ? member.planId : ''),
    amount: Number(amount),
    method: method || 'Cash',
    ref: `PAY-${Date.now()}`,
    notes: notes || '',
    date: new Date(),
  });

  res.status(201).json(payment);
});

// GET /api/payments/member/:memberId
exports.getMemberPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ memberId: req.params.memberId }).sort({ date: -1 });
  res.json(payments);
});

// GET /api/payments/plan/:planId
exports.getPlanPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ planId: req.params.planId }).sort({ date: -1 });
  res.json(payments);
});

/* ═══════════════════════════════════════════
   5. DASHBOARD & STATS
═══════════════════════════════════════════ */

// GET /api/dashboard/stats
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [totalMembers, activeMembers, expiredMembers, checkinsToday, payments] = await Promise.all([
    GymMember.countDocuments(),
    GymMember.countDocuments({ status: 'active' }),
    GymMember.countDocuments({ status: 'expired' }),
    GymCheckin.countDocuments({ date: { $gte: todayStart } }),
    Payment.find(),
  ]);

  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  res.json({
    totalMembers,
    activeMembers,
    expiredMembers,
    checkinsToday,
    totalRevenue,
  });
});

// GET /api/dashboard/revenue
exports.getDashboardRevenue = asyncHandler(async (req, res) => {
  const payments = await Payment.find().sort({ date: 1 });
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  res.json({
    totalRevenue,
    payments,
  });
});

/* ═══════════════════════════════════════════
   6. REPORTS
═══════════════════════════════════════════ */

// GET /api/reports/checkins
exports.getCheckinReports = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const checkins = await GymCheckin.find(filter).sort({ date: -1 });
  res.json({ total: checkins.length, data: checkins });
});

// GET /api/reports/members
exports.getMemberReports = asyncHandler(async (req, res) => {
  const [total, active, expired, suspended] = await Promise.all([
    GymMember.countDocuments(),
    GymMember.countDocuments({ status: 'active' }),
    GymMember.countDocuments({ status: 'expired' }),
    GymMember.countDocuments({ status: 'suspended' }),
  ]);
  const members = await GymMember.find().sort({ createdAt: -1 });
  res.json({ totals: { total, active, expired, suspended }, data: members });
});

// GET /api/reports/revenue
exports.getRevenueReports = asyncHandler(async (req, res) => {
  const [payments, sales] = await Promise.all([
    Payment.find().sort({ date: -1 }),
    Sale.find({ status: 'completed' }).sort({ createdAt: -1 }),
  ]);
  const gymRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const posRevenue = sales.reduce((s, p) => s + (p.total || 0), 0);
  res.json({ gymRevenue, posRevenue, totalRevenue: gymRevenue + posRevenue, payments, sales });
});
