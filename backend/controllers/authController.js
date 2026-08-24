const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

function signToken(id) {
  const secret = process.env.JWT_SECRET || 'aurum_hotel_jwt_secret_key_2026';
  return jwt.sign({ id }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function initialsFrom(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * GET /api/auth/bootstrap-status — public, unauthenticated. Tells the
 * login page whether an admin account already exists, so it can show
 * "create the administrator account" (first run) or hide sign-up
 * entirely and point people to their admin instead.
 */
exports.bootstrapStatus = asyncHandler(async (req, res) => {
  const count = await User.countDocuments();
  res.json({ success: true, bootstrapped: count > 0 });
});

/**
 * POST /api/auth/signup — bootstrap ONLY. The very first account ever
 * created becomes the admin, with role/privilege/department forced
 * server-side (never taken from the request body, so nobody can hand
 * themselves admin by adding role:'admin' to the payload). Once one
 * user exists, this endpoint is permanently closed — every other
 * account must be created by an admin via POST /api/auth/users.
 */
exports.signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email and password are required' });
  }

  const userCount = await User.countDocuments();
  if (userCount > 0) {
    return res.status(403).json({
      success: false,
      error: 'Sign-ups are closed. Ask your administrator to create your account.',
    });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: 'admin',
    privilege: 'Full',
    department: 'Management',
    phone: req.body.phone || '',
    initials: initialsFrom(name),
  });

  const token = signToken(user._id);
  res.status(201).json({ success: true, token, user: user.toJSON() });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || user.status === 'inactive') {
    return res.status(401).json({ success: false, error: 'Invalid credentials or account disabled' });
  }

  const ok = await user.comparePassword(password || '');
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  user.lastLogin = new Date();
  await user.save();

  const token = signToken(user._id);
  res.json({ success: true, token, user: user.toJSON() });
});

exports.session = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  res.json({
    success: true,
    user: req.user.toJSON(),
    name: req.user.name,
    initials: req.user.initials || '',
    role: req.user.role,
    privilege: req.user.privilege || 'Standard',
    department: req.user.department || 'General',
  });
});

exports.logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

/* ── Admin-only user management ──
   This is now the ONLY way accounts get created after the first
   (admin) account exists — the public /signup route is closed. */

exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ name: 1 });
  res.json({ success: true, count: users.length, data: users });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, privilege, department, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email and password are required' });
  }
  if (!role) {
    return res.status(400).json({ success: false, error: 'role is required' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role,
    privilege: privilege || 'Standard',
    department: department || 'General',
    phone: phone || '',
    initials: initialsFrom(name),
  });

  res.status(201).json({ success: true, user: user.toJSON() });
});

/**
 * PATCH /api/auth/users/:id — admin assigns/changes role, privilege,
 * department, or active/inactive status for an existing account.
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const { role, privilege, department, status, name, phone } = req.body;
  if (role !== undefined) user.role = role;
  if (privilege !== undefined) user.privilege = privilege;
  if (department !== undefined) user.department = department;
  if (status !== undefined) user.status = status;
  if (name !== undefined) { user.name = name; user.initials = initialsFrom(name); }
  if (phone !== undefined) user.phone = phone;

  await user.save();
  res.json({ success: true, user: user.toJSON() });
});