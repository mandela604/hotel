/**
 * services/restaurant-service.js — Shared data + business logic for Restaurant
 * Depends on: data/restaurant-seed.js (window.RestaurantSeed)
 * Optional: services/permissions.js (window.Permissions)
 * Optional: BookingData (booking-service.js) — posts Room Charge sales to guest
 *           folio via addRoomCharge, and is the source of truth for in-house
 *           guests (see getInHouseGuests below).
 *
 * Load order:
 *   permissions.js (optional)
 *   data/restaurant-seed.js
 *   services/restaurant-service.js
 *   page script
 *
 * Pages call RestaurantService.* and only render — they never reach into
 * window.BookingData directly (see WHY GETINHOUSEGUESTS LIVES HERE below),
 * and they never re-implement filtering/aggregation over state.sales
 * themselves — see getFilteredSales / salesKPIs below. That logic lives
 * here so every page (Sales, Reports, Dashboard…) sees the same numbers.
 *
 * CONFIG GETTERS — added so dashboard/reports/sales pages never hardcode
 * currency, status values, level labels, room-charge method name, money-
 * received rules, or revenue-breakdown display order/colors. Every one of
 * these reads RestaurantSeed first and falls back to a single NAMED
 * default (documented at each function) — override via RestaurantSeed,
 * never by editing this file or a page.
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

  // Lazily (and only once) loads the Booking module's demo-data script and
  // service script if a page hasn't already loaded them. Pages no longer
  // need <script src="../booking/data/booking-demo-seed.js"> or
  // <script src="../booking/services/booking-service.js"> at all — this
  // service is the only thing that talks to BookingData, so it's the only
  // thing that needs to know how to fetch it. When this goes live, this
  // function is the one place that changes.
  var bookingDataLoadPromise = null;
  function ensureBookingData() {
    if (global.BookingData && typeof global.BookingData.getBookingData === 'function') {
      return Promise.resolve(global.BookingData);
    }
    if (bookingDataLoadPromise) return bookingDataLoadPromise;

    bookingDataLoadPromise = (async function () {
      // Paths to the Booking module's sibling scripts are a deployment/
      // repo-layout detail — sourced from RestaurantSeed.BOOKING_MODULE_PATHS
      // (mirrors PoolBarSeed.BOOKING_MODULE_PATHS) so a page that preloads
      // window.BookingData itself never needs these paths to be correct.
      const paths = (global.RestaurantSeed && global.RestaurantSeed.BOOKING_MODULE_PATHS) || {};
      if (!global.BookingDemoSeed && paths.demoSeed) {
        await loadScriptTag(resolveRelative(paths.demoSeed));
      } else if (!global.BookingDemoSeed && !paths.demoSeed) {
        await loadScriptTag(resolveRelative('../../booking/data/booking-demo-seed.js'));
      }
      if (!global.BookingData && paths.service) {
        await loadScriptTag(resolveRelative(paths.service));
      } else if (!global.BookingData && !paths.service) {
        await loadScriptTag(resolveRelative('../../booking/services/booking-service.js'));
      }
      if (!global.BookingData || typeof global.BookingData.getBookingData !== 'function') {
        throw new Error('BookingData failed to initialize after dynamic load.');
      }
      return global.BookingData;
    })();

    return bookingDataLoadPromise;
  }

  const KEYS = {
    STOCK: 'restaurant-stock',
    CATEGORIES: 'restaurant-categories',
    SALES: 'restaurant-sales',
    ORDERS: 'restaurant-orders',
    PENDING: 'restaurant-pending-transfers',
    HISTORY: 'restaurant-transfer-history',
    MOVEMENTS: 'restaurant-movements',
    TRANSFER_COUNT: 'restaurant-transfer-count',
  };

  // Single source of truth for accepted payment methods — pages (Orders,
  // Reports, …) read this instead of hardcoding their own copy of the list.
  // Still sourced from seed when provided, so this constant is only the
  // named fallback (unchanged default from before this pass).
  function getPaymentMethods() {
    const s = global.RestaurantSeed || {};
    return Array.isArray(s.PAYMENT_METHODS) && s.PAYMENT_METHODS.length
      ? s.PAYMENT_METHODS
      : PAYMENT_METHODS;
  }
  const PAYMENT_METHODS = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];

  const storage = global.storage || {
    async get(key) {
      const v = localStorage.getItem(key);
      return v == null ? null : { key, value: v };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value };
    },
  };

  async function loadShared(key, fallback) {
    try {
      const r = await storage.get(key, true);
      if (r && r.value) {
        const parsed = JSON.parse(r.value);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* first run */ }
    return fallback;
  }
  async function saveShared(key, value) {
    try {
      await storage.set(key, JSON.stringify(value), true);
      return true;
    } catch (e) {
      console.warn('[RestaurantService] save failed:', key, e);
      return false;
    }
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // ── Currency — RestaurantSeed.CURRENCY:{symbol,locale}, falling back to
  // the historical Naira default so existing deployments keep working
  // unchanged. Override in the seed, not here.
  const DEFAULT_CURRENCY = { symbol: '₦', locale: 'en-NG' };
  function getCurrencyConfig() {
    const s = global.RestaurantSeed || {};
    return (s.CURRENCY && s.CURRENCY.symbol) ? s.CURRENCY : DEFAULT_CURRENCY;
  }
  function fmtN(n) {
    const cur = getCurrencyConfig();
    const amount = Math.round(n || 0);
    return cur.symbol + amount.toLocaleString(cur.locale || undefined);
  }

  function fmtStamp(date) {
    let h = date.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad2(h)}:${pad2(date.getMinutes())} ${ampm}`;
  }
  function nowStamp() { return fmtStamp(new Date()); }
  function todayDDMMYY() {
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  }
  function parseStamp(str) {
    if (!str) return null;
    const parts = str.split(' ');
    const [dd, mm, yy] = parts[0].split('/').map((n) => parseInt(n, 10));
    let hh = 0, mi = 0;
    if (parts[1]) {
      const t = parts[1].split(':').map((n) => parseInt(n, 10));
      hh = t[0]; mi = t[1] || 0;
    }
    if (parts[2]) {
      const ap = parts[2].toUpperCase();
      if (ap === 'PM' && hh < 12) hh += 12;
      if (ap === 'AM' && hh === 12) hh = 0;
    }
    const fullYear = yy < 100 ? 2000 + yy : yy;
    return new Date(fullYear, mm - 1, dd, hh, mi);
  }
  function dateOnly(dt) {
    return dt ? new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) : null;
  }

  function stockLevel(i) {
    return i.qty <= 0 ? 'out' : (i.qty <= i.min ? 'low' : 'ok');
  }
  const LEVEL_CHIP = { ok: 'chip-ok', low: 'chip-low', out: 'chip-out' };

  // Level labels are display config — RestaurantSeed.STOCK_LEVEL_LABELS
  // can override any of ok/low/out; the object below is the named default,
  // not a hardcoded requirement. LEVEL_LABEL stays a live-reading Proxy so
  // existing `RestaurantService.LEVEL_LABEL.low` call sites keep working
  // unchanged while still picking up seed overrides.
  const DEFAULT_LEVEL_LABELS = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };
  function getLevelLabels() {
    const s = global.RestaurantSeed || {};
    return Object.assign({}, DEFAULT_LEVEL_LABELS, s.STOCK_LEVEL_LABELS || {});
  }
  const LEVEL_LABEL = new Proxy({}, { get: (_, key) => getLevelLabels()[key] });

  // Short-form level labels (used where space is tight, e.g. a compact
  // "OUT"/"LOW" chip) — separate from LEVEL_LABEL because the full and
  // short forms are allowed to differ, but both are seed-overridable and
  // neither is hardcoded on a page.
  const DEFAULT_LEVEL_LABELS_SHORT = { ok: 'OK', low: 'LOW', out: 'OUT' };
  function getLevelLabelsShort() {
    const s = global.RestaurantSeed || {};
    return Object.assign({}, DEFAULT_LEVEL_LABELS_SHORT, s.STOCK_LEVEL_LABELS_SHORT || {});
  }

  function getEmptyValuePlaceholder() {
    const s = global.RestaurantSeed || {};
    return s.EMPTY_VALUE_PLACEHOLDER || '—';
  }

  // ── Sale/order status vocabulary — same pattern as PoolBarService.
  // RestaurantSeed.STATUS_VALUES can rename any of these; the object below
  // is the named default this service writes when a seed provides nothing.
  const DEFAULT_STATUS = {
    SALE_COMPLETED: 'completed', SALE_VOIDED: 'voided',
    ORDER_OPEN: 'open', ORDER_SERVED: 'served', ORDER_PAID: 'paid', ORDER_CANCELLED: 'cancelled',
  };
  function getStatusConstants() {
    const s = global.RestaurantSeed || {};
    return Object.assign({}, DEFAULT_STATUS, s.STATUS_VALUES || {});
  }

  // Which PAYMENT_METHODS value means "charge to the guest's room" —
  // sourced from seed, never assumed to literally be "Room Charge" (a
  // standalone restaurant with no room ledger can omit this).
  function getRoomChargeMethodName() {
    const s = global.RestaurantSeed || {};
    return s.ROOM_CHARGE_METHOD || 'Room Charge';
  }

  function getModuleName() {
    const s = global.RestaurantSeed || {};
    return s.MODULE_NAME || 'Restaurant';
  }
  function getDepartmentName() {
    const s = global.RestaurantSeed || {};
    return s.DEPARTMENT_NAME || s.MODULE_NAME || 'Restaurant';
  }

  // Cash-like tenders that count as "money received" today vs. money still
  // owed (e.g. Room Charge). Sourced from seed; default matches the
  // historical hardcoded rule (Cash/POS/Transfer).
  const DEFAULT_MONEY_RECEIVED_METHODS = ['Cash', 'POS', 'Transfer'];
  function isMoneyReceived(method) {
    const s = global.RestaurantSeed || {};
    const list = Array.isArray(s.MONEY_RECEIVED_METHODS) && s.MONEY_RECEIVED_METHODS.length
      ? s.MONEY_RECEIVED_METHODS
      : DEFAULT_MONEY_RECEIVED_METHODS;
    return list.indexOf((method || '').trim()) !== -1;
  }

  // ── Revenue-breakdown display (dashboard "Revenue Breakdown" bars) —
  // which payment methods appear first and what accent color each gets.
  // Sourced from RestaurantSeed.REVENUE_METHOD_ORDER / REVENUE_METHOD_COLORS;
  // the arrays/object below are the named defaults, matching the previous
  // hardcoded values on the dashboard page.
  const DEFAULT_REVENUE_METHOD_ORDER = ['Cash', 'Room Charge', 'POS', 'Transfer', 'Complimentary', 'Other'];
  const DEFAULT_REVENUE_METHOD_COLORS = {
    Cash: '', 'Room Charge': 'blue', POS: 'blue', Transfer: 'purple', Complimentary: 'purple',
  };
  function getRevenueMethodOrder() {
    const s = global.RestaurantSeed || {};
    return Array.isArray(s.REVENUE_METHOD_ORDER) && s.REVENUE_METHOD_ORDER.length
      ? s.REVENUE_METHOD_ORDER
      : DEFAULT_REVENUE_METHOD_ORDER;
  }
  function getRevenueMethodColorClass(method) {
    const s = global.RestaurantSeed || {};
    const map = Object.assign({}, DEFAULT_REVENUE_METHOD_COLORS, s.REVENUE_METHOD_COLORS || {});
    return map[method] || '';
  }
  /**
   * Group + order a set of completed sales by payment method for the
   * dashboard's Revenue Breakdown bars. Moves the "which methods, in what
   * order, with what color" decision off the page entirely — the page
   * only renders whatever entries come back.
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

  function nextSaleId(sales) {
    let max = 1000;
    (sales || []).forEach((s) => {
      const n = parseInt((s.id || '').replace('RST-', ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'RST-' + (max + 1);
  }
  function nextOrderId(orders) {
    let max = 0;
    (orders || []).forEach((o) => {
      const n = parseInt((o.id || '').replace('RSO-', ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'RSO-' + String(max + 1).padStart(3, '0');
  }

  const state = {
    stock: [], categories: [], sales: [], orders: [], pending: [], history: [], movements: [],
    transfersToday: 0,
    ready: false,
  };

  const listeners = [];
  function onChange(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }
  function emitChange(reason) {
    listeners.forEach((fn) => {
      try { fn(state, reason); } catch (e) { console.warn('[RestaurantService] listener', e); }
    });
  }

  function seed() {
    const s = global.RestaurantSeed || {};
    const stock = s.DEMO_STOCK || [];
    const fromStock = [...new Set(stock.map((i) => i.category).filter(Boolean))];
    const defaults = ['Mains', 'Soups', 'Starters', 'Sides', 'Drinks', 'Desserts', 'Uncategorized'];
    return {
      stock,
      categories: s.DEMO_CATEGORIES || [...new Set(defaults.concat(fromStock))],
      sales: s.DEMO_SALES || [],
      orders: s.DEMO_ORDERS || [],
      pending: s.DEMO_PENDING || [],
      history: s.DEMO_HISTORY || [],
      movements: s.DEMO_MOVEMENTS || [],
      transferCount: s.DEMO_TRANSFER_COUNT || [],
    };
  }

  async function loadAll() {
    const s = seed();
    const [stock, categories, sales, orders, pending, history, movements, transferCountRec] = await Promise.all([
      loadShared(KEYS.STOCK, s.stock),
      loadShared(KEYS.CATEGORIES, s.categories),
      loadShared(KEYS.SALES, s.sales),
      loadShared(KEYS.ORDERS, s.orders),
      loadShared(KEYS.PENDING, s.pending),
      loadShared(KEYS.HISTORY, s.history),
      loadShared(KEYS.MOVEMENTS, s.movements),
      loadShared(KEYS.TRANSFER_COUNT, s.transferCount),
    ]);
    state.stock = stock;
    // merge any categories that exist on stock items but not in list
    const merged = [...new Set([...(categories || []), ...stock.map((i) => i.category).filter(Boolean)])];
    state.categories = merged.sort((a, b) => a.localeCompare(b));
    state.sales = sales;
    state.orders = orders;
    state.pending = pending;
    state.history = history;
    state.movements = movements;
    const today = todayDDMMYY();
    state.transfersToday = (transferCountRec[0] && transferCountRec[0].date === today)
      ? transferCountRec[0].count : 0;
    state.ready = true;

    await Promise.all([
      saveShared(KEYS.STOCK, state.stock),
      saveShared(KEYS.CATEGORIES, state.categories),
      saveShared(KEYS.SALES, state.sales),
      saveShared(KEYS.ORDERS, state.orders),
      saveShared(KEYS.PENDING, state.pending),
      saveShared(KEYS.HISTORY, state.history),
      saveShared(KEYS.MOVEMENTS, state.movements),
    ]);

    // Kick off BookingData loading now (not awaited-to-fail) so it's
    // usually already resolved by the time getInHouseGuests() is called.
    // Non-fatal here: a standalone restaurant with no Booking module still
    // works, just without Room Charge guest lookup / folio posting.
    ensureBookingData().catch(function (e) {
      console.warn('[RestaurantService] BookingData not available:', e.message);
    });

    emitChange('load');
    return state;
  }

  async function persist(keys) {
    const map = {
      stock: KEYS.STOCK,
      categories: KEYS.CATEGORIES,
      sales: KEYS.SALES,
      orders: KEYS.ORDERS,
      pending: KEYS.PENDING,
      history: KEYS.HISTORY,
      movements: KEYS.MOVEMENTS,
    };
    const list = keys && keys.length ? keys : Object.keys(map);
    await Promise.all(list.map((k) => saveShared(map[k], state[k])));
  }

  // ── Stock ──────────────────────────────────────
  function findStock(name) {
    return state.stock.find((i) => i.name === name);
  }

  async function addStockItem({ name, category, unit, min = 0, price = 0, desc = '' }) {
    if (!name || !name.trim()) throw new Error('Item name is required.');
    if (findStock(name)) throw new Error(`"${name}" is already tracked — edit it instead.`);
    const cat = await ensureCategory(category);
    const emptyValue = getEmptyValuePlaceholder();
    const entry = {
      name: name.trim(), category: cat, unit, qty: 0, min, price,
      batch: emptyValue, received: emptyValue, desc,
    };
    state.stock.push(entry);
    await persist(['stock']);
    emitChange('stock:add');
    return entry;
  }

  async function editStockItem(name, updates) {
    const i = findStock(name);
    if (!i) throw new Error(`"${name}" not found in stock.`);
    const { qty, batch, received, ...safe } = updates;
    if (safe.category != null) safe.category = await ensureCategory(safe.category);
    Object.assign(i, safe);
    await persist(['stock']);
    emitChange('stock:edit');
    return i;
  }

  async function deleteStockItem(name) {
    state.stock = state.stock.filter((i) => i.name !== name);
    await persist(['stock']);
    emitChange('stock:delete');
  }

  async function deductStock(name, qty, reason, notes) {
    const i = findStock(name);
    if (!i) throw new Error(`"${name}" not found in stock.`);
    if (qty < 1) throw new Error('Enter a valid quantity.');
    if (qty > i.qty) throw new Error(`Cannot deduct more than the ${i.qty} ${i.unit} on hand.`);
    i.qty -= qty;
    state.movements.unshift({
      date: nowStamp(), item: i.name, qtyIn: 0, qtyOut: qty, balance: i.qty,
      reason: notes ? `${reason} — ${notes}` : reason,
    });
    await persist(['stock', 'movements']);
    emitChange('stock:deduct');
    return i;
  }

  function restoreStock(name, qty, reason) {
    const i = findStock(name);
    if (!i) return null;
    i.qty += qty;
    state.movements.unshift({
      date: nowStamp(), item: i.name, qtyIn: qty, qtyOut: 0, balance: i.qty, reason,
    });
    return i;
  }

  // ── Categories ─────────────────────────────────
  function getCategories() {
    return (state.categories || []).slice().sort((a, b) => a.localeCompare(b));
  }

  async function addCategory(name) {
    const n = (name || '').trim();
    if (!n) throw new Error('Category name is required.');
    if (state.categories.some((c) => c.toLowerCase() === n.toLowerCase())) {
      throw new Error(`Category "${n}" already exists.`);
    }
    state.categories.push(n);
    state.categories.sort((a, b) => a.localeCompare(b));
    await persist(['categories']);
    emitChange('category:add');
    return n;
  }

  async function renameCategory(oldName, newName) {
    const n = (newName || '').trim();
    if (!oldName) throw new Error('Old category name is required.');
    if (!n) throw new Error('New category name is required.');
    if (n.toLowerCase() !== oldName.toLowerCase() &&
        state.categories.some((c) => c.toLowerCase() === n.toLowerCase())) {
      throw new Error(`Category "${n}" already exists.`);
    }
    const idx = state.categories.findIndex((c) => c === oldName);
    if (idx === -1) throw new Error(`Category "${oldName}" not found.`);
    state.categories[idx] = n;
    state.categories.sort((a, b) => a.localeCompare(b));
    state.stock.forEach((i) => {
      if (i.category === oldName) i.category = n;
    });
    await persist(['categories', 'stock']);
    emitChange('category:rename');
    return n;
  }

  async function deleteCategory(name, { reassignTo = 'Uncategorized' } = {}) {
    if (!name) throw new Error('Category name is required.');
    if (name === 'Uncategorized') throw new Error('Cannot delete "Uncategorized".');
    state.categories = state.categories.filter((c) => c !== name);
    if (!state.categories.includes(reassignTo)) state.categories.push(reassignTo);
    state.stock.forEach((i) => {
      if (i.category === name) i.category = reassignTo;
    });
    state.categories.sort((a, b) => a.localeCompare(b));
    await persist(['categories', 'stock']);
    emitChange('category:delete');
  }

  // ensure category exists when adding/editing stock
  async function ensureCategory(name) {
    const n = (name || '').trim() || 'Uncategorized';
    if (!state.categories.some((c) => c.toLowerCase() === n.toLowerCase())) {
      state.categories.push(n);
      state.categories.sort((a, b) => a.localeCompare(b));
      await persist(['categories']);
    }
    return n;
  }

  // ── Store → Restaurant transfers ───────────────
  /** Pending + history combined (for list pages that show everything). */
  function getAllTransfers() {
    return state.pending.concat(state.history);
  }

  async function acceptTransfer(no, { receivedBy, remarks }) {
    if (!receivedBy || !receivedBy.trim()) throw new Error('Please enter who received the transfer.');
    const idx = state.pending.findIndex((p) => p.no === no);
    if (idx === -1) throw new Error(`Transfer ${no} not found.`);
    const t = state.pending[idx];
    const stamp = nowStamp();

    (t.items || []).forEach((item) => {
      let inv = findStock(item.name);
      if (!inv) {
        inv = {
          name: item.name, category: 'Uncategorized', unit: item.unit || 'unit',
          qty: 0, min: 0, price: 0, batch: t.batchNo || t.no, received: todayDDMMYY(), desc: '',
        };
        state.stock.push(inv);
      }
      inv.qty += item.qty;
      inv.batch = t.batchNo || inv.batch;
      inv.received = todayDDMMYY();
      state.movements.unshift({
        date: stamp, item: inv.name, qtyIn: item.qty, qtyOut: 0, balance: inv.qty,
        reason: `Store Transfer (${t.no})`,
      });
    });

    const done = Object.assign({}, t, {
      status: 'accepted',
      receivedBy: receivedBy.trim(),
      actionRemarks: remarks || '',
      actionDate: stamp,
    });
    state.pending.splice(idx, 1);
    state.history.unshift(done);
    await persist(['stock', 'movements', 'pending', 'history']);
    emitChange('transfer:accept');
    return done;
  }

  async function rejectTransfer(no, { reason }) {
    if (!reason || !reason.trim()) throw new Error('Please enter a reason for rejecting this transfer.');
    const idx = state.pending.findIndex((p) => p.no === no);
    if (idx === -1) throw new Error(`Transfer ${no} not found.`);
    const t = state.pending[idx];
    const stamp = nowStamp();
    const done = Object.assign({}, t, {
      status: 'rejected',
      receivedBy: '',
      actionRemarks: reason.trim(),
      actionDate: stamp,
    });
    state.pending.splice(idx, 1);
    state.history.unshift(done);
    await persist(['pending', 'history']);
    emitChange('transfer:reject');
    return done;
  }

  /** Log that restaurant raised a requisition to Store today (KPI counter). */
  async function logRequisitionRaised() {
    const today = todayDDMMYY();
    state.transfersToday += 1;
    await saveShared(KEYS.TRANSFER_COUNT, [{ date: today, count: state.transfersToday }]);
    emitChange('requisition:raised');
    return state.transfersToday;
  }

  // ── Sales & open tabs ──────────────────────────
  function cartTotals(cart, discountPct) {
    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const total = subtotal * (1 - (discountPct || 0) / 100);
    return { subtotal, total };
  }

  /** Post a Room Charge sale to the guest folio (Booking module). Non-fatal if Booking is missing. */
  async function postToGuestFolio(sale) {
    if (!sale || sale.method !== getRoomChargeMethodName()) return;
    if (!sale.roomNumber) return;
    let bookingData;
    try {
      bookingData = await ensureBookingData();
    } catch (e) {
      console.warn('[RestaurantService] BookingData unavailable — folio not updated:', e.message);
      return;
    }
    if (typeof bookingData.addRoomCharge !== 'function') {
      console.warn('[RestaurantService] BookingData.addRoomCharge unavailable — folio not updated.');
      return;
    }
    // Look up the guest from the room number
    let guestKey = sale.guestName;
    if (!guestKey) {
      const data = await bookingData.getBookingData();
      const booking = data.bookings.find(b => b.room === sale.roomNumber);
      if (booking && booking.guest) {
        guestKey = booking.guest;
      } else {
        console.warn('[RestaurantService] No guest found for room ' + sale.roomNumber + '. Charge will not be recorded.');
        return;
      }
    }
    const desc = (sale.items || []).map(function (i) {
      return (i.qty || 1) + 'x ' + (i.name || '');
    }).join(', ') || sale.id;
    try {
      await bookingData.addRoomCharge(guestKey, {
        source: getModuleName(),
        desc: desc,
        room: sale.roomNumber,
        amount: sale.total,
        by: sale.staff || getModuleName(),
      });
    } catch (e) {
      console.warn('[RestaurantService] folio charge failed:', e && e.message ? e.message : e);
    }
  }

  async function recordSale({ items, discount = 0, method, staff, table, notes = '', roomNumber = null, guestName = null, guestPhone = null }) {
    if (!items || !items.length) throw new Error('Add at least one item.');
    if (!table) throw new Error('Please enter a table or seat.');
    if (!staff) throw new Error('Please enter the staff name.');
    const cleanItems = items.map((c) => ({ name: c.key || c.name, qty: c.qty, price: c.price }));
    const { subtotal, total } = cartTotals(cleanItems, discount);
    const stamp = nowStamp();
    const roomChargeMethod = getRoomChargeMethodName();
    if (roomNumber && roomChargeMethod) method = roomChargeMethod;
    const sale = {
      id: nextSaleId(state.sales), items: cleanItems, subtotal, discount, total,
      method, staff, table, notes, date: stamp, status: getStatusConstants().SALE_COMPLETED, source: 'quick',
      roomNumber: roomNumber || null, guestName: guestName || null, guestPhone: guestPhone || null,
    };
    sale.items.forEach((c) => {
      const inv = findStock(c.name);
      if (inv) {
        inv.qty = Math.max(0, inv.qty - c.qty);
        state.movements.unshift({
          date: stamp, item: c.name, qtyIn: 0, qtyOut: c.qty, balance: inv.qty,
          reason: `Sale (${sale.id})`,
        });
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
    const cleanItems = items.map((c) => ({ name: c.key || c.name, qty: c.qty, price: c.price }));
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
    const o = state.orders.find((x) => x.id === orderId);
    if (!o) throw new Error(`Order ${orderId} not found.`);
    o.status = getStatusConstants().ORDER_SERVED;
    await persist(['orders']);
    emitChange('order:served');
    return o;
  }

  async function payOrder(orderId, methodOrOpts) {
    const o = state.orders.find((x) => x.id === orderId);
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
    const roomChargeMethod = getRoomChargeMethodName();
    if (roomNumber && roomChargeMethod) method = roomChargeMethod;
    const stamp = nowStamp();
    const sale = {
      id: nextSaleId(state.sales), items: o.items, subtotal: o.subtotal, discount: o.discount,
      total: o.total, method, staff: o.staff, table: o.table, notes: o.notes,
      date: stamp, status: getStatusConstants().SALE_COMPLETED, source: 'tab',
      roomNumber: roomNumber || null, guestName: guestName || null, guestPhone: guestPhone || null,
    };
    o.items.forEach((item) => {
      const inv = findStock(item.name);
      if (inv) {
        inv.qty = Math.max(0, inv.qty - item.qty);
        state.movements.unshift({
          date: stamp, item: item.name, qtyIn: 0, qtyOut: item.qty, balance: inv.qty,
          reason: `Tab Payment (${o.id})`,
        });
      }
    });
    state.sales.unshift(sale);
    o.status = getStatusConstants().ORDER_PAID;
    o.payMethod = method;
    o.paidSaleId = sale.id;
    o.roomNumber = roomNumber; o.guestName = guestName; o.guestPhone = guestPhone;
    await persist(['sales', 'stock', 'movements', 'orders']);
    await postToGuestFolio(sale);
    emitChange('order:paid');
    return { order: o, sale };
  }

  async function cancelOrder(orderId) {
    const o = state.orders.find((x) => x.id === orderId);
    if (!o) throw new Error(`Order ${orderId} not found.`);
    o.status = getStatusConstants().ORDER_CANCELLED;
    await persist(['orders']);
    emitChange('order:cancelled');
    return o;
  }

  async function voidSale(saleId, reason, voidedBy) {
    const s = state.sales.find((x) => x.id === saleId);
    if (!s) throw new Error(`Sale ${saleId} not found.`);
    if (s.status === getStatusConstants().SALE_VOIDED) return s;
    const stamp = nowStamp();
    s.items.forEach((item) => restoreStock(item.name, item.qty, `Voided Sale (${s.id})`));
    s.status = getStatusConstants().SALE_VOIDED;
    s.voidReason = reason;
    s.voidDate = stamp;
    s.voidedBy = voidedBy;
    await persist(['sales', 'stock', 'movements']);
    emitChange('sale:void');
    return s;
  }

  // ── In-house guests (for Room Charge orders) ────
  /**
   * The single source of truth for "who is in-house right now, for Room
   * Charge purposes". Pages call THIS, never window.BookingData directly.
   *
   * Throws on failure — it NEVER falls back to hardcoded/fake guest data.
   * Callers (pages) decide how to show that failure to the user; this
   * function's only job is to get real data or say clearly that it couldn't.
   */
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
      .filter((b) => b.status === 'checkedin' && b.guest)
      .map((b) => ({ room: String(b.room || ''), name: b.guest || '', phone: b.phone || '', status: 'In-House' }));
  }

  // ── Filtering (Sales / Reports pages) ───────────
  /**
   * Single source of truth for "which sales match these filters". Any page
   * that needs a filtered slice of state.sales (Reports, Sales, Dashboard
   * drill-downs, …) calls this instead of writing its own .filter() over
   * state.sales — keeps behavior (and any future filter rule change) in
   * one place instead of drifting per-page.
   *
   * @param {object} filters
   *   status:  '' | 'completed' | 'voided'
   *   source:  '' | 'quick' | 'tab'
   *   payment: '' | one of PAYMENT_METHODS
   *   search:  free text — matches sale id, staff, table, method, notes,
   *            roomNumber, guestName, and item names
   *   bounds:  { start: Date|null, end: Date|null } — inclusive day range,
   *            compared against the sale's date field via dateOnly/parseStamp
   *   list:    optional array to filter instead of state.sales (rarely needed)
   */
  function getFilteredSales(filters) {
    const f = filters || {};
    const rows = f.list || state.sales;
    const bounds = f.bounds || {};
    const q = (f.search || '').trim().toLowerCase();

    return rows.filter((s) => {
      if (f.status && s.status !== f.status) return false;
      if (f.source && (s.source || 'quick') !== f.source) return false;
      if (f.payment && s.method !== f.payment) return false;

      if (bounds.start && bounds.end) {
        const sd = dateOnly(parseStamp(s.date));
        if (!sd || sd < bounds.start || sd > bounds.end) return false;
      }

      if (q) {
        const hay = [
          s.id, s.staff, s.table, s.method, s.notes, s.roomNumber, s.guestName,
          (s.items || []).map((i) => i.name || i.meal || '').join(' '),
        ].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /**
   * Today's completed (non-voided) sales — the exact rule the dashboard's
   * revenue panel needs, moved off the page. Equivalent to:
   *   getFilteredSales({ status: getStatusConstants().SALE_COMPLETED })
   *   .filter(s => s.date starts with today)
   * but expressed once here so "today" and "completed" are never
   * re-typed on a page.
   */
  function getTodaysCompletedSales() {
    const today = todayDDMMYY();
    const completedStatus = getStatusConstants().SALE_COMPLETED;
    return state.sales.filter(function (s) {
      return s.status === completedStatus && (s.date || '').startsWith(today);
    });
  }

  // ── KPIs ───────────────────────────────────────
  function dashboardKPIs() {
    const st = getStatusConstants();
    const pendingN = state.pending.length;
    const lowStock = state.stock.filter((i) => stockLevel(i) !== 'ok').length;
    const todaySales = getTodaysCompletedSales();
    const todayRevenue = todaySales.reduce((s, x) => s + x.total, 0);
    const units = state.stock.reduce((s, i) => s + i.qty, 0);
    const openTabs = state.orders.filter((o) => o.status === st.ORDER_OPEN || o.status === st.ORDER_SERVED).length;
    return {
      pendingN, lowStock, todaySalesCount: todaySales.length, todayRevenue,
      units, itemCount: state.stock.length, openTabs, transfersToday: state.transfersToday,
    };
  }

  /**
   * Aggregate KPIs over a row set (defaults to all of state.sales).
   * `quick`/`voided` counts are over the raw row set (any status); revenue/
   * units/avgTicket are over completed rows only, matching Reports' cards.
   */
  function salesKPIs(list) {
    const st = getStatusConstants();
    const rows = list || state.sales;
    const completed = rows.filter((s) => s.status === st.SALE_COMPLETED);
    const voided = rows.filter((s) => s.status === st.SALE_VOIDED);
    const quick = completed.filter((s) => (s.source || 'quick') !== 'tab');
    const revenue = completed.reduce((s, x) => s + x.total, 0);
    const units = completed.reduce(
      (s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0
    );
    return {
      total: rows.length,
      count: completed.length,
      quickCount: quick.length,
      voided: voided.length,
      revenue,
      units,
      avgTicket: completed.length ? revenue / completed.length : 0,
    };
  }

  function transferKPIs() {
    const all = getAllTransfers();
    return {
      pending: state.pending.length,
      accepted: state.history.filter((t) => t.status === 'accepted').length,
      rejected: state.history.filter((t) => t.status === 'rejected').length,
      total: all.length,
    };
  }

  // ── Public API ─────────────────────────────────
  global.RestaurantService = {
    KEYS,
    PAYMENT_METHODS,
    state,
    loadAll,
    onChange,

    // helpers
    fmtN, fmtStamp, nowStamp, todayDDMMYY, parseStamp, dateOnly,
    stockLevel, LEVEL_CHIP, LEVEL_LABEL, cartTotals,

    // config getters — dashboard/reports/sales pages read these instead
    // of hardcoding currency, status values, level labels, room-charge
    // method, money-received rule, or revenue-breakdown order/colors.
    getPaymentMethods,
    getCurrencyConfig,
    getStatusConstants,
    getLevelLabels,
    getLevelLabelsShort,
    getEmptyValuePlaceholder,
    getRoomChargeMethodName,
    getModuleName,
    getDepartmentName,
    isMoneyReceived,
    getRevenueMethodOrder,
    getRevenueMethodColorClass,
    getRevenueBreakdown,
    getTodaysCompletedSales,

    // stock
    findStock, addStockItem, editStockItem, deleteStockItem, deductStock,

    // categories
    getCategories, addCategory, renameCategory, deleteCategory,
    // transfers (Store → Restaurant)
    getAllTransfers, acceptTransfer, rejectTransfer, logRequisitionRaised,

    // sales / tabs
    recordSale, openTab, markServed, payOrder, cancelOrder, voidSale,

    // guests / folio
    getInHouseGuests, postToGuestFolio,

    // filtering / kpis
    getFilteredSales, dashboardKPIs, salesKPIs, transferKPIs,
  };
})(window);