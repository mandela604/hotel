function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (allowedRoles.length === 0) return next();
    if (allowedRoles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = roleGuard;
