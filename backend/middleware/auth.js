const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }

  try {
    const token = header.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'aurum_hotel_jwt_secret_key_2026';
    const decoded = jwt.verify(token, secret);
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
