const Staff = require('../models/Staff');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

const USER_DEPARTMENTS = [
  'Management', 'Front Desk', 'Housekeeping', 'Laundry', 'Restaurant',
  'Kitchen', 'Pool Bar', 'Gym', 'Store', 'Procurement', 'Accounts', 'Barbeque',
];

function sanitizeDept(raw) {
  if (!raw) return 'Front Desk';
  // Match ignoring case AND spacing so 'poolbar' / 'pool bar' / 'Pool Bar'
  // all resolve to the canonical department instead of silently dropping
  // to the Front Desk fallback (which made HR and login records diverge).
  const norm = String(raw).toLowerCase().replace(/\s+/g, '');
  // Multi-department staff (e.g. a waiter on both "Pool Bar, Restaurant"):
  // keep every valid part instead of collapsing the whole string to Front Desk.
  const parts = norm.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    const matched = parts
      .map(p => USER_DEPARTMENTS.find(d => d.toLowerCase().replace(/\s+/g, '') === p))
      .filter(Boolean);
    if (matched.length) return matched.join(', ');
  }
  const match = USER_DEPARTMENTS.find(d => d.toLowerCase().replace(/\s+/g, '') === norm);
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

  // Normalize ONCE and use for BOTH the HR record and the login account —
  // the two documents must never diverge on email or department (a past
  // bug wrote different values into each, making the login unreachable).
  const normEmail = email ? email.toLowerCase().trim() : '';
  const normDept = sanitizeDept(department || dept);

  const staff = await Staff.create({
    staffCode,
    name: name.trim(),
    email: normEmail,
    phone: phone || '',
    role: role.trim(),
    department: normDept,
    dept: normDept,
    shift: shift || 'Morning',
    status: status || 'on_duty',
    salary: Number(salary) || 0,
    hireDate: hireDate || new Date().toISOString().slice(0, 10),
    privileges: privileges || {},
  });

  let loginCreated = false, loginNote = '';
  if (password && normEmail) {
    const existingUser = await User.findOne({ email: normEmail });
    console.log('[staff] createStaff login check:', { email: normEmail, hasPassword: !!password, emailExists: !!existingUser });
    const pType = (privileges && privileges.type) || null;
    const pOverrides = (privileges && privileges.overrides) || {};
    const pScopes = Array.isArray(privileges && privileges.supervisorScopes) ? privileges.supervisorScopes : [];
    const userRole = ['admin','manager','supervisor'].includes(role) ? role : 'staff';
    const priv = { type: pType, overrides: pOverrides };
    if (pScopes.length) priv.supervisorScopes = pScopes;
    const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    if (!existingUser) {
      await User.create({
        name: name.trim(),
        email: normEmail,
        password,
        role: userRole,
        privileges: priv,
        department: normDept,
        phone: phone || '',
        initials,
      });
      loginCreated = true;
      console.log('[staff] login User created:', { email: normEmail, role: userRole });
    } else {
      // A login already exists for this email — update it so the password
      // entered here actually works (previously the new password was dropped).
      existingUser.name = name.trim();
      existingUser.password = password;
      existingUser.role = userRole;
      existingUser.privileges = priv;
      existingUser.department = normDept;
      if (phone) existingUser.phone = phone;
      if (initials) existingUser.initials = initials;
      existingUser.status = 'active';
      await existingUser.save();
      loginCreated = true;
      loginNote = 'An existing login for this email was updated with the new password.';
      console.log('[staff] existing login User updated:', { email: normEmail, role: userRole });
    }
  } else {
    loginNote = 'No login created (email or password missing) — staff saved without sign-in access.';
    console.log('[staff] login NOT created (missing email/password):', { hasEmail: !!normEmail, hasPassword: !!password });
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
    let user = await User.findOne({ email: staff.email.toLowerCase() });
    if (!user) {
      // Staff never had a login (e.g. created without a password) — create one now
      // so "Change password" on an existing staff row actually grants sign-in.
      const pType = (privileges && privileges.type) || (staff.privileges && staff.privileges.type) || null;
      const pOverrides = (privileges && privileges.overrides) || (staff.privileges && staff.privileges.overrides) || {};
      const pScopes = Array.isArray(privileges && privileges.supervisorScopes) ? privileges.supervisorScopes : ((staff.privileges && staff.privileges.supervisorScopes) || []);
      const userRole = ['admin','manager','supervisor'].includes(role || staff.role) ? (role || staff.role) : 'staff';
      const priv = { type: pType, overrides: pOverrides };
      if (pScopes.length) priv.supervisorScopes = pScopes;
      user = new User({
        name: (name || staff.name).trim(),
        email: staff.email.toLowerCase(),
        role: userRole,
        privileges: priv,
        department: sanitizeDept(department || dept || staff.department),
        phone: phone || staff.phone || '',
      });
      console.log('[staff] creating missing login during update:', staff.email.toLowerCase());
    }
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
    user.status = 'active';
    await user.save();
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
  const staff = await Staff.findById(req.params.id);
  if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found' });

  // Self-delete guard — deleting your own row would also kill the login
  // you are currently using (below) and lock you out.
  if (req.user && staff.email && String(staff.email).toLowerCase() === String(req.user.email || '').toLowerCase()) {
    return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
  }

  await Staff.findByIdAndDelete(req.params.id);

  // The login (User) lives in a separate collection — delete it too, or
  // the account survives the "delete" and keeps the email reserved.
  let loginRemoved = false;
  if (staff.email) {
    const r = await User.deleteOne({ email: String(staff.email).toLowerCase().trim() });
    loginRemoved = r.deletedCount > 0;
  }

  res.json({ success: true, message: `Staff member "${staff.name}" removed`, data: { loginRemoved } });
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
