const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const User = require('../models/User');

/**
 * auth(roles?) — verifies the Bearer token, reads the session (the
 * decoded JWT payload) to load the current user fresh from the DB
 * (so a disabled/deleted account is rejected even with a still-valid
 * token), and optionally restricts access to a list of roles.
 *
 * Usage:
 *   router.get('/x', auth(), ctrl.handler)                 // any logged-in user
 *   router.post('/y', auth(['admin','manager']), ctrl.handler) // role-gated
 */
function auth(roles = []) {
  if (typeof roles === 'string') roles = [roles];

  return async function (req, res, next) {
    try {
      const header = req.header('Authorization') || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) {
        throw new ApiError(401, 'Missing or malformed Authorization header (expected: Bearer <token>)');
      }

      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (e) {
        throw new ApiError(401, e.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid session token');
      }

      const user = await User.findById(payload.sub);
      if (!user) throw new ApiError(401, 'Session refers to a user that no longer exists');
      if (user.status !== 'active') throw new ApiError(403, 'Account is suspended or inactive');

      if (roles.length && !roles.includes(user.role)) {
        throw new ApiError(403, `This action requires one of these roles: ${roles.join(', ')}`);
      }

      // req.user is "the session" for the rest of the request — every
      // controller reads staff identity from here, never from the body.
      req.user = { id: String(user._id), name: user.name, email: user.email, role: user.role, initials: user.initials };
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = auth;