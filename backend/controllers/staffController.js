const Staff = require('../models/Staff');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

const USER_DEPARTMENTS = [
  'Management', 'Front Desk', 'Housekeeping', 'Restaurant',
  'Kitchen', 'Pool Bar', 'Gym', 'Store', 'Procurement', 'Accounts',
];

function sanitizeDept(raw) {
  if (!raw) return 'Front Desk';
  const match = USER_DEPARTMENTS.find(d => d.toLowerCase() === String(raw).toLowerCase());
  return match || 'Front Desk';
}

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
  const { name, email, phone, role, dept, department, shift, status, salary, hireDate, privileges, password } = req.body;
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

  let loginCreated = false, loginNote = '';
  if (password && email) {
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    console.log('[staff] createStaff login check:', { email: email.toLowerCase().trim(), hasPassword: !!password, emailExists: !!existingUser });
    if (!existingUser) {
      const pType = (privileges && privileges.type) || null;
      const pOverrides = (privileges && privileges.overrides) || {};
      const pScopes = Array.isArray(privileges && privileges.supervisorScopes) ? privileges.supervisorScopes : [];
      const userRole = ['admin','manager','supervisor'].includes(role) ? role : 'staff';
      const priv = { type: pType, overrides: pOverrides };
      if (pScopes.length) priv.supervisorScopes = pScopes;
      await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: userRole,
        privileges: priv,
        department: sanitizeDept(department || dept),
        phone: phone || '',
        initials: name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2),
      });
      loginCreated = true;
      console.log('[staff] login User created:', { email: email.toLowerCase().trim(), role: userRole });
    } else {
      loginNote = 'A login already exists for this email — staff saved, but sign-in still uses the OLD password.';
      console.log('[staff] login NOT created (email already has a User):', email.toLowerCase().trim());
    }
  } else {
    loginNote = 'No login created (email or password missing) — staff saved without sign-in access.';
    console.log('[staff] login NOT created (missing email/password):', { hasEmail: !!email, hasPassword: !!password });
  }

  const out = staff.toObject();
  out._login = { created: loginCreated, note: loginNote };
  res.status(201).json({ success: true, data: out });
});

exports.updateStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found' });

  const { name, email, phone, role, dept, department, shift, status, salary, hireDate, privileges, password } = req.body;
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

  if (password && staff.email) {
    const user = await User.findOne({ email: staff.email.toLowerCase() });
    if (user) {
      user.password = password;
      if (name) user.name = name.trim();
      if (role) user.role = ['admin','manager','supervisor'].includes(role) ? role : 'staff';
      if (privileges !== undefined) {
        const pScopes = Array.isArray(privileges.supervisorScopes) ? privileges.supervisorScopes : undefined;
        if (pScopes !== undefined) {
          user.privileges = user.privileges || {};
          user.privileges.supervisorScopes = pScopes;
          if (privileges.type !== undefined) user.privileges.type = privileges.type;
          if (privileges.overrides !== undefined) user.privileges.overrides = privileges.overrides;
          user.markModified('privileges');
        } else {
          user.privileges = privileges;
        }
      }
      if (department || dept) user.department = sanitizeDept(department || dept);
      await user.save();
    }
  } else if (name || role || privileges !== undefined || department || dept) {
    const user = await User.findOne({ email: staff.email.toLowerCase() });
    if (user) {
      if (name) user.name = name.trim();
      if (role) user.role = ['admin','manager','supervisor'].includes(role) ? role : 'staff';
      if (privileges !== undefined) {
        const pScopes = Array.isArray(privileges.supervisorScopes) ? privileges.supervisorScopes : undefined;
        if (pScopes !== undefined) {
          user.privileges = user.privileges || {};
          user.privileges.supervisorScopes = pScopes;
          if (privileges.type !== undefined) user.privileges.type = privileges.type;
          if (privileges.overrides !== undefined) user.privileges.overrides = privileges.overrides;
          user.markModified('privileges');
        } else {
          user.privileges = privileges;
        }
      }
      if (department || dept) user.department = sanitizeDept(department || dept);
      await user.save();
    }
  }

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

exports.updateOverrides = asyncHandler(async (req, res) => {
  const { overrides } = req.body;
  if (!overrides || typeof overrides !== 'object') {
    return res.status(400).json({ success: false, error: 'overrides object is required' });
  }

  const staff = await Staff.findById(req.params.id);
  if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found' });

  // Patch only overrides — preserving type, supervisorScopes, etc.
  if (!staff.privileges) staff.privileges = {};
  staff.privileges = Object.assign({}, staff.privileges, { overrides });
  await staff.save();

  // Sync to User document
  const user = await User.findOne({ email: staff.email.toLowerCase() });
  if (user) {
    if (!user.privileges) user.privileges = {};
    user.privileges.overrides = overrides;
    user.markModified('privileges');
    await user.save();
  }

  res.json({ success: true, data: staff });
});
