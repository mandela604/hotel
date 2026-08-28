/**
 * services/restaurant-service.js — Restaurant API client (window.RestaurantService)
 * ─────────────────────────────────────────────────────────────────
 * Production only — no localStorage/loadShared/saveShared path. Talks
 * directly to routes/restaurantRoutes.js + controllers/restaurantController.js.
 *
 * REBUILD NOTE: the previous version of this file was never provided to
 * me directly — this rewrite was reconstructed from every
 * RestaurantService.svc.RS.* call actually present across 
 * restaurant-dashboard.html, restaurant-inventory.html, restaurant-sales.html,
 * restaurant-reports.html, and restaurant-transfer-history.html, so the
 * public method names and shapes match what those pages already call.
 * Test each page after dropping this in — if any page used a method that
 * isn't in this list, it wasn't visible in the pages I could inspect.
 *
 * Depends on: services/permissions.js (optional).
 *
 * KEYS — kept as plain string identifiers (not real storage keys anymore)
 * purely for backward compatibility: restaurant-orders.html passes
 * RestaurantService.KEYS.STOCK/SALES/ORDERS/MOVEMENTS into OrdersWorkspace,
 * which owns its OWN separate storage engine (with its own
 * CFG.API_BASE, unrelated to this file). Making THIS file
 * production-ready does not make OrdersWorkspace production-ready — that's
 * a separate component.
 *
 * TRANSFER IDENTIFIER: acceptTransfer()/rejectTransfer() are called with
 * a transfer's human-readable `no` (e.g. "KTN-00046"), not a Mongo _id —
 * matches how restaurant-transfer-history.html calls them. Requests hit
 * POST /transfers/:id/accept|reject with that `no` in the :id slot;
 * this assumes restaurantController resolves :id by either _id or
 * transferNo (the same $or pattern already used for Kitchen's
 * Production/Transfer lookups) — confirm that's true server-side.
 *
 * Script order: services/permissions.js (optional), then this file.
 */
(function (global) {
  'use strict';

  const CONFIG = {
    API_BASE: '/api/restaurant',
    TOKEN_STORAGE_KEY: 'token',
  };

  // Plain labels only — see the KEYS note above. Not real storage keys.
  const KEYS = {
    STOCK: 'restaurant-stock',
    SALES: 'restaurant-sales',
    ORDERS: 'restaurant-orders',
    MOVEMENTS: 'restaurant-movements',
    TRANSFERS: 'restaurant-transfers',
  };

   /* ══════════════════════════════════════════════════════════════
      Config-driven pure helpers — read from global config each
      call, so a deployment can change labels/colors/currency without
      touching this file. None of this is persistence — untouched by the
      REST rewrite below.
  ══════════════════════════════════════════════════════════════ */
  function seed() { return global.RestaurantSeed || {}; }

  function getEmptyValuePlaceholder() { return seed().EMPTY_VALUE_PLACEHOLDER || '—'; }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function getCurrencyConfig() { return seed().CURRENCY || null; }
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
  const DEFAULT_LEVEL_LABELS = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };
  const DEFAULT_LEVEL_SHORT = { ok: 'OK', low: 'LOW', out: 'OUT' };
  const LEVEL_CHIP = { ok: 'chip-ok', low: 'chip-low', out: 'chip-out' };
  function getLevelLabels() { return Object.assign({}, DEFAULT_LEVEL_LABELS, seed().STOCK_LEVEL_LABELS || {}); }
  function getLevelLabelsShort() { return Object.assign({}, DEFAULT_LEVEL_SHORT, seed().STOCK_LEVEL_SHORT_LABELS || {}); }
  const LEVEL_LABEL = new Proxy({}, { get: (_, key) => getLevelLabels()[key] });

  const DEFAULT_REVENUE_ORDER = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];
  const DEFAULT_REVENUE_COLORS = {};
  /**
   * Groups completed sales by payment method, in config order, with a
   * config color class per method. See restaurant-dashboard.html's own
   * doc comment: order/colors come from RestaurantSeed
   * .REVENUE_METHOD_ORDER / .REVENUE_METHOD_COLORS — this page never
   * hand-decides "Cash first" or which bar is blue.
   */
  function getRevenueBreakdown(sales) {
    const order = Array.isArray(seed().REVENUE_METHOD_ORDER) ? seed().REVENUE_METHOD_ORDER : DEFAULT_REVENUE_ORDER;
    const colors = seed().REVENUE_METHOD_COLORS || DEFAULT_REVENUE_COLORS;
    const totals = {};
    (sales || []).forEach(function (s) {
      if (s.status === 'voided') return;
      const method = s.method || 'Other';
      totals[method] = (totals[method] || 0) + (s.total || 0);
    });
    const methods = order.filter(function (m) { return totals[m] > 0; })
      .concat(Object.keys(totals).filter(function (m) { return order.indexOf(m) === -1; }));
    return methods.map(function (method) {
      return { method, amount: totals[method] || 0, colorClass: colors[method] || '' };
    });
  }

  function getFilteredSales(filters) {
  const { status, source, payment, search, bounds } = filters || {};
  return (state.sales || []).filter(function (s) {
    if (status && s.status !== status) return false;
    if (source && s.source !== source) return false;
    if (payment && s.payment !== payment) return false;
    if (search && s.name && s.name.toLowerCase().indexOf(search.toLowerCase()) === -1) return false;
    if (bounds) {
      const d = parseStamp(s.date);
      if (!d) return false;
      if (bounds.start && d < new Date(bounds.start)) return false;
      if (bounds.end && d > new Date(bounds.end)) return false;
    }
    return true;
  }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
}

function getCategories() {
    const cats = new Set();
    (state.stock || []).forEach(function (i) { if (i.category || i.cat) cats.add(i.category || i.cat); });
    (state.extraCategories || []).forEach(function (c) { if (c) cats.add(c); });
    return [...cats].sort();
  }

  function listManagedCategories() {
    const set = new Set([...(state.extraCategories || [])]);
    (state.stock || []).forEach(function (i) { if (i.category) set.add(i.category); });
    return [...set];
  }

  async function addCategory(name) {
    const n = (name || '').trim();
    if (!n) throw new Error('Category name is required.');
    if (listManagedCategories().some(c => String(c).toLowerCase() === n.toLowerCase())) {
      throw new Error(`Category "${n}" already exists.`);
    }
    const res = await post('/categories', { name: n });
    const saved = (res && res.data && res.data.name) || n;
    state.extraCategories.push(saved);
    emitChange('category:add');
    return saved;
  }

  async function renameCategory(oldName, newName) {
    const n = (newName || '').trim();
    if (!n) throw new Error('Category name is required.');
    if (String(n).toLowerCase() !== String(oldName || '').toLowerCase() &&
        listManagedCategories().some(c => String(c).toLowerCase() === n.toLowerCase())) {
      throw new Error(`Category "${n}" already exists.`);
    }
    await put('/categories/' + encodeURIComponent(oldName), { name: n });
    (state.stock || []).forEach(function (i) { if (i.category === oldName) i.category = n; });
    const idx = state.extraCategories.indexOf(oldName);
    if (idx > -1) state.extraCategories[idx] = n;
    emitChange('category:rename');
    return n;
  }

  async function deleteCategory(name) {
    const n = (name || '').trim();
    if (!n) throw new Error('Category name is required.');
    await del('/categories/' + encodeURIComponent(n));
    state.extraCategories = state.extraCategories.filter(function (c) { return c !== n; });
    emitChange('category:delete');
    return n;
  }

  function salesKPIs(list) {
    const rows = list || state.sales || [];
    const completed = rows.filter(function (s) { return s.status === 'completed'; });
    const voided = rows.filter(function (s) { return s.status === 'voided'; });
    const revenue = completed.reduce(function (s, x) { return s + (x.total || 0); }, 0);
    const units = completed.reduce(function (s, x) { return s + (x.items || []).reduce(function (a, i) { return a + (i.qty || 0); }, 0); }, 0);
    return { total: rows.length, completed: completed.length, voided: voided.length, revenue, units };
  }

  function getTodaysCompletedSales() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (state.sales || []).filter(function (s) {
    const d = parseStamp(s.date);
    return d && d >= today && s.status === 'completed';
  });
}

function dashboardKPIs() {
    const pendingN = (state.pending || []).length;
    const lowStock = (state.stock || []).filter(function (i) { return stockLevel(i) !== 'ok'; }).length;
    const todaySales = getTodaysCompletedSales();
    const todayRevenue = todaySales.reduce(function (s, x) { return s + (x.total || 0); }, 0);
    const units = (state.stock || []).reduce(function (s, i) { return s + (i.qty || 0); }, 0);
    return { pendingN, lowStock, todaySalesCount: todaySales.length, todayRevenue, units, itemCount: (state.stock || []).length };
  }

  function transferKPIs() {
    const pending = state.pending || [];
    const history = state.history || [];
    const today = todayDDMMYY();
    return {
      pendingCount: pending.length,
      acceptedToday: history.filter(function (t) { return t.status === 'accepted' && (t.date || '').startsWith(today); }).length,
      rejectedToday: history.filter(function (t) { return t.status === 'rejected' && (t.date || '').startsWith(today); }).length,
      totalToday: pending.concat(history).filter(function (t) { return (t.date || '').startsWith(today); }).length,
    };
  }

  /* ══════════════════════════════════════════════════════════════
     Auth / session (same convention as booking-service.js)
  ══════════════════════════════════════════════════════════════ */
  function getToken() {
    // httpOnly cookie is sent automatically — no localStorage token needed.
    return '';
  }
  function decodeJwtPayload(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }
  function getSession() {
    // With httpOnly cookies, we can't decode the JWT client-side.
    // Use the session API endpoint for user info, or return a default.
    return null;
  }

  function can(session, permission) {
    if (!global.Permissions) return true;
    return global.Permissions.hasPermission(session, permission, 'restaurant');
  }
  function canVoidSale(session) {
    if (!global.Permissions) return true;
    return global.Permissions.canVoid(session, 'restaurant');
  }
  function canDiscount(session) {
    if (!global.Permissions) return true;
    return global.Permissions.canGiveDiscount(session, 'restaurant');
  }

  /* ══════════════════════════════════════════════════════════════
     REST client
  ══════════════════════════════════════════════════════════════ */
  async function apiFetch(path, options) {
    options = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    // httpOnly cookie is sent automatically — no Authorization header needed.

    let res;
    try {
    res = await fetch(CONFIG.API_BASE + path, Object.assign({}, options, { headers, credentials: 'include' }));
    } catch (networkErr) {
      throw new Error('Could not reach the server — check your connection.');
    }
    let body = null;
    try { body = await res.json(); } catch (e) { /* empty/non-JSON body */ }
    if (!res.ok) {
      const err = new Error((body && body.error) || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      throw err;
    }
    return body;
  }
  function get(path) { return apiFetch(path, { method: 'GET' }); }
  function post(path, data) { return apiFetch(path, { method: 'POST', body: JSON.stringify(data || {}) }); }
  function put(path, data) { return apiFetch(path, { method: 'PUT', body: JSON.stringify(data || {}) }); }
  function patch(path, data) { return apiFetch(path, { method: 'PATCH', body: JSON.stringify(data || {}) }); }
  function del(path) { return apiFetch(path, { method: 'DELETE' }); }

  /* ══════════════════════════════════════════════════════════════
     State + change listeners
  ══════════════════════════════════════════════════════════════ */
  const state = { stock: [], sales: [], orders: [], pending: [], history: [], movements: [], menu: [], extraCategories: [], ready: false };
  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(function (fn) { try { fn(state, reason); } catch (e) { console.warn('[RestaurantService] listener error', e); } }); }

  async function loadAll() {
    const [stockRes, salesRes, ordersRes, transfersRes, movementsRes, menuRes] = await Promise.all([
      get('/stock'), get('/sales'), get('/orders'), get('/transfers'), get('/movements'), get('/menu'),
    ]);
    state.stock = stockRes.data || [];
    state.sales = salesRes.data || [];
    state.orders = ordersRes.data || [];
    state.menu = menuRes.data || [];
    try {
      const catRes = await get('/categories');
      state.extraCategories = (catRes && catRes.data) ? catRes.data : [];
    } catch (e) { state.extraCategories = []; }
    const transfers = transfersRes.data || [];
    // 'sent' = awaiting review (pending); everything else (accepted/
    // rejected/cancelled) is history — same status vocabulary as
    // Kitchen's Transfer model.
    state.pending = transfers.filter(function (t) { return t.status === 'sent'; });
    state.history = transfers.filter(function (t) { return t.status !== 'sent'; });
    // Normalize transfer identifier: backend uses transferNo, frontend
    // references it as `no` for display. Ensure both are set so
    // pending/history lookups by `no` always match.
    state.pending.concat(state.history).forEach(function (t) {
      if (!t.no && t.transferNo) t.no = t.transferNo;
    });
    state.movements = movementsRes.data || [];
    state.ready = true;
    emitChange('load');
    return state;
  }

  function findStock(name) {
    const n = (name || '').trim().toLowerCase();
    return (state.stock || []).find(function (i) { return (i.name || '').toLowerCase() === n; }) || null;
  }

  async function addStockItem(payload) {
    const res = await post('/stock', payload);
    state.stock.push(res.data);
    emitChange('stock:add');
    return res.data;
  }
  async function editStockItem(name, updates) {
    const res = await put('/stock/' + encodeURIComponent(name), updates);
    const idx = state.stock.findIndex(function (i) { return i.name === name; });
    if (idx > -1) state.stock[idx] = res.data;
    emitChange('stock:edit');
    return res.data;
  }
  async function deleteStockItem(name) {
    await del('/stock/' + encodeURIComponent(name));
    state.stock = state.stock.filter(function (i) { return i.name !== name; });
    emitChange('stock:delete');
  }

  // ── Menu ──────────────────────────────────────
  async function listMenu() {
    const res = await get('/menu');
    state.menu = res.data || [];
    return state.menu;
  }
  async function addMenuItem(payload) {
    const res = await post('/menu', payload);
    state.menu.push(res.data);
    emitChange('menu:add');
    return res.data;
  }
  async function updateMenuItem(id, updates) {
    const res = await put('/menu/' + encodeURIComponent(id), updates);
    const idx = state.menu.findIndex(function (i) { return i._id === id || i.id === id; });
    if (idx > -1) state.menu[idx] = res.data;
    emitChange('menu:edit');
    return res.data;
  }
  async function patchMenuItem(id, updates) {
    const res = await patch('/menu/' + encodeURIComponent(id), updates);
    const idx = state.menu.findIndex(function (i) { return i._id === id || i.id === id; });
    if (idx > -1) state.menu[idx] = res.data;
    emitChange('menu:patch');
    return res.data;
  }
  async function deleteMenuItem(id) {
    await del('/menu/' + encodeURIComponent(id));
    state.menu = state.menu.filter(function (i) { return i._id !== id && i.id !== id; });
    emitChange('menu:delete');
  }

  async function recordSale(payload) {
    const res = await post('/sales', payload);
    state.sales.unshift(res.data);
    emitChange('sale:record');
    return res.data;
  }
  async function voidSale(saleId, reason, voidedBy) {
    const res = await post('/sales/' + encodeURIComponent(saleId) + '/void', { reason, voidedBy });
    const idx = state.sales.findIndex(function (s) { return s.id === saleId || s._id === saleId; });
    if (idx > -1) state.sales[idx] = res.data;
    emitChange('sale:void');
    return res.data;
  }

  async function openTab(payload) {
    const res = await post('/orders', payload);
    state.orders.unshift(res.data);
    emitChange('order:open');
    return res.data;
  }
  async function markServed(orderId) {
    const res = await patch('/orders/' + encodeURIComponent(orderId) + '/serve');
    const idx = state.orders.findIndex(function (o) { return o.id === orderId; });
    if (idx > -1) state.orders[idx] = res.data;
    emitChange('order:served');
    return res.data;
  }
  async function payOrder(orderId, methodOrOpts) {
    const payload = typeof methodOrOpts === 'string' ? { method: methodOrOpts } : methodOrOpts;
    const res = await post('/orders/' + encodeURIComponent(orderId) + '/pay', payload);
    const idx = state.orders.findIndex(function (o) { return o.id === orderId; });
    if (idx > -1) state.orders[idx] = res.data;
    if (res.sale) state.sales.unshift(res.sale);
    emitChange('order:paid');
    return { order: res.data, sale: res.sale };
  }
  async function cancelOrder(orderId) {
    const res = await patch('/orders/' + encodeURIComponent(orderId) + '/cancel');
    const idx = state.orders.findIndex(function (o) { return o.id === orderId; });
    if (idx > -1) state.orders[idx] = res.data;
    emitChange('order:cancelled');
    return res.data;
  }

  async function acceptTransfer(no, opts) {
    const res = await post('/transfers/' + encodeURIComponent(no) + '/accept', opts || {});
    state.pending = state.pending.filter(function (t) { return (t.no || t.transferNo) !== no; });
    state.history.unshift(res.data);
    emitChange('transfer:accept');
    return res.data;
  }
  async function rejectTransfer(no, opts) {
    const res = await post('/transfers/' + encodeURIComponent(no) + '/reject', opts || {});
    state.pending = state.pending.filter(function (t) { return (t.no || t.transferNo) !== no; });
    state.history.unshift(res.data);
    emitChange('transfer:reject');
    return res.data;
  }

  async function getRequisitions() {
    const res = await get('/requisitions');
    return res.data || [];
  }
  function getRequisition(no) {
    if (!no) return null;
    return (state.history || []).concat(state.pending || []).find(function (r) { return r.no === no || r.requisitionNo === no || r.id === no; }) || null;
  }
  async function submitRequisition(payload) {
    payload = payload || {};
    payload.requester = payload.requester || payload.by || 'Restaurant Staff';
    payload.neededBy = payload.neededBy || payload.needed || '';
    const res = await post('/requisitions', payload);
    emitChange('requisition:submit');
    return res.data;
  }
  async function receiveRequisition(req) {
    if (!req) throw new Error('Invalid requisition — nothing to receive.');
    const id = (typeof req === 'string' ? req : (req.no || req.requisitionNo || req.id || req._id));
    if (!id) throw new Error('Requisition has no id/number.');

    const res = await post('/requisitions/' + encodeURIComponent(id) + '/receive');
    await loadAll().catch(function () {});
    emitChange('requisition:received');
    return res.data || res;
  }
  async function confirmReceipt(no) {
    return receiveRequisition(no);
  }

  /* ══════════════════════════════════════════════════════════════
     Booking integration — Room Charge guest lookup.
     Calls the booking API directly via fetch.
     Uses the same JWT token for auth.
  ══════════════════════════════════════════════════════════════ */
  const BOOKING_API_BASE = '/api/booking';
  async function getInHouseGuests() {
    const headers = { 'Content-Type': 'application/json' };
    let res;
    try {
      res = await fetch(BOOKING_API_BASE + '/data', { headers, credentials: 'include' });
    } catch (e) {
      throw new Error('Could not reach the booking server.');
    }
    let body = null;
    try { body = await res.json(); } catch (_) { /* empty */ }
    if (res.status === 401) { window.location.href = '/login.html'; return null; }
if (!res.ok) throw new Error((body && body.error) || 'Booking data unavailable');
    const bookings = (body && body.data && body.data.bookings) || [];
    return bookings
      .filter(function (b) { return b.status === 'checkedin' && b.guest; })
      .map(function (b) { return { room: String(b.room || ''), name: b.guest || '', phone: b.phone || '', status: 'In-House' }; });
  }

  global.RestaurantService = {
    KEYS,
    state, onChange, loadAll,
    fmtN, nowStamp, fmtStamp, parseStamp, dateOnly, todayDDMMYY,
    stockLevel, LEVEL_CHIP, LEVEL_LABEL, getLevelLabelsShort,
    getEmptyValuePlaceholder, getCurrencyConfig, getCategories,
    addCategory, renameCategory, deleteCategory,
    findStock, addStockItem, editStockItem, deleteStockItem,
    listMenu, addMenuItem, updateMenuItem, patchMenuItem, deleteMenuItem,
    recordSale, voidSale,
    openTab, markServed, payOrder, cancelOrder,
    acceptTransfer, rejectTransfer, transferKPIs,
    getRequisitions, submitRequisition,
    dashboardKPIs, salesKPIs, getFilteredSales, getRevenueBreakdown, getTodaysCompletedSales,
    can, canVoidSale, canDiscount,
    getInHouseGuests,
    getSession,
  };
})(window);