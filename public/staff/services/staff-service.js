/**
 * services/staff-service.js — Shared data + business logic for Staff Management
 * Production only — talks to the real backend (routes/staff.js).
 */
(function (global) {
  'use strict';

  const CONFIG = {
    API_BASE: '/api/staff',
  };

  const KEYS = {
    STAFF: 'platform-staff',
  };

  /* ── Permission definitions (module-scoped, shared with page)
       Must stay byte-identical to public/services/permissions.js
       and backend/config/permissions.js. ── */
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
          canVoid: false, canGiveDiscount: false,
        },
      },
      restaurant_staff: {
        restaurant: {
          canView: true, canCreate: true, canEdit: false, canDelete: false,
          canVoid: false, canGiveDiscount: false,
        },
      },
    },
  };

  const ALL_MODULES = ['booking', 'procurement', 'accounting', 'store', 'restaurant', 'poolbar', 'kitchen', 'gym'];
  const ALL_ACTIONS = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canApprove', 'canReject', 'canVoid', 'canGiveDiscount', 'canRestock', 'canManageUsers', 'canViewReports', 'canManagePlans', 'canManageRoles'];
  const ROLE_KEYS = Object.keys(PERMISSIONS.roles);
  const PRIVILEGE_KEYS = Object.keys(PERMISSIONS.privileges);

  /* ── State ── */
  const state = { staff: [], ready: false };
  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[StaffService] listener error', e); } }); }

  /* ── Shared helpers ── */
  function labelize(key) { return String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  function initials(name) { return (name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(); }

  /* ── Token ── */
  function getToken() {
    // httpOnly cookie is sent automatically — no localStorage token needed.
    return '';
  }

  /* ── API fetch ── */
  async function apiFetch(path, options) {
    options = options || {};
    // httpOnly cookie is sent automatically — no Authorization header needed.
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});

    if (options.body !== undefined && options.body !== null && typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body);
    }

    let res;
    try {
      res = await fetch(CONFIG.API_BASE + path, Object.assign({}, options, { headers }));
    } catch (networkErr) {
      const err = new Error('Network error contacting server: ' + networkErr.message);
      err.code = 'NETWORK_ERROR';
      throw err;
    }

    let body = null;
    try { body = await res.json(); } catch (e) { /* no/invalid JSON body */ }

    if (!res.ok || (body && body.success === false)) {
      const msg = (body && body.error) || ('Request failed (' + res.status + ')');
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    return body ? body.data : null;
  }

  /* ── Status mapping (frontend ↔ backend) ── */
  function toBackendStatus(fe) {
    if (fe === 'Inactive') return 'off_duty';
    return 'on_duty';
  }
  function toFrontendStatus(be) {
    if (be === 'on_duty' || be === 'on_leave') return 'Active';
    return 'Inactive';
  }

  /* ── Normalize backend record → frontend shape ── */
  function normalize(s) {
    if (!s) return s;
    const p = (s.privileges && typeof s.privileges === 'object') ? s.privileges : {};
    return {
      id: s._id || s.id,
      staffCode: s.staffCode || '',
      name: s.name || '',
      email: s.email || '',
      phone: s.phone || '',
      role: s.role || 'staff',
      privilege: p.type || (typeof s.privileges === 'string' ? s.privileges : null) || null,
      dept: s.dept || s.department || '',
      status: toFrontendStatus(s.status),
      salary: s.salary || 0,
      hireDate: s.hireDate || '',
      overrides: p.overrides || {},
    };
  }

  /* ── Frontend data → API payload ── */
  function toPayload(fe) {
    const payload = {
      name: fe.name,
      email: fe.email,
      phone: fe.phone || '',
      role: fe.role,
      dept: fe.dept || '',
      department: fe.dept || '',
      status: toBackendStatus(fe.status),
      salary: Number(fe.salary) || 0,
      hireDate: fe.hireDate || '',
      privileges: { type: fe.privilege || null, overrides: fe.overrides || {} },
    };
    if (fe.password) payload.password = fe.password;
    return payload;
  }

  /* ══════════════════════════════════════════════════════════════
     Data operations — production REST client
  ══════════════════════════════════════════════════════════════ */

  async function loadAll() {
    try {
      const list = await apiFetch('?_=' + Date.now());
      state.staff = (Array.isArray(list) ? list : []).map(normalize);
    } catch (e) {
      console.warn('[StaffService] API load failed:', e.message);
      state.staff = [];
    }
    state.ready = true;
    emitChange('load');
    return state;
  }

  async function addStaff(data) {
    const created = await apiFetch('', { method: 'POST', body: toPayload(data) });
    const norm = normalize(created);
    state.staff.unshift(norm);
    emitChange('staff:add');
    return norm;
  }

  async function editStaff(id, data) {
    const updated = await apiFetch('/' + id, { method: 'PUT', body: toPayload(data) });
    const norm = normalize(updated);
    const idx = state.staff.findIndex(s => s.id === id);
    if (idx > -1) state.staff[idx] = norm; else state.staff.unshift(norm);
    emitChange('staff:edit');
    return norm;
  }

  async function deleteStaff(id) {
    await apiFetch('/' + id, { method: 'DELETE' });
    state.staff = state.staff.filter(s => s.id !== id);
    emitChange('staff:delete');
  }

  /* ── KPIs ── */
  function dashboardKPIs() {
    const list = state.staff;
    const total = list.length;
    const active = list.filter(s => s.status === 'Active').length;
    const admins = list.filter(s => s.role === 'admin' || s.role === 'manager').length;
    const depts = new Set(list.map(s => s.dept).filter(Boolean)).size;
    return { total, active, admins, depts, activePercent: total ? Math.round(active / total * 100) : 0 };
  }

  /* ── Permission logic ── */
  function getBasePermission(staff, module, action) {
    if (staff.role === 'admin') return true;
    if (staff.role === 'manager') return !!(PERMISSIONS.roles.manager || {})[action];
    if (staff.privilege && PERMISSIONS.privileges[staff.privilege] && PERMISSIONS.privileges[staff.privilege][module]) {
      return !!PERMISSIONS.privileges[staff.privilege][module][action];
    }
    return !!(PERMISSIONS.roles.staff || {})[action];
  }
  function getEffectivePermission(staff, module, action) {
    const ov = staff.overrides && staff.overrides[module] ? staff.overrides[module][action] : undefined;
    return ov !== undefined ? ov : getBasePermission(staff, module, action);
  }

  /* ── Public API ── */
  global.StaffService = {
    CONFIG,
    PERMISSIONS,
    ALL_MODULES,
    ALL_ACTIONS,
    ROLE_KEYS,
    PRIVILEGE_KEYS,
    state,
    onChange,
    loadAll,
    addStaff,
    editStaff,
    deleteStaff,
    dashboardKPIs,
    getBasePermission,
    getEffectivePermission,
    labelize,
    initials,
    normalize,
    toPayload,
  };
})(window);
