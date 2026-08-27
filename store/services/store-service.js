/**
 * services/store-service.js — Shared data + business logic for the Store module
 * Depends on: data/store-seed.js (window.StoreSeed)
 * Optional: services/permissions.js (window.Permissions)
 */
(function (global) {
  'use strict';

  const KEYS = {
    REQ_INDEX: 'req-index',
    STOCK: 'store-stock',
  };

  const storage = global.storage || {
    async get(key, shared) { const v = localStorage.getItem(key); return v == null ? null : { key, value: v, shared }; },
    async set(key, value, shared) { localStorage.setItem(key, value); return { key, value, shared }; },
    async delete(key, shared) { localStorage.removeItem(key); return { key, deleted: true, shared }; },
    async list(prefix, shared) { const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)); return { keys, prefix, shared }; },
  };

  async function loadSharedRaw(key) {
    try {
      const r = await storage.get(key, true);
      return r ? r.value : null;
    } catch (e) { return null; }
  }
  async function saveSharedRaw(key, value) {
    try { await storage.set(key, value, true); return true; }
    catch (e) { console.warn('[StoreService] save failed:', key, e); return false; }
  }
  async function loadSharedJSON(key, fallback) {
    const raw = await loadSharedRaw(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }
  async function saveSharedJSON(key, value) {
    return saveSharedRaw(key, JSON.stringify(value));
  }

  const DEPT_PREFIX = { Kitchen: 'KREQ', Housekeeping: 'HREQ', Bar: 'BREQ', 'Front Desk': 'FREQ', Maintenance: 'MREQ', Store: 'PR' };

  function fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function todayISO() { return new Date().toISOString().split('T')[0]; }
  function todayDisplay() {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function genStockId() { return 's' + Date.now() + Math.floor(Math.random() * 1000); }

  function stockLevel(s) {
    const qty = Number(s && s.qty) || 0;
    const min = Number(s && s.min) || 0;
    if (qty <= 0) return 'out';
    if (qty <= min) return 'low';
    return 'ok';
  }
  const LEVEL_CHIP = { ok: 'chip-ok', low: 'chip-low', out: 'chip-out' };
  const LEVEL_LABEL = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };

  const state = {
    requests: [],
    stock: [],
    categories: [],
    catalog: [],
    ready: false,
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[StoreService] listener error', e); } }); }

  function seed() {
    const s = global.StoreSeed || {};
    return {
      stock: s.DEMO_STOCK || [],
      catalog: s.DEMO_CATALOG || null,
      requests: s.DEMO_REQUESTS || [],
    };
  }

  function ensureStockShape(rows) {
    return (rows || []).map(function (s) {
      return Object.assign({
        id: genStockId(),
        cat: 'Other',
      }, s);
    });
  }

  function deriveCategories(stock) {
    const set = new Set();
    (stock || []).forEach(function (s) { if (s.cat) set.add(s.cat); });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  /**
   * Rebuilds the item-picker catalog straight from current stock. Called
   * on load AND after every stock mutation (add/edit/delete) so a brand
   * new or renamed item is immediately searchable on the requisition form
   * without needing a page reload.
   */
  function rebuildCatalog() {
    const s = seed();
    state.catalog = (s.catalog && s.catalog.length)
      ? s.catalog
      : state.stock.map(function (i) { return { name: i.name, unit: i.unit }; });
  }

  async function loadAll() {
    const s = seed();

    let stock = await loadSharedJSON(KEYS.STOCK, null);
    let needsSave = false;
    if (!Array.isArray(stock) || !stock.length) {
      stock = ensureStockShape(s.stock);
      needsSave = true;
    } else if (stock.some(function (i) { return !i.id; })) {
      stock = ensureStockShape(stock);
      needsSave = true;
    }
    state.stock = stock;
    if (needsSave) await saveSharedJSON(KEYS.STOCK, state.stock);

    state.categories = deriveCategories(state.stock);
    rebuildCatalog();

    let idx = await loadSharedJSON(KEYS.REQ_INDEX, null);
    if (!Array.isArray(idx)) idx = [];

    if (!idx.length && s.requests.length) {
      for (const r of s.requests) {
        await saveSharedJSON('req:' + r.no, r);
      }
      idx = s.requests.map(function (r) { return r.no; });
      await saveSharedJSON(KEYS.REQ_INDEX, idx);
    }

    const reqs = [];
    for (const no of idx) {
      const r = await loadSharedJSON('req:' + no, null);
      if (r) reqs.push(r);
    }
    state.requests = reqs;
    state.ready = true;

    emitChange('load');
    return state;
  }

  async function persistStock() {
    await saveSharedJSON(KEYS.STOCK, state.stock);
  }

  /**
   * Resolves a requisition line's item name to a Store stock record.
   * Requesting departments (Pool Bar, Restaurant, Kitchen, ...) don't
   * always spell an item exactly the way Store's central stock does
   * ("Bottled Water" on a requisition vs "Bottled Water 1.5L" in Store's
   * stock list) — a strict-equality match silently treated that as "not
   * found" and stockQtyFor() returned 0 even when Store actually had the
   * item. This now falls back through three passes before giving up:
   *   1. Exact match (case-insensitive) — unchanged, still tried first.
   *   2. The requisition's item name appears inside a stock item's name
   *      (e.g. "Bottled Water" -> "Bottled Water 1.5L").
   *   3. A stock item's name appears inside the requisition's item name
   *      (covers the reverse phrasing).
   */
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
  function findCatalogItem(name) {
    const n = (name || '').trim().toLowerCase();
    return state.catalog.find(function (c) { return (c.name || '').toLowerCase() === n; }) || null;
  }
  function suggestIssueQty(name, requestedQty) {
    return Math.min(requestedQty || 0, stockQtyFor(name));
  }

  async function addStockItem({ name, cat, unit, min = 0 }) {
    const n = (name || '').trim();
    if (!n) throw new Error('Item name is required.');
    if (findStock(n)) throw new Error(`"${n}" is already tracked — edit it instead.`);
    const entry = {
      id: genStockId(), name: n, cat: cat || 'Other', unit: unit || 'unit',
      qty: 0, cost: 0, min: Number(min) || 0,
    };
    state.stock.push(entry);
    await persistStock();
    state.categories = deriveCategories(state.stock);
    rebuildCatalog();
    emitChange('stock:add');
    return entry;
  }

  async function editStockItem(id, updates) {
    const i = findStockById(id);
    if (!i) throw new Error('Stock item not found.');
    const { qty, cost, ...safe } = updates || {};
    Object.assign(i, safe);
    await persistStock();
    state.categories = deriveCategories(state.stock);
    rebuildCatalog();
    emitChange('stock:edit');
    return i;
  }

  async function deleteStockItem(id) {
    state.stock = state.stock.filter(function (i) { return i.id !== id; });
    await persistStock();
    state.categories = deriveCategories(state.stock);
    rebuildCatalog();
    emitChange('stock:delete');
  }

  function getCategories() {
    return state.categories.slice();
  }
  async function renameCategory(oldName, newName) {
    const n = (newName || '').trim();
    if (!n) throw new Error('Category name is required.');
    if (n.toLowerCase() !== (oldName || '').toLowerCase() &&
        state.categories.some(function (c) { return c.toLowerCase() === n.toLowerCase(); })) {
      throw new Error(`Category "${n}" already exists.`);
    }
    state.stock.forEach(function (s) { if (s.cat === oldName) s.cat = n; });
    await persistStock();
    state.categories = deriveCategories(state.stock);
    emitChange('category:rename');
    return n;
  }
  async function deleteCategory(name, { reassignTo = 'Other' } = {}) {
    state.stock.forEach(function (s) { if (s.cat === name) s.cat = reassignTo; });
    await persistStock();
    state.categories = deriveCategories(state.stock);
    emitChange('category:delete');
  }

  function prefixForDept(dept, mode) {
    if (mode === 'purchase') return 'PR';
    return DEPT_PREFIX[dept] || 'REQ';
  }
  async function peekNextNumber(dept, mode) {
    const prefix = prefixForDept(dept, mode);
    const raw = await loadSharedRaw('counter:' + prefix);
    const n = raw != null ? parseInt(raw, 10) : 45;
    return prefix + '-2025-' + String(n + 1).padStart(5, '0');
  }
  async function nextNumber(dept, mode) {
    const prefix = prefixForDept(dept, mode);
    const raw = await loadSharedRaw('counter:' + prefix);
    let n = raw != null ? parseInt(raw, 10) : 45;
    n += 1;
    await saveSharedRaw('counter:' + prefix, String(n));
    return prefix + '-2025-' + String(n).padStart(5, '0');
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

    const no = await nextNumber(dept, mode);
    const entry = {
      no: no, mode: mode, by: by, dept: dept, needed: needed, priority: opts.priority || 'Normal',
      remark: (opts.remark || '').trim(),
      fulfillStore: mode === 'store_issue' ? (opts.fulfillStore || 'Central Store') : null,
      supplier: mode === 'purchase' ? (opts.supplier || '').trim() : null,
      linked: mode === 'purchase' ? (opts.linked || '').trim() : null,
      items: validItems.map(function (i) {
        return {
          name: i.name.trim(), unit: i.unit || 'unit', qty: parseFloat(i.qty) || 0,
          cost: parseFloat(i.cost) || 0, remark: i.remark || '', issuedQty: 0,
        };
      }),
      status: 'Pending',
      dateRaised: todayISO(),
      dateRaisedDisplay: todayDisplay(),
    };

    await saveSharedJSON('req:' + no, entry);
    const idx = await loadSharedJSON(KEYS.REQ_INDEX, []);
    idx.unshift(no);
    await saveSharedJSON(KEYS.REQ_INDEX, idx);

    state.requests.unshift(entry);
    emitChange('requisition:submit');
    return entry;
  }

  /**
   * Edit an existing purchase-mode (mode:'purchase') requisition — used
   * by the shared purchase-request form when it's opened as
   * store-purchase-request.html?no=<no>. Only purchase-mode requests are
   * editable here (store_issue requests go through approveAndIssue's
   * separate lifecycle instead), and only before Procurement has picked
   * it up: once ProcurementService.importStoreRequest() has stamped
   * `procurementPrId` onto the record, it belongs to Procurement's own
   * copy from then on and editing here would silently drift out of sync
   * with what Procurement is actually pricing/approving.
   */
  async function updatePurchaseRequest(no, updates) {
    const req = findReq(no);
    if (!req) throw new Error(`Request ${no} not found.`);
    if (req.mode !== 'purchase') throw new Error('Only purchase requests can be edited here.');
    if (req.procurementPrId) throw new Error('This request has already been sent to Procurement and can no longer be edited here.');

    const validItems = (updates.items || []).filter(function (i) {
      return i.name && i.name.trim() && (parseFloat(i.qty) || 0) > 0;
    });
    if (!validItems.length) throw new Error('Add at least one item with a name and quantity.');

    Object.assign(req, {
      dept: updates.dept || req.dept,
      needed: updates.needed || req.needed,
      priority: updates.priority || req.priority,
      remark: updates.remark != null ? updates.remark.trim() : req.remark,
      supplier: updates.supplier != null ? updates.supplier.trim() : req.supplier,
      items: validItems.map(function (i) {
        return {
          name: i.name.trim(), unit: i.unit || 'unit', qty: parseFloat(i.qty) || 0,
          cost: parseFloat(i.cost) || 0, remark: i.remark || '', issuedQty: 0,
        };
      }),
    });

    await saveSharedJSON('req:' + no, req);
    emitChange('requisition:update');
    return req;
  }

  async function approveAndIssue(no, issuedQtyByItem) {
    const req = findReq(no);
    if (!req) throw new Error('Requisition ' + no + ' not found.');
    if (req.mode !== 'store_issue') throw new Error('Only Store-issue requisitions can be issued from here.');
    if (req.status === 'Rejected') throw new Error('This requisition was rejected and cannot be issued.');

    let totalReq = 0, totalIssued = 0;
    const nextItems = req.items.map(function (it) {
      const has = issuedQtyByItem && Object.prototype.hasOwnProperty.call(issuedQtyByItem, it.name);
      const raw = has ? issuedQtyByItem[it.name] : it.issuedQty;
      const avail = stockQtyFor(it.name);
      const issued = Math.max(0, Math.min(parseFloat(raw) || 0, avail, it.qty));
      totalReq += it.qty;
      totalIssued += issued;
      return Object.assign({}, it, { issuedQty: issued });
    });

    nextItems.forEach(function (it, i) {
      const prevIssued = req.items[i].issuedQty || 0;
      const delta = it.issuedQty - prevIssued;
      if (delta > 0) {
        const stockItem = findStock(it.name);
        if (stockItem) stockItem.qty = Math.max(0, (stockItem.qty || 0) - delta);
      }
    });

    req.items = nextItems;
    req.status = totalIssued >= totalReq ? 'Full' : totalIssued > 0 ? 'Partial' : 'Pending';

    await saveSharedJSON('req:' + no, req);
    await persistStock();
    emitChange('requisition:issue');
    return req;
  }

  async function rejectRequisition(no, reason) {
    const req = findReq(no);
    if (!req) throw new Error('Requisition ' + no + ' not found.');
    req.status = 'Rejected';
    req.rejectReason = (reason || '').trim();
    await saveSharedJSON('req:' + no, req);
    emitChange('requisition:reject');
    return req;
  }

  async function confirmReceipt(no) {
    const req = findReq(no);
    if (!req) throw new Error('Requisition ' + no + ' not found.');
    if (req.status !== 'Full' && req.status !== 'Partial') {
      throw new Error('Only a Full or Partial requisition can be confirmed received.');
    }
    req.status = 'Completed';
    await saveSharedJSON('req:' + no, req);
    emitChange('requisition:confirm');
    return req;
  }

  async function rejectDelivery(no, reason) {
    const req = findReq(no);
    if (!req) throw new Error('Requisition ' + no + ' not found.');
    if (req.status !== 'Full' && req.status !== 'Partial') {
      throw new Error('Only a Full or Partial requisition can be disputed.');
    }
    req.status = 'Disputed';
    req.disputeReason = (reason || '').trim();
    await saveSharedJSON('req:' + no, req);
    emitChange('requisition:dispute');
    return req;
  }

  global.StoreService = {
    KEYS, DEPT_PREFIX,
    state, onChange, loadAll,
    fmtN, fmtDate, todayISO, todayDisplay,
    stockLevel, LEVEL_CHIP, LEVEL_LABEL,
    findStock, findStockById, stockQtyFor, findCatalogItem, suggestIssueQty,
    addStockItem, editStockItem, deleteStockItem,
    getCategories, renameCategory, deleteCategory,
    prefixForDept, peekNextNumber, nextNumber,
    submitRequisition, updatePurchaseRequest, approveAndIssue, rejectRequisition, confirmReceipt, rejectDelivery,
    getRequisitions, getRequisition, getPendingRequisitions, pendingCount,
  };
})(window);