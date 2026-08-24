const Staff = require('../models/Staff');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

exports.listStaff = asyncHandler(async (req, res) => {
  const { dept, shift, status, search } = req.query;
  const filter = {};
  if (dept) filter.department = dept;
  if (shift) filter.shift = shift;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { role: new RegExp(search, 'i') },
      { staffCode: new RegExp(search, 'i') },
    ];
  }
  const list = await Staff.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.getStaffById = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found' });
  res.json({ success: true, data: staff });
});

exports.createStaff = asyncHandler(async (req, res) => {
  const { name, email, phone, role, dept, department, shift, status, salary, hireDate, privileges } = req.body;
  if (!name || !role) {
    return res.status(400).json({ success: false, error: 'Name and role are required' });
  }

  const count = await Staff.countDocuments();
  const staffCode = `STF-${String(count + 1).padStart(4, '0')}`;

  const staff = await Staff.create({
    staffCode,
    name: name.trim(),
    email: email ? email.toLowerCase().trim() : '',
    phone: phone || '',
    role: role.trim(),
    department: department || dept || 'General',
    dept: dept || department || 'General',
    shift: shift || 'Morning',
    status: status || 'on_duty',
    salary: Number(salary) || 0,
    hireDate: hireDate || new Date().toISOString().slice(0, 10),
    privileges: privileges || {},
  });

  res.status(201).json({ success: true, data: staff });
});

exports.updateStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found' });

  const { name, email, phone, role, dept, department, shift, status, salary, hireDate, privileges } = req.body;
  if (name) staff.name = name.trim();
  if (email !== undefined) staff.email = email.toLowerCase().trim();
  if (phone !== undefined) staff.phone = phone;
  if (role) staff.role = role.trim();
  if (department || dept) {
    staff.department = department || dept;
    staff.dept = dept || department;
  }
  if (shift) staff.shift = shift;
  if (status) staff.status = status;
  if (salary !== undefined) staff.salary = Number(salary);
  if (hireDate !== undefined) staff.hireDate = hireDate;
  if (privileges !== undefined) staff.privileges = privileges;

  await staff.save();
  res.json({ success: true, data: staff });
});

exports.deleteStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findByIdAndDelete(req.params.id);
  if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found' });
  res.json({ success: true, message: `Staff member "${staff.name}" removed` });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ success: false, error: 'Status is required' });

  const staff = await Staff.findById(req.params.id);
  if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found' });

  staff.status = status;
  await staff.save();
  res.json({ success: true, data: staff });
});
