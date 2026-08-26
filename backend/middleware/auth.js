const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is required but not set');
  return s;
}

async function auth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, getSecret());
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.status === 'inactive') {
      return res.status(401).json({ success: false, error: 'Account inactive or session invalid' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired authentication token' });
  }
}

module.exports = auth;
