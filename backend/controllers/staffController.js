const Staff = require('../database/models/Staff');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/staff
exports.listStaff = asyncHandler(async (req, res) => {
  const { department, status, q } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { role: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
    ];
  }
  const staffMembers = await Staff.find(filter).sort({ name: 1 });
  res.json(staffMembers);
});

// GET /api/staff/:id
exports.getStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findOne({ id: req.params.id });
  if (!staff) throw new ApiError(404, 'Staff member not found');
  res.json(staff);
});

// POST /api/staff
exports.createStaff = asyncHandler(async (req, res) => {
  const { name, role, department, shift, status, baseSalary, phone, email } = req.body;
  if (!name || !role) throw new ApiError(400, 'name and role are required');

  const staff = await Staff.create({
    name,
    role,
    department: department || 'General',
    shift: shift || 'Morning',
    status: status || 'on_duty',
    baseSalary: Number(baseSalary) || 0,
    phone: phone || '',
    email: email || '',
  });

  res.status(201).json(staff);
});

// PUT /api/staff/:id
exports.updateStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findOne({ id: req.params.id });
  if (!staff) throw new ApiError(404, 'Staff member not found');

  const { name, role, department, shift, status, baseSalary, phone, email } = req.body;
  if (name !== undefined) staff.name = name;
  if (role !== undefined) staff.role = role;
  if (department !== undefined) staff.department = department;
  if (shift !== undefined) staff.shift = shift;
  if (status !== undefined) staff.status = status;
  if (baseSalary !== undefined) staff.baseSalary = Number(baseSalary);
  if (phone !== undefined) staff.phone = phone;
  if (email !== undefined) staff.email = email;

  await staff.save();
  res.json(staff);
});

// DELETE /api/staff/:id
exports.deleteStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findOne({ id: req.params.id });
  if (!staff) throw new ApiError(404, 'Staff member not found');
  await staff.deleteOne();
  res.json({ ok: true });
});
