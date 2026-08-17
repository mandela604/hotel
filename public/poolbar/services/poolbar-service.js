/**
 * services/poolbar-service.js — Shared data + business logic for the Pool Bar module
 * Depends on: data/poolbar-seed.js (window.PoolBarSeed), optionally services/permissions.js (window.Permissions)
 * Optional: BookingData (booking-service.js) — posts Room Charge sales to guest folio via addRoomCharge,
 *           and is the source of truth for in-house guests (see getInHouseGuests below).
 * Load order: poolbar-seed.js, THEN this file, then the page's own <script>.
 *
 * Formal service restored. OrdersWorkspace: pass service: PoolBarService.
 * Optional roomNumber/guestName/guestPhone on recordSale/openTab/payOrder.
 *
 * PAYMENT METHODS — single source of truth is data/poolbar-seed.js
 * (PoolBarSeed.PAYMENT_METHODS). Exposed here as both `paymentMethods`
 * (a plain property) and `getPaymentMethods()` (a function) so
 * OrdersWorkspace's resolvePaymentMethodsFromService() picks it up
 * automatically — pages no longer pass their own paymentMethods list.
 *
 * WHY getInHouseGuests() LIVES HERE, NOT ON THE PAGE
 * ───────────────────────────────────────────────────
 * Pages (poolbar-orders.html etc.) should never reach into window.BookingData
 * directly — that couples every page to today's demo data source. Instead
 * they call PoolBarService.getInHouseGuests(), which owns the "how/where do
 * we get in-house guests" decision. When this module goes live against a
 * real API, only this one function changes — no page touches BookingData
 * again. It throws (never silently falls back to fake data) so the caller
 * can decide how to surface the failure to the user.
 *
 * SALES PAGE BUSINESS LOGIC — filterShiftSales / getShiftKpiSummary /
 * buildSaleDetailShape / normalizeSaleForTable / getShiftLabel /
 * getShiftNoteText / getShiftTableTitle / getPrintSummary all moved here
 * from poolbar-sales.html so that page is pure call-and-render.
 *
 * STOCK PAGE BUSINESS LOGIC — filterStock / listStockCategoriesInUse /
 * parseReceivedDate / getStockCategories / getStockUnits / getDeductReasons
 * moved here from poolbar-stock.html so that page is pure call-and-render.
 *
 * CATEGORY MANAGEMENT — addCategory / renameCategory / deleteCategory /
 * listManagedCategories / categoryItemCount / getFallbackCategoryName.
 * Categories are just a field on stock items here (no separate category
 * record like StoreService's item master), so a category with zero items
 * has nowhere to live unless something persists it. state.extraCategories
 * is that "nowhere" — loaded/saved via the exact same loadShared/
 * saveShared + persist() pattern as stock/sales/orders/etc., so it
 * survives reloads and behaves like every other piece of state here.
 * Pages call these three functions and only render — they never touch
 * state.extraCategories or loop stock items themselves.
 *
 * DASHBOARD REVENUE DISPLAY — getRevenueMethodOrder / getRevenueMethodColorClass /
 * getRevenueBreakdown / getLevelLabelsShort / getTodaysCompletedSales moved
 * here from poolbar-dashboard.html so that page never hardcodes a payment-
 * method display order/color map or a short-form level label set.
 */
(function (global) {
  'use strict';

  // Captured synchronously while this file is executing as a plain
  // <script src> tag — used to resolve where booking-demo-seed.js and
  // booking-service.js live relative to THIS file, not relative to
  // whatever page happens to load it.
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
      if (!global.BookingDemoSeed && paths.demoSeed) {
        await loadScriptTag(resolveRelative(paths.demoSeed));
      }
      if (!global.BookingData && paths.service) {
        await loadScriptTag(resolveRelative(paths.service));
      }
      if (!global.BookingData || typeof global.BookingData.getBookingData !== 'function') {
        throw new Error('BookingData failed to initialize after dynamic load. Provide PoolBarSeed.BOOKING_MODULE_PATHS or preload window.BookingData yourself.');
      }
      return global.BookingData;
    })();

    return bookingDataLoadPromise;
  }

  const KEYS = {
    STOCK: 'poolbar-stock',
    SALES: 'poolbar-sales',
    ORDERS: 'poolbar-orders',
    PENDING: 'poolbar-pending-requisitions',
    MOVEMENTS: 'poolbar-movements',
    TRANSFERS: 'poolbar-store-transfers',
    TRANSFER_COUNT: 'poolbar-store-transfers-count',
    EXTRA_CATEGORIES: 'poolbar-extra-categories',
  };

  const storage = global.storage || {
    async get(key, shared) { const v = localStorage.getItem(key); return v == null ? null : { key, value: v, shared }; },
    async set(key, value, shared) { localStorage.setItem(key, value); return { key, value, shared }; },
    async delete(key, shared) { localStorage.removeItem(key); return { key, deleted: true, shared }; },
    async list(prefix, shared) { const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)); return { keys, prefix, shared }; },
  };

  async function loadShared(key, fallback) {
    try {
      const r = await storage.get(key, true);
      if (r && r.value) { const parsed = JSON.parse(r.value); if (Array.isArray(parsed)) return parsed; }
    } catch (e) { /* first run */ }
    return fallback;
  }
  async function saveShared(key, value) {
    try { await storage.set(key, JSON.stringify(value), true); return true; }
    catch (e) { console.warn('[PoolBarService] sync failed:', key, e); return false; }
  }

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

  // Short-form level labels (e.g. compact "OUT"/"LOW" chips) — separate
  // from LEVEL_LABEL because the short and full forms are allowed to
  // differ. Overridable via PoolBarSeed.STOCK_LEVEL_LABELS_SHORT; the
  // object below is only the named default.
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
  function nextSaleId(sales) {
    const prefix = getIdPrefixes().sale;
    let max = 1000;
    (sales || []).forEach(s => { const n = parseInt((s.id || '').replace(prefix, ''), 10); if (!isNaN(n) && n > max) max = n; });
    return prefix + (max + 1);
  }
  function nextOrderId(orders) {
    const prefix = getIdPrefixes().order;
    let max = 0;
    (orders || []).forEach(o => { const n = parseInt((o.id || '').replace(prefix, ''), 10); if (!isNaN(n) && n > max) max = n; });
    return prefix + String(max + 1).padStart(3, '0');
  }

  const state = {
    stock: [], sales: [], orders: [], pending: [], movements: [], transfers: [],
    extraCategories: [],
    transfersToday: 0,
    ready: false,
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[PoolBarService] listener error', e); } }); }

  function seed() {
    const s = global.PoolBarSeed || {};
    return {
      stock: s.DEMO_STOCK || [],
      sales: s.DEMO_SALES || [],
      orders: s.DEMO_ORDERS || [],
      pending: s.DEMO_PENDING || [],
      movements: s.DEMO_MOVEMENTS || [],
      transfers: s.DEMO_STORE_TRANSFERS || [],
    };
  }

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
    return s.COMPLETED_SALE_STATUS || null;
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
    const list = Array.isArray(s.MONEY_RECEIVED_METHODS) ? s.MONEY_RECEIVED_METHODS : [];
    return list.indexOf((method || '').trim()) !== -1;
  }

  function getDefaultPageSize() {
    const s = global.PoolBarSeed || {};
    return (typeof s.DEFAULT_PAGE_SIZE === 'number' && s.DEFAULT_PAGE_SIZE > 0)
      ? s.DEFAULT_PAGE_SIZE
      : 8;
  }

  function getOrderPageLink() {
    const s = global.PoolBarSeed || {};
    return s.ORDER_PAGE_LINK || 'poolbar-orders.html';
  }

  // ── Stock form pick-lists (config from seed; empty = no options, not a demo fallback)
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

  // ── Dashboard "Revenue Breakdown" display — which payment methods
  // appear first and what accent color each gets. Sourced from
  // PoolBarSeed.REVENUE_METHOD_ORDER / REVENUE_METHOD_COLORS; the arrays/
  // object below are only the named defaults (unchanged from the previous
  // hardcoded values on the dashboard page).
  const DEFAULT_REVENUE_METHOD_ORDER = ['Cash', 'Room Charge', 'POS', 'Transfer', 'Complimentary', 'Other'];
  const DEFAULT_REVENUE_METHOD_COLORS = {
    Cash: '', 'Room Charge': 'blue', POS: 'blue', Transfer: 'purple', Complimentary: 'purple',
  };
  function getRevenueMethodOrder() {
    const s = global.PoolBarSeed || {};
    return Array.isArray(s.REVENUE_METHOD_ORDER) && s.REVENUE_METHOD_ORDER.length
      ? s.REVENUE_METHOD_ORDER
      : DEFAULT_REVENUE_METHOD_ORDER;
  }
  function getRevenueMethodColorClass(method) {
    const s = global.PoolBarSeed || {};
    const map = Object.assign({}, DEFAULT_REVENUE_METHOD_COLORS, s.REVENUE_METHOD_COLORS || {});
    return map[method] || '';
  }
  /**
   * Group + order a set of sales by payment method for the dashboard's
   * Revenue Breakdown bars. Moves the "which methods, in what order, with
   * what color" decision off the page entirely — the page only renders
   * whatever entries come back.
   * Returns [{ method, amount, colorClass }, ...]
   */
  function getRevenueBreakdown(sales) {
    const byMethod = {};
    (sales || []).forEach(function (s) {
      const m = s.method || 'Other';
      byMethod[m] = (byMethod[m] || 0) + (s.total || 0);
    });
    const order = getRevenueMethodOrder();
    const entries = order
      .filter(function (k) { return byMethod[k]; })
      .map(function (k) { return { method: k, amount: byMethod[k], colorClass: getRevenueMethodColorClass(k) }; });
    Object.keys(byMethod).forEach(function (k) {
      if (order.indexOf(k) === -1) {
        entries.push({ method: k, amount: byMethod[k], colorClass: getRevenueMethodColorClass(k) });
      }
    });
    return entries;
  }

  /**
   * Today's completed (non-voided) sales — the exact rule the dashboard's
   * revenue panel needs, moved off the page. Expressed once here so
   * "today" and "completed" are never re-typed on a page.
   */
  function getTodaysCompletedSales() {
    const today = todayDDMMYY();
    const completedStatus = getStatusConstants().SALE_COMPLETED;
    return (state.sales || []).filter(function (s) {
      return s.status === completedStatus && (s.date || '').startsWith(today);
    });
  }

  // Single source of truth for "what category does a deleted/reassigned
  // stock item fall back to" — used by both acceptRequisition() (when
  // auto-creating a stock row for an unknown item) and deleteCategory()
  // below, so there is exactly one default category name in this file.
  const DEFAULT_FALLBACK_CATEGORY = 'Uncategorized';
  function getFallbackCategoryName() {
    const s = global.PoolBarSeed || {};
    return s.FALLBACK_CATEGORY || DEFAULT_FALLBACK_CATEGORY;
  }

  /**
   * Parse a "received" date string (DD/MM/YY) to a timestamp for sorting.
   * Returns 0 for empty / placeholder / unparseable values.
   */
  function parseReceivedDate(s) {
    const empty = getEmptyValuePlaceholder();
    if (!s || s === empty) return 0;
    const parts = String(s).split('/');
    if (parts.length < 3) return 0;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return 0;
    return new Date(2000 + y, m - 1, d).getTime();
  }

  /**
   * Categories that currently appear on at least one stock item.
   * Used by the toolbar category filter (distinct from the configured
   * pick-list used in the Add/Edit form, and distinct from
   * listManagedCategories() below which also includes empty categories).
   */
  function listStockCategoriesInUse() {
    const cats = new Set();
    (state.stock || []).forEach(function (i) {
      if (i.category) cats.add(i.category);
    });
    return [...cats].sort();
  }

  /**
   * Every category the Category Manager should show: ones currently in
   * use on stock, plus ones created via addCategory() that have no items
   * yet. This is the ONE list a page needs for that modal.
   */
  function listManagedCategories() {
    const set = new Set([...listStockCategoriesInUse(), ...(state.extraCategories || [])]);
    return [...set].filter(Boolean).sort();
  }

  /** How many stock items currently use this category. */
  function categoryItemCount(name) {
    return (state.stock || []).filter(function (i) { return i.category === name; }).length;
  }

  /**
   * Create a category with no items yet. Throws on empty name or a
   * case-insensitive duplicate against listManagedCategories(). Persisted
   * in state.extraCategories the same way stock/sales/etc. are persisted.
   */
  async function addCategory(name) {
    const n = (name || '').trim();
    if (!n) throw new Error('Category name is required.');
    if (listManagedCategories().some(function (c) { return c.toLowerCase() === n.toLowerCase(); })) {
      throw new Error(`Category "${n}" already exists.`);
    }
    state.extraCategories.push(n);
    await persist(['extraCategories']);
    emitChange('category:add');
    return n;
  }

  /**
   * Rename a category: updates every stock item that used the old name,
   * and keeps state.extraCategories in sync (whether the category had
   * items, was empty, or — belt and suspenders — wasn't tracked as
   * "extra" at all, e.g. legacy data). Throws on empty name or a
   * case-insensitive duplicate against another existing category.
   */
  async function renameCategory(oldName, newName) {
    const n = (newName || '').trim();
    if (!n) throw new Error('Category name is required.');
    if (n.toLowerCase() !== (oldName || '').toLowerCase() &&
        listManagedCategories().some(function (c) { return c.toLowerCase() === n.toLowerCase(); })) {
      throw new Error(`Category "${n}" already exists.`);
    }
    let affected = 0;
    state.stock.forEach(function (i) { if (i.category === oldName) { i.category = n; affected++; } });
    const idx = state.extraCategories.indexOf(oldName);
    if (idx > -1) state.extraCategories[idx] = n;
    else if (affected === 0) state.extraCategories.push(n);
    await persist(['stock', 'extraCategories']);
    emitChange('category:rename');
    return n;
  }

  /**
   * Delete a category: every stock item using it is reassigned to
   * opts.reassignTo (default getFallbackCategoryName()), and it's
   * removed from state.extraCategories if present.
   */
  async function deleteCategory(name, opts) {
    opts = opts || {};
    const reassignTo = opts.reassignTo || getFallbackCategoryName();
    state.stock.forEach(function (i) { if (i.category === name) i.category = reassignTo; });
    state.extraCategories = state.extraCategories.filter(function (c) { return c !== name; });
    await persist(['stock', 'extraCategories']);
    emitChange('category:delete');
  }

  /**
   * Filter + sort stock for the stock page table.
   * filterState: { search, level, category, sort }
   *   search   — free text (name or batch)
   *   level    — '' | 'ok' | 'low' | 'out'
   *   category — exact category or ''
   *   sort     — 'name_asc' | 'qty_asc' | 'qty_desc' | 'received_desc'
   */
  function filterStock(filterState) {
    filterState = filterState || {};
    const q = (filterState.search || '').trim().toLowerCase();
    const level = filterState.level || '';
    const cat = filterState.category || '';
    const sort = filterState.sort || 'name_asc';

    let rows = (state.stock || []).filter(function (i) {
      const mq = !q
        || (i.name || '').toLowerCase().indexOf(q) !== -1
        || (i.batch || '').toLowerCase().indexOf(q) !== -1;
      const ml = !level || stockLevel(i) === level;
      const mc = !cat || i.category === cat;
      return mq && ml && mc;
    });

    if (sort === 'name_asc') {
      rows.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    } else if (sort === 'qty_asc') {
      rows.sort(function (a, b) { return (a.qty || 0) - (b.qty || 0); });
    } else if (sort === 'qty_desc') {
      rows.sort(function (a, b) { return (b.qty || 0) - (a.qty || 0); });
    } else if (sort === 'received_desc') {
      rows.sort(function (a, b) { return parseReceivedDate(b.received) - parseReceivedDate(a.received); });
    }
    return rows;
  }

  async function loadAll() {
    const s = seed();
    const [stock, sales, orders, pending, movements, transfers, transferCountRec, extraCategories] = await Promise.all([
      loadShared(KEYS.STOCK, s.stock),
      loadShared(KEYS.SALES, s.sales),
      loadShared(KEYS.ORDERS, s.orders),
      loadShared(KEYS.PENDING, s.pending),
      loadShared(KEYS.MOVEMENTS, s.movements),
      loadShared(KEYS.TRANSFERS, s.transfers),
      loadShared(KEYS.TRANSFER_COUNT, []),
      loadShared(KEYS.EXTRA_CATEGORIES, []),
    ]);
    state.stock = stock; state.sales = sales; state.orders = orders;
    state.pending = pending; state.movements = movements; state.transfers = transfers;
    state.extraCategories = extraCategories;
    const today = todayDDMMYY();
    state.transfersToday = (transferCountRec[0] && transferCountRec[0].date === today) ? transferCountRec[0].count : 0;
    state.ready = true;

    await Promise.all([
      saveShared(KEYS.STOCK, state.stock), saveShared(KEYS.SALES, state.sales),
      saveShared(KEYS.ORDERS, state.orders), saveShared(KEYS.PENDING, state.pending),
      saveShared(KEYS.MOVEMENTS, state.movements), saveShared(KEYS.TRANSFERS, state.transfers),
      saveShared(KEYS.EXTRA_CATEGORIES, state.extraCategories),
    ]);

    ensureBookingData().catch(function (e) {
      console.warn('[PoolBarService] BookingData not available:', e.message);
    });

    emitChange('load');
    return state;
  }

  async function persist(keys) {
    const map = {
      stock: KEYS.STOCK, sales: KEYS.SALES, orders: KEYS.ORDERS,
      pending: KEYS.PENDING, movements: KEYS.MOVEMENTS, transfers: KEYS.TRANSFERS,
      extraCategories: KEYS.EXTRA_CATEGORIES,
    };
    const list = keys && keys.length ? keys : Object.keys(map);
    await Promise.all(list.map(k => saveShared(map[k], state[k])));
  }

  function findStock(name) { return state.stock.find(i => i.name === name); }

  async function postToGuestFolio(sale) {
    if (!sale || sale.method !== getRoomChargeMethodName()) return;
    if (!sale.roomNumber) return;
    let bookingData;
    try {
      bookingData = await ensureBookingData();
    } catch (e) {
      console.warn('[PoolBarService] BookingData unavailable — folio not updated:', e.message);
      return;
    }
    if (typeof bookingData.addRoomCharge !== 'function') {
      console.warn('[PoolBarService] BookingData.addRoomCharge unavailable — folio not updated.');
      return;
    }
    const desc = (sale.items || []).map(function (i) {
      return (i.qty || 1) + 'x ' + (i.name || '');
    }).join(', ') || sale.id;
    const guestKey = sale.guestName || sale.roomNumber;
    try {
      await bookingData.addRoomCharge(guestKey, {
        source: getModuleName(),
        desc: desc,
        room: sale.roomNumber,
        amount: sale.total,
        by: sale.staff || getModuleName(),
      });
    } catch (e) {
      console.warn('[PoolBarService] folio charge failed:', e && e.message ? e.message : e);
    }
  }

  async function getInHouseGuests() {
    let bookingData;
    try {
      bookingData = await ensureBookingData();
    } catch (e) {
      const err = new Error('BookingData could not be loaded automatically: ' + e.message);
      err.code = 'BOOKING_DATA_UNAVAILABLE';
      throw err;
    }
    const data = await bookingData.getBookingData();
    const bookings = (data && data.bookings) || [];
    return bookings
      .filter(function (b) { return b.status === 'checkedin' && b.guest; })
      .map(function (b) {
        return {
          room: String(b.room || ''),
          name: b.guest || '',
          phone: b.phone || '',
          status: 'In-House',
        };
      });
  }

  async function addStockItem({ name, category, unit, min = 0, price = 0, desc = '' }) {
    if (!name || !name.trim()) throw new Error('Item name is required.');
    if (findStock(name)) throw new Error(`"${name}" is already tracked — edit it instead.`);
    const emptyValue = getEmptyValuePlaceholder();
    const entry = { name: name.trim(), category, unit, qty: 0, min, price, batch: emptyValue, received: emptyValue, desc };
    state.stock.push(entry);
    await persist(['stock']);
    emitChange('stock:add');
    return entry;
  }

  async function editStockItem(name, updates) {
    const i = findStock(name);
    if (!i) throw new Error(`"${name}" not found in stock.`);
    const { qty, batch, received, ...safeUpdates } = updates;
    Object.assign(i, safeUpdates);
    await persist(['stock']);
    emitChange('stock:edit');
    return i;
  }

  async function deleteStockItem(name) {
    state.stock = state.stock.filter(i => i.name !== name);
    await persist(['stock']);
    emitChange('stock:delete');
  }

  async function deductStock(name, qty, reason, notes) {
    const i = findStock(name);
    if (!i) throw new Error(`"${name}" not found in stock.`);
    if (qty < 1) throw new Error('Enter a valid quantity.');
    if (qty > i.qty) throw new Error(`Cannot deduct more than the ${i.qty} ${i.unit} on hand.`);
    i.qty -= qty;
    state.movements.unshift({ date: nowStamp(), item: i.name, qtyIn: 0, qtyOut: qty, balance: i.qty, reason: notes ? `${reason} — ${notes}` : reason });
    await persist(['stock', 'movements']);
    emitChange('stock:deduct');
    return i;
  }

  function restoreStock(name, qty, reason) {
    const i = findStock(name);
    if (!i) return null;
    i.qty += qty;
    state.movements.unshift({ date: nowStamp(), item: i.name, qtyIn: qty, qtyOut: 0, balance: i.qty, reason });
    return i;
  }

  async function acceptRequisition(reqNo) {
    const idx = state.pending.findIndex(p => p.no === reqNo);
    if (idx === -1) throw new Error(`Requisition ${reqNo} not found.`);
    const p = state.pending[idx];
    let item = findStock(p.item);
    if (!item) {
      item = { name: p.item, category: getFallbackCategoryName(), unit: p.unit, qty: 0, min: 0, price: 0, batch: p.no, received: todayDDMMYY(), desc: '' };
      state.stock.push(item);
    }
    item.qty += p.qty;
    item.batch = p.no;
    item.received = todayDDMMYY();
    state.movements.unshift({ date: nowStamp(), item: item.name, qtyIn: p.qty, qtyOut: 0, balance: item.qty, reason: `Requisition Received (${p.no})` });
    state.pending.splice(idx, 1);
    await persist(['stock', 'movements', 'pending']);
    emitChange('requisition:accept');
    return item;
  }

  async function rejectRequisition(reqNo) {
    const idx = state.pending.findIndex(p => p.no === reqNo);
    if (idx === -1) throw new Error(`Requisition ${reqNo} not found.`);
    const [removed] = state.pending.splice(idx, 1);
    await persist(['pending']);
    emitChange('requisition:reject');
    return removed;
  }

  async function logRequisitionRaised() {
    const today = todayDDMMYY();
    state.transfersToday += 1;
    await saveShared(KEYS.TRANSFER_COUNT, [{ date: today, count: state.transfersToday }]);
    emitChange('requisition:raised');
    return state.transfersToday;
  }

  function cartTotals(cart, discountPct) {
    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const total = subtotal * (1 - (discountPct || 0) / 100);
    return { subtotal, total };
  }

  async function recordSale({ items, discount = 0, method, staff, table, notes = '', roomNumber = null, guestName = null, guestPhone = null }) {
    if (!items || !items.length) throw new Error('Add at least one item.');
    if (!table) throw new Error('Please enter a table or seat.');
    if (!staff) throw new Error('Please enter the staff name.');
    const cleanItems = items.map(c => ({ name: c.key || c.name, qty: c.qty, price: c.price }));
    const { subtotal, total } = cartTotals(cleanItems, discount);
    const stamp = nowStamp();
    const roomChargeMethod = getRoomChargeMethodName();
    if (roomNumber && roomChargeMethod) method = roomChargeMethod;
    const sale = {
      id: nextSaleId(state.sales), items: cleanItems, subtotal, discount, total,
      method, staff, table, notes, date: stamp, status: getStatusConstants().SALE_COMPLETED, source: 'quick',
      roomNumber: roomNumber || null, guestName: guestName || null, guestPhone: guestPhone || null,
    };
    sale.items.forEach(c => {
      const inv = findStock(c.name);
      if (inv) {
        inv.qty = Math.max(0, inv.qty - c.qty);
        state.movements.unshift({ date: stamp, item: c.name, qtyIn: 0, qtyOut: c.qty, balance: inv.qty, reason: `Sale (${sale.id})` });
      }
    });
    state.sales.unshift(sale);
    await persist(['sales', 'stock', 'movements']);
    await postToGuestFolio(sale);
    emitChange('sale:record');
    return sale;
  }

  async function openTab({ items, discount = 0, staff, table, notes = '', roomNumber = null, guestName = null, guestPhone = null }) {
    if (!items || !items.length) throw new Error('Add at least one item.');
    if (!table) throw new Error('Please enter a table or seat.');
    if (!staff) throw new Error('Please enter the staff name.');
    const cleanItems = items.map(c => ({ name: c.key || c.name, qty: c.qty, price: c.price }));
    const { subtotal, total } = cartTotals(cleanItems, discount);
    const order = {
      id: nextOrderId(state.orders), items: cleanItems, subtotal, discount, total,
      staff, table, notes, date: nowStamp(), status: getStatusConstants().ORDER_OPEN, source: 'tab',
      roomNumber: roomNumber || null, guestName: guestName || null, guestPhone: guestPhone || null,
    };
    state.orders.unshift(order);
    await persist(['orders']);
    emitChange('order:open');
    return order;
  }

  async function markServed(orderId) {
    const o = state.orders.find(x => x.id === orderId);
    if (!o) throw new Error(`Order ${orderId} not found.`);
    o.status = getStatusConstants().ORDER_SERVED;
    await persist(['orders']);
    emitChange('order:served');
    return o;
  }

  async function payOrder(orderId, methodOrOpts) {
    const o = state.orders.find(x => x.id === orderId);
    if (!o) throw new Error(`Order ${orderId} not found.`);
    let method = 'Cash';
    let roomNumber = o.roomNumber || null;
    let guestName = o.guestName || null;
    let guestPhone = o.guestPhone || null;
    if (methodOrOpts && typeof methodOrOpts === 'object') {
      method = methodOrOpts.method || method;
      if (methodOrOpts.roomNumber != null) roomNumber = methodOrOpts.roomNumber;
      if (methodOrOpts.guestName != null) guestName = methodOrOpts.guestName;
      if (methodOrOpts.guestPhone != null) guestPhone = methodOrOpts.guestPhone;
    } else if (typeof methodOrOpts === 'string') {
      method = methodOrOpts;
    }
    const payRoomChargeMethod = getRoomChargeMethodName();
    if (roomNumber && payRoomChargeMethod) method = payRoomChargeMethod;
    const stamp = nowStamp();
    const sale = {
      id: nextSaleId(state.sales), items: o.items, subtotal: o.subtotal, discount: o.discount,
      total: o.total, method, staff: o.staff, table: o.table, notes: o.notes,
      date: stamp, status: getStatusConstants().SALE_COMPLETED, source: 'tab',
      roomNumber: roomNumber || null, guestName: guestName || null, guestPhone: guestPhone || null,
    };
    o.items.forEach(item => {
      const inv = findStock(item.name);
      if (inv) {
        inv.qty = Math.max(0, inv.qty - item.qty);
        state.movements.unshift({ date: stamp, item: item.name, qtyIn: 0, qtyOut: item.qty, balance: inv.qty, reason: `Tab Payment (${o.id})` });
      }
    });
    state.sales.unshift(sale);
    o.status = getStatusConstants().ORDER_PAID; o.payMethod = method; o.paidSaleId = sale.id;
    o.roomNumber = roomNumber; o.guestName = guestName; o.guestPhone = guestPhone;
    await persist(['sales', 'stock', 'movements', 'orders']);
    await postToGuestFolio(sale);
    emitChange('order:paid');
    return { order: o, sale };
  }

  async function cancelOrder(orderId) {
    const o = state.orders.find(x => x.id === orderId);
    if (!o) throw new Error(`Order ${orderId} not found.`);
    o.status = getStatusConstants().ORDER_CANCELLED;
    await persist(['orders']);
    emitChange('order:cancelled');
    return o;
  }

  async function voidSale(saleId, reason, voidedBy) {
    const s = state.sales.find(x => x.id === saleId);
    if (!s) throw new Error(`Sale ${saleId} not found.`);
    if (s.status === getStatusConstants().SALE_VOIDED) return s;
    const stamp = nowStamp();
    s.items.forEach(item => restoreStock(item.name, item.qty, `Voided Sale (${s.id})`));
    s.status = getStatusConstants().SALE_VOIDED; s.voidReason = reason; s.voidDate = stamp; s.voidedBy = voidedBy;
    await persist(['sales', 'stock', 'movements']);
    emitChange('sale:void');
    return s;
  }

  function dashboardKPIs() {
    const pendingN = state.pending.length;
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
    const units = completed.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0);
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
    const completedToday = state.sales.filter(s => s.status === getStatusConstants().SALE_COMPLETED && (s.date || '').startsWith(todayStr));
    const rejectedToday = state.orders.filter(o => o.status === getStatusConstants().ORDER_CANCELLED && (o.date || '').startsWith(todayStr));
    const unitsOnHand = state.stock.reduce((s, i) => s + i.qty, 0);
    const st = getStatusConstants();
    const active = state.orders.filter(o => o.status === st.ORDER_OPEN || o.status === st.ORDER_SERVED).length;
    const unitsSoldToday = completedToday.reduce((s, x) => s + (x.items || []).reduce((a, i) => a + i.qty, 0), 0);
    return {
      completedToday: completedToday.length,
      completedTodayRevenue: completedToday.reduce((s, x) => s + x.total, 0),
      transfersToday: state.transfersToday,
      rejectedToday: rejectedToday.length,
      unitsOnHand,
      unitsSoldToday,
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
    const me = ((session && session.name) || '').toLowerCase();
    const allStaff = isManagerLike(session);

    return (state.sales || []).filter(function (s) {
      if (!(s.date || '').startsWith(today)) return false;
      if (!allStaff) {
        if (!me) return false;
        if ((s.staff || '').toLowerCase() !== me) return false;
      }
      return true;
    });
  }

  // ── Page-level business logic, moved off poolbar-sales.html so the
  // page is pure call-and-render. Filtering, KPI math, row/detail
  // shaping, and shift copy all live here — the page only wires DOM
  // and passes user input through.
  function normalizeSaleForTable(s) {
    return Object.assign({}, s, {
      items: (s.items || []).map(function (i) {
        return { name: i.name || '—', qty: i.qty || 0, price: i.price || 0 };
      }),
    });
  }

  function buildSaleDetailShape(s) {
    return {
      id: s.id, dept: getDepartmentName(), table: s.table, staff: s.staff,
      date: s.date, method: s.method,
      items: (s.items || []).map(function (i) {
        return { name: i.name || '—', qty: i.qty || 0, price: i.price || 0 };
      }),
      discount: (s.subtotal || 0) * (s.discount || 0) / 100,
      total: s.total, status: s.status, voidReason: s.voidReason, notes: s.notes,
      roomNumber: s.roomNumber || null, guestName: s.guestName || null, guestPhone: s.guestPhone || null,
    };
  }

  function saleItemsQty(s) {
    return (s.items || []).reduce(function (sum, i) { return sum + (i.qty || 0); }, 0);
  }

  /** Filters this session's shift sales by status/payment/search — the exact rules poolbar-sales.html used to run inline. */
  function filterShiftSales(session, filterState) {
    filterState = filterState || {};
    const q = (filterState.search || '').trim().toLowerCase();
    return getShiftSales(session).filter(function (s) {
      if (filterState.status && s.status !== filterState.status) return false;
      if (filterState.payment && s.method !== filterState.payment) return false;
      if (q) {
        const items = s.items || [];
        const mq = (s.id || '').toLowerCase().indexOf(q) !== -1
          || (s.staff || '').toLowerCase().indexOf(q) !== -1
          || (s.table || '').toLowerCase().indexOf(q) !== -1
          || items.some(function (i) { return (i.name || '').toLowerCase().indexOf(q) !== -1; });
        if (!mq) return false;
      }
      return true;
    });
  }

  /** Revenue / money-received / units math for a set of sale rows (already filtered). */
  function getShiftKpiSummary(rows) {
    rows = rows || [];
    const st = getStatusConstants();
    const completed = rows.filter(function (s) { return s.status === st.SALE_COMPLETED; });
    const voided = rows.filter(function (s) { return s.status === st.SALE_VOIDED; });
    const revenue = completed.reduce(function (sum, s) { return sum + (s.total || 0); }, 0);
    const units = completed.reduce(function (sum, s) { return sum + saleItemsQty(s); }, 0);
    const moneyReceived = completed
      .filter(function (s) { return isMoneyReceived(s.method); })
      .reduce(function (sum, s) { return sum + (s.total || 0); }, 0);
    const notReceivedTotal = completed
      .filter(function (s) { return s.method && !isMoneyReceived(s.method); })
      .reduce(function (sum, s) { return sum + (s.total || 0); }, 0);
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
  if (Array.isArray(seed.SALE_STATUS_OPTIONS) && seed.SALE_STATUS_OPTIONS.length) {
    return seed.SALE_STATUS_OPTIONS;
  }
  const st = getStatusConstants();
  const defaults = [
    { value: st.SALE_COMPLETED, label: 'Completed', color: 'var(--green)', colorBg: 'var(--green-bg)' },
    { value: st.SALE_VOIDED,    label: 'Voided',    color: 'var(--red)',   colorBg: 'var(--red-bg)' },
  ];
  // add any other status that might appear (e.g., from future extensions)
  const knownValues = new Set(defaults.map(d => d.value));
  const existing = (state.sales || [])
    .map(s => s.status)
    .filter(Boolean)
    .filter(v => !knownValues.has(v));
  existing.forEach(v => {
    defaults.push({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1),
      color: 'var(--text2)',
      colorBg: 'var(--surface3)',
    });
  });
  return defaults;
}

function filterSales(filterState) {
  filterState = filterState || {};
  const q = (filterState.search || '').trim().toLowerCase();
  const pay = filterState.payment || '';
  const status = filterState.status || '';
  const staff = filterState.staff || '';
  const bounds = filterState.dateRange || { start: null, end: null };

  return (state.sales || []).filter(function (s) {
    if (status && s.status !== status) return false;
    if (pay && s.method !== pay) return false;
    if (staff && (s.staff || '') !== staff) return false;
    if (q) {
      const hit = (s.id || '').toLowerCase().includes(q)
        || (s.staff || '').toLowerCase().includes(q)
        || (s.table || '').toLowerCase().includes(q)
        || (s.items || []).some(function (i) { return (i.name || '').toLowerCase().includes(q); });
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


// ── Requisition history business logic (merged transfers + Store requisitions)

/**
 * Returns all history rows for a department:
 * - Pool Bar's own store transfers (PBS.state.transfers)
 * - StoreService requisitions for that department with status 'Full' or 'Rejected'
 * Each row gets a _kind: 'transfer' or 'requisition'
 */
function getDepartmentHistory(dept) {
  const transfers = (state.transfers || []).map(function (t) {
    return Object.assign({}, t, { _kind: 'transfer' });
  });
  let reqs = [];
  if (global.StoreService && typeof global.StoreService.getRequisitions === 'function') {
    reqs = global.StoreService.getRequisitions({ mode: 'store_issue' })
      .filter(function (r) { return r.dept === dept && (r.status === 'Full' || r.status === 'Rejected'); })
      .map(function (r) { return Object.assign({}, r, { _kind: 'requisition' }); });
  }
  return transfers.concat(reqs);
}

/**
 * Filter rows by:
 *   - search (free text against no., item name, by/from)
 *   - status (string: 'Completed', 'Rejected', 'Transfer')
 *   - priority (string: 'Urgent' | 'Normal' | '')
 *   - source (string: 'requisition' | 'store_push' | '')
 */
function filterHistory(rows, filters) {
  filters = filters || {};
  const q = (filters.search || '').trim().toLowerCase();
  const status = filters.status || '';
  const priority = filters.priority || '';
  const source = filters.source || '';

  return rows.filter(function (r) {
    const isReq = r._kind === 'requisition';
    const isTrans = r._kind === 'transfer';

    // Search match
    if (q) {
      const by = (isReq ? (r.by || '') : (r.sentBy || r.from || '')).toLowerCase();
      const itemNames = (r.items || []).map(function (i) { return (i.name || '').toLowerCase(); }).join(' ');
      const no = (r.no || '').toLowerCase();
      if (!no.includes(q) && !by.includes(q) && !itemNames.includes(q)) return false;
    }

    // Status filter
    if (status) {
      if (status === 'Completed' && !(isReq && r.status === 'Full')) return false;
      if (status === 'Rejected' && !(isReq && r.status === 'Rejected')) return false;
      if (status === 'Transfer' && !isTrans) return false;
    }

    // Priority filter
    if (priority) {
      const p = r.priority || 'Normal';
      if (p !== priority) return false;
    }

    // Source filter
    if (source) {
      if (source === 'requisition' && !isReq) return false;
      if (source === 'store_push' && !isTrans) return false;
    }

    return true;
  });
}

/**
 * Sort rows by date or item count.
 * sortKey: 'date' or 'items'
 * sortDir: 'asc' or 'desc' (default 'desc')
 */
function sortHistory(rows, sortKey, sortDir) {
  sortKey = sortKey || 'date';
  sortDir = sortDir || 'desc';
  var sorted = rows.slice();
  sorted.sort(function (a, b) {
    var cmp = 0;
    if (sortKey === 'date') {
      var da = (a.dateRaised || a.date || '');
      var db = (b.dateRaised || b.date || '');
      var ta = Date.parse(da) || 0;
      var tb = Date.parse(db) || 0;
      cmp = ta - tb;
    } else if (sortKey === 'items') {
      cmp = (a.items || []).length - (b.items || []).length;
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });
  return sorted;
}

/**
 * Compute KPIs for a history row set:
 *   completed: number of requisitions with status 'Full'
 *   rejected: number of requisitions with status 'Rejected'
 *   transfers: number of store transfers
 *   totalUnits: sum of issuedQty (or qty) across completed + transfers
 */
function getHistoryKPIs(rows) {
  var completed = 0, rejected = 0, transfers = 0, totalUnits = 0;
  rows.forEach(function (r) {
    if (r._kind === 'transfer') {
      transfers++;
      (r.items || []).forEach(function (i) {
        totalUnits += parseFloat(i.issuedQty != null ? i.issuedQty : i.qty) || 0;
      });
    } else if (r._kind === 'requisition') {
      if (r.status === 'Full') {
        completed++;
        (r.items || []).forEach(function (i) {
          totalUnits += parseFloat(i.issuedQty != null ? i.issuedQty : i.qty) || 0;
        });
      } else if (r.status === 'Rejected') {
        rejected++;
      }
    }
  });
  return { completed, rejected, transfers, totalUnits };
}

/**
 * Return display label and CSS class for a history row's status.
 * kind: 'requisition' or 'transfer'
 * status: the raw status string
 */
function getHistoryStatusDisplay(kind, status) {
  if (kind === 'transfer') {
    return { label: status || 'Store Transfer', cls: 'chip-transfer' };
  }
  if (status === 'Full') return { label: 'Completed', cls: 'chip-completed' };
  if (status === 'Rejected') return { label: 'Rejected', cls: 'chip-rejected' };
  return { label: status || '—', cls: '' };
}


function getLowStockItems() {
  return state.stock.filter(i => stockLevel(i) !== 'ok');
}

  global.PoolBarService = {
    KEYS,
    storage, loadShared, saveShared,
    fmtN, nowStamp, fmtStamp, parseStamp, dateOnly, todayDDMMYY,
    stockLevel, LEVEL_CHIP, LEVEL_LABEL,
    nextSaleId, nextOrderId,
    state,
    onChange,
    loadAll,
    persist,
    findStock,
    addStockItem, editStockItem, deleteStockItem, deductStock, restoreStock,
    acceptRequisition, rejectRequisition, logRequisitionRaised,
    recordSale, openTab, markServed, payOrder, cancelOrder, voidSale,
    cartTotals,
    dashboardKPIs, salesKPIs, stockKPIs, ordersKPIs,
    can, canVoidSale, canDiscount,
    listStaffNames,
    getShiftSales, isManagerLike,
    postToGuestFolio,
    getInHouseGuests,
    paymentMethods: getPaymentMethods(),
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
    // Stock form pick-lists + stock-page filter/sort (call-and-render)
    getStockCategories,
    getStockUnits,
    getDeductReasons,
    listStockCategoriesInUse,
    parseReceivedDate,
    filterStock,
    // Category management — service does all the work; pages only render.
    listManagedCategories,
    categoryItemCount,
    addCategory,
    renameCategory,
    deleteCategory,
    getFallbackCategoryName,
    // Sales-page business logic (already moved)
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