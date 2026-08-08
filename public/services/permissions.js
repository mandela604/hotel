// services/permissions.js

/**
 * PERMISSION SYSTEM
 * 
 * Roles:
 * - admin: Full system access. Can do everything across all modules.
 * - manager: Can view, create, edit, approve, void. Cannot delete or manage users.
 * - staff: Base level. Permissions vary by module/privilege.
 * 
 * Privileges (staff only):
 * - front_desk: Can view bookings, create bookings, check-in/out guests
 * - accountant: Can view financial data, approve payments, view reports
 * - procurement_manager: Can manage requisitions, approve/reject requests
 * - sales_rep: Can create sales, void sales (with manager approval), view reports
 * - store_keeper: Can manage stock, issue items, receive requisitions
 * - chef: Can create productions, view inventory, request transfers
 * - gym_attendant: Can manage members, check-ins, sell plans
 * - pool_bar_staff: Can create sales, view stock
 * - restaurant_staff: Can take orders, create sales
 * 
 * Manager can edit and void sales. Only admin can delete, edit any record,
 * give discounts, or manage users.
 */

const PERMISSIONS = {
  roles: {
    admin: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canApprove: true,
      canReject: true,
      canVoid: true,
      canGiveDiscount: true,
      canRestock: true,
      canManageUsers: true,
      canViewReports: true,
      canManagePlans: true,
      canManageRoles: true,
    },
    manager: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canApprove: true,
      canReject: true,
      canVoid: true,
      canGiveDiscount: false,
      canRestock: true,
      canManageUsers: false,
      canViewReports: true,
      canManagePlans: true,
      canManageRoles: false,
    },
    staff: {
      // Base permissions - extended by privileges below
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
      canReject: false,
      canVoid: false,
      canGiveDiscount: false,
      canRestock: false,
      canManageUsers: false,
      canViewReports: false,
      canManagePlans: false,
      canManageRoles: false,
    },
  },

  // Staff privileges by module
  privileges: {
    // Booking module
    front_desk: {
      booking: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canCheckin: true,
        canCheckout: true,
      }
    },
    // Accounting module
    accountant: {
      accounting: {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: true,
        canViewReports: true,
      }
    },
    // Procurement module
    procurement_manager: {
      procurement: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: true,
        canReject: true,
      }
    },
    // Restaurant module
    sales_rep: {
      restaurant: {
        canView: true,
        canCreate: true,
        canEdit: false,
        canDelete: false,
        canVoid: false, // Only manager/admin can void
        canGiveDiscount: false,
      },
      poolbar: {
        canView: true,
        canCreate: true,
        canEdit: false,
        canDelete: false,
        canVoid: false,
        canGiveDiscount: false,
      }
    },
    // Store module
    store_keeper: {
      store: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canRestock: true,
      },
      procurement: {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canReject: false,
      }
    },
    // Kitchen module
    chef: {
      kitchen: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
      }
    },
    // Gym module
    gym_attendant: {
      gym: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canManagePlans: false,
        canCheckin: true,
        canSellPlan: true,
      }
    },
    // Pool Bar module
    pool_bar_staff: {
      poolbar: {
        canView: true,
        canCreate: true,
        canEdit: false,
        canDelete: false,
        canVoid: false,
        canGiveDiscount: false,
      }
    },
    // Restaurant module (waiter/order taker)
    restaurant_staff: {
      restaurant: {
        canView: true,
        canCreate: true,
        canEdit: false,
        canDelete: false,
        canVoid: false,
        canGiveDiscount: false,
      }
    },
  },

  // Module-specific permissions for admin/manager
  modules: {
    booking: {
      admin: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canCheckin: true, canCheckout: true },
      manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canCheckin: true, canCheckout: true },
    },
    procurement: {
      admin: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canReject: true },
      manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canReject: true },
    },
    accounting: {
      admin: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canViewReports: true },
      manager: { canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: true, canViewReports: true },
    },
    store: {
      admin: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canRestock: true },
      manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canRestock: true },
    },
    restaurant: {
      admin: { canView: true, canCreate: true, canEdit: true, canDelete: true, canVoid: true, canGiveDiscount: true },
      manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canVoid: true, canGiveDiscount: false },
    },
    poolbar: {
      admin: { canView: true, canCreate: true, canEdit: true, canDelete: true, canVoid: true, canGiveDiscount: true },
      manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canVoid: true, canGiveDiscount: false },
    },
    kitchen: {
      admin: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
      manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    },
    gym: {
      admin: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canManagePlans: true, canCheckin: true, canSellPlan: true },
      manager: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canManagePlans: true, canCheckin: true, canSellPlan: true },
    },
  }
};

/**
 * Get user's effective permissions
 * Combines role-based + privilege-based permissions
 */
function getUserEffectivePermissions(session, module = null) {
  if (!session || !session.role) return {};
  
  const role = session.role.toLowerCase();
  const privilege = session.privilege ? session.privilege.toLowerCase() : null;
  
  // Admin gets full permissions
  if (role === 'admin') {
    return PERMISSIONS.modules[module]?.[role] || PERMISSIONS.roles.admin;
  }
  
  // Manager gets manager permissions
  if (role === 'manager') {
    return PERMISSIONS.modules[module]?.[role] || PERMISSIONS.roles.manager;
  }
  
  // Staff: combine base + privilege
  const base = { ...PERMISSIONS.roles.staff };
  
  if (privilege && PERMISSIONS.privileges[privilege]) {
    const privPerms = PERMISSIONS.privileges[privilege];
    if (module) {
      // FIX: only merge this privilege's permissions for THIS module. The
      // previous version fell through to merging every module the privilege
      // touches whenever the requested module wasn't one of them — e.g. a
      // front_desk (booking-only) user checking a kitchen permission would
      // silently inherit their booking canCreate/canEdit flags into the
      // kitchen check. If the privilege doesn't cover this module, the user
      // keeps only the staff base (view-only) for it.
      if (privPerms[module]) {
        Object.assign(base, privPerms[module]);
      }
    } else {
      // No module specified — merge all of this privilege's permissions
      // (used for generic, module-agnostic checks only).
      Object.values(privPerms).forEach(modPerms => {
        Object.assign(base, modPerms);
      });
    }
  }
  
  return base;
}

/**
 * Check if current user has a specific permission
 */
export function hasPermission(session, permission, module = null) {
  if (!session || !session.role) return false;
  
  const role = session.role.toLowerCase();
  
  // Admin has all permissions
  if (role === 'admin') return true;
  
  // Check module-specific permissions first
  if (module && PERMISSIONS.modules[module]) {
    const modulePerms = PERMISSIONS.modules[module];
    if (modulePerms[role]) {
      return modulePerms[role][permission] || false;
    }
  }
  
  // Check staff privileges
  if (role === 'staff') {
    const perms = getUserEffectivePermissions(session, module);
    return perms[permission] || false;
  }
  
  // Fallback to global role
  return PERMISSIONS.roles[role]?.[permission] || false;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(session, permissions, module = null) {
  return permissions.some(p => hasPermission(session, p, module));
}

/**
 * Check if user has all specified permissions
 */
export function hasAllPermissions(session, permissions, module = null) {
  return permissions.every(p => hasPermission(session, p, module));
}

/**
 * Get all permissions for a user
 */
export function getUserPermissions(session, module = null) {
  if (!session || !session.role) return {};
  
  const role = session.role.toLowerCase();
  
  if (role === 'admin') {
    const perms = { ...PERMISSIONS.roles.admin };
    if (module && PERMISSIONS.modules[module]?.[role]) {
      Object.assign(perms, PERMISSIONS.modules[module][role]);
    }
    return perms;
  }
  
  if (role === 'manager') {
    const perms = { ...PERMISSIONS.roles.manager };
    if (module && PERMISSIONS.modules[module]?.[role]) {
      Object.assign(perms, PERMISSIONS.modules[module][role]);
    }
    return perms;
  }
  
  // Staff
  return getUserEffectivePermissions(session, module);
}

/**
 * Check if user can perform an action on a specific entity
 */
export function canEdit(session, module, entity = null) {
  if (!hasPermission(session, 'canEdit', module)) return false;
  
  // Admin can edit anything
  if (session.role === 'admin') return true;
  
  // Additional business logic
  if (entity && entity.status) {
    const lockedStatuses = ['completed', 'approved', 'fulfilled', 'paid', 'reconciled'];
    if (lockedStatuses.includes(entity.status)) {
      return false;
    }
  }
  
  return true;
}

export function canDelete(session, module, entity = null) {
  // Only admin can delete
  if (!session || session.role !== 'admin') return false;
  
  if (entity && entity.status) {
    const lockedStatuses = ['completed', 'approved', 'fulfilled', 'paid', 'reconciled'];
    if (lockedStatuses.includes(entity.status)) {
      return false;
    }
  }
  
  return true;
}

export function canApprove(session, module, entity = null) {
  return hasPermission(session, 'canApprove', module);
}

export function canVoid(session, module, entity = null) {
  // Only admin and manager can void
  if (session?.role === 'admin' || session?.role === 'manager') {
    return hasPermission(session, 'canVoid', module);
  }
  return false;
}

export function canGiveDiscount(session, module) {
  // Only admin can give discounts
  return session?.role === 'admin' && hasPermission(session, 'canGiveDiscount', module);
}

export default {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  canEdit,
  canDelete,
  canApprove,
  canVoid,
  canGiveDiscount,
};