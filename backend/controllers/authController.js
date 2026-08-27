const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is required but not set');
  return s;
}

function signToken(id) {
  return jwt.sign({ id }, getSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function initialsFrom(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function isSecure() {
  return process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
}

function cookieOptions() {
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  return {
    httpOnly: true,
    secure: isSecure(),
    // 'lax' — sends the cookie on same-site top-level navigations (the
    // login → dashboard redirect) while still blocking cross-site POSTs.
    // 'strict' could refuse to send the token during that redirect, which
    // is exactly the "login succeeded but then I'm logged back out" loop.
    sameSite: 'lax',
    path: '/',
    maxAge: maxAge,
  };
}

function setTokenCookie(res, token) {
  res.cookie('token', token, cookieOptions());
}

function clearTokenCookie(res) {
  res.clearCookie('token', { path: '/' });
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
    privileges: { type: null, overrides: {} },
    department: 'Management',
    phone: req.body.phone || '',
    initials: initialsFrom(name),
  });

  const token = signToken(user.id);
  setTokenCookie(res, token);
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

  if (!user.password) {
    return res.status(401).json({ success: false, error: 'Account has no password set — contact administrator' });
  }

  const ok = await user.comparePassword(password || '');
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  user.lastLogin = new Date();
  await user.save();

  const token = signToken(user.id);
  setTokenCookie(res, token);
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
    privileges: req.user.privileges || { type: null, overrides: {} },
    department: req.user.department || 'General',
  });
});

exports.logout = asyncHandler(async (req, res) => {
  clearTokenCookie(res);
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
  const { name, email, password, role, privileges, department, phone } = req.body;
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

  const priv = privileges && typeof privileges === 'object'
    ? { type: privileges.type || null, overrides: privileges.overrides || {} }
    : { type: null, overrides: {} };

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role,
    privileges: priv,
    department: department || 'Management',
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
  // Match on the user's UUID `id` field (same field auth tokens carry),
  // not the Mongo _id — listUsers exposes `id`, and the admin panel uses it.
  const user = await User.findOne({ id: req.params.id });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const { role, privileges, department, status, name, phone } = req.body;
  if (role !== undefined) user.role = role;
  if (privileges !== undefined && typeof privileges === 'object') {
    if (privileges.type !== undefined) user.privileges.type = privileges.type;
    if (privileges.overrides !== undefined) user.privileges.overrides = privileges.overrides;
  }
  if (department !== undefined) user.department = department;
  if (status !== undefined) user.status = status;
  if (name !== undefined) { user.name = name; user.initials = initialsFrom(name); }
  if (phone !== undefined) user.phone = phone;

  await user.save();
  res.json({ success: true, user: user.toJSON() });
});
