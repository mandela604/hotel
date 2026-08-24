/**
 * services/poolbar-service.js — Production Pool Bar service.
 * Talks to the real backend (routes/poolbarRoutes.js + controllers/poolbarController.js)
 * over HTTP instead of window.storage/localStorage. Every page keeps calling
 * the exact same PoolBarService.* functions as before — only what happens
 * INSIDE them changed (fetch() + JWT instead of shared-storage JSON blobs).
 *
 * ── CONFIG ────────────────────────────────────────────────────────────
 * API base path:   PoolBarSeed.API_BASE            (default '/api/poolbar')
 * Auth token:      window.Auth.getToken()          if present, else
 *                  localStorage 'gh_token' / 'token'
 * All requests send `Authorization: Bearer <token>` — matches middleware/auth.js.
 *
 * ── WHAT CHANGED FROM THE DEMO VERSION ──────────────────────────────────
 * - state.stock / state.sales / state.orders / state.requisitions /
 *   state.movements are now hydrated from the API on loadAll(), not seeded
 *   from data/poolbar-seed.js + localStorage.
 * - Every mutation (add/edit/delete stock, deduct, sale, void, open/pay/
 *   cancel order, submit requisition) is a real HTTP call; state is only
 *   updated from what the server actually persisted (the response body),
 *   never optimistically assumed.
 * - The old "pending store transfers" accept/reject flow (state.pending,
 *   acceptRequisition/rejectRequisition/logRequisitionRaised) had no
 *   backend endpoint and is removed — Store→PoolBar stock now only moves
 *   through the real requisition lifecycle (submitRequisition +
 *   receiveRequisition, see below).
 * - Category management (addCategory/renameCategory/deleteCategory) has
 *   no dedicated backend collection for Pool Bar (unlike Procurement's
 *   ProcurementCategory) — categories are still derived from
 *   PoolbarStock.category values. "Extra" categories a manager pre-creates
 *   before any item uses them are now session-only (in-memory), since
 *   there's nowhere on the server to persist a category with zero items.
 * - receiveRequisition() credits Pool Bar's own stock via
 *   PUT /stock/:id (or POST /stock if the item doesn't exist yet) since
 *   there's no dedicated "receive" endpoint. Already-received lines are
 *   tracked in memory for this session to avoid double-crediting a repeat
 *   click; that tracking does not survive a page reload — if that matters,
 *   add a real POST /requisitions/:no/receive endpoint server-side instead.
 *
 * Everything else — KPI math, filters, formatting, permission checks,
 * shift-report helpers, sale-detail shaping — is pure computation over
 * state and is unchanged.
 */
(function (global) {
  'use strict';

  /* ── API config ─────────────────────────────────────────────────── */
  function getApiBase() {
    const s = global.PoolBarSeed || {};
    return s.API_BASE || '/api/poolbar';
  }
  function getAuthToken() {
    if (global.Auth && typeof global.Auth.getToken === 'function') {
      try { return global.Auth.getToken() || ''; } catch (e) { /* fall through */ }
    }
    try {
      return localStorage.getItem('gh_token') || localStorage.getItem('token') || '';
    } catch (e) { return ''; }
  }

  async function apiFetch(path, options) {
    options = options || {};
    const token = getAuthToken();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers.Authorization = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(getApiBase() + path, Object.assign({}, options, { headers }));
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
      err.statusCode = res.status;
      err.field = body && body.field;
      throw err;
    }
    return body || { success: true };
  }
  function apiGet(path) { return apiFetch(path, { method: 'GET' }); }
  function apiPost(path, data) { return apiFetch(path, { method: 'POST', body: JSON.stringify(data || {}) }); }
  function apiPut(path, data) { return apiFetch(path, { method: 'PUT', body: JSON.stringify(data || {}) }); }
  function apiDelete(path) { return apiFetch(path, { method: 'DELETE' }); }

  /* ── Booking module (Room Charge folio posting) — unchanged from the
   *    demo version; dynamically loads BookingData if it's not already
   *    on the page, same as before. Orthogonal to the API-ification
   *    above. ── */
  var OWN_SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  function resolveRelative(rel) {
    if (!OWN_SCRIPT_SRC) return rel;
    try { return new URL(rel, OWN_SCRIPT_SRC).href; } catch (e) { return rel; }
  }
  function loadScriptTag(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load script: ' + url)); };
      document.head.appendChild(s);
    });
  }
  var bookingDataLoadPromise = null;
  function ensureBookingData() {
    if (global.BookingData && typeof global.BookingData.getBookingData === 'function') {
      return Promise.resolve(global.BookingData);
    }
    if (bookingDataLoadPromise) return bookingDataLoadPromise;
    bookingDataLoadPromise = (async function () {
      const paths = (global.PoolBarSeed && global.PoolBarSeed.BOOKING_MODULE_PATHS) || {};
      if (!global.BookingDemoSeed && paths.demoSeed) await loadScriptTag(resolveRelative(paths.demoSeed));
      if (!global.BookingData && paths.service) await loadScriptTag(resolveRelative(paths.service));
      if (!global.BookingData || typeof global.BookingData.getBookingData !== 'function') {
        throw new Error('BookingData failed to initialize. Provide PoolBarSeed.BOOKING_MODULE_PATHS or preload window.BookingData yourself.');
      }
      return global.BookingData;
    })();
    return bookingDataLoadPromise;
  }

  /* ── Formatting / small helpers ─────────────────────────────────── */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function getCurrencyConfig() {
    const s = global.PoolBarSeed || {};
    return s.CURRENCY || null;
  }
  function fmtN(n) {
    const cur = getCurrencyConfig();
    const amount = Math.round(n || 0);
    if (!cur || !cur.symbol) return amount.toLocaleString();
    return cur.symbol + amount.toLocaleString(cur.locale || undefined);
  }
  function fmtStamp(date) {
    let h = date.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad2(h)}:${pad2(date.getMinutes())} ${ampm}`;
  }
  function nowStamp() { return fmtStamp(new Date()); }
  function todayDDMMYY() { const d = new Date(); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`; }

  function parseStamp(str) {
    if (!str) return null;
    // Accept ISO dates straight from Mongo (createdAt/date) as well as the
    // dd/mm/yy hh:mm AM/PM stamp format used by demo data.
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    const parts = str.split(' ');
    const [d, m, y] = parts[0].split('/').map(n => parseInt(n, 10));
    let hh = 0, mm = 0;
    if (parts[1]) { const [h, mi] = parts[1].split(':').map(n => parseInt(n, 10)); hh = h; mm = mi || 0; }
    if (parts[2]) {
      const ap = parts[2].toUpperCase();
      if (ap === 'PM' && hh < 12) hh += 12;
      if (ap === 'AM' && hh === 12) hh = 0;
    }
    const fullYear = y < 100 ? 2000 + y : y;
    return new Date(fullYear, m - 1, d, hh, mm);
  }
  function dateOnly(dt) { return dt ? new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) : null; }

  function stockLevel(i) { return i.qty <= 0 ? 'out' : (i.qty <= i.min ? 'low' : 'ok'); }
  const LEVEL_CHIP = { ok: 'chip-ok', low: 'chip-low', out: 'chip-out' };
  const DEFAULT_LEVEL_LABELS = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };
  function getLevelLabels() {
    const s = global.PoolBarSeed || {};
    return Object.assign({}, DEFAULT_LEVEL_LABELS, s.STOCK_LEVEL_LABELS || {});
  }
  const LEVEL_LABEL = new Proxy({}, { get: (_, key) => getLevelLabels()[key] });

  const DEFAULT_LEVEL_LABELS_SHORT = { ok: 'OK', low: 'LOW', out: 'OUT' };
  function getLevelLabelsShort() {
    const s = global.PoolBarSeed || {};
    return Object.assign({}, DEFAULT_LEVEL_LABELS_SHORT, s.STOCK_LEVEL_LABELS_SHORT || {});
  }

  const DEFAULT_ID_PREFIXES = { sale: 'PBS-', order: 'PBO-' };
  function getIdPrefixes() {
    const s = global.PoolBarSeed || {};
    return Object.assign({}, DEFAULT_ID_PREFIXES, s.ID_PREFIXES || {});
  }

  const state = {
    stock: [], sales: [], orders: [], requisitions: [], movements: [],
    extraCategories: [], // session-only, see file header
    ready: false,
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[PoolBarService] listener error', e); } }); }

  function getPaymentMethods() {
    const s = global.PoolBarSeed || {};
    return Array.isArray(s.PAYMENT_METHODS) ? s.PAYMENT_METHODS : [];
  }
  function getRoomChargeMethodName() {
    const s = global.PoolBarSeed || {};
    return s.ROOM_CHARGE_METHOD || null;
  }
  function getStatusOptions() {
    const s = global.PoolBarSeed || {};
    return Array.isArray(s.ORDER_STATUS_OPTIONS) ? s.ORDER_STATUS_OPTIONS : [];
  }
  function getCompletedSaleStatus() {
    const s = global.PoolBarSeed || {};
    return s.COMPLETED_SALE_STATUS || 'completed';
  }
  const DEFAULT_STATUS = {
    SALE_COMPLETED: 'completed', SALE_VOIDED: 'voided',
    ORDER_OPEN: 'open', ORDER_SERVED: 'served', ORDER_PAID: 'paid', ORDER_CANCELLED: 'cancelled',
  };
  function getStatusConstants() {
    const s = global.PoolBarSeed || {};
    return Object.assign({}, DEFAULT_STATUS, s.STATUS_VALUES || {});
  }
  function getModuleName() {
    const s = global.PoolBarSeed || {};
    return s.MODULE_NAME || 'Pool Bar';
  }
  function getDepartmentName() {
    const s = global.PoolBarSeed || {};
    return s.DEPARTMENT_NAME || s.MODULE_NAME || 'Pool Bar';
  }
  function isMoneyReceived(method) {
    const s = global.PoolBarSeed || {};
    const list = Array.isArray(s.MONEY_RECEIVED_METHODS) ? s.MONEY_RECEIVED_METHODS : ['Cash', 'POS', 'Transfer'];
    return list.indexOf((method || '').trim()) !== -1;
  }
  function getDefaultPageSize() {
    const s = global.PoolBarSeed || {};
    return (typeof s.DEFAULT_PAGE_SIZE === 'number' && s.DEFAULT_PAGE_SIZE > 0) ? s.DEFAULT_PAGE_SIZE : 8;
  }
  function getOrderPageLink() {
    const s = global.PoolBarSeed || {};
    return s.ORDER_PAGE_LINK || 'poolbar-orders.html';
  }
  function getStockCategories() {
    const s = global.PoolBarSeed || {};
    return Array.isArray(s.STOCK_CATEGORIES) ? s.STOCK_CATEGORIES : [];
  }
  function getStockUnits() {
    const s = global.PoolBarSeed || {};
    return Array.isArray(s.STOCK_UNITS) ? s.STOCK_UNITS : [];
  }
  function getDeductReasons() {
    const s = global.PoolBarSeed || {};
    return Array.isArray(s.DEDUCT_REASONS) ? s.DEDUCT_REASONS : [];
  }
  function getEmptyValuePlaceholder() {
    const s = global.PoolBarSeed || {};
    return s.EMPTY_VALUE_PLACEHOLDER || '—';
  }

  const DEFAULT_REVENUE_METHOD_ORDER = ['Cash', 'Room Charge', 'POS', 'Transfer', 'Complimentary', 'Other'];
  const DEFAULT_REVENUE_METHOD_COLORS = { Cash: '', 'Room Charge': 'blue', POS: 'blue', Transfer: 'purple', Complimentary: 'purple' };
  function getRevenueMethodOrder() {
    const s = global.PoolBarSeed || {};
    return Array.isArray(s.REVENUE_METHOD_ORDER) && s.REVENUE_METHOD_ORDER.length ? s.REVENUE_METHOD_ORDER : DEFAULT_REVENUE_METHOD_ORDER;
  }
  function getRevenueMethodColorClass(method) {
    const s = global.PoolBarSeed || {};
    const map = Object.assign({}, DEFAULT_REVENUE_METHOD_COLORS, s.REVENUE_METHOD_COLORS || {});
    return map[method] || '';
  }
  function getRevenueBreakdown(sales) {
    const byMethod = {};
    (sales || []).forEach(function (s) { const m = s.method || 'Other'; byMethod[m] = (byMethod[m] || 0) + (s.total || 0); });
    const order = getRevenueMethodOrder();
    const entries = order.filter(function (k) { return byMethod[k]; })
      .map(function (k) { return { method: k, amount: byMethod[k], colorClass: getRevenueMethodColorClass(k) }; });
    Object.keys(byMethod).forEach(function (k) {
      if (order.indexOf(k) === -1) entries.push({ method: k, amount: byMethod[k], colorClass: getRevenueMethodColorClass(k) });
    });
    return entries;
  }
  function getTodaysCompletedSales() {
    const today = todayDDMMYY();
    const completedStatus = getStatusConstants().SALE_COMPLETED;
    return (state.sales || []).filter(function (s) {
      const d = s.date ? new Date(s.date) : null;
      const dStr = d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}` : (s.dateDisplay || '');
      return s.status === completedStatus && dStr === today;
    });
  }

  const DEFAULT_DASHBOARD_DISPLAY_LIMITS = { stock: 5, lowStock: 3, pending: 3, recentSales: 3 };
  function getDashboardDisplayLimits() {
    const s = global.PoolBarSeed || {};
    return Object.assign({}, DEFAULT_DASHBOARD_DISPLAY_LIMITS, s.DASHBOARD_DISPLAY_LIMITS || {});
  }
  function getStockSnapshot() { return (state.stock || []).slice(0, getDashboardDisplayLimits().stock); }
  function getLowStockSnapshot() { return getLowStockItems().slice(0, getDashboardDisplayLimits().lowStock); }
  function getPendingSnapshot() {
    const pendingStatuses = ['Pending', 'Partial'];
    return (state.requisitions || []).filter(r => pendingStatuses.includes(r.status)).slice(0, getDashboardDisplayLimits().pending);
  }
  function getRecentSalesSnapshot() { return (state.sales || []).slice(0, getDashboardDisplayLimits().recentSales); }

  const DEFAULT_FALLBACK_CATEGORY = 'Uncategorized';
  function getFallbackCategoryName() {
    const s = global.PoolBarSeed || {};
    return s.FALLBACK_CATEGORY || DEFAULT_FALLBACK_CATEGORY;
  }

  function parseReceivedDate(s) {
    const empty = getEmptyValuePlaceholder();
    if (!s || s === empty) return 0;
    const parts = String(s).split('/');
    if (parts.length < 3) return 0;
    const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return 0;
    return new Date(2000 + y, m - 1, d).getTime();
  }

  function listStockCategoriesInUse() {
    const cats = new Set();
    (state.stock || []).forEach(function (i) { if (i.category) cats.add(i.category); });
    return [...cats].sort();
  }
  function listManagedCategories() {
    const set = new Set([...listStockCategoriesInUse(), ...(state.extraCategories || [])]);
    return [...set].filter(Boolean).sort();
  }
  function categoryItemCount(name) {
    return (state.stock || []).filter(function (i) { return i.category === name; }).length;
  }
  // Session-only — see file header. Persists nothing server-side.
  async function addCategory(name) {
    const n = (name || '').trim();
    if (!n) throw new Error('Category name is required.');
    if (listManagedCategories().some(c => c.toLowerCase() === n.toLowerCase())) {
      throw new Error(`Category "${n}" already exists.`);
    }
    state.extraCategories.push(n);
    emitChange('category:add');
    return n;
  }
  async function renameCategory(oldName, newName) {
    const n = (newName || '').trim();
    if (!n) throw new Error('Category name is required.');
    if (n.toLowerCase() !== (oldName || '').toLowerCase() &&
        listManagedCategories().some(c => c.toLowerCase() === n.toLowerCase())) {
      throw new Error(`Category "${n}" already exists.`);
    }
    // Persist the rename onto every stock item currently using it — this
    // part IS real (goes through the API), only the "not-yet-used" extra
    // category bookkeeping is session-only.
    const affected = state.stock.filter(i => i.category === oldName);
    for (const item of affected) {
      const idForApi = item.id || item._id;
      const res = await apiPut('/stock/' + idForApi, { category: n });
      Object.assign(item, res.data);
    }
    const idx = state.extraCategories.indexOf(oldName);
    if (idx > -1) state.extraCategories[idx] = n;
    else if (affected.length === 0) state.extraCategories.push(n);
    emitChange('category:rename');
    return n;
  }
  async function deleteCategory(name, opts) {
    opts = opts || {};
    const reassignTo = opts.reassignTo || getFallbackCategoryName();
    const affected = state.stock.filter(i => i.category === name);
    for (const item of affected) {
      const idForApi = item.id || item._id;
      const res = await apiPut('/stock/' + idForApi, { category: reassignTo });
      Object.assign(item, res.data);
    }
    state.extraCategories = state.extraCategories.filter(c => c !== name);
    emitChange('category:delete');
  }

  function filterStock(filterState) {
    filterState = filterState || {};
    const q = (filterState.search || '').trim().toLowerCase();
    const level = filterState.level || '';
    const cat = filterState.category || '';
    const sort = filterState.sort || 'name_asc';

    let rows = (state.stock || []).filter(function (i) {
      const mq = !q || (i.name || '').toLowerCase().indexOf(q) !== -1 || (i.batch || '').toLowerCase().indexOf(q) !== -1;
      const ml = !level || stockLevel(i) === level;
      const mc = !cat || i.category === cat;
      return mq && ml && mc;
    });

    if (sort === 'name_asc') rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sort === 'qty_asc') rows.sort((a, b) => (a.qty || 0) - (b.qty || 0));
    else if (sort === 'qty_desc') rows.sort((a, b) => (b.qty || 0) - (a.qty || 0));
    else if (sort === 'received_desc') rows.sort((a, b) => parseReceivedDate(b.received) - parseReceivedDate(a.received));
    return rows;
  }

  /* ── Load everything from the real API ──────────────────────────── */
  async function loadAll() {
    const [stockRes, salesRes, ordersRes, reqRes, movRes] = await Promise.all([
      apiGet('/stock'),
      apiGet('/sales'),
      apiGet('/orders'),
      apiGet('/requisitions'),
      apiGet('/movements'),
    ]);
    state.stock = stockRes.data || [];
    state.sales = salesRes.data || [];
    state.orders = ordersRes.data || [];
    state.requisitions = reqRes.data || [];
    state.movements = movRes.data || [];
    state.ready = true;

    ensureBookingData().catch(function (e) {
      console.warn('[PoolBarService] BookingData not available:', e.message);
    });

    emitChange('load');
    return state;
  }

  function findStock(name) { return state.stock.find(i => i.name === name); }
  function findStockRecordId(item) { return item.id || item._id; }

  async function postToGuestFolio(sale) {
    if (!sale || sale.method !== getRoomChargeMethodName()) return;
    if (!sale.roomNumber) return;
    let bookingData;
    try { bookingData = await ensureBookingData(); }
    catch (e) { console.warn('[PoolBarService] BookingData unavailable — folio not updated:', e.message); return; }
    if (typeof bookingData.addRoomCharge !== 'function') {
      console.warn('[PoolBarService] BookingData.addRoomCharge unavailable — folio not updated.');
      return;
    }
    const desc = (sale.items || []).map(i => (i.qty || 1) + 'x ' + (i.name || '')).join(', ') || sale.id;
    const guestKey = sale.guestName || sale.roomNumber;
    try {
      await bookingData.addRoomCharge(guestKey, {
        source: getModuleName(), desc, room: sale.roomNumber, amount: sale.total,
        by: sale.staff || getModuleName(),
      });
    } catch (e) {
      console.warn('[PoolBarService] folio charge failed:', e && e.message ? e.message : e);
    }
  }

  async function getInHouseGuests() {
    let bookingData;
    try { bookingData = await ensureBookingData(); }
    catch (e) {
      const err = new Error('BookingData could not be loaded automatically: ' + e.message);
      err.code = 'BOOKING_DATA_UNAVAILABLE';
      throw err;
    }
    const data = await bookingData.getBookingData();
    const bookings = (data && data.bookings) || [];
    return bookings.filter(b => b.status === 'checkedin' && b.guest).map(b => ({
      room: String(b.room || ''), name: b.guest || '', phone: b.phone || '', status: 'In-House',
    }));
  }

  /* ── Stock CRUD (real API) ───────────────────────────────────────── */
  async function addStockItem({ name, category, unit, min = 0, price = 0, desc = '' }) {
    if (!name || !name.trim()) throw new Error('Item name is required.');
    if (findStock(name)) throw new Error(`"${name}" is already tracked — edit it instead.`);
    const res = await apiPost('/stock', { name, category, unit, min, price, desc });
    state.stock.push(res.data);
    emitChange('stock:add');
    return res.data;
  }

  async function editStockItem(nameOrId, updates) {
    const item = typeof nameOrId === 'string'
      ? (findStock(nameOrId) || state.stock.find(i => i.id === nameOrId || i._id === nameOrId))
      : nameOrId;
    if (!item) throw new Error(`"${nameOrId}" not found in stock.`);
    const { qty, batch, received, ...safeUpdates } = updates || {};
    const res = await apiPut('/stock/' + findStockRecordId(item), safeUpdates);
    Object.assign(item, res.data);
    emitChange('stock:edit');
    return item;
  }

  async function deleteStockItem(nameOrId) {
    const item = typeof nameOrId === 'string'
      ? (findStock(nameOrId) || state.stock.find(i => i.id === nameOrId || i._id === nameOrId))
      : nameOrId;
    if (!item) return;
    await apiDelete('/stock/' + findStockRecordId(item));
    state.stock = state.stock.filter(i => i !== item);
    emitChange('stock:delete');
  }

  async function deductStock(name, qty, reason, notes) {
    if (!qty || qty < 1) throw new Error('Enter a valid quantity.');
    const res = await apiPost('/stock/deduct', { name, qty, reason, notes });
    const item = findStock(name);
    if (item) Object.assign(item, res.data);
    emitChange('stock:deduct');
    return item || res.data;
  }

  /**
   * Client-side stock restore used only as a local mirror right after a
   * void/cancel API call already told us the new server-side qty — never
   * called on its own to mutate the server. See voidSale() below, which
   * uses the qty the server actually returned instead of guessing.
   */
  function restoreStockLocal(name, qty) {
    const i = findStock(name);
    if (!i) return null;
    i.qty += qty;
    return i;
  }

  /* ── Requisitions (Pool Bar → Store) ─────────────────────────────── */
  async function submitRequisition({ items, requester, dept, priority, remark, neededBy }) {
    const res = await apiPost('/requisitions', {
      items, requester, dept: dept || getDepartmentName(), priority, remark, neededBy,
    });
    state.requisitions.unshift(res.data);
    emitChange('requisition:submit');
    return res.data;
  }

  // In-memory only — see file header. Prevents double-crediting stock if
  // the same requisition's "Accept Delivery" is triggered twice in one
  // session; does not survive a reload.
  const _receivedReqLinesThisSession = {};

  /**
   * Credits Pool Bar's own stock with whatever Store issued on a
   * requisition, via PUT /stock/:id (or POST /stock for a brand-new
   * item) since there's no dedicated "receive" endpoint yet.
   */
  async function receiveRequisition(req) {
    if (!req || !Array.isArray(req.items)) throw new Error('Invalid requisition — nothing to receive.');
    const reqNo = req.no || req.requisitionNo;
    let receivedAny = false;

    for (const it of req.items) {
      const issued = Number(it.issuedQty) || 0;
      const already = (_receivedReqLinesThisSession[reqNo] && _receivedReqLinesThisSession[reqNo][it.name]) || 0;
      const delta = issued - already;
      if (delta <= 0) continue;
      receivedAny = true;

      const existing = findStock(it.name);
      if (existing) {
        const res = await apiPut('/stock/' + findStockRecordId(existing), { qty: (existing.qty || 0) + delta });
        Object.assign(existing, res.data);
      } else {
        const res = await apiPost('/stock', {
          name: it.name, category: getFallbackCategoryName(), unit: it.unit || 'unit',
          min: 0, price: Number(it.cost) || 0, qty: delta,
        });
        state.stock.push(res.data);
      }

      _receivedReqLinesThisSession[reqNo] = _receivedReqLinesThisSession[reqNo] || {};
      _receivedReqLinesThisSession[reqNo][it.name] = issued;
    }

    if (!receivedAny) return null;
    emitChange('requisition:received');
    return req;
  }

  function cartTotals(cart, discountPct) {
    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const total = subtotal * (1 - (discountPct || 0) / 100);
    return { subtotal, total };
  }

  /* ── Sales (real API) ────────────────────────────────────────────── */
  async function recordSale({ items, discount = 0, method, staff, table, notes = '', roomNumber = null, guestName = null, guestPhone = null }) {
    if (!items || !items.length) throw new Error('Add at least one item.');
    if (!staff) throw new Error('Please enter the staff name.');
    const cleanItems = items.map(c => ({ name: c.key || c.name, qty: c.qty, price: c.price }));
    const roomChargeMethod = getRoomChargeMethodName();
    const effectiveMethod = (roomNumber && roomChargeMethod) ? roomChargeMethod : method;

    const res = await apiPost('/sales', {
      items: cleanItems, discount, method: effectiveMethod, staff, table, notes,
      roomNumber, guestName, guestPhone,
    });
    state.sales.unshift(res.data);
    emitChange('sale:record');
    await postToGuestFolio(res.data);
    return res.data;
  }

  async function voidSale(saleId, reason, voidedBy) {
    const res = await apiPost('/sales/' + saleId + '/void', { reason });
    const idx = state.sales.findIndex(s => s.id === saleId || s._id === saleId);
    if (idx > -1) state.sales[idx] = res.data;
    else state.sales.unshift(res.data);
    emitChange('sale:void');
    return res.data;
  }

  /* ── Orders / Tabs (real API) ─────────────────────────────────────── */
  async function openTab({ items, discount = 0, staff, table, notes = '', roomNumber = null, guestName = null, guestPhone = null }) {
    if (!items || !items.length) throw new Error('Add at least one item.');
    if (!staff) throw new Error('Please enter the staff name.');
    const cleanItems = items.map(c => ({ name: c.key || c.name, qty: c.qty, price: c.price }));
    const res = await apiPost('/orders', { items: cleanItems, discount, staff, table, notes, roomNumber, guestName, guestPhone });
    state.orders.unshift(res.data);
    emitChange('order:open');
    return res.data;
  }

  async function updateOrder(orderId, updates) {
    const res = await apiPut('/orders/' + orderId, updates);
    const idx = state.orders.findIndex(o => o.id === orderId || o._id === orderId);
    if (idx > -1) state.orders[idx] = res.data;
    emitChange('order:update');
    return res.data;
  }

  async function markServed(orderId) {
    const res = await updateOrder(orderId, { status: 'served' });
    emitChange('order:served');
    return res;
  }

  async function payOrder(orderId, methodOrOpts) {
    const body = (methodOrOpts && typeof methodOrOpts === 'object') ? methodOrOpts : { method: methodOrOpts };
    const res = await apiPost('/orders/' + orderId + '/pay', body);
    const idx = state.orders.findIndex(o => o.id === orderId || o._id === orderId);
    if (idx > -1) state.orders[idx] = res.data.order;
    state.sales.unshift(res.data.sale);
    emitChange('order:paid');
    await postToGuestFolio(res.data.sale);
    return res.data;
  }

  async function cancelOrder(orderId, reason) {
    const res = await apiPost('/orders/' + orderId + '/cancel', { reason });
    const idx = state.orders.findIndex(o => o.id === orderId || o._id === orderId);
    if (idx > -1) state.orders[idx] = res.data;
    emitChange('order:cancelled');
    return res.data;
  }

  /* ── KPIs ─────────────────────────────────────────────────────────── */
  function dashboardKPIs() {
    const pendingStatuses = ['Pending', 'Partial'];
    const pendingN = (state.requisitions || []).filter(r => pendingStatuses.includes(r.status)).length;
    const lowStock = state.stock.filter(i => stockLevel(i) !== 'ok').length;
    const todaySales = getTodaysCompletedSales();
    const todayRevenue = todaySales.reduce((s, x) => s + x.total, 0);
    const units = state.stock.reduce((s, i) => s + i.qty, 0);
    return { pendingN, lowStock, todaySalesCount: todaySales.length, todayRevenue, units, itemCount: state.stock.length };
  }

  function salesKPIs(list) {
    const rows = list || state.sales;
    const completed = rows.filter(s => s.status === getStatusConstants().SALE_COMPLETED);
    const voided = rows.filter(s => s.status === getStatusConstants().SALE_VOIDED);
    const revenue = completed.reduce((s, x) => s + x.total, 0);
    const units = completed.reduce((s, x) => s + (x.items || []).reduce((a, i) => a + i.qty, 0), 0);
    return { total: rows.length, completed: completed.length, voided: voided.length, revenue, units };
  }

  function stockKPIs() {
    const total = state.stock.length;
    const low = state.stock.filter(i => stockLevel(i) === 'low').length;
    const out = state.stock.filter(i => stockLevel(i) === 'out').length;
    const units = state.stock.reduce((s, i) => s + i.qty, 0);
    return { total, low, out, units };
  }

  function ordersKPIs() {
    const todayStr = todayDDMMYY();
    const isToday = (d) => {
      const dt = d ? new Date(d) : null;
      return dt && `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}` === todayStr;
    };
    const completedToday = state.sales.filter(s => s.status === getStatusConstants().SALE_COMPLETED && isToday(s.date));
    const rejectedToday = state.orders.filter(o => o.status === getStatusConstants().ORDER_CANCELLED && isToday(o.date));
    const unitsOnHand = state.stock.reduce((s, i) => s + i.qty, 0);
    const st = getStatusConstants();
    const active = state.orders.filter(o => o.status === st.ORDER_OPEN || o.status === st.ORDER_SERVED).length;
    const unitsSoldToday = completedToday.reduce((s, x) => s + (x.items || []).reduce((a, i) => a + i.qty, 0), 0);
    return {
      completedToday: completedToday.length,
      completedTodayRevenue: completedToday.reduce((s, x) => s + x.total, 0),
      rejectedToday: rejectedToday.length,
      unitsOnHand, unitsSoldToday,
      itemCount: state.stock.length,
      activeOrders: active,
    };
  }

  function can(session, permission) {
    if (!global.Permissions) return true;
    return global.Permissions.hasPermission(session, permission, 'poolbar');
  }
  function canVoidSale(session) {
    if (!global.Permissions) return true;
    return global.Permissions.canVoid(session, 'poolbar');
  }
  function canDiscount(session) {
    if (!global.Permissions) return true;
    return global.Permissions.canGiveDiscount(session, 'poolbar');
  }

  function listStaffNames() {
    const names = new Set();
    state.sales.forEach(s => { if (s.staff) names.add(s.staff); });
    state.orders.forEach(o => { if (o.staff) names.add(o.staff); });
    return [...names].sort();
  }

  function isManagerLike(session) {
    if (!session) return false;
    return session.role === 'admin' || session.role === 'manager';
  }

  function getShiftSales(session) {
    const today = todayDDMMYY();
    const isToday = (d) => {
      const dt = d ? new Date(d) : null;
      return dt && `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}` === today;
    };
    const me = ((session && session.name) || '').toLowerCase();
    const allStaff = isManagerLike(session);
    return (state.sales || []).filter(s => {
      if (!isToday(s.date)) return false;
      if (!allStaff) {
        if (!me) return false;
        if ((s.staff || '').toLowerCase() !== me) return false;
      }
      return true;
    });
  }

  function normalizeSaleForTable(s) {
    return Object.assign({}, s, {
      items: (s.items || []).map(i => ({ name: i.name || '—', qty: i.qty || 0, price: i.price || 0 })),
    });
  }

  function buildSaleDetailShape(s) {
    return {
      id: s.id, dept: getDepartmentName(), table: s.table, staff: s.staff,
      date: s.date, method: s.method,
      items: (s.items || []).map(i => ({ name: i.name || '—', qty: i.qty || 0, price: i.price || 0 })),
      discount: (s.subtotal || 0) * (s.discount || 0) / 100,
      total: s.total, status: s.status, voidReason: s.voidReason, notes: s.notes,
      roomNumber: s.roomNumber || null, guestName: s.guestName || null, guestPhone: s.guestPhone || null,
    };
  }

  function saleItemsQty(s) { return (s.items || []).reduce((sum, i) => sum + (i.qty || 0), 0); }

  function filterShiftSales(session, filterState) {
    filterState = filterState || {};
    const q = (filterState.search || '').trim().toLowerCase();
    return getShiftSales(session).filter(s => {
      if (filterState.status && s.status !== filterState.status) return false;
      if (filterState.payment && s.method !== filterState.payment) return false;
      if (q) {
        const items = s.items || [];
        const mq = (s.id || '').toLowerCase().includes(q)
          || (s.staff || '').toLowerCase().includes(q)
          || (s.table || '').toLowerCase().includes(q)
          || items.some(i => (i.name || '').toLowerCase().includes(q));
        if (!mq) return false;
      }
      return true;
    });
  }

  function getShiftKpiSummary(rows) {
    rows = rows || [];
    const st = getStatusConstants();
    const completed = rows.filter(s => s.status === st.SALE_COMPLETED);
    const voided = rows.filter(s => s.status === st.SALE_VOIDED);
    const revenue = completed.reduce((sum, s) => sum + (s.total || 0), 0);
    const units = completed.reduce((sum, s) => sum + saleItemsQty(s), 0);
    const moneyReceived = completed.filter(s => isMoneyReceived(s.method)).reduce((sum, s) => sum + (s.total || 0), 0);
    const notReceivedTotal = completed.filter(s => s.method && !isMoneyReceived(s.method)).reduce((sum, s) => sum + (s.total || 0), 0);
    return { total: rows.length, completed: completed.length, voided: voided.length, revenue, units, moneyReceived, notReceivedTotal };
  }

  function getShiftLabel(session) { return isManagerLike(session) ? 'Today' : 'Your shift'; }
  function getShiftNoteText(session) {
    return isManagerLike(session)
      ? 'Today only · all ' + getDepartmentName().toLowerCase() + ' staff'
      : ('Today only · ' + ((session && session.name) || 'your') + ' sales');
  }
  function getShiftTableTitle(session) {
    return isManagerLike(session) ? 'Today — All staff' : 'Today — ' + ((session && session.name) || 'My sales');
  }
  function getPrintSummary(session, rows) {
    return 'Printed: ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
      ' · ' + rows.length + ' record' + (rows.length !== 1 ? 's' : '') +
      ' · ' + (isManagerLike(session) ? 'All staff today' : ((session && session.name) || ''));
  }

  function getSaleStatusOptions() {
    const seed = global.PoolBarSeed || {};
    if (Array.isArray(seed.SALE_STATUS_OPTIONS) && seed.SALE_STATUS_OPTIONS.length) return seed.SALE_STATUS_OPTIONS;
    const st = getStatusConstants();
    const defaults = [
      { value: st.SALE_COMPLETED, label: 'Completed', color: 'var(--green)', colorBg: 'var(--green-bg)' },
      { value: st.SALE_VOIDED, label: 'Voided', color: 'var(--red)', colorBg: 'var(--red-bg)' },
    ];
    const knownValues = new Set(defaults.map(d => d.value));
    const existing = (state.sales || []).map(s => s.status).filter(Boolean).filter(v => !knownValues.has(v));
    existing.forEach(v => defaults.push({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1), color: 'var(--text2)', colorBg: 'var(--surface3)' }));
    return defaults;
  }

  function filterSales(filterState) {
    filterState = filterState || {};
    const q = (filterState.search || '').trim().toLowerCase();
    const pay = filterState.payment || '';
    const status = filterState.status || '';
    const staff = filterState.staff || '';
    const bounds = filterState.dateRange || { start: null, end: null };

    return (state.sales || []).filter(s => {
      if (status && s.status !== status) return false;
      if (pay && s.method !== pay) return false;
      if (staff && (s.staff || '') !== staff) return false;
      if (q) {
        const hit = (s.id || '').toLowerCase().includes(q)
          || (s.staff || '').toLowerCase().includes(q)
          || (s.table || '').toLowerCase().includes(q)
          || (s.items || []).some(i => (i.name || '').toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (bounds.start && bounds.end) {
        const sd = dateOnly(parseStamp(s.date));
        if (!sd || sd < bounds.start || sd > bounds.end) return false;
      }
      return true;
    });
  }

  function getReportTitle(periodLabel) {
    if (!periodLabel || periodLabel === 'All time') return 'Full Report';
    return 'Report: ' + periodLabel;
  }

  /* ── Requisition history (Pool Bar → Store) ──────────────────────────
   * Sourced entirely from state.requisitions (the real API) now — the
   * old demo merged in a separate "Store push transfer" list that had no
   * backend model wired up for Pool Bar; that concept is gone until a
   * real transfers endpoint exists. */
  function getDepartmentHistory(dept) {
    return (state.requisitions || [])
      .filter(r => !dept || r.dept === dept)
      .map(r => Object.assign({}, r, { _kind: 'requisition' }));
  }

  function filterHistory(rows, filters) {
    filters = filters || {};
    const q = (filters.search || '').trim().toLowerCase();
    const status = filters.status || '';
    const priority = filters.priority || '';

    return rows.filter(r => {
      if (q) {
        const by = (r.requester || r.by || '').toLowerCase();
        const itemNames = (r.items || []).map(i => (i.name || '').toLowerCase()).join(' ');
        const no = (r.no || r.requisitionNo || '').toLowerCase();
        if (!no.includes(q) && !by.includes(q) && !itemNames.includes(q)) return false;
      }
      if (status && r.status !== status) return false;
      if (priority && (r.priority || 'Normal') !== priority) return false;
      return true;
    });
  }

  function sortHistory(rows, sortKey, sortDir) {
    sortKey = sortKey || 'date'; sortDir = sortDir || 'desc';
    const sorted = rows.slice();
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        const ta = Date.parse(a.dateRaised || a.date || '') || 0;
        const tb = Date.parse(b.dateRaised || b.date || '') || 0;
        cmp = ta - tb;
      } else if (sortKey === 'items') {
        cmp = (a.items || []).length - (b.items || []).length;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }

  function getHistoryKPIs(rows) {
    let pending = 0, completed = 0, rejected = 0, totalUnits = 0;
    rows.forEach(r => {
      if (r.status === 'Full' || r.status === 'Completed') {
        completed++;
        (r.items || []).forEach(i => { totalUnits += parseFloat(i.issuedQty != null ? i.issuedQty : i.qty) || 0; });
      } else if (r.status === 'Rejected' || r.status === 'Disputed') {
        rejected++;
      } else {
        pending++;
      }
    });
    return { pending, completed, rejected, transfers: 0, totalUnits };
  }

  function getHistoryStatusDisplay(kind, status) {
    switch (status) {
      case 'Pending':   return { label: 'Pending', cls: 'chip-pending' };
      case 'Partial':   return { label: 'Partially Issued', cls: 'chip-partial' };
      case 'Full':      return { label: 'Issued — Awaiting You', cls: 'chip-issued' };
      case 'Completed': return { label: 'Completed', cls: 'chip-completed' };
      case 'Disputed':  return { label: 'Disputed', cls: 'chip-disputed' };
      case 'Rejected':  return { label: 'Rejected', cls: 'chip-rejected' };
      default:          return { label: status || '—', cls: '' };
    }
  }

  function getLowStockItems() { return state.stock.filter(i => stockLevel(i) !== 'ok'); }

  global.PoolBarService = {
    fmtN, nowStamp, fmtStamp, parseStamp, dateOnly, todayDDMMYY,
    stockLevel, LEVEL_CHIP, LEVEL_LABEL,
    state,
    onChange,
    loadAll,
    findStock,
    addStockItem, editStockItem, deleteStockItem, deductStock,
    submitRequisition, receiveRequisition,
    recordSale, openTab, markServed, updateOrder, payOrder, cancelOrder, voidSale,
    cartTotals,
    dashboardKPIs, salesKPIs, stockKPIs, ordersKPIs,
    can, canVoidSale, canDiscount,
    listStaffNames,
    getShiftSales, isManagerLike,
    postToGuestFolio,
    getInHouseGuests,
    getPaymentMethods,
    getRoomChargeMethodName,
    getStatusOptions,
    getCompletedSaleStatus,
    getIdPrefixes,
    getLevelLabels,
    getLevelLabelsShort,
    getModuleName,
    getDepartmentName,
    isMoneyReceived,
    getDefaultPageSize,
    getOrderPageLink,
    getCurrencyConfig,
    getStatusConstants,
    getEmptyValuePlaceholder,
    getRevenueMethodOrder,
    getRevenueMethodColorClass,
    getRevenueBreakdown,
    getTodaysCompletedSales,
    getDashboardDisplayLimits,
    getStockSnapshot,
    getLowStockSnapshot,
    getPendingSnapshot,
    getRecentSalesSnapshot,
    getStockCategories,
    getStockUnits,
    getDeductReasons,
    listStockCategoriesInUse,
    parseReceivedDate,
    filterStock,
    listManagedCategories,
    categoryItemCount,
    addCategory,
    renameCategory,
    deleteCategory,
    getFallbackCategoryName,
    normalizeSaleForTable,
    buildSaleDetailShape,
    filterShiftSales,
    getShiftKpiSummary,
    getShiftLabel,
    getShiftNoteText,
    getShiftTableTitle,
    getPrintSummary,
    getSaleStatusOptions,
    filterSales,
    getReportTitle,
    getDepartmentHistory,
    filterHistory,
    sortHistory,
    getHistoryKPIs,
    getHistoryStatusDisplay,
    getLowStockItems,
  };
})(window);