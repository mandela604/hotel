/**
 * services/procurement-service.js — Procurement CRUD + approval flow
 * Classic IIFE so shell, modals, and pages can use it without modules.
 *
 * Approval flow (UPDATED):
 *  1. Purchase Request (any department)
 *  2. Accountant Approval (all requests)
 *  3. GM Approval (all requests)
 *  4. Amount Check: if > ₦100,000 → MD Approval required
 *  5. Final approval (GM or MD, whichever is last) → approvalStage
 *     becomes 'sent_to_store' — NOT 'approved' anymore. This is what
 *     makes an approved PR show up in Store's all-requisitions.html
 *     "Incoming POs" as something Store needs to act on.
 *  6. Store calls acceptPO() → 'fulfilled', or rejectPO() → 'rejected'
 *     (with a required reason). Both are new in this version — see
 *     below, right after rejectPR().
 *
 * The old 'approved' stage / createPO() flow (Procurement manually
 * typing in a PO number + supplier once fully approved) is left intact
 * for any records already sitting at 'approved' from before this
 * change, but approvePR() itself will never produce 'approved' again —
 * new approvals go straight to 'sent_to_store'.
 *
 * Load order on every page:
 *   <script src="../services/permissions.js"></script>
 *   <script src="../services/procurement-service.js"></script>
 *   <script src="procurement-shell.js"></script>
 *   <script src="procurement-modals.js"></script>
 */
(function (global) {
  'use strict';

  var CONFIG = {
    API_BASE: '/api/procurement',
    MD_APPROVAL_THRESHOLD: 100000,
    MODULE: 'procurement',
  };

  var _prs = [];
  var _suppliers = [];
  var _categories = [];

  var state = { prs: [], suppliers: [], categories: [], ready: false };
  var listeners = [];
  function onChange(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }
  function emitChange(reason) {
    listeners.forEach(function (fn) {
      try { fn(state, reason); } catch (e) { console.warn('[ProcurementService] listener error', e); }
    });
  }
  function syncState(reason) {
    state.prs = _prs.slice();
    state.suppliers = _suppliers.slice();
    state.categories = _categories.slice();
    emitChange(reason);
  }

  // ─── Session / Permissions ───────────────────────────────────

  function resolveSession(session) {
    if (session && session.role) return session;

    try {
      if (
        global.ProcurementShell &&
        typeof global.ProcurementShell.getLastUser === 'function'
      ) {
        var u = global.ProcurementShell.getLastUser();
        if (u && u.role) return u;
      }
    } catch (e) {}

    if (global.__procurementSession && global.__procurementSession.role) {
      return global.__procurementSession;
    }

    return {
      name: 'Procurement Officer',
      initials: 'PO',
      role: 'manager',
      privilege: 'procurement_manager',
    };
  }

  function requirePermission(permission, session, entity) {
    var s = resolveSession(session);
    var P = global.Permissions;

    if (!P || typeof P.hasPermission !== 'function') {
      throw new Error('Permissions module not loaded');
    }

    if (permission === 'canEdit' && typeof P.canEdit === 'function') {
      if (!P.canEdit(s, CONFIG.MODULE, entity)) {
        throw new Error('You do not have permission to edit this record');
      }
      return s;
    }
    if (permission === 'canDelete' && typeof P.canDelete === 'function') {
      if (!P.canDelete(s, CONFIG.MODULE, entity)) {
        throw new Error('You do not have permission to delete this record');
      }
      return s;
    }
    if (permission === 'canApprove' && typeof P.canApprove === 'function') {
      if (!P.canApprove(s, CONFIG.MODULE, entity)) {
        throw new Error('You do not have permission to approve');
      }
      return s;
    }
    if (!P.hasPermission(s, permission, CONFIG.MODULE)) {
      throw new Error('You do not have permission: ' + permission);
    }
    return s;
  }

  function actorName(session) {
    var s = resolveSession(session);
    return s.name || s.role || 'User';
  }

  // ─── Helpers ─────────────────────────────────────────────────

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function fmtN(n) {
    return '\u20A6' + Math.round(n || 0).toLocaleString('en-NG');
  }

  function fmtDate(d) {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function computeItemsTotal(items) {
    return (items || []).reduce(function (sum, i) {
      var qty = Number(i.qty) || 0;
      var price = i.price != null ? Number(i.price) : Number(i.cost) || 0;
      var subtotal = i.subtotal != null ? Number(i.subtotal) : qty * price;
      return sum + subtotal;
    }, 0);
  }

  // ─── API Fetch Helper ───────────────────────────────────────

  function apiFetch(path, opts) {
    opts = opts || {};
    var url = CONFIG.API_BASE + path;
    var headers = opts.headers || {};
    if (!(opts.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    return fetch(url, {
      method: opts.method || 'GET',
      headers: headers,
      credentials: 'include',
      body: opts.body instanceof FormData
        ? opts.body
        : (opts.body != null ? JSON.stringify(opts.body) : undefined),
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok || (body && body.success === false)) {
          throw new Error((body && body.error) || 'Request failed (' + res.status + ')');
        }
        return body && body.data !== undefined ? body.data : body;
      });
    });
  }

  // ─── Categories (backend) ───────────────────────────────────

  function getCategories() {
    return apiFetch('/categories');
  }

  function addCategory(name, session) {
    requirePermission('canCreate', session);
    var n = (name || '').trim();
    if (!n) throw new Error('Category name is required.');
    return apiFetch('/categories', {
      method: 'POST',
      body: { name: n },
    });
  }

  function renameCategory(oldName, newName, session) {
    requirePermission('canEdit', session);
    var n = (newName || '').trim();
    if (!n) throw new Error('Category name is required.');
    return apiFetch('/categories/' + encodeURIComponent(oldName), {
      method: 'PUT',
      body: { newName: n },
    });
  }

  function deleteCategory(name, opts, session) {
    requirePermission('canDelete', session);
    opts = opts || {};
    var reassignTo = (opts.reassignTo || 'Other').trim() || 'Other';
    return apiFetch('/categories/' + encodeURIComponent(name) + '?reassignTo=' + encodeURIComponent(reassignTo), {
      method: 'DELETE',
    });
  }

  // ─── Dashboard / Pipeline (backend) ─────────────────────────

  var PIPELINE_STAGES = ['pending', 'accountant', 'gm', 'md', 'sent_to_store', 'fulfilled'];
  var ACTIVE_STAGES = ['pending', 'accountant', 'gm', 'md', 'sent_to_store'];

  function dashboardKPIs() {
    return apiFetch('/dashboard');
  }

  function approvalPipelineCounts() {
    return apiFetch('/pipeline');
  }

  // ─── Item Catalog (backend) ─────────────────────────────────

  function getItemCatalog() {
    return apiFetch('/item-catalog');
  }

  // ─── PRs ─────────────────────────────────────────────────────

  function getPRs() {
    return apiFetch('/requests');
  }

  function getPR(id) {
    return apiFetch('/requests/' + id);
  }

  function getPOs() {
    return apiFetch('/requests').then(function (prs) {
      return (prs || []).filter(function (p) { return !!p.poNo; });
    });
  }

  function createPR(payload, session) {
    requirePermission('canCreate', session);
    return apiFetch('/requests', {
      method: 'POST',
      body: payload,
    });
  }

  function updatePR(id, updates, session) {
    if (session) {
      return getPR(id).then(function (existing) {
        requirePermission('canEdit', session, existing);
        return apiFetch('/requests/' + id, {
          method: 'PUT',
          body: updates,
        });
      });
    }
    return apiFetch('/requests/' + id, {
      method: 'PUT',
      body: updates,
    });
  }

  /**
   * Advances a PR through the approval chain. CHANGED: the final step
   * (GM approval when no MD is needed, or MD approval when it is) now
   * lands on approvalStage:'sent_to_store' instead of 'approved'. That's
   * the signal Store's all-requisitions.html watches for (via
   * StoreService.getIncomingPOs()) to show the PO as something Store
   * needs to act on.
   */
  function approvePR(id, roleOrSession, note) {
    var session =
      roleOrSession && typeof roleOrSession === 'object'
        ? roleOrSession
        : null;
    requirePermission('canApprove', session);
    return apiFetch('/requests/' + id + '/approve', {
      method: 'POST',
      body: { note: note || '' },
    });
  }

  function rejectPR(id, roleOrSession, note) {
    var session =
      roleOrSession && typeof roleOrSession === 'object'
        ? roleOrSession
        : null;
    var s = resolveSession(session);
    var P = global.Permissions;

    if (P && typeof P.hasPermission === 'function') {
      var ok =
        P.hasPermission(s, 'canReject', CONFIG.MODULE) ||
        P.hasPermission(s, 'canApprove', CONFIG.MODULE);
      if (!ok) throw new Error('You do not have permission to reject');
    }

    if (!note || !String(note).trim()) {
      throw new Error('Rejection reason is required');
    }

    return apiFetch('/requests/' + id + '/reject', {
      method: 'POST',
      body: { note: String(note).trim() },
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     STORE HANDOFF — acceptPO() / rejectPO()
     These are the two moves available to Store once a PR reaches
     'sent_to_store'. Both are the single source of truth for that
     transition — store-service.js's own acceptPO()/rejectPO() just
     delegate straight through to these, so there's exactly one place
     that ever flips a PO to 'fulfilled' or 'rejected'.
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Store accepts a PO. Only legal from 'sent_to_store' — this is
   * deliberately not reachable from 'approved' (the old, pre-this-change
   * terminal stage) so a stale record from before this update doesn't
   * suddenly become acceptable without having gone through Store's
   * actual queue.
   */
  function acceptPO(prId, session) {
    var s = requirePermission('canEdit', session);
    return getPR(prId).then(function (pr) {
      if (!pr) throw new Error('PR not found');
      if (pr.approvalStage !== 'sent_to_store') {
        throw new Error('This PO is not currently awaiting Store action.');
      }
      var by = actorName(s);
      return apiFetch('/requests/' + prId, {
        method: 'PUT',
        body: {
          status: 'fulfilled',
          approvalStage: 'fulfilled',
          history: (pr.history || []).concat([
            {
              date: todayISO(),
              action: 'Accepted by Store',
              by: by,
              note: '',
              stage: 'fulfilled',
            },
          ]),
        },
      });
    });
  }

  /**
   * Store rejects a PO, with a required reason (kept on the record as
   * `rejectReason` for po-history.html / all-requisitions.html to show).
   * Same 'sent_to_store' guard as acceptPO().
   */
  function rejectPO(prId, reason, session) {
    var r = (reason || '').trim();
    if (!r) throw new Error('Please provide a reason for rejecting this PO.');

    var s = requirePermission('canEdit', session);
    return getPR(prId).then(function (pr) {
      if (!pr) throw new Error('PR not found');
      if (pr.approvalStage !== 'sent_to_store') {
        throw new Error('This PO is not currently awaiting Store action.');
      }
      var by = actorName(s);
      return apiFetch('/requests/' + prId, {
        method: 'PUT',
        body: {
          status: 'rejected',
          approvalStage: 'rejected',
          rejectReason: r,
          history: (pr.history || []).concat([
            {
              date: todayISO(),
              action: 'Rejected by Store',
              by: by,
              note: r,
              stage: 'rejected',
            },
          ]),
        },
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     VOID & CORRECT — only legal from 'fulfilled' (Store already
     accepted the PO, but the actual market purchase came back short /
     different). Voids the original, raises a corrected PR that skips
     re-approval and goes straight to 'sent_to_store'.
  ══════════════════════════════════════════════════════════════════ */
  function voidAndCorrectPO(prId, payload, session) {
    requirePermission('canEdit', session);
    var reason = (payload.reason || '').trim();
    if (!reason) throw new Error('A reason for voiding is required');
    var items = payload.items || [];
    if (!items.length) throw new Error('Corrected items are required');

    return apiFetch('/requests/' + prId + '/void-correct', {
      method: 'POST',
      body: { items: items, reason: reason },
    });
  }

  function createPO(prId, poNo, supplier, session) {
    requirePermission('canCreate', session);
    if (!poNo || !String(poNo).trim()) throw new Error('PO number is required');
    if (!supplier || !String(supplier).trim()) {
      throw new Error('Supplier is required');
    }
    return apiFetch('/requests/' + prId + '/create-po', {
      method: 'POST',
      body: { poNo: String(poNo).trim(), supplier: String(supplier).trim() },
    });
  }

  // ─── Suppliers ───────────────────────────────────────────────

  function getSuppliers() {
    return apiFetch('/suppliers');
  }

  function getSupplierById(id) {
    return apiFetch('/suppliers/' + id);
  }

  function createSupplier(entry, session) {
    requirePermission('canCreate', session);
    return apiFetch('/suppliers', {
      method: 'POST',
      body: entry,
    });
  }

  function updateSupplier(id, updates, session) {
    requirePermission('canEdit', session);
    return apiFetch('/suppliers/' + id, {
      method: 'PUT',
      body: updates,
    });
  }

  // ─── Purchase Order create/edit (used by po-form.html) ─────────

  function deletePR(id, session) {
    requirePermission('canCreate', session);
    return apiFetch('/requests/' + encodeURIComponent(id), {
      method: 'DELETE',
    });
  }

  function createPurchaseOrder(payload, session) {
    var totalAmount = computeItemsTotal(payload.items);
    return createPR(
      Object.assign({}, payload, {
        totalAmount: totalAmount,
        item: (payload.items || []).map(function (i) { return i.name; }).join(', '),
      }),
      session
    );
  }

  function updatePurchaseOrder(id, payload, session) {
    return getPR(id).then(function (existing) {
      if (!existing) throw new Error('Purchase order not found.');
      var items = payload.items || existing.items || [];
      var totalAmount = computeItemsTotal(items);
      var needsMDApproval = totalAmount > CONFIG.MD_APPROVAL_THRESHOLD;
      return updatePR(
        id,
        Object.assign({}, payload, {
          items: items,
          totalAmount: totalAmount,
          needsMDApproval: needsMDApproval,
          item: items.map(function (i) { return i.name; }).join(', '),
        }),
        session
      );
    });
  }

  // ─── loadAll ─────────────────────────────────────────────────

  function loadAll() {
    return Promise.all([
      apiFetch('/requests').then(function (prs) {
        _prs = Array.isArray(prs) ? prs : [];
      }),
      apiFetch('/suppliers').then(function (sp) {
        _suppliers = Array.isArray(sp) ? sp : [];
      }),
      apiFetch('/categories').then(function (cats) {
        _categories = Array.isArray(cats) ? cats : [];
      }),
    ]).then(function () {
      syncState('load');
      state.ready = true;
      return state;
    });
  }

  // ─── Public surface ──────────────────────────────────────────

  var api = {
    CONFIG: CONFIG,
    resolveSession: resolveSession,
    state: state,
    onChange: onChange,
    loadAll: loadAll,
    dashboardKPIs: dashboardKPIs,
    approvalPipelineCounts: approvalPipelineCounts,
    getPRs: getPRs,
    getPR: getPR,
    getPOs: getPOs,
    createPR: createPR,
    updatePR: updatePR,
    approvePR: approvePR,
    rejectPR: rejectPR,
    acceptPO: acceptPO,
    rejectPO: rejectPO,
    voidAndCorrectPO: voidAndCorrectPO,
    createPO: createPO,
    createPurchaseOrder: createPurchaseOrder,
    updatePurchaseOrder: updatePurchaseOrder,
    deletePR: deletePR,
    getItemCatalog: getItemCatalog,
    getSuppliers: getSuppliers,
    getSupplierById: getSupplierById,
    createSupplier: createSupplier,
    updateSupplier: updateSupplier,
    getCategories: getCategories,
    addCategory: addCategory,
    renameCategory: renameCategory,
    deleteCategory: deleteCategory,
    fmtN: fmtN,
    fmtDate: fmtDate,
    todayISO: todayISO,
    computeItemsTotal: computeItemsTotal,
    PIPELINE_STAGES: PIPELINE_STAGES,
    ACTIVE_STAGES: ACTIVE_STAGES,
  };

  global.ProcurementService = api;
  global.ProcurementAPI = api;
})(window);
