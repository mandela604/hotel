const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../database/models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name },
    process.env.JWT_SECRET || 'grace_hotel_secret_key_2026',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'email and password are required');

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) throw new ApiError(401, 'Invalid email or password');
  if (user.status !== 'active') throw new ApiError(403, 'Account is suspended or inactive');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new ApiError(401, 'Invalid email or password');

  const token = signToken(user);
  res.json({
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, initials: user.initials },
  });
});

// POST /api/auth/logout
exports.logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user || null });
});

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, initials } = req.body;
  if (!name || !email || !password || !role) throw new ApiError(400, 'name, email, password and role are required');
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) throw new ApiError(409, 'A user with that email already exists');

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: String(email).toLowerCase(),
    password: hash,
    role,
    phone,
    initials,
    status: 'active',
  });

  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// GET /api/auth/users
exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}, '-password').sort({ name: 1 });
  res.json(users);
});
