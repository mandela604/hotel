/**
 * services/permissions.js — Role / privilege checks (window.Permissions)
 * Classic IIFE so booking-service.js, shell, and pages can use it without modules.
 *
 * Production note:
 * - Pages keep calling Permissions.hasPermission(session, …) forever.
 * - Demo: session = { role, privilege } → maps below decide flags.
 * - Live option A: API returns { role } only → same maps.
 * - Live option B: API returns { role, permissions: { canVoid: true, … } }
 *   → those flags win for that session (one place to change: this file).
 * Real security is still enforced on the backend for every write.
 */
(function (global) {
  'use strict';

  /**
   * Roles:
   * - admin: full access
   * - manager: view/create/edit/approve/void (no delete / manage users / discounts)
   * - staff: base view; extra rights come from privilege
   *
   * Staff privileges: front_desk, accountant, procurement_manager, sales_rep,
   * store_keeper, chef, gym_attendant, pool_bar_staff, restaurant_staff
   */

  const PERMISSIONS = {
    roles: {
      admin: {
        canView: true, canCreate: true, canEdit: true, canDelete: true,
        canApprove: true, canReject: true, canVoid: true, canGiveDiscount: true,
        canRestock: true, canManageUsers: true, canViewReports: true,
        canManagePlans: true, canManageRoles: true,
      },
      manager: {
        canView: true, canCreate: true, canEdit: true, canDelete: false,
        canApprove: true, canReject: true, canVoid: true, canGiveDiscount: false,
        canRestock: true, canManageUsers: false, canViewReports: true,
        canManagePlans: true, canManageRoles: false,
      },
      staff: {
        canView: true, canCreate: false, canEdit: false, canDelete: false,
        canApprove: false, canReject: false, canVoid: false, canGiveDiscount: false,
        canRestock: false, canManageUsers: false, canViewReports: false,
        canManagePlans: false, canManageRoles: false,
      },
    },

    privileges: {
      front_desk: {
        booking: {
          canView: true, canCreate: true, canEdit: true, canDelete: false,
          canApprove: false, canCheckin: true, canCheckout: true,
        },
      },
      accountant: {
        accounting: {
          canView: true, canCreate: true, canEdit: true, canDelete: false,
          canApprove: true, canViewReports: true,
        },
      },
      procurement_manager: {
        procurement: {
          canView: true, canCreate: true, canEdit: true, canDelete: false,
          canApprove: true, canReject: true,
        },
      },
      sales_rep: {
        restaurant: {
          canView: true, canCreate: true, canEdit: false, canDelete: false,
          canVoid: false, canReject: true, canGiveDiscount: false,
        },
        poolbar: {
          canView: true, canCreate: true, canEdit: false, canDelete: false,
          canVoid: false, canGiveDiscount: false,
        },
      },
      store_keeper: {
        store: {
          canView: true, canCreate: true, canEdit: true, canDelete: false,
          canApprove: false, canRestock: true,
        },
        procurement: {
          canView: true, canCreate: false, canEdit: false, canDelete: false,
          canApprove: false, canReject: false,
        },
      },
      chef: {
        kitchen: {
          canView: true, canCreate: true, canEdit: true, canDelete: false,
          canApprove: false,
        },
      },
      gym_attendant: {
        gym: {
          canView: true, canCreate: true, canEdit: true, canDelete: false,
          canApprove: false, canManagePlans: false, canCheckin: true, canSellPlan: true,
        },
      },
      pool_bar_staff: {
        poolbar: {
          canView: true, canCreate: true, canEdit: false, canDelete: false,
          canVoid: false, canGiveDiscount: false, canManageOrders: true,
        },
      },
      restaurant_staff: {
        restaurant: {
          canView: true, canCreate: true, canEdit: false, canDelete: false,
          canVoid: false, canGiveDiscount: false,
        },
      },
      waiter: {
        restaurant: {
          canView: true, canCreate: true, canEdit: true, canDelete: false,
          canVoid: false, canGiveDiscount: false, canManageOrders: true,
        },
        poolbar: {
          canView: true, canCreate: true, canEdit: true, canDelete: false,
          canVoid: false, canGiveDiscount: false, canManageOrders: true,
        },
      },
    },

    modules: {
      booking: {
        admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canCheckin: true, canCheckout: true },
        manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canCheckin: true, canCheckout: true },
      },
      procurement: {
        admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canReject: true },
        manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canReject: true },
      },
      accounting: {
        admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canViewReports: true },
        manager: { canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: true, canViewReports: true },
      },
      store: {
        admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canRestock: true },
        manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canRestock: true },
      },
      restaurant: {
        admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canVoid: true, canGiveDiscount: true },
        manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canVoid: true, canGiveDiscount: false },
      },
      poolbar: {
        admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canVoid: true, canGiveDiscount: true, canManageOrders: true },
        manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canVoid: true, canGiveDiscount: false, canViewReports: true, canManageOrders: true },
      },
      kitchen: {
        admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
        manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
      },
      gym: {
        admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canManagePlans: true, canCheckin: true, canSellPlan: true },
        manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canManagePlans: true, canCheckin: true, canSellPlan: true },
      },
    },
  };

  /**
   * If backend sent session.permissions (or session.permissions[module]),
   * those boolean flags override the local role/privilege maps for that key.
   * Demo sessions without .permissions behave exactly as before.
   */
  function flagFromSession(session, permission, module) {
    if (!session || !session.permissions || typeof session.permissions !== 'object') {
      return null; // no override
    }
    // Module-scoped bag: { restaurant: { canVoid: true }, … }
    if (module && session.permissions[module] && typeof session.permissions[module] === 'object') {
      if (typeof session.permissions[module][permission] === 'boolean') {
        return session.permissions[module][permission];
      }
    }
    // Flat bag: { canVoid: true, canDelete: false, … }
    if (typeof session.permissions[permission] === 'boolean') {
      return session.permissions[permission];
    }
    return null;
  }

  function getUserEffectivePermissions(session, module) {
    if (!session || !session.role) return {};
    const role = session.role.toLowerCase();
    const privilege = session.privilege ? session.privilege.toLowerCase() : null;

    if (role === 'admin') {
      return (module && PERMISSIONS.modules[module] && PERMISSIONS.modules[module][role])
        || PERMISSIONS.roles.admin;
    }
    if (role === 'manager') {
      return (module && PERMISSIONS.modules[module] && PERMISSIONS.modules[module][role])
        || PERMISSIONS.roles.manager;
    }

    const base = Object.assign({}, PERMISSIONS.roles.staff);
    if (privilege && PERMISSIONS.privileges[privilege]) {
      const privPerms = PERMISSIONS.privileges[privilege];
      if (module) {
        if (privPerms[module]) Object.assign(base, privPerms[module]);
      } else {
        Object.keys(privPerms).forEach(function (k) {
          Object.assign(base, privPerms[k]);
        });
      }
    }

    // Overlay any API-supplied flags so getUserPermissions stays consistent
    if (session.permissions && typeof session.permissions === 'object') {
      const overlay = (module && session.permissions[module] && typeof session.permissions[module] === 'object')
        ? session.permissions[module]
        : session.permissions;
      Object.keys(overlay).forEach(function (k) {
        if (typeof overlay[k] === 'boolean') base[k] = overlay[k];
      });
    }
    return base;
  }

  function hasPermission(session, permission, module) {
    if (!session || !session.role) return false;

    // Live option B: explicit flag from API wins
    const override = flagFromSession(session, permission, module);
    if (override !== null) return override;

    const role = session.role.toLowerCase();
    if (role === 'admin') return true;

    if (module && PERMISSIONS.modules[module]) {
      const modulePerms = PERMISSIONS.modules[module];
      if (modulePerms[role]) return !!modulePerms[role][permission];
    }

    if (role === 'staff') {
      const perms = getUserEffectivePermissions(session, module || null);
      return !!perms[permission];
    }

    return !!(PERMISSIONS.roles[role] && PERMISSIONS.roles[role][permission]);
  }

  function hasAnyPermission(session, permissions, module) {
    return permissions.some(function (p) {
      return hasPermission(session, p, module || null);
    });
  }

  function hasAllPermissions(session, permissions, module) {
    return permissions.every(function (p) {
      return hasPermission(session, p, module || null);
    });
  }

  function getUserPermissions(session, module) {
    if (!session || !session.role) return {};
    const role = session.role.toLowerCase();

    if (role === 'admin') {
      const perms = Object.assign({}, PERMISSIONS.roles.admin);
      if (module && PERMISSIONS.modules[module] && PERMISSIONS.modules[module][role]) {
        Object.assign(perms, PERMISSIONS.modules[module][role]);
      }
      return perms;
    }
    if (role === 'manager') {
      const perms = Object.assign({}, PERMISSIONS.roles.manager);
      if (module && PERMISSIONS.modules[module] && PERMISSIONS.modules[module][role]) {
        Object.assign(perms, PERMISSIONS.modules[module][role]);
      }
      return perms;
    }
    return getUserEffectivePermissions(session, module || null);
  }

  function canEdit(session, module, entity) {
    if (!hasPermission(session, 'canEdit', module)) return false;
    if (session.role === 'admin') return true;
    if (entity && entity.status) {
      var locked = ['completed', 'approved', 'fulfilled', 'paid', 'reconciled'];
      if (locked.indexOf(entity.status) !== -1) return false;
    }
    return true;
  }

  function canDelete(session, module, entity) {
    // Admin only — still respects session.permissions.canDelete if API sent it
    if (flagFromSession(session, 'canDelete', module) === true) {
      // allow non-admin only if backend explicitly granted it
    } else if (!session || session.role !== 'admin') {
      return false;
    }
    if (entity && entity.status) {
      var locked = ['completed', 'approved', 'fulfilled', 'paid', 'reconciled'];
      if (locked.indexOf(entity.status) !== -1) return false;
    }
    return true;
  }

  function canApprove(session, module, entity) {
    return hasPermission(session, 'canApprove', module);
  }

  function canVoid(session, module, entity) {
    // Prefer explicit API flag if present
    const override = flagFromSession(session, 'canVoid', module);
    if (override !== null) return override;

    if (session && (session.role === 'admin' || session.role === 'manager')) {
      return hasPermission(session, 'canVoid', module);
    }
    return false;
  }

  function canGiveDiscount(session, module) {
    const override = flagFromSession(session, 'canGiveDiscount', module);
    if (override !== null) return override;
    return !!(session && session.role === 'admin' && hasPermission(session, 'canGiveDiscount', module));
  }

  global.Permissions = {
    hasPermission: hasPermission,
    hasAnyPermission: hasAnyPermission,
    hasAllPermissions: hasAllPermissions,
    getUserPermissions: getUserPermissions,
    canEdit: canEdit,
    canDelete: canDelete,
    canApprove: canApprove,
    canVoid: canVoid,
    canGiveDiscount: canGiveDiscount,
  };
})(window);
