/**
 * services/store-service.js — Shared data + business logic for the Store module
 * Depends on: data/store-seed.js (window.StoreSeed)
 * Optional: services/permissions.js (window.Permissions)
 *
 * Owns:
 *   - Requisitions (both 'store_issue' and 'purchase' modes share one
 *     numbering scheme + record shape, keyed req:<NO>, indexed by req-index)
 *   - Stock-on-hand (store-stock) — deducted when a store_issue requisition
 *     is approved/issued, and managed directly on stock.html (add/edit/
 *     delete item master entries, categories)
 *   - The item catalog used by the New Request item picker
 *   - The low/out-of-stock threshold rule (stockLevel) and its display
 *     chip class/label — the SAME single source of truth every page
 *     (stock.html, store-dashboard.html, …) must use, mirroring how
 *     PoolBarService exports stockLevel/LEVEL_CHIP/LEVEL_LABEL. Pages
 *     should never redefine this rule locally — that's how a stray
 *     `s.reorder` (stock items only ever have `.min`) went unnoticed on
 *     store-dashboard.html.
 *
 * Pages (requisition-form.html, store.html, stock.html, store-dashboard.html,
 * and any future Procurement pages) call StoreService.* and only render —
 * they never touch the underlying storage keys (`req:<NO>`, `req-index`,
 * `counter:<PREFIX>`, `store-stock`) directly. When this goes live against
 * a real API, this file is the only thing that changes.
 *
 * Stock item shape (normalized on load — see ensureStockShape):
 *   { id, name, cat, unit, qty, cost, min }
 * `data/store-seed.js` only supplies { name, unit, qty, cost, min } —
 * `id` and `cat` are backfilled here so every page sees a consistent shape.
 * `min` is the reorder threshold — there is no `.reorder` field anywhere
 * in this module; stockLevel() below is the only place that rule lives.
 *
 * mode on a requisition:
 *   'store_issue' -> fulfilled from Central Store stock, shown on store.html
 *   'purchase'    -> routed to Procurement. StoreService still owns the
 *                    record + numbering so both flows share one requisition
 *                    ledger, but does not implement a PO/approval workflow
 *                    beyond storing status — that's Procurement's module.
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

  // Department -> requisition-number prefix. Purchase mode always uses PR
  // regardless of department (matches the original New Request behaviour).
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

  // ── Stock threshold rule — the ONLY place "low" / "out" is decided.
  // Stock items only ever have `.min` (reorder threshold); there is no
  // `.reorder` field anywhere in this module.
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
    requests: [],   // all requisitions, newest first
    stock: [],      // [{ id, name, cat, unit, qty, cost, min }]
    categories: [], // string[]
    catalog: [],    // [{ name, unit }] — item picker source
    ready: false,
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[StoreService] listener error', e); } }); }

  function seed() {
    const s = global.StoreSeed || {};
    return {
      stock: s.DEMO_STOCK || [],
      catalog: s.DEMO_CATALOG || null, // null => derive from stock
      requests: s.DEMO_REQUESTS || [],
    };
  }

  /**
   * Backfills id/cat on stock rows loaded from either the seed (which only
   * has name/unit/qty/cost/min) or older persisted data. Non-destructive —
   * only fills fields that are missing, everything else passes through.
   */
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

  async function loadAll() {
    const s = seed();

    // Stock: shared + persisted, seeded on first run only.
    let stock = await loadSharedJSON(KEYS.STOCK, null);
    let needsSave = false;
    if (!Array.isArray(stock) || !stock.length) {
      stock = ensureStockShape(s.stock);
      needsSave = true;
    } else if (stock.some(function (i) { return !i.id; })) {
      // Older persisted data saved before id/cat existed — backfill once.
      stock = ensureStockShape(stock);
      needsSave = true;
    }
    state.stock = stock;
    if (needsSave) await saveSharedJSON(KEYS.STOCK, state.stock);

    state.categories = deriveCategories(state.stock);
    state.catalog = (s.catalog && s.catalog.length)
      ? s.catalog
      : state.stock.map(function (i) { return { name: i.name, unit: i.unit }; });

    // Requisitions: read the shared index, hydrate each req:<no> record.
    // First run only: seed from DEMO_REQUESTS so pages aren't empty.
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

  // ── Stock / catalog lookups ─────────────────────
  function findStock(name) {
    const n = (name || '').trim().toLowerCase();
    return state.stock.find(function (i) { return (i.name || '').toLowerCase() === n; }) || null;
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
  /** How much of a requested qty can be suggested for issue right now. */
  function suggestIssueQty(name, requestedQty) {
    return Math.min(requestedQty || 0, stockQtyFor(name));
  }

  /**
   * Add a new item master entry. qty/cost start at 0 — they're only
   * populated once Procurement/Goods Receipt sends stock in.
   */
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
    emitChange('stock:add');
    return entry;
  }

  /** Edit item master fields. qty/cost are intentionally NOT editable here — those move via requisitions/goods receipt. */
  async function editStockItem(id, updates) {
    const i = findStockById(id);
    if (!i) throw new Error('Stock item not found.');
    const { qty, cost, ...safe } = updates || {};
    Object.assign(i, safe);
    await persistStock();
    state.categories = deriveCategories(state.stock);
    emitChange('stock:edit');
    return i;
  }

  async function deleteStockItem(id) {
    state.stock = state.stock.filter(function (i) { return i.id !== id; });
    await persistStock();
    state.categories = deriveCategories(state.stock);
    emitChange('stock:delete');
  }

  // ── Categories ─────────────────────────────────
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

  // ── Numbering ───────────────────────────────────
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

  // ── Requisitions ────────────────────────────────
  function findReq(no) {
    return state.requests.find(function (r) { return r.no === no; }) || null;
  }
  function getRequisitions(opts) {
    opts = opts || {};
    return opts.mode ? state.requests.filter(function (r) { return r.mode === opts.mode; }) : state.requests.slice();
  }
  function getRequisition(no) { return findReq(no); }

  // Single definition of "pending" (Pending or Partial) — dashboard,
  // approval queue, and the nav badge should all call this rather than
  // re-deriving the same status check against state.requests themselves.
  function getPendingRequisitions(opts) {
    return getRequisitions(opts).filter(function (r) {
      return r.status === 'Pending' || r.status === 'Partial';
    });
  }
  function pendingCount(mode) {
    return getPendingRequisitions({ mode: mode }).length;
  }

  /**
   * Submit a new requisition (store_issue or purchase). Assigns the number,
   * persists the record + shared index, updates in-memory state, and
   * notifies listeners. Returns the saved requisition.
   */
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
   * Approve & issue items against a Store-issue requisition.
   * `issuedQtyByItem` is a map of item name -> issued quantity (as entered
   * by staff on store.html). Clamps each to [0, requested, stock on hand],
   * deducts stock for what's actually issued, and recomputes status
   * (Pending / Partial / Full).
   */
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

    // Deduct stock for what's actually issued this time vs. what was
    // already deducted previously (so re-approving a partial doesn't
    // double-deduct).
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

  global.StoreService = {
    KEYS, DEPT_PREFIX,
    state, onChange, loadAll,
    fmtN, fmtDate, todayISO, todayDisplay,
    stockLevel, LEVEL_CHIP, LEVEL_LABEL,
    findStock, findStockById, stockQtyFor, findCatalogItem, suggestIssueQty,
    addStockItem, editStockItem, deleteStockItem,
    getCategories, renameCategory, deleteCategory,
    prefixForDept, peekNextNumber, nextNumber,
    submitRequisition, approveAndIssue, rejectRequisition,
    getRequisitions, getRequisition, getPendingRequisitions, pendingCount,
  };
})(window);