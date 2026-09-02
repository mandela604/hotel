/**
 * services/store-service.js — Shared data + business logic for the Store module
 *
 * PRODUCTION VERSION: talks to the real backend (routes/store.js →
 * controllers/storeController.js) over HTTP. No demo/localStorage fallback.
 */
(function (global) {
  'use strict';

  const CONFIG = {
    API_BASE: '/api/store',
  };

  const KEYS = {
    REQ_INDEX: 'req-index',
    STOCK: 'store-stock',
  };

  const DEPT_PREFIX = { Kitchen: 'KREQ', Housekeeping: 'HREQ', 'Pool Bar': 'BREQ', 'Front Desk': 'FREQ', Gym: 'GREQ', Store: 'PR' };

  function fmtN(n) { return '\u20A6' + Math.round(n || 0).toLocaleString('en-NG'); }
  function todayISO() { return new Date().toISOString().split('T')[0]; }
  function todayDisplay() {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(d) {
    if (!d) return '\u2014';
    return new Date(d + (d.includes && d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function stockLevel(s) {
    const qty = Number(s && s.qty) || 0;
    const min = Number(s && s.min) || 0;
    if (qty <= 0) return 'out';
    if (qty <= min) return 'low';
    return 'ok';
  }
  const LEVEL_CHIP = { ok: 'chip-ok', low: 'chip-low', out: 'chip-out' };
  const LEVEL_LABEL = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };

  const state = { requests: [], stock: [], categories: [], catalog: [], ready: false };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[StoreService] listener error', e); } }); }

  function getToken() {
    // httpOnly cookie is sent automatically — no localStorage token needed.
    return '';
  }

  async function apiFetch(path, options) {
    options = options || {};
    // httpOnly cookie is sent automatically — no Authorization header needed.
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});

    let res;
    try {
      res = await fetch(CONFIG.API_BASE + path, Object.assign({}, options, { headers }));
    } catch (networkErr) {
      const err = new Error('Network error contacting server: ' + networkErr.message);
      err.code = 'NETWORK_ERROR';
      throw err;
    }

    let body = null;
    try { body = await res.json(); } catch (e) { /* no/invalid JSON */ }

    if (!res.ok || (body && body.success === false)) {
      const msg = (body && body.error) || ('Request failed (' + res.status + ')');
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    return body ? body.data : null;
  }

  function normalizeStock(s) {
    if (!s) return s;
    return {
      id: s.id || s._id || '',
      name: s.name || '',
      cat: s.cat || 'Other',
      unit: s.unit || 'unit',
      baseUnit: s.baseUnit || '',
      packSize: Number(s.packSize) || 0,
      qty: Number(s.qty) || 0,
      cost: Number(s.cost) || 0,
      min: Number(s.min) || 0,
    };
  }

  function normalizeRequisition(r) {
    if (!r) return r;
    return {
      no: r.requisitionNo || r.no || '',
      mode: r.mode || 'store_issue',
      by: r.requester || r.by || '',
      dept: r.dept || '',
      needed: r.neededBy || r.needed || '',
      priority: r.priority || 'Normal',
      remark: r.remark || '',
      fulfillStore: r.fulfillStore || null,
      supplier: r.supplier || null,
      linked: r.linked || null,
      items: (r.items || []).map(function (it) {
        return {
          name: it.name || '', stockId: it.stockId || '', unit: it.unit || 'unit', packSize: Number(it.packSize) || 0, baseUnit: it.baseUnit || '', qty: Number(it.qty) || 0,
          cost: Number(it.cost) || 0, remark: it.remark || '', issuedQty: Number(it.issuedQty) || 0,
        };
      }),
      status: r.status || 'Pending',
      rejectReason: r.rejectReason || '',
      disputeReason: r.disputeReason || '',
      dateRaised: r.dateRaised || '',
      dateRaisedDisplay: r.dateRaisedDisplay || '',
      procurementPrId: r.procurementPrId || null,
      procurementPrNo: r.procurementPrNo || '',
    };
  }

  function stockToPayload(fe) {
    return {
      name: fe.name,
      cat: fe.cat || 'Other',
      unit: fe.unit || 'unit',
      baseUnit: fe.baseUnit || '',
      packSize: Number(fe.packSize) || 0,
      min: Number(fe.min) || 0,
      cost: Number(fe.cost) || 0,
    };
  }

  function requisitionToPayload(fe) {
    return {
      mode: fe.mode || 'store_issue',
      by: fe.by || '',
      dept: fe.dept || '',
      needed: fe.needed || '',
      priority: fe.priority || 'Normal',
      remark: fe.remark || '',
      fulfillStore: fe.fulfillStore || null,
      supplier: fe.supplier || null,
      linked: fe.linked || null,
      items: (fe.items || []).map(function (it) {
        return {
          name: it.name || '', stockId: it.stockId || '', unit: it.unit || 'unit', packSize: Number(it.packSize) || 0, baseUnit: it.baseUnit || '', qty: Number(it.qty) || 0,
          cost: Number(it.cost) || 0, remark: it.remark || '',
        };
      }),
    };
  }

  function deriveCategories(stock) {
    const set = new Set();
    (stock || []).forEach(function (s) { if (s.cat) set.add(s.cat); });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  function rebuildCatalog() {
    state.catalog = state.stock.map(function (i) { return { name: i.name, unit: i.unit, id: i.id, stockQty: i.qty }; });
  }

  function findStock(name) {
    const n = (name || '').trim();
    if (!n) return null;
    const nLower = n.toLowerCase();

    let found = state.stock.find(function (i) { return (i.name || '').toLowerCase() === nLower; });
    if (found) return found;

    found = state.stock.find(function (i) { return (i.name || '').toLowerCase().includes(nLower); });
    if (found) return found;

    found = state.stock.find(function (i) { return nLower.includes((i.name || '').toLowerCase()); });
    return found || null;
  }

  function findStockById(id) {
    return state.stock.find(function (i) { return i.id === id; }) || null;
  }

  function stockQtyFor(name) {
    const i = findStock(name);
    return i ? (i.qty || 0) : 0;
  }

  function stockItemFor(name) {
    return findStock(name) || null;
  }

  function findCatalogItem(name) {
    const n = (name || '').trim().toLowerCase();
    return state.catalog.find(function (c) { return (c.name || '').toLowerCase() === n; }) || null;
  }

  function suggestIssueQty(name, requestedQty) {
    return Math.min(requestedQty || 0, stockQtyFor(name));
  }

  function prefixForDept(dept, mode) {
    if (mode === 'purchase') return 'PR';
    return DEPT_PREFIX[dept] || 'REQ';
  }

  function findReq(no) {
    return state.requests.find(function (r) { return r.no === no; }) || null;
  }
  function getRequisitions(opts) {
    opts = opts || {};
    return opts.mode ? state.requests.filter(function (r) { return r.mode === opts.mode; }) : state.requests.slice();
  }
  function getRequisition(no) { return findReq(no); }
  function getPendingRequisitions(opts) {
    return getRequisitions(opts).filter(function (r) {
      return r.status === 'Pending' || r.status === 'Partial';
    });
  }
  function pendingCount(mode) {
    return getPendingRequisitions({ mode: mode }).length;
  }

  /* ══════════════════════════════════════════════════════════════
     loadAll
  ══════════════════════════════════════════════════════════════ */
  async function loadAll() {
    try {
      const stockData = await apiFetch('/stock?_=' + Date.now());
      state.stock = (Array.isArray(stockData) ? stockData : []).map(normalizeStock);
    } catch (e) {
      console.error('[StoreService] Failed to load stock:', e.message);
      state.stock = [];
    }

    state.categories = deriveCategories(state.stock);
    rebuildCatalog();

    // Merge in categories persisted in the DB (the /categories endpoint
    // already unions DB + derived), so pre-created empty categories that
    // have no stock item yet still show up after a reload.
    try {
      const catApi = await apiFetch('/categories?_=' + Date.now());
      if (Array.isArray(catApi) && catApi.length) {
        const set = new Set(state.categories.concat(catApi));
        state.categories = Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
      }
    } catch (e) { /* non-fatal */ }

    try {
      const reqData = await apiFetch('/requisitions?_=' + Date.now());
      state.requests = (Array.isArray(reqData) ? reqData : []).map(normalizeRequisition);
    } catch (e) {
      console.error('[StoreService] Failed to load requisitions:', e.message);
      state.requests = [];
    }

    state.ready = true;
    emitChange('load');
    return state;
  }

  /* ══════════════════════════════════════════════════════════════
     Stock CRUD
  ══════════════════════════════════════════════════════════════ */

  async function addStockItem(data) {
    const created = await apiFetch('/stock', { method: 'POST', body: JSON.stringify(stockToPayload(data)) });
    const norm = normalizeStock(created);
    state.stock.push(norm);
    state.categories = deriveCategories(state.stock);
    // Merge DB categories so empty pre-created ones aren't lost
    try {
      const catApi = await apiFetch('/categories?_=' + Date.now());
      if (Array.isArray(catApi) && catApi.length) {
        const set = new Set(state.categories.concat(catApi));
        state.categories = Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
      }
    } catch (e) {}
    rebuildCatalog();
    emitChange('stock:add');
    return norm;
  }

  async function editStockItem(id, updates) {
    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.cat !== undefined) payload.cat = updates.cat;
    if (updates.unit !== undefined) payload.unit = updates.unit;
    if (updates.min !== undefined) payload.min = updates.min;
    if (updates.cost !== undefined) payload.cost = updates.cost;
    if (updates.baseUnit !== undefined) payload.baseUnit = updates.baseUnit;
    if (updates.packSize !== undefined) payload.packSize = updates.packSize;

    // When packSize is set/changed, recalculate cost per base unit
    // This handles the "manual portioning" workflow:
    // 1. Receive 1 Cow for ₦1.5M (cost=1500000, packSize=0)
    // 2. Store sets packSize=120 (cow yielded 120 kg)
    // 3. System recalculates: cost_per_kg = 1500000 / 120 = 12500
    if (updates.packSize && updates.packSize > 0) {
      const current = findStockById(id);
      if (current && current.cost > 0 && current.packSize !== updates.packSize) {
        payload.cost = Math.round(current.cost / updates.packSize * 100) / 100;
      }
    }

    const updated = await apiFetch('/stock/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    const norm = normalizeStock(updated);
    const idx = state.stock.findIndex(function (s) { return s.id === id; });
    if (idx > -1) state.stock[idx] = norm; else state.stock.push(norm);
    state.categories = deriveCategories(state.stock);
    try {
      const catApi = await apiFetch('/categories?_=' + Date.now());
      if (Array.isArray(catApi) && catApi.length) {
        const set = new Set(state.categories.concat(catApi));
        state.categories = Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
      }
    } catch (e) {}
    rebuildCatalog();
    emitChange('stock:edit');
    return norm;
  }

  async function deleteStockItem(id) {
    await apiFetch('/stock/' + id, { method: 'DELETE' });
    state.stock = state.stock.filter(function (i) { return i.id !== id; });
    state.categories = deriveCategories(state.stock);
    rebuildCatalog();
    emitChange('stock:delete');
  }

  /* ══════════════════════════════════════════════════════════════
     Categories
  ══════════════════════════════════════════════════════════════ */

  function getCategories() {
    return state.categories.slice();
  }

  async function addCategory(name) {
    const n = (name || '').trim();
    if (!n) throw new Error('Category name is required.');
    await apiFetch('/categories', { method: 'POST', body: JSON.stringify({ name: n }) });
    // Refresh categories from backend to ensure merged list is up to date
    try {
      const catApi = await apiFetch('/categories?_=' + Date.now());
      if (Array.isArray(catApi)) {
        state.categories = catApi.sort(function (a, b) { return a.localeCompare(b); });
      }
    } catch (e) {
      // Fallback: add locally if API refresh fails
      if (!state.categories.some(function (c) { return c.toLowerCase() === n.toLowerCase(); })) {
        state.categories.push(n);
      }
    }
    emitChange('category:add');
    return n;
  }

  async function renameCategory(oldName, newName) {
    const n = (newName || '').trim();
    if (!n) throw new Error('Category name is required.');
    await apiFetch('/categories/' + encodeURIComponent(oldName), { method: 'PUT', body: JSON.stringify({ name: n }) });
    state.stock.forEach(function (s) { if (s.cat === oldName) s.cat = n; });
    try {
      const catApi = await apiFetch('/categories?_=' + Date.now());
      state.categories = Array.isArray(catApi) ? catApi.sort(function (a, b) { return a.localeCompare(b); }) : deriveCategories(state.stock);
    } catch (e) { state.categories = deriveCategories(state.stock); }
    emitChange('category:rename');
    return n;
  }

  async function deleteCategory(name, opts) {
    opts = opts || {};
    const reassignTo = opts.reassignTo || 'Other';
    await apiFetch('/categories/' + encodeURIComponent(name), { method: 'DELETE', body: JSON.stringify({ reassignTo: reassignTo }) });
    state.stock.forEach(function (s) { if (s.cat === name) s.cat = reassignTo; });
    try {
      const catApi = await apiFetch('/categories?_=' + Date.now());
      state.categories = Array.isArray(catApi) ? catApi.sort(function (a, b) { return a.localeCompare(b); }) : deriveCategories(state.stock);
    } catch (e) { state.categories = deriveCategories(state.stock); }
    emitChange('category:delete');
  }

  /* ══════════════════════════════════════════════════════════════
     Requisitions
  ══════════════════════════════════════════════════════════════ */

  async function peekNextNumber(dept, mode) {
    const params = new URLSearchParams({ dept: dept, mode: mode });
    const result = await apiFetch('/requisitions/next-number?' + params.toString());
    return result ? result.no : '';
  }

  async function nextNumber(dept, mode) {
    const params = new URLSearchParams({ dept: dept, mode: mode });
    const result = await apiFetch('/requisitions/next-number?' + params.toString());
    return result ? result.no : '';
  }

  async function submitRequisition(opts) {
    opts = opts || {};
    const mode = opts.mode === 'purchase' ? 'purchase' : 'store_issue';
    const by = (opts.by || '').trim();
    const dept = opts.dept;
    const needed = opts.needed;
    if (!by) throw new Error('Please enter who is requesting.');
    if (!dept) throw new Error('Please choose a department.');
    if (!needed) throw new Error('Please choose a needed-by date.');
    const validItems = (opts.items || []).filter(function (i) {
      return i.name && i.name.trim() && (parseFloat(i.qty) || 0) > 0;
    });
    if (!validItems.length) throw new Error('Add at least one item with a name and quantity.');

    const payload = requisitionToPayload({
      mode: mode, by: by, dept: dept, needed: needed,
      priority: opts.priority, remark: opts.remark,
      fulfillStore: opts.fulfillStore, supplier: opts.supplier, linked: opts.linked,
      items: validItems,
    });
    const created = await apiFetch('/requisitions', { method: 'POST', body: JSON.stringify(payload) });
    const norm = normalizeRequisition(created);
    state.requests.unshift(norm);
    emitChange('requisition:submit');
    return norm;
  }

  async function updatePurchaseRequest(no, updates) {
    const payload = requisitionToPayload({
      mode: 'purchase', by: updates.by || '', dept: updates.dept || '',
      needed: updates.needed || '', priority: updates.priority,
      remark: updates.remark, supplier: updates.supplier, items: updates.items,
    });
    const updated = await apiFetch('/requisitions/' + encodeURIComponent(no), { method: 'PUT', body: JSON.stringify(payload) });
    const norm = normalizeRequisition(updated);
    const idx = state.requests.findIndex(function (r) { return r.no === no; });
    if (idx > -1) state.requests[idx] = norm; else state.requests.unshift(norm);
    emitChange('requisition:update');
    return norm;
  }

  async function approveAndIssue(no, issuedQtyByItem) {
    const result = await apiFetch('/requisitions/' + encodeURIComponent(no) + '/issue', {
      method: 'PATCH',
      body: JSON.stringify({ issuedQtyByItem: issuedQtyByItem }),
    });
    const norm = normalizeRequisition(result);
    const idx = state.requests.findIndex(function (r) { return r.no === no; });
    if (idx > -1) state.requests[idx] = norm; else state.requests.unshift(norm);
    emitChange('requisition:issue');
    return norm;
  }

  async function rejectRequisition(no, reason) {
    const result = await apiFetch('/requisitions/' + encodeURIComponent(no) + '/reject', {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason }),
    });
    const norm = normalizeRequisition(result);
    const idx = state.requests.findIndex(function (r) { return r.no === no; });
    if (idx > -1) state.requests[idx] = norm; else state.requests.unshift(norm);
    emitChange('requisition:reject');
    return norm;
  }

  async function confirmReceipt(no) {
    const result = await apiFetch('/requisitions/' + encodeURIComponent(no) + '/confirm', { method: 'PATCH' });
    const norm = normalizeRequisition(result);
    const idx = state.requests.findIndex(function (r) { return r.no === no; });
    if (idx > -1) state.requests[idx] = norm; else state.requests.unshift(norm);
    emitChange('requisition:confirm');
    return norm;
  }

  async function rejectDelivery(no, reason) {
    const result = await apiFetch('/requisitions/' + encodeURIComponent(no) + '/dispute', {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason }),
    });
    const norm = normalizeRequisition(result);
    const idx = state.requests.findIndex(function (r) { return r.no === no; });
    if (idx > -1) state.requests[idx] = norm; else state.requests.unshift(norm);
    emitChange('requisition:dispute');
    return norm;
  }

  /* ══════════════════════════════════════════════════════════════
     STORE HANDOFF — acceptPO() / rejectPO()
     Delegates to ProcurementService for the PO status transition.
     acceptPO also upserts stock items from the PO line items.
  ══════════════════════════════════════════════════════════════ */

  async function acceptPO(prId) {
    const PS = global.ProcurementService;
    if (!PS) throw new Error('ProcurementService not loaded on this page.');

    const pr = await PS.getPR(prId);
    if (!pr) throw new Error('PR not found.');
    if (pr.approvalStage !== 'sent_to_store') {
      throw new Error('This PO is not awaiting Store action.');
    }

    const items = pr.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = (it.name || '').trim();
      if (!name) continue;
      const qty = parseFloat(it.qty) || 0;
      const packSize = parseFloat(it.packSize) || 0;
      const baseQty = packSize > 0 ? qty * packSize : qty;
      const rawCost = parseFloat(it.price || it.cost) || 0;
      const cost = packSize > 0 && rawCost > 0 ? Math.round(rawCost / packSize * 100) / 100 : rawCost;
      const unit = it.unit || 'unit';
      const stockId = it.stockId || '';

      let stockItem = stockId ? findStockById(stockId) : null;
      if (!stockItem) throw new Error('Store item not found for stockId '+stockId+' — pick from Store catalog (uuid) again.');
      const payload = { qty: baseQty };
      if (cost > 0) payload.cost = cost;
      if (packSize > 0) payload.packSize = packSize;
      if (it.baseUnit) payload.baseUnit = it.baseUnit;
      if (it.unit) payload.unit = it.unit;
      const updated = await apiFetch('/stock/' + stockItem.id + '/receive', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (updated) {
        stockItem.qty = (updated.qty != null ? updated.qty : stockItem.qty);
        if (updated.cost != null) stockItem.cost = updated.cost;
        if (updated.packSize) stockItem.packSize = updated.packSize;
        if (updated.baseUnit) stockItem.baseUnit = updated.baseUnit;
        if (updated.unit) stockItem.unit = updated.unit;
      } else {
        stockItem.qty = (stockItem.qty || 0) + baseQty;
        if (cost > 0) stockItem.cost = cost;
      }
    }

    state.categories = deriveCategories(state.stock);
    try {
      const catApi = await apiFetch('/categories?_=' + Date.now());
      if (Array.isArray(catApi) && catApi.length) {
        const set = new Set(state.categories.concat(catApi));
        state.categories = Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
      }
    } catch (e) {}
    rebuildCatalog();
    emitChange('stock:accept-po');

    await PS.acceptPO(prId);
    return pr;
  }

  async function rejectPO(prId, reason) {
    const PS = global.ProcurementService;
    if (!PS) throw new Error('ProcurementService not loaded on this page.');
    const r = (reason || '').trim();
    if (!r) throw new Error('Please provide a rejection reason.');

    const pr = await PS.getPR(prId);
    if (!pr) throw new Error('PR not found.');
    if (pr.approvalStage !== 'sent_to_store') {
      throw new Error('This PO is not awaiting Store action.');
    }

    await PS.rejectPO(prId, r);
    return pr;
  }

  global.StoreService = {
    CONFIG: CONFIG,
    KEYS: KEYS,
    DEPT_PREFIX: DEPT_PREFIX,

    state: state,
    onChange: onChange,
    loadAll: loadAll,

    fmtN: fmtN,
    fmtDate: fmtDate,
    todayISO: todayISO,
    todayDisplay: todayDisplay,

    stockLevel: stockLevel,
    LEVEL_CHIP: LEVEL_CHIP,
    LEVEL_LABEL: LEVEL_LABEL,

    findStock: findStock,
    findStockById: findStockById,
    stockQtyFor: stockQtyFor,
    stockItemFor: stockItemFor,
    findCatalogItem: findCatalogItem,
    suggestIssueQty: suggestIssueQty,

    addStockItem: addStockItem,
    editStockItem: editStockItem,
    deleteStockItem: deleteStockItem,

    getCategories: getCategories,
    addCategory: addCategory,
    renameCategory: renameCategory,
    deleteCategory: deleteCategory,

    prefixForDept: prefixForDept,
    peekNextNumber: peekNextNumber,
    nextNumber: nextNumber,

    submitRequisition: submitRequisition,
    updatePurchaseRequest: updatePurchaseRequest,
    approveAndIssue: approveAndIssue,
    rejectRequisition: rejectRequisition,
    confirmReceipt: confirmReceipt,
    rejectDelivery: rejectDelivery,

    getRequisitions: getRequisitions,
    getRequisition: getRequisition,
    getPendingRequisitions: getPendingRequisitions,
    pendingCount: pendingCount,

    acceptPO: acceptPO,
    rejectPO: rejectPO,

    normalizeStock: normalizeStock,
    normalizeRequisition: normalizeRequisition,
  };
})(window);
