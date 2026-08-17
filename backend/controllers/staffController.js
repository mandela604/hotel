const Staff = require('../models/Staff');
const asyncHandler = require('../middleware/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const staff = await Staff.find().sort({ name: 1 });
  res.json(staff);
});

exports.create = asyncHandler(async (req, res) => {
  const staff = await Staff.create(req.body);
  res.status(201).json(staff);
});

exports.update = asyncHandler(async (req, res) => {
  const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!staff) return res.status(404).json({ message: 'Staff not found' });
  res.json(staff);
});

exports.remove = asyncHandler(async (req, res) => {
  const staff = await Staff.findByIdAndDelete(req.params.id);
  if (!staff) return res.status(404).json({ message: 'Staff not found' });
  res.json({ ok: true });
});

exports.updatePermissions = asyncHandler(async (req, res) => {
  const staff = await Staff.findByIdAndUpdate(
    req.params.id,
    { privileges: req.body.permissions },
    { new: true, runValidators: true }
  );
  if (!staff) return res.status(404).json({ message: 'Staff not found' });
  res.json(staff);
});
