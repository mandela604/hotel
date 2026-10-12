const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  // Optional filters (all additive — bare GET keeps the old latest-50 behavior)
  const { dept, search, from, to } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const filter = {};
  if (dept) filter.dept = dept;
  if (search) filter.text = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from + 'T00:00:00');
    if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59.999');
  }
  const [rows, total] = await Promise.all([
    Activity.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Activity.countDocuments(filter),
  ]);
  res.json({ success: true, count: rows.length, total, page, pages: Math.ceil(total / limit) || 1, data: rows });
});

exports.create = asyncHandler(async (req, res) => {
  const activity = await Activity.create({
    ...req.body,
    by: (req.user ? req.user.name : req.body.by) || 'System',
  });
  res.status(201).json({ success: true, data: activity });
});
