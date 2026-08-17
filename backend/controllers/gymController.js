const GymPlan = require('../models/GymPlan');
const GymMember = require('../models/GymMember');
const GymCheckin = require('../models/GymCheckin');
const Sale = require('../models/Sale');
const asyncHandler = require('../middleware/asyncHandler');

/* ── PLANS ── */

// @desc    Get all gym plans
// @route   GET /api/gym/plans
exports.listPlans = asyncHandler(async (req, res) => {
  const plans = await GymPlan.find();
  res.json(plans);
});

// @desc    Create a gym plan
// @route   POST /api/gym/plans
exports.createPlan = asyncHandler(async (req, res) => {
  const plan = await GymPlan.create(req.body);
  res.status(201).json(plan);
});

// @desc    Update a gym plan by id
// @route   PUT /api/gym/plans/:id
exports.updatePlan = asyncHandler(async (req, res) => {
  const plan = await GymPlan.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!plan) {
    return res.status(404).json({ message: 'Plan not found' });
  }
  res.json(plan);
});

// @desc    Delete a gym plan by id
// @route   DELETE /api/gym/plans/:id
exports.deletePlan = asyncHandler(async (req, res) => {
  const plan = await GymPlan.findByIdAndDelete(req.params.id);
  if (!plan) {
    return res.status(404).json({ message: 'Plan not found' });
  }
  res.json({ message: 'Plan removed' });
});

/* ── MEMBERS ── */

// @desc    Get all gym members
// @route   GET /api/gym/members
exports.listMembers = asyncHandler(async (req, res) => {
  const members = await GymMember.find().populate('plan');
  res.json(members);
});

// @desc    Create a gym member
// @route   POST /api/gym/members
exports.createMember = asyncHandler(async (req, res) => {
  const { planName } = req.body;
  const plan = await GymPlan.findOne({ name: planName });
  if (!plan) {
    return res.status(404).json({ message: 'Plan not found' });
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 86400000);

  const member = await GymMember.create({
    ...req.body,
    plan: plan._id,
    planName: plan.name,
    startDate,
    endDate,
  });
  res.status(201).json(member);
});

// @desc    Update a gym member by id
// @route   PUT /api/gym/members/:id
exports.updateMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }
  res.json(member);
});

// @desc    Delete a gym member by id
// @route   DELETE /api/gym/members/:id
exports.deleteMember = asyncHandler(async (req, res) => {
  const member = await GymMember.findByIdAndDelete(req.params.id);
  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }
  res.json({ message: 'Member removed' });
});

/* ── CHECK-INS ── */

// @desc    Get all gym check-ins (optional ?date filter)
// @route   GET /api/gym/checkins
exports.listCheckins = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.date) {
    const start = new Date(req.query.date);
    const end = new Date(req.query.date);
    end.setHours(23, 59, 59, 999);
    filter.date = { $gte: start, $lte: end };
  }
  const checkins = await GymCheckin.find(filter).sort({ date: -1 });
  res.json(checkins);
});

// @desc    Create a gym check-in
// @route   POST /api/gym/checkins
exports.createCheckin = asyncHandler(async (req, res) => {
  const checkin = await GymCheckin.create(req.body);

  if (req.body.member) {
    await GymMember.findByIdAndUpdate(req.body.member, {
      $inc: { totalCheckins: 1 },
    });
  }

  res.status(201).json(checkin);
});

/* ── REVENUE ── */

// @desc    Get gym revenue by plan type for a date range
// @route   GET /api/gym/revenue
exports.revenue = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const members = await GymMember.find(filter).populate('plan');

  const revenueByPlan = {};
  members.forEach((m) => {
    const name = m.planName || (m.plan && m.plan.name) || 'Unknown';
    const amount = m.plan ? m.plan.price : 0;
    if (!revenueByPlan[name]) {
      revenueByPlan[name] = { count: 0, total: 0 };
    }
    revenueByPlan[name].count += 1;
    revenueByPlan[name].total += amount;
  });

  res.json(revenueByPlan);
});
