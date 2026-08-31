'use strict';

/**
 * config/permissions.js — Single source of truth for authorization.
 *
 * Kept byte-identical to public/services/permissions.js.  Both sides
 * import/require this same structure so they never drift.
 *
 * permissionGuard(user, module, action, overrides?) mirrors the frontend's
 * getEffectivePermission() / hasPermission() logic exactly.
 */

/* ── Permission matrix ─────────────────────────────────────── */

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
        canApprove: false, canReject: true, canRestock: true,
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
      admin:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canReject: true, canRestock: true },
      manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canReject: true, canRestock: true },
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

/* ── Department → module-key mapping ─────────────────────────
   User.department uses title-case ('Pool Bar'), module keys are
   lowercase-no-space ('poolbar').  This table bridges the gap. */

const MODULE_KEY_MAP = {
  'Management':  null,
  'Front Desk':  'booking',
  'Housekeeping': null,
  'Restaurant':  'restaurant',
  'Kitchen':     'kitchen',
  'Pool Bar':    'poolbar',
  'Gym':         'gym',
  'Store':       'store',
  'Procurement': 'procurement',
  'Accounts':    'accounting',
};

const PRIVILEGE_KEYS = Object.keys(PERMISSIONS.privileges);
const ALL_MODULES    = Object.keys(PERMISSIONS.modules);
const ALL_ACTIONS    = Object.keys(PERMISSIONS.roles.admin);

/* ── Backend permission check ────────────────────────────────
   Mirrors staff-service.js getEffectivePermission() exactly:
     1. admin  → always true
     2. manager → check MODULES[module].manager[action], else base manager
     3. staff  → base staff + PRIVILEGES[type][module] + overrides
*/
function hasPermission(user, module, action) {
  const role = (user.role || '').toLowerCase();
  const privType = user.privileges && user.privileges.type
    ? user.privileges.type.toLowerCase()
    : null;
  const overrides = (user.privileges && user.privileges.overrides) || {};

  if (role === 'admin') return true;

  if (role === 'manager') {
    const mod = module && PERMISSIONS.modules[module]
      ? PERMISSIONS.modules[module].manager
      : null;
    if (mod && typeof mod[action] === 'boolean') return mod[action];
    return !!PERMISSIONS.roles.manager[action];
  }

  /* staff — privilege-based */
  const base = Object.assign({}, PERMISSIONS.roles.staff);
  if (privType && PERMISSIONS.privileges[privType]) {
    const privPerms = PERMISSIONS.privileges[privType];
    if (module && privPerms[module]) {
      Object.assign(base, privPerms[module]);
    }
  }

  /* per-staff overrides win */
  if (module && overrides[module] && typeof overrides[module][action] === 'boolean') {
    return overrides[module][action];
  }

  return !!base[action];
}

module.exports = {
  PERMISSIONS,
  MODULE_KEY_MAP,
  PRIVILEGE_KEYS,
  ALL_MODULES,
  ALL_ACTIONS,
  hasPermission,
};
