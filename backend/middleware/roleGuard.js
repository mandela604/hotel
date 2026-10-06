/**
 * roleGuard — legacy guard, checks req.user.role against allowed values.
 * Kept for cross-module routes (auth, staff, settings) that don't belong
 * to a single department.
 */
function roleGuard(...allowedRoles) {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (roles.length === 0) return next();

    const userRole = (req.user.role || '').toLowerCase();
    const isAllowed = roles.some(r => r.toLowerCase() === userRole) || userRole === 'admin';

    if (isAllowed) return next();

    res.status(403).json({
      success: false,
      error: `Access denied. Requires one of roles: [${roles.join(', ')}]`,
    });
  };
}

/**
 * departmentGuard — module-scoped access check.
 *
 * admin   → always allowed, req.actionLevel = 'admin'
 * manager → always allowed, req.actionLevel = 'manager'
 * staff   → allowed only if department matches, req.actionLevel = 'staff'
 * otherwise → 403
 *
 * Usage:  router.post('/stock', departmentGuard('Pool Bar'), handler)
 */
function departmentGuard(requiredDepartment) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const userDept = (req.user.department || '').toLowerCase();
    const required = (requiredDepartment || '').toLowerCase();

    if (userRole === 'admin') {
      req.actionLevel = 'admin';
      return next();
    }
    if (userRole === 'manager') {
      req.actionLevel = 'manager';
      return next();
    }
    if (userRole === 'supervisor') {
      const scopes = (req.user.privileges && req.user.privileges.supervisorScopes) || [];
      const { MODULE_KEY_MAP } = require('../config/permissions');
      const requiredModule = MODULE_KEY_MAP[requiredDepartment] || required.replace(/\s/g, '');
      if (scopes.length && requiredModule && scopes.includes(requiredModule)) {
        req.actionLevel = 'supervisor';
        return next();
      }
      // supervisor with empty scopes or not in allowlist → deny
      return res.status(403).json({
        success: false,
        error: `Access denied. Supervisor not allowed for "${requiredDepartment}".`,
      });
    }
    if (userRole === 'staff' && userDept === required) {
      req.actionLevel = 'staff';
      return next();
    }

    res.status(403).json({
      success: false,
      error: `Access denied. Requires department "${requiredDepartment}" or admin/manager role.`,
    });
  };
}

/**
 * privilegeGuard(module, action) — action-level gate, runs AFTER departmentGuard.
 *
 * Mirrors staff-service.js getEffectivePermission() exactly:
 *   admin   → always passes
 *   manager → checks MODULES[module].manager[action] || base manager
 *   staff   → base staff + PRIVILEGES[type][module][action] + overrides
 *
 * Usage:
 *   departmentGuard('Pool Bar'), privilegeGuard('poolbar', 'canCreate'), handler
 */
const { PERMISSIONS } = require('../config/permissions');

function privilegeGuard(module, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const role = (req.user.role || '').toLowerCase();
    const privType = req.user.privileges && req.user.privileges.type
      ? req.user.privileges.type.toLowerCase()
      : null;
    const overrides = (req.user.privileges && req.user.privileges.overrides) || {};

    if (role === 'admin') return next();

    if (role === 'manager') {
      const mod = module && PERMISSIONS.modules[module]
        ? PERMISSIONS.modules[module].manager
        : null;
      if (mod && typeof mod[action] === 'boolean') {
        if (mod[action]) return next();
      } else if (PERMISSIONS.roles.manager[action]) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: `Access denied. Manager lacks "${action}" in module "${module}".`,
      });
    }

    if (role === 'supervisor') {
      const scopes = (req.user.privileges && req.user.privileges.supervisorScopes) || [];
      if (module && scopes.length && !scopes.includes(module)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Supervisor not allowed for module "${module}".`,
        });
      }
      const mod = module && PERMISSIONS.modules[module]
        ? PERMISSIONS.modules[module].supervisor
        : null;
      if (mod && typeof mod[action] === 'boolean') {
        if (mod[action]) return next();
      } else if (PERMISSIONS.roles.supervisor[action]) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: `Access denied. Supervisor lacks "${action}" in module "${module}".`,
      });
    }

    /* staff — privilege-based */
    if (role === 'staff') {
      const base = Object.assign({}, PERMISSIONS.roles.staff);
      // module-level staff override (e.g. restaurant/poolbar allow tab create/edit)
      if (module && PERMISSIONS.modules[module] && PERMISSIONS.modules[module].staff) {
        Object.assign(base, PERMISSIONS.modules[module].staff);
      }
      if (privType && PERMISSIONS.privileges[privType] && PERMISSIONS.privileges[privType][module]) {
        Object.assign(base, PERMISSIONS.privileges[privType][module]);
      }

      /* per-staff overrides win */
      if (module && overrides[module] && typeof overrides[module][action] === 'boolean') {
        if (overrides[module][action]) return next();
        return res.status(403).json({
          success: false,
          error: `Access denied. Override denies "${action}" in module "${module}".`,
        });
      }

      if (base[action]) return next();

      return res.status(403).json({
        success: false,
        error: `Access denied. Requires privilege "${action}" in module "${module}".`,
      });
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied.',
    });
  };
}

module.exports = roleGuard;
module.exports.roleGuard = roleGuard;
module.exports.departmentGuard = departmentGuard;
module.exports.privilegeGuard = privilegeGuard;
