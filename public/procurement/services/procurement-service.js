/**
 * services/procurement-service.js — Procurement CRUD + approval flow
 * Classic IIFE so shell, modals, and pages can use it without modules.
 *
 * Mirrors the poolbar-service pattern:
 *  - Reads seed from ProcurementSeed (data/procurement-seed.js)
 *  - Persists to localStorage in demo mode
 *  - Resolves session via shell / __procurementSession / demo default
 *  - Gates mutate actions with window.Permissions (module: 'procurement')
 *  - Same public surface pages already use as ProcurementAPI
 *
 * Approval flow:
 *  1. Purchase Request (any department)
 *  2. Accountant Approval (all requests)
 *  3. GM Approval (all requests)
 *  4. Amount Check: if > ₦100,000 → MD Approval required
 *  5. Create PO (after all approvals) → fulfilled
 *
 * WHAT'S NEW IN THIS VERSION
 * ─────────────────────────
 * Added `source` ('Store' | 'Procurement') to every PR/PO record — who
 * actually raised it, independent of `dept` (which department the goods
 * are FOR). This is what lets po-history.html show a clean two-value
 * "Store vs Procurement" column instead of the full department list, and
 * lets the Amount column correctly dash out for Store-raised requests
 * that haven't been priced by Procurement yet (Store doesn't set cost —
 * see new-purchase-order.html's edit mode).
 *
 * FLAG: `source` is not yet wired to any real handoff from Store's own
 * purchase-mode requisitions (services/store-service.js submitRequisition
 * with mode:'purchase') — those still live in a completely separate data
 * store (req:<no>/req-index) from this module's DEMO_PR/hotel-procurement
 * key. Until that integration exists, `source` on demo rows is hand-set
 * in data/procurement-seed.js, and new POs created from
 * new-purchase-order.html default to 'Procurement'. Treat any PR you see
 * with source:'Store' here as illustrative, not a real cross-module link.
 *
 * ALSO NEW: createPurchaseOrder() / updatePurchaseOrder() / getItemCatalog()
 * — added so po-form.html (create + edit a PO) is call-and-render only.
 * PR/PO numbering, items-total + MD-approval recompute, and the item-name
 * autocomplete list all live here now instead of in the page. See each
 * function's docstring below.
 *
 * ALSO NEW: a full Category Management API — getCategories() /
 * addCategory() / renameCategory() / deleteCategory() — plus
 * updateSupplier() / getSupplierById(). suppliers.html was already
 * calling all of these; they simply didn't exist yet, which is why you'd
 * see "ProcurementService.getCategories is not a function" the moment
 * that page loaded. Unlike Store's stock categories (which are purely
 * derived from what's currently on an item), Procurement's supplier
 * categories are their own persisted list — a category with zero
 * suppliers in it right now still exists and still counts, since
 * suppliers.html's "Categories Tracked" KPI is about categories DEFINED
 * in the system, not just ones currently in use. See the "Categories"
 * section below.
 *
 * Load order on every page:
 *   <script src="../services/permissions.js"></script>
 *   <script src="../data/procurement-seed.js"></script>
 *   <script src="../services/procurement-service.js"></script>
 *   <script src="procurement-shell.js"></script>
 *   <script src="procurement-modals.js"></script>
 */
(function (global) {
  'use strict';

  const CONFIG = {
    USE_PROD: false,
    API_BASE: 'https://your-api-server.com/api',
    API_KEY: '',
    DEMO_MODE: true,
    MD_APPROVAL_THRESHOLD: 100000,
    MODULE: 'procurement',
  };

  const KEY_PR = 'hotel-procurement';
  const KEY_SUPPLIERS = 'hotel-suppliers';
  const KEY_CATEGORIES = 'hotel-procurement-categories';

  const data = global.ProcurementSeed || {
    DEMO_PR: [],
    DEMO_SUPPLIERS: [],
  };

  let DEMO_PR = Array.isArray(data.DEMO_PR) ? data.DEMO_PR.slice() : [];
  let DEMO_SUPPLIERS = Array.isArray(data.DEMO_SUPPLIERS)
    ? data.DEMO_SUPPLIERS.slice()
    : [];
  // Independently-managed list of supplier categories — NOT derived from
  // DEMO_SUPPLIERS on the fly (that would make an empty category
  // disappear the moment its last supplier is reassigned/deleted, which
  // is exactly the behaviour suppliers.html's KPI comment says it does
  // NOT want). Seeded once from whatever categories exist on the demo
  // suppliers, then lives entirely on its own after that.
  let DEMO_CATEGORIES = [];

  // ─── Reactive state (mirrors RestaurantService/PoolBarService/KitchenService) ───
  // Lets pages render the kitchen-dashboard.html way: loadAll() once,
  // paint from state, subscribe with onChange(paint) — instead of pulling
  // DEMO_PR/localStorage themselves. Every mutation below calls
  // syncState() after persisting so this never goes stale.
  const state = { prs: [], suppliers: [], categories: [], ready: false };
  const listeners = [];
  function onChange(fn) {
    listeners.push(fn);
    return function () {
      const i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }
  function emitChange(reason) {
    listeners.forEach(function (fn) {
      try { fn(state, reason); } catch (e) { console.warn('[ProcurementService] listener error', e); }
    });
  }
  function syncState(reason) {
    state.prs = DEMO_PR.slice();
    state.suppliers = DEMO_SUPPLIERS.slice();
    state.categories = DEMO_CATEGORIES.slice();
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
        const u = global.ProcurementShell.getLastUser();
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
    const s = resolveSession(session);
    const P = global.Permissions;

    if (!P || typeof P.hasPermission !== 'function') {
      if (CONFIG.DEMO_MODE) return s;
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
    const s = resolveSession(session);
    return s.name || s.role || 'User';
  }

  // ─── Helpers ─────────────────────────────────────────────────

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function fmtN(n) {
    return '₦' + Math.round(n || 0).toLocaleString('en-NG');
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function loadFromStorage() {
    try {
      const rawPr = localStorage.getItem(KEY_PR);
      if (rawPr) {
        const parsed = JSON.parse(rawPr);
        if (Array.isArray(parsed) && parsed.length) DEMO_PR = parsed;
      } else {
        localStorage.setItem(KEY_PR, JSON.stringify(DEMO_PR));
      }

      const rawSp = localStorage.getItem(KEY_SUPPLIERS);
      if (rawSp) {
        const parsed = JSON.parse(rawSp);
        if (Array.isArray(parsed) && parsed.length) DEMO_SUPPLIERS = parsed;
      } else {
        localStorage.setItem(KEY_SUPPLIERS, JSON.stringify(DEMO_SUPPLIERS));
      }
    } catch (e) {}
  }

  function savePRs() {
    try {
      localStorage.setItem(KEY_PR, JSON.stringify(DEMO_PR));
    } catch (e) {}
  }

  function saveSuppliers() {
    try {
      localStorage.setItem(KEY_SUPPLIERS, JSON.stringify(DEMO_SUPPLIERS));
    } catch (e) {}
  }

  // ─── Categories ─────────────────────────────────────────────
  // Independently persisted list, seeded once from the categories that
  // happen to exist on DEMO_SUPPLIERS, then managed entirely on its own.

  function deriveDefaultCategories() {
    const set = new Set();
    DEMO_SUPPLIERS.forEach(function (sp) { if (sp.cat) set.add(sp.cat); });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  function sortCategories() {
    DEMO_CATEGORIES.sort(function (a, b) { return a.localeCompare(b); });
  }

  function loadCategoriesFromStorage() {
    try {
      const raw = localStorage.getItem(KEY_CATEGORIES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          DEMO_CATEGORIES = parsed;
          return;
        }
      }
    } catch (e) {}
    DEMO_CATEGORIES = deriveDefaultCategories();
    saveCategories();
  }

  function saveCategories() {
    try {
      localStorage.setItem(KEY_CATEGORIES, JSON.stringify(DEMO_CATEGORIES));
    } catch (e) {}
  }

  function getCategories() {
    return DEMO_CATEGORIES.slice();
  }

  async function addCategory(name, session) {
    requirePermission('canCreate', session);
    const n = (name || '').trim();
    if (!n) throw new Error('Category name is required.');
    const exists = DEMO_CATEGORIES.some(function (c) { return c.toLowerCase() === n.toLowerCase(); });
    if (exists) throw new Error(`Category "${n}" already exists.`);
    DEMO_CATEGORIES.push(n);
    sortCategories();
    saveCategories();
    syncState('category:add');
    return n;
  }

  async function renameCategory(oldName, newName, session) {
    requirePermission('canEdit', session);
    const n = (newName || '').trim();
    if (!n) throw new Error('Category name is required.');
    const idx = DEMO_CATEGORIES.findIndex(function (c) { return c === oldName; });
    if (idx === -1) throw new Error(`Category "${oldName}" not found.`);
    if (n.toLowerCase() !== oldName.toLowerCase() &&
        DEMO_CATEGORIES.some(function (c) { return c.toLowerCase() === n.toLowerCase(); })) {
      throw new Error(`Category "${n}" already exists.`);
    }
    DEMO_CATEGORIES[idx] = n;
    sortCategories();
    // Re-point every supplier that was using the old name.
    DEMO_SUPPLIERS.forEach(function (sp) { if (sp.cat === oldName) sp.cat = n; });
    saveCategories();
    saveSuppliers();
    syncState('category:rename');
    return n;
  }

  async function deleteCategory(name, opts, session) {
    requirePermission('canDelete', session);
    opts = opts || {};
    const reassignTo = (opts.reassignTo || 'Other').trim() || 'Other';
    const idx = DEMO_CATEGORIES.findIndex(function (c) { return c === name; });
    if (idx === -1) throw new Error(`Category "${name}" not found.`);
    DEMO_CATEGORIES.splice(idx, 1);
    if (!DEMO_CATEGORIES.some(function (c) { return c.toLowerCase() === reassignTo.toLowerCase(); })) {
      DEMO_CATEGORIES.push(reassignTo);
    }
    sortCategories();
    // Any supplier using the deleted category falls back to reassignTo.
    DEMO_SUPPLIERS.forEach(function (sp) { if (sp.cat === name) sp.cat = reassignTo; });
    saveCategories();
    saveSuppliers();
    syncState('category:delete');
  }

  function resetDemoData() {
    const seed = global.ProcurementSeed || {};
    DEMO_PR = Array.isArray(seed.DEMO_PR) ? seed.DEMO_PR.slice() : [];
    DEMO_SUPPLIERS = Array.isArray(seed.DEMO_SUPPLIERS)
      ? seed.DEMO_SUPPLIERS.slice()
      : [];
    DEMO_CATEGORIES = deriveDefaultCategories();
    savePRs();
    saveSuppliers();
    saveCategories();
    syncState('reset');
    return { prs: DEMO_PR.length, suppliers: DEMO_SUPPLIERS.length, categories: DEMO_CATEGORIES.length };
  }

  loadFromStorage();
  loadCategoriesFromStorage();

  /**
   * (Re)reads from storage and populates `state`. Call once on page init —
   * same pattern as RestaurantService.loadAll() / KitchenService.loadAll().
   * Safe to call more than once.
   */
  async function loadAll() {
    loadFromStorage();
    loadCategoriesFromStorage();
    syncState('load');
    state.ready = true;
    return state;
  }

  // ─── PRs ─────────────────────────────────────────────────────

  async function getPRs() {
    if (CONFIG.USE_PROD) {
      const res = await fetch(CONFIG.API_BASE + '/prs', {
        headers: { Authorization: 'Bearer ' + CONFIG.API_KEY },
      });
      return await res.json();
    }
    return DEMO_PR.slice();
  }

  async function getPR(id) {
    if (CONFIG.USE_PROD) {
      const res = await fetch(CONFIG.API_BASE + '/prs/' + id, {
        headers: { Authorization: 'Bearer ' + CONFIG.API_KEY },
      });
      return await res.json();
    }
    return DEMO_PR.find(function (p) {
      return p.id === id;
    });
  }

  function getPOs() {
    return DEMO_PR.filter(function (p) {
      return !!p.poNo;
    });
  }

  async function createPR(payload, session) {
    const s = requirePermission('canCreate', session);

    if (CONFIG.USE_PROD) {
      const res = await fetch(CONFIG.API_BASE + '/prs', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + CONFIG.API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      return await res.json();
    }

    const qty = Number(payload.qty) || 1;
    const unitCost =
      Number(payload.unitCost) || Number(payload.totalAmount) || 0;
    const totalAmount =
      payload.totalAmount != null
        ? Number(payload.totalAmount)
        : qty * unitCost;
    const needsMDApproval = totalAmount > CONFIG.MD_APPROVAL_THRESHOLD;
    const by = payload.by || actorName(s);

    const newPR = {
      id: payload.id || 'pr_' + Date.now(),
      prNo:
        payload.prNo ||
        'PR-' + String(Math.floor(Math.random() * 900) + 100),
      poNo: payload.poNo || '',
      item: payload.item || '',
      cat: payload.cat || '',
      dept: payload.dept || '',
      // Who raised this PO — 'Store' or 'Procurement'. Defaults to
      // 'Procurement' since createPR() is currently only ever called from
      // new-purchase-order.html (a Procurement-side form). See the FLAG
      // note at the top of this file re: Store integration.
      source: payload.source || 'Procurement',
      by: by,
      date: payload.date || todayISO(),
      needed: payload.needed || '',
      qty: qty,
      unit: payload.unit || 'Units',
      unitCost: unitCost,
      priority: payload.priority || 'Normal',
      totalAmount: totalAmount,
      needsMDApproval: needsMDApproval,
      status: 'pending',
      supplier: payload.supplier || '',
      notes: payload.notes || '',
      items: payload.items || [],
      approvalStage: 'pending',
      history: [
        {
          date: todayISO(),
          action: 'Request submitted',
          by: by,
          note: '',
          stage: 'pending',
        },
      ],
    };

    DEMO_PR.unshift(newPR);
    savePRs();
    syncState('pr:create');
    return newPR;
  }

  async function updatePR(id, updates, session) {
    if (session) {
      const existing = await getPR(id);
      requirePermission('canEdit', session, existing);
    }

    if (CONFIG.USE_PROD) {
      const res = await fetch(CONFIG.API_BASE + '/prs/' + id, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + CONFIG.API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      return await res.json();
    }

    const idx = DEMO_PR.findIndex(function (p) {
      return p.id === id;
    });
    if (idx === -1) throw new Error('PR not found');

    DEMO_PR[idx] = Object.assign({}, DEMO_PR[idx], updates);
    savePRs();
    syncState('pr:update');
    return DEMO_PR[idx];
  }

  async function approvePR(id, roleOrSession, note) {
    const session =
      roleOrSession && typeof roleOrSession === 'object'
        ? roleOrSession
        : null;
    const s = requirePermission('canApprove', session);
    const pr = await getPR(id);
    if (!pr) throw new Error('PR not found');

    let nextStage = pr.approvalStage;
    let action = '';
    let approvedBy = actorName(s);

    switch (pr.approvalStage) {
      case 'pending':
        nextStage = 'accountant';
        action = 'Accountant approved';
        if (!session) approvedBy = 'Accountant';
        break;
      case 'accountant':
        nextStage = 'gm';
        action = 'GM approved';
        if (!session) approvedBy = 'General Manager';
        break;
      case 'gm':
        if (pr.totalAmount > CONFIG.MD_APPROVAL_THRESHOLD) {
          nextStage = 'md';
          action = 'Forwarded to MD';
          if (!session) approvedBy = 'General Manager';
        } else {
          nextStage = 'approved';
          action = 'Fully approved';
          if (!session) approvedBy = 'General Manager';
        }
        break;
      case 'md':
        nextStage = 'approved';
        action = 'MD approved';
        if (!session) approvedBy = 'Managing Director';
        break;
      default:
        throw new Error('Cannot approve from stage: ' + pr.approvalStage);
    }

    return await updatePR(id, {
      approvalStage: nextStage,
      status: nextStage === 'approved' ? 'approved' : nextStage,
      history: (pr.history || []).concat([
        {
          date: todayISO(),
          action: action,
          by: approvedBy,
          note: note || '',
          stage: nextStage,
        },
      ]),
    });
  }

  async function rejectPR(id, roleOrSession, note) {
    const session =
      roleOrSession && typeof roleOrSession === 'object'
        ? roleOrSession
        : null;
    const s = resolveSession(session);
    const P = global.Permissions;

    if (P && typeof P.hasPermission === 'function') {
      const ok =
        P.hasPermission(s, 'canReject', CONFIG.MODULE) ||
        P.hasPermission(s, 'canApprove', CONFIG.MODULE);
      if (!ok) throw new Error('You do not have permission to reject');
    }

    const pr = await getPR(id);
    if (!pr) throw new Error('PR not found');
    if (!note || !String(note).trim()) {
      throw new Error('Rejection reason is required');
    }

    const by =
      actorName(s) ||
      (typeof roleOrSession === 'string' && roleOrSession === 'gm'
        ? 'General Manager'
        : 'Managing Director');

    return await updatePR(id, {
      status: 'rejected',
      approvalStage: 'rejected',
      history: (pr.history || []).concat([
        {
          date: todayISO(),
          action: 'Rejected',
          by: by,
          note: String(note).trim(),
          stage: 'rejected',
        },
      ]),
    });
  }

  async function createPO(prId, poNo, supplier, session) {
    requirePermission('canCreate', session);
    const pr = await getPR(prId);
    if (!pr) throw new Error('PR not found');
    if (pr.approvalStage !== 'approved') {
      throw new Error('PR must be fully approved before creating a PO');
    }
    if (!poNo || !String(poNo).trim()) throw new Error('PO number is required');
    if (!supplier || !String(supplier).trim()) {
      throw new Error('Supplier is required');
    }

    const by = actorName(session);

    return await updatePR(prId, {
      status: 'fulfilled',
      approvalStage: 'fulfilled',
      poNo: String(poNo).trim(),
      supplier: String(supplier).trim(),
      history: (pr.history || []).concat([
        {
          date: todayISO(),
          action: 'PO Created',
          by: by,
          note: 'PO ' + poNo + ' issued to ' + supplier,
          stage: 'fulfilled',
        },
      ]),
    });
  }

  // ─── Suppliers ───────────────────────────────────────────────

  async function getSuppliers() {
    if (CONFIG.USE_PROD) {
      const res = await fetch(CONFIG.API_BASE + '/suppliers', {
        headers: { Authorization: 'Bearer ' + CONFIG.API_KEY },
      });
      return await res.json();
    }
    return DEMO_SUPPLIERS.slice();
  }

  function getSupplierById(id) {
    return DEMO_SUPPLIERS.find(function (sp) { return sp.id === id; }) || null;
  }

  async function createSupplier(entry, session) {
    requirePermission('canCreate', session);

    if (CONFIG.USE_PROD) {
      const res = await fetch(CONFIG.API_BASE + '/suppliers', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + CONFIG.API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
      return await res.json();
    }

    const name = (entry.name || '').trim();
    if (!name) throw new Error('Supplier name is required');
    const exists = DEMO_SUPPLIERS.some(function (sp) {
      return (sp.name || '').toLowerCase() === name.toLowerCase();
    });
    if (exists) throw new Error('A supplier with that name already exists');

    const row = {
      id: entry.id || 'sp_' + Date.now(),
      name: name,
      cat: entry.cat || 'Food & Beverage',
      status: entry.status || 'Active',
      contact: entry.contact || '—',
      phone: entry.phone || '—',
      email: entry.email || '—',
      address: entry.address || '',
      notes: entry.notes || '',
      rating: entry.rating != null ? entry.rating : 0,
    };
    DEMO_SUPPLIERS.push(row);
    saveSuppliers();
    syncState('supplier:create');
    return row;
  }

  /**
   * Edit an existing supplier. Same duplicate-name check as
   * createSupplier(), but excludes the supplier being edited from that
   * check (so saving a supplier without renaming it doesn't false-positive
   * against itself).
   */
  async function updateSupplier(id, updates, session) {
    requirePermission('canEdit', session);

    if (CONFIG.USE_PROD) {
      const res = await fetch(CONFIG.API_BASE + '/suppliers/' + id, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + CONFIG.API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      return await res.json();
    }

    const idx = DEMO_SUPPLIERS.findIndex(function (sp) { return sp.id === id; });
    if (idx === -1) throw new Error('Supplier not found.');

    const name = (updates.name || '').trim();
    if (!name) throw new Error('Supplier name is required');
    const dup = DEMO_SUPPLIERS.some(function (sp, i) {
      return i !== idx && (sp.name || '').toLowerCase() === name.toLowerCase();
    });
    if (dup) throw new Error('A supplier with that name already exists');

    DEMO_SUPPLIERS[idx] = Object.assign({}, DEMO_SUPPLIERS[idx], updates, { name: name });
    saveSuppliers();
    syncState('supplier:update');
    return DEMO_SUPPLIERS[idx];
  }

  // ─── Purchase Order create/edit (used by po-form.html) ─────────
  // po-form.html is call-and-render only: it gathers what's on screen and
  // hands it to one of these, which own numbering, items-total + MD flag
  // recompute, and persistence (via createPR/updatePR above).

  function nextPurchaseOrderNumbers() {
    const n = DEMO_PR.length + 1;
    const year = new Date().getFullYear();
    const seq = String(n).padStart(3, '0');
    return { prNo: 'PR-' + year + '-' + seq, poNo: 'PO-' + year + '-' + seq };
  }

  function computeItemsTotal(items) {
    return (items || []).reduce(function (sum, i) {
      const qty = Number(i.qty) || 0;
      const price = i.price != null ? Number(i.price) : Number(i.cost) || 0;
      const subtotal = i.subtotal != null ? Number(i.subtotal) : qty * price;
      return sum + subtotal;
    }, 0);
  }

  /**
   * Create a new purchase order. Assigns sequential PR/PO numbers (unless
   * already supplied), computes totalAmount from `payload.items`, and
   * derives the `item` summary string — then persists via createPR(),
   * which itself derives needsMDApproval from totalAmount.
   */
  async function createPurchaseOrder(payload, session) {
    const nums = nextPurchaseOrderNumbers();
    const totalAmount = computeItemsTotal(payload.items);
    return createPR(
      Object.assign({}, payload, {
        prNo: payload.prNo || nums.prNo,
        poNo: payload.poNo || nums.poNo,
        totalAmount: totalAmount,
        item: (payload.items || []).map(function (i) { return i.name; }).join(', '),
      }),
      session
    );
  }

  /**
   * Edit an existing purchase order. Recomputes totalAmount and
   * needsMDApproval from the (possibly changed) items list, then persists
   * via updatePR(). Fields not present on `payload` are left untouched.
   */
  async function updatePurchaseOrder(id, payload, session) {
    const existing = await getPR(id);
    if (!existing) throw new Error('Purchase order not found.');
    const items = payload.items || existing.items || [];
    const totalAmount = computeItemsTotal(items);
    const needsMDApproval = totalAmount > CONFIG.MD_APPROVAL_THRESHOLD;
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
  }

  /**
   * Item-name + last-price suggestions for the po-form.html entry-row
   * autocomplete, derived from every item ever purchased across DEMO_PR.
   * No separate localStorage cache — this IS the cache, computed fresh.
   */
  function getItemCatalog() {
    const seen = new Set();
    const list = [];
    DEMO_PR.forEach(function (pr) {
      (pr.items || []).forEach(function (it) {
        const key = (it.name || '').trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        const price = it.price != null ? it.price : (it.cost || 0);
        list.push({ name: (it.name || '').trim(), price: price });
      });
    });
    return list;
  }

  // ─── Dashboard aggregates (used by procurement-dashboard.html) ─
  const PIPELINE_STAGES = ['pending', 'accountant', 'gm', 'md', 'approved'];
  const ACTIVE_STAGES = ['pending', 'accountant', 'gm', 'md'];

  function dashboardKPIs() {
    const prs = state.ready ? state.prs : DEMO_PR;
    const pending = prs.filter(function (p) {
      return ACTIVE_STAGES.indexOf(p.approvalStage) > -1;
    }).length;
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const closedThisMonth = prs.filter(function (p) {
      return (p.approvalStage === 'approved' || p.approvalStage === 'fulfilled') &&
        (p.date || '').startsWith(monthPrefix);
    });
    const needsMD = prs.filter(function (p) {
      return p.needsMDApproval && ACTIVE_STAGES.indexOf(p.approvalStage) > -1;
    }).length;
    return {
      pending: pending,
      approvedThisMonth: closedThisMonth.length,
      spendThisMonth: closedThisMonth.reduce(function (s, p) { return s + (p.totalAmount || 0); }, 0),
      needsMD: needsMD,
    };
  }

  function approvalPipelineCounts() {
    const prs = state.ready ? state.prs : DEMO_PR;
    const counts = {};
    PIPELINE_STAGES.forEach(function (stage) {
      counts[stage] = prs.filter(function (p) { return p.approvalStage === stage; }).length;
    });
    return counts;
  }

  // ─── Public surface ──────────────────────────────────────────

  const api = {
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
    createPO: createPO,
    createPurchaseOrder: createPurchaseOrder,
    updatePurchaseOrder: updatePurchaseOrder,
    getItemCatalog: getItemCatalog,
    getSuppliers: getSuppliers,
    getSupplierById: getSupplierById,
    createSupplier: createSupplier,
    updateSupplier: updateSupplier,
    getCategories: getCategories,
    addCategory: addCategory,
    renameCategory: renameCategory,
    deleteCategory: deleteCategory,
    resetDemoData: resetDemoData,
    fmtN: fmtN,
    fmtDate: fmtDate,
    todayISO: todayISO,
    get DEMO_PR() {
      return DEMO_PR;
    },
    set DEMO_PR(v) {
      DEMO_PR = Array.isArray(v) ? v : [];
      savePRs();
      syncState('pr:set');
    },
    get DEMO_SUPPLIERS() {
      return DEMO_SUPPLIERS;
    },
    set DEMO_SUPPLIERS(v) {
      DEMO_SUPPLIERS = Array.isArray(v) ? v : [];
      saveSuppliers();
      syncState('supplier:set');
    },
    get DEMO_CATEGORIES() {
      return DEMO_CATEGORIES;
    },
    set DEMO_CATEGORIES(v) {
      DEMO_CATEGORIES = Array.isArray(v) ? v : [];
      saveCategories();
      syncState('category:set');
    },
  };

  global.ProcurementService = api;
  global.ProcurementAPI = api;
})(window);