const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const activities = await Activity.find().sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, count: activities.length, data: activities });
});

exports.create = asyncHandler(async (req, res) => {
  const activity = await Activity.create({
    ...req.body,
    by: (req.user ? req.user.name : req.body.by) || 'System',
  });
  res.status(201).json({ success: true, data: activity });
});
