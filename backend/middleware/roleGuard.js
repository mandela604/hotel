function roleGuard(...allowedRoles) {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (roles.length === 0) return next();
    
    const userRole = (req.user.role || '').toLowerCase();
    const isAllowed = roles.some(r => r.toLowerCase() === userRole || userRole === 'admin');
    
    if (isAllowed) return next();
    
    res.status(403).json({
      success: false,
      error: `Access denied. Requires one of roles: [${roles.join(', ')}]`,
    });
  };
}

module.exports = roleGuard;
