const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const activities = await Activity.find().sort({ createdAt: -1 }).limit(50);
  res.json(activities);
});

exports.create = asyncHandler(async (req, res) => {
  const activity = await Activity.create(req.body);
  res.status(201).json(activity);
});
