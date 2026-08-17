const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

exports.signup = asyncHandler(async (req, res) => {
  const { name, email, password, role, privilege } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const user = await User.create({ name, email: email.toLowerCase(), password: password || '', role: role || 'staff', privilege: privilege || '', initials });
  const token = signToken(user._id);
  res.status(201).json({ token, user });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await user.comparePassword(password || '');
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user._id);
  res.json({ token, user });
});

exports.session = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
