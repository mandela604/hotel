/**
 * services/accounting-service.js — Shared data + business logic for the Accounting module
 * Depends on: data/accounting-seed.js (window.AccountingSeed), optionally services/permissions.js (window.Permissions)
 * Optional: BookingData (booking-service.js) — reads room revenue from the Booking module.
 *
 * Load order: accounting-seed.js, THEN this file, then the page's own <script>.
 *
 * Formal service restored. Pages call AccountingData methods and only render.
 * Reads/writes the SHARED store (window.storage, shared:true — the same
 * store Restaurant / Pool Bar / Booking already write to under
 * 'restaurant-sales', 'poolbar-sales', 'booking-bookings' etc.), seeded
 * once from data/accounting-seed.js (window.AccountingSeed). Falls back
 * to plain localStorage when window.storage isn't available.
 *
 * When going live: replace this file with a real API client that keeps
 * the SAME function names and return shapes.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT'S NEW IN THIS VERSION
 * Every page in the Accounting module (breakdown, P&L, reconciliation,
 * transactions — not just dashboard/reports) now gets everything it
 * needs from here: no page should keep its own `storage` shim, its own
 * `buildTransactions()`, its own date-label formatters, or its own
 * filter/sort logic anymore. New surface area added below:
 *   - date/label formatting  (shiftRangeLabel, dayLabel, currentShiftKey…)
 *   - range + daily aggregation (for Revenue Breakdown)
 *   - shift-detail helpers + getShiftDetail() (for Reconciliation)
 *   - P&L CRUD: addIncome/updateIncome/deleteIncome + expense equivalents
 *   - a unified, cross-module transactions feed (for Transactions),
 *     which also reads Booking + Gym payment data (read-only, demo
 *     fallback kept local to this file — those modules own their own
 *     seed data, Accounting only displays it)
 *   - queryTransactions() — pure filter/sort so pages hand over raw
 *     filter values and get back rows, instead of writing the loop
 * ─────────────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  const KEYS = {
    ROOM_TX: 'accounting-room-tx',
    REST: 'restaurant-sales',
    POOLBAR: 'poolbar-sales',
    SHIFTS: 'accounting-shifts',
    RECON_LOG: 'accounting-reconciliation-log',
    SESSION: 'accounting-session',
    INCOME: 'accounting-income',
    EXPENSES: 'accounting-expenses',
    // Cross-module, read-only from Accounting's point of view — these
    // modules own the data; Accounting just displays it on Transactions.
    BOOKINGS: 'booking-bookings',
    GYM: 'gym-members',
  };

  const SHIFT_START_HOUR = 9;

  const CONFIG = {
    USE_DEMO: true,
    API_BASE: '',
    API_KEY: '',
    DEMO_SESSION: {
      name: 'Finance Manager',
      initials: 'FM',
      role: 'staff',
      privilege: 'accountant',
    },
  };

  function configure(opts) {
    Object.assign(CONFIG, opts || {});
  }

  /* ── shared storage (window.storage), falling back to localStorage ── */
  const storage = global.storage || {
    async get(key, shared) {
      const v = localStorage.getItem(key);
      return v == null ? null : { key, value: v, shared };
    },
    async set(key, value, shared) {
      localStorage.setItem(key, value);
      return { key, value, shared };
    },
    async delete(key, shared) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared };
    },
    async list(prefix, shared) {
      const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared };
    },
  };

  async function loadShared(key, fallback) {
    try {
      const r = await storage.get(key, true);
      if (r && r.value) {
        const parsed = JSON.parse(r.value);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* fall through to fallback */ }
    return fallback;
  }
  async function saveShared(key, value) {
    try { await storage.set(key, JSON.stringify(value), true); return true; }
    catch (e) { console.warn('[AccountingService] sync failed:', key, e); return false; }
  }

  /* ── local (per-device) session — same pattern as booking-service.js ── */
  function lsGet(key) {
    try { const v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); }
    catch (e) { return null; }
  }
  function lsSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function getSession() { return lsGet(KEYS.SESSION) || CONFIG.DEMO_SESSION; }
  function setSession(s) { lsSet(KEYS.SESSION, s); }

  function delay(ms) { return new Promise((r) => setTimeout(r, ms || 100)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ── date helpers ── */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

  function shiftKeyFor(dt) {
    const d = new Date(dt);
    if (d.getHours() < SHIFT_START_HOUR) d.setDate(d.getDate() - 1);
    return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  function calendarKeyFor(dt) { return ymd(new Date(dt)); }
  function keyForMode(dt, mode) { return mode === 'calendar' ? calendarKeyFor(dt) : shiftKeyFor(dt); }

  // Parses "DD/MM/YY hh:mm AM/PM" (poolbar rows use `time`, others `date`)
  function parseTxDate(str) {
    if (!str) return null;
    const [datePart, timePart, ampm] = str.split(' ');
    if (!datePart || !datePart.includes('/')) return null;
    const [d, m, y] = datePart.split('/').map((n) => parseInt(n, 10));
    let hh = 0, mm = 0;
    if (timePart) { const [h, mi] = timePart.split(':').map((n) => parseInt(n, 10)); hh = h; mm = mi || 0; }
    if (ampm) { const u = ampm.toUpperCase(); if (u === 'PM' && hh < 12) hh += 12; if (u === 'AM' && hh === 12) hh = 0; }
    const fullYear = y < 100 ? 2000 + y : y;
    return new Date(fullYear, m - 1, d, hh, mm);
  }

  // Superset of parseTxDate — also accepts a plain "YYYY-MM-DD" (or
  // "YYYY-MM-DDTHH:mm...") date, which is the shape Booking/Gym use.
  // Needed by getAllTransactions() since it mixes both formats.
  function parseAnyDate(str) {
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str.length === 10 ? str + 'T00:00:00' : str);
    return parseTxDate(str);
  }

  function fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function fmtTime(d) { return d ? d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'; }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  function fmtDateTime(d) { return d ? (fmtDate(d) + ' · ' + fmtTime(d)) : '—'; }
  function nowStamp() {
    return new Date()
      .toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      .replace(',', '');
  }
  function todayDDMMYY() {
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  }
  function fmtHourLabel(h) {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:00 ${suffix}`;
  }

  /* ── key → human label helpers (moved off every page — dashboard,
     breakdown, reconciliation, and reports all hand-rolled their own
     copies of these) ── */
  function shortDateLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fullDateLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function shiftRangeLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    const start = new Date(y, m - 1, d, SHIFT_START_HOUR, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const opt = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('en-GB', opt)}, ${fmtTime(start)} → ${end.toLocaleDateString('en-GB', opt)}, ${fmtTime(end)}`;
  }
  // dayLabel: 'shift' mode → "17 Jul → 18 Jul"; 'calendar' mode → "Fri, 17 Jul 2026"
  function dayLabel(key, mode) {
    const [y, m, d] = key.split('-').map(Number);
    if (mode === 'shift') {
      const start = new Date(y, m - 1, d, SHIFT_START_HOUR, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const opt = { day: 'numeric', month: 'short' };
      return `${start.toLocaleDateString('en-GB', opt)} → ${end.toLocaleDateString('en-GB', opt)}`;
    }
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  // "Current shift" anchored to the most recent transaction present in
  // the data (demo timestamps are relative to load time), falling back
  // to the real wall-clock shift if there are no transactions at all.
  function currentShiftKey(transactions) {
    if (!transactions || !transactions.length) return shiftKeyFor(new Date());
    return shiftKeyFor(transactions[0].date); // expects newest-first, same as buildTransactions() output
  }

  /* ── permissions ── */
  function perm() { return global.Permissions || null; }
  function requirePerm(session, action, module, entity) {
    const P = perm();
    if (!P) return true;
    if (action === 'canEdit') return P.canEdit(session, module, entity);
    if (action === 'canDelete') return P.canDelete(session, module, entity);
    return P.hasPermission(session, action, module);
  }
  function deny(msg) {
    const err = new Error(msg || 'Permission denied');
    err.code = 'PERMISSION_DENIED';
    throw err;
  }
  function can(session, permission) {
    if (!global.Permissions) return true;
    return global.Permissions.hasPermission(session, permission, 'accounting');
  }
  function canApprove(session) {
    if (!global.Permissions) return true;
    return global.Permissions.canApprove(session, 'accounting');
  }

  /* ── pure helpers — no I/O, safe to call with any transaction/shift arrays ── */
  function buildTransactions(roomTx, restSales, poolSales) {
    const out = [];
    (roomTx || []).forEach((r) => out.push({
      id: r.id, dept: 'Rooms', desc: r.desc, amount: r.amount, method: r.method, staff: r.staff, date: parseTxDate(r.date),
    }));
    (restSales || []).filter((s) => s.status !== 'voided').forEach((s) => {
      const desc = (s.items || []).map((i) => `${i.meal} ×${i.qty}`).join(', ') || 'Restaurant sale';
      out.push({ id: s.id, dept: 'Restaurant', desc, amount: s.total, method: s.method, staff: s.staff, date: parseTxDate(s.date) });
    });
    (poolSales || []).forEach((s) => out.push({
      id: s.id, dept: 'Pool Bar', desc: `${s.item} ×${s.qty}`, amount: s.total, method: s.method, staff: s.staff, date: parseTxDate(s.time),
    }));
    return out.filter((t) => t.date).sort((a, b) => b.date - a.date);
  }

  function computeShiftTotals(transactions, key) {
    const rows = (transactions || []).filter((t) => shiftKeyFor(t.date) === key);
    const rooms = rows.filter((t) => t.dept === 'Rooms').reduce((s, t) => s + t.amount, 0);
    const restaurant = rows.filter((t) => t.dept === 'Restaurant').reduce((s, t) => s + t.amount, 0);
    const poolbar = rows.filter((t) => t.dept === 'Pool Bar').reduce((s, t) => s + t.amount, 0);
    const gross = rooms + restaurant + poolbar;
    // "Complimentary" transactions are comps/discounts — gross includes them, net doesn't
    const discounts = rows.filter((t) => t.method === 'Complimentary').reduce((s, t) => s + t.amount, 0);
    return { key, rows, count: rows.length, rooms, restaurant, poolbar, gross, discounts, net: gross - discounts };
  }

  function cashSalesFor(transactions, dept, key) {
    return (transactions || [])
      .filter((t) => t.dept === dept && t.method === 'Cash' && shiftKeyFor(t.date) === key)
      .reduce((s, t) => s + t.amount, 0);
  }
  function expectedCashFor(shift, transactions) {
    return (shift.openingFloat || 0) + cashSalesFor(transactions, shift.dept, shift.key);
  }
  function shiftHealth(shift, transactions, tolerance) {
    if (shift.status !== 'reconciled') return 'open';
    const v = shift.actualCash - expectedCashFor(shift, transactions);
    return Math.abs(v) <= tolerance ? 'ok' : 'bad';
  }

  /* ══════════════════════════════════════════════════════════════════
     RANGE + DAILY AGGREGATION — powers accounting-breakdown.html.
     Pure functions: pass in the transactions you already have (from
     buildTransactions or getAllTransactions) plus a from/to range and
     'shift' | 'calendar' mode.
  ══════════════════════════════════════════════════════════════════ */
  function filterTransactionsByRange(transactions, from, to, mode) {
    return (transactions || []).filter((t) => {
      const k = keyForMode(t.date, mode);
      return (!from || k >= from) && (!to || k <= to);
    });
  }

  function deptTotals(rows) {
    const rooms = rows.filter((t) => t.dept === 'Rooms').reduce((s, t) => s + t.amount, 0);
    const restaurant = rows.filter((t) => t.dept === 'Restaurant').reduce((s, t) => s + t.amount, 0);
    const poolbar = rows.filter((t) => t.dept === 'Pool Bar').reduce((s, t) => s + t.amount, 0);
    return { rooms, restaurant, poolbar, total: rooms + restaurant + poolbar };
  }

  function methodTotals(rows, methods) {
    const list = methods || AccountingSeedRef().PAYMENT_METHODS || ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];
    const out = {};
    list.forEach((m) => { out[m] = 0; });
    rows.forEach((t) => { out[t.method] = (out[t.method] || 0) + t.amount; });
    return out;
  }

  // One row per day (or per shift-day), each with per-department totals,
  // a grand total, a transaction count, and a per-payment-method breakdown.
  function buildDailyBreakdown(transactions, mode) {
    const map = {};
    (transactions || []).forEach((t) => {
      const k = keyForMode(t.date, mode);
      if (!map[k]) map[k] = { key: k, Rooms: 0, Restaurant: 0, 'Pool Bar': 0, total: 0, count: 0, methods: {} };
      map[k][t.dept] = (map[k][t.dept] || 0) + t.amount;
      map[k].total += t.amount;
      map[k].count += 1;
      map[k].methods[t.method] = (map[k].methods[t.method] || 0) + t.amount;
    });
    return Object.values(map);
  }

  /* ══════════════════════════════════════════════════════════════════
     SHIFT-DETAIL HELPERS — powers accounting-reconciliation.html /
     ShiftReconciliationDetail. All pure except getShiftDetail(), which
     reads current service state (call loadAll() first).
  ══════════════════════════════════════════════════════════════════ */
  function findShift(shifts, key, dept) {
    return (shifts || []).find((s) => s.key === key && s.dept === dept);
  }
  function txForShift(transactions, dept, key) {
    return (transactions || []).filter((t) => t.dept === dept && shiftKeyFor(t.date) === key);
  }
  function grossForShift(transactions, dept, key) {
    return txForShift(transactions, dept, key).reduce((s, t) => s + t.amount, 0);
  }
  function txCountForShift(transactions, dept, key) {
    return txForShift(transactions, dept, key).length;
  }
  function methodBreakdownForShift(transactions, dept, key) {
    const rows = {};
    txForShift(transactions, dept, key).forEach((t) => { rows[t.method] = (rows[t.method] || 0) + t.amount; });
    return rows;
  }
  function historyForShift(reconLog, dept, key) {
    return (reconLog || [])
      .filter((h) => h.key === key && h.dept === dept)
      .sort((a, b) => parseTxDate(b.date) - parseTxDate(a.date));
  }

  // Full detail payload for ShiftReconciliationDetail — everything the
  // widget needs, built from current service state. Page code becomes:
  //   const payload = AccountingData.getShiftDetail(dept, key);
  //   shiftDetail.open(payload, { onReconcile: ..., onSuccess: ... });
  function getShiftDetail(dept, key) {
    const transactions = buildTransactions(state.roomTx, state.restSales, state.poolSales);
    const s = findShift(state.shifts, key, dept);
    if (!s) return null;
    const history = historyForShift(state.reconLog, dept, key);
    const mb = methodBreakdownForShift(transactions, dept, key);
    const tolerance = (global.AccountingSeed && global.AccountingSeed.VARIANCE_TOLERANCE) || 500;
    return {
      dept, key,
      rangeLabel: shiftRangeLabel(key),
      staff: s.staff,
      openingFloat: s.openingFloat,
      txCount: txCountForShift(transactions, dept, key),
      grossSales: grossForShift(transactions, dept, key),
      cashSales: cashSalesFor(transactions, dept, key),
      expectedCash: expectedCashFor(s, transactions),
      status: s.status,
      actualCash: s.actualCash,
      notes: s.notes,
      lastActor: history[0] ? history[0].actor : s.staff,
      varianceTolerance: tolerance,
      methodBreakdown: Object.keys(mb).map((m) => ({ method: m, amount: mb[m] })),
      history,
    };
  }

  /* ── shape validation for shifts pulled from storage — never trust it blindly ── */
  function isValidShift(s, departments) {
    return s
      && typeof s.key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.key)
      && typeof s.dept === 'string' && departments.includes(s.dept)
      && typeof s.staff === 'string' && s.staff.trim().length > 0
      && typeof s.openingFloat === 'number'
      && (s.status === 'open' || s.status === 'reconciled')
      && (s.status === 'open' || typeof s.actualCash === 'number'); // reconciled shifts must have a resolved number, never the literal 'auto'
  }
  function isValidShiftsArray(arr, departments) {
    return Array.isArray(arr) && arr.length > 0 && arr.every((s) => isValidShift(s, departments));
  }

  /* ── state + listeners (same pattern as PoolBarService) ── */
  const state = {
    roomTx: [], restSales: [], poolSales: [], shifts: [], reconLog: [],
    income: [], expenses: [],
    ready: false,
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[AccountingService] listener error', e); } }); }

  function AccountingSeedRef() { return global.AccountingSeed || {}; }

  function seed() {
    const s = AccountingSeedRef();
    return {
      roomTx: s.DEMO_ROOM_TX || [],
      restSales: s.DEMO_RESTAURANT_SALES || [],
      poolSales: s.DEMO_POOLBAR_SALES || [],
      shifts: s.DEMO_SHIFTS || [],
      income: s.DEMO_INCOME || [],
      expenses: s.DEMO_EXPENSES || [],
    };
  }

  /* ── seed shared storage from AccountingSeed the first time it's empty ── */
  let _seeded = false;
  let _seedPromise = null;
  function ensureSeeded() {
    if (_seeded) return Promise.resolve();
    if (_seedPromise) return _seedPromise;

    _seedPromise = (async () => {
      const seedData = seed();
      const departments = (global.AccountingSeed && global.AccountingSeed.DEPARTMENTS) || ['Rooms', 'Restaurant', 'Pool Bar'];
      if (!global.AccountingSeed || !global.AccountingSeed.DEMO_ROOM_TX) {
        console.error('[AccountingData] Load data/accounting-seed.js first');
        return;
      }

      let roomTx = await loadShared(KEYS.ROOM_TX, null);
      if (!Array.isArray(roomTx) || !roomTx.length) { roomTx = seedData.roomTx; await saveShared(KEYS.ROOM_TX, roomTx); }

      let rest = await loadShared(KEYS.REST, null);
      if (!Array.isArray(rest) || !rest.length) { rest = seedData.restSales; await saveShared(KEYS.REST, rest); }

      let pool = await loadShared(KEYS.POOLBAR, null);
      if (!Array.isArray(pool) || !pool.length) { pool = seedData.poolSales; await saveShared(KEYS.POOLBAR, pool); }

      let shifts = await loadShared(KEYS.SHIFTS, null);
      if (!isValidShiftsArray(shifts, departments)) {
        const transactions = buildTransactions(roomTx, rest, pool);
        shifts = seedData.shifts.map((s) => ({ ...s }));
        shifts.forEach((s) => {
          if (s.actualCash === 'auto') {
            s.actualCash = expectedCashFor(s, transactions) + (s.demoVariance || 0);
          }
          delete s.demoVariance;
        });
        await saveShared(KEYS.SHIFTS, shifts);
      }

      let log = await loadShared(KEYS.RECON_LOG, null);
      if (!Array.isArray(log)) {
        const transactions = buildTransactions(roomTx, rest, pool);
        log = shifts.filter((s) => s.status === 'reconciled').map((s) => {
          const expected = expectedCashFor(s, transactions);
          return {
            key: s.key, dept: s.dept, actor: s.staff, actualCash: s.actualCash,
            expected, variance: s.actualCash - expected, notes: s.notes || '', type: 'initial',
            date: (() => { const [y, m, d] = s.key.split('-').map(Number); return `${pad2(d)}/${pad2(m)}/${String(y).slice(-2)} 09:05 AM`; })(),
          };
        });
        await saveShared(KEYS.RECON_LOG, log);
      }

      let income = await loadShared(KEYS.INCOME, null);
      if (!Array.isArray(income) || !income.length) { income = seedData.income; await saveShared(KEYS.INCOME, income); }

      let expenses = await loadShared(KEYS.EXPENSES, null);
      if (!Array.isArray(expenses) || !expenses.length) { expenses = seedData.expenses; await saveShared(KEYS.EXPENSES, expenses); }

      if (!lsGet(KEYS.SESSION)) setSession(CONFIG.DEMO_SESSION);
      _seeded = true;
    })();

    return _seedPromise;
  }

  /* ── loadAll — same pattern as PoolBarService.loadAll() ── */
  async function loadAll() {
    await ensureSeeded();
    const [roomTx, restSales, poolSales, shifts, reconLog, income, expenses] = await Promise.all([
      loadShared(KEYS.ROOM_TX, []),
      loadShared(KEYS.REST, []),
      loadShared(KEYS.POOLBAR, []),
      loadShared(KEYS.SHIFTS, []),
      loadShared(KEYS.RECON_LOG, []),
      loadShared(KEYS.INCOME, []),
      loadShared(KEYS.EXPENSES, []),
    ]);
    state.roomTx = roomTx;
    state.restSales = restSales;
    state.poolSales = poolSales;
    state.shifts = shifts;
    state.reconLog = reconLog;
    state.income = income;
    state.expenses = expenses;
    state.ready = true;
    emitChange('load');
    return state;
  }

  /* ── persist — same pattern as PoolBarService.persist() ── */
  async function persist(keys) {
    const map = {
      roomTx: KEYS.ROOM_TX, restSales: KEYS.REST, poolSales: KEYS.POOLBAR,
      shifts: KEYS.SHIFTS, reconLog: KEYS.RECON_LOG,
      income: KEYS.INCOME, expenses: KEYS.EXPENSES,
    };
    const list = keys && keys.length ? keys : Object.keys(map);
    await Promise.all(list.map(k => saveShared(map[k], state[k])));
  }

  /* ── getters ── */
  async function getRoomTransactions() { await ensureSeeded(); return clone(await loadShared(KEYS.ROOM_TX, [])); }
  async function getRestaurantSales()  { await ensureSeeded(); return clone(await loadShared(KEYS.REST, [])); }
  async function getPoolBarSales()     { await ensureSeeded(); return clone(await loadShared(KEYS.POOLBAR, [])); }
  async function getShifts()           { await ensureSeeded(); return clone(await loadShared(KEYS.SHIFTS, [])); }
  async function getReconciliationLog(){ await ensureSeeded(); return clone(await loadShared(KEYS.RECON_LOG, [])); }
  async function getIncome()           { await ensureSeeded(); return clone(await loadShared(KEYS.INCOME, [])); }
  async function getExpenses()         { await ensureSeeded(); return clone(await loadShared(KEYS.EXPENSES, [])); }

  async function getAccountingData() {
    await ensureSeeded();
    const [roomTx, restSales, poolSales, shifts, reconLog, income, expenses] = await Promise.all([
      getRoomTransactions(), getRestaurantSales(), getPoolBarSales(), getShifts(), getReconciliationLog(), getIncome(), getExpenses(),
    ]);
    return { roomTx, restSales, poolSales, shifts, reconLog, income, expenses, session: clone(getSession()) };
  }

  /* ── mutations: shifts ── */
  async function openShift(dept, staff, openingFloat) {
    await delay(100);
    await ensureSeeded();
    const session = getSession();
    if (!requirePerm(session, 'canCreate', 'accounting')) deny("You don't have permission to open a new shift.");

    const shifts = await loadShared(KEYS.SHIFTS, []);
    const key = shiftKeyFor(new Date());
    if (shifts.find((s) => s.key === key && s.dept === dept)) {
      throw new Error('A shift for this department is already open today.');
    }
    const row = { key, dept, staff: staff || session.name || 'Front Desk', openingFloat: Number(openingFloat) || 0, status: 'open' };
    shifts.push(row);
    await saveShared(KEYS.SHIFTS, shifts);
    state.shifts = shifts;
    emitChange('shift:open');
    return clone(row);
  }

  async function reconcileShift(payload) {
    await delay(150);
    await ensureSeeded();
    const session = getSession();

    const shifts = await loadShared(KEYS.SHIFTS, []);
    const idx = shifts.findIndex((s) => s.key === payload.key && s.dept === payload.dept);
    if (idx < 0) throw new Error('Shift not found');
    const shift = shifts[idx];

    const isCorrection = shift.status === 'reconciled';
    if (isCorrection) {
      if (!requirePerm(session, 'canEdit', 'accounting', shift)) deny("You don't have permission to correct a reconciled shift.");
    } else {
      if (!requirePerm(session, 'canApprove', 'accounting')) deny("You don't have permission to reconcile shifts.");
    }

    const [roomTx, rest, pool] = await Promise.all([
      loadShared(KEYS.ROOM_TX, []), loadShared(KEYS.REST, []), loadShared(KEYS.POOLBAR, []),
    ]);
    const transactions = buildTransactions(roomTx, rest, pool);
    const expected = expectedCashFor(shift, transactions);
    const actualCash = Number(payload.actualCash) || 0;
    const variance = actualCash - expected;

    shift.actualCash = actualCash;
    shift.status = 'reconciled';
    shift.notes = payload.notes || '';
    shifts[idx] = shift;

    const log = await loadShared(KEYS.RECON_LOG, []);
    const entry = {
      key: shift.key, dept: shift.dept, actor: payload.actor || session.name || 'Front Desk',
      actualCash, expected, variance, notes: shift.notes,
      type: isCorrection ? 'correction' : 'initial', date: nowStamp(),
    };
    log.unshift(entry);

    await Promise.all([saveShared(KEYS.SHIFTS, shifts), saveShared(KEYS.RECON_LOG, log)]);
    state.shifts = shifts;
    state.reconLog = log;
    emitChange('shift:reconcile');
    return { shift: clone(shift), entry: clone(entry), expected, variance, isCorrection, health: Math.abs(variance) <= ((global.AccountingSeed && global.AccountingSeed.VARIANCE_TOLERANCE) || 500) ? 'ok' : 'bad', rangeLabel: shiftRangeLabel(shift.key) };
  }

  /* ── P&L: bulk setters (kept for back-compat) + row-level CRUD ── */
  async function saveIncome(income) {
    await ensureSeeded();
    await saveShared(KEYS.INCOME, income);
    state.income = income;
    emitChange('income:save');
    return clone(income);
  }
  async function saveExpenses(expenses) {
    await ensureSeeded();
    await saveShared(KEYS.EXPENSES, expenses);
    state.expenses = expenses;
    emitChange('expenses:save');
    return clone(expenses);
  }

  function requirePnLPerm(action) {
    const session = getSession();
    if (!requirePerm(session, action, 'accounting')) {
      const verb = action === 'canCreate' ? 'add' : action === 'canEdit' ? 'edit' : 'delete';
      deny(`You don't have permission to ${verb} P&L entries.`);
    }
    return session;
  }

  async function addIncome(entry) {
    await ensureSeeded();
    const session = requirePnLPerm('canCreate');
    const income = await loadShared(KEYS.INCOME, []);
    const row = { id: uid('inc'), date: entry.date, department: entry.department, description: entry.description, amount: Number(entry.amount) || 0, recordedBy: entry.recordedBy || session.name || '' };
    income.push(row);
    await saveShared(KEYS.INCOME, income);
    state.income = income;
    emitChange('income:add');
    return clone(row);
  }
  async function updateIncome(id, patch) {
    await ensureSeeded();
    requirePnLPerm('canEdit');
    const income = await loadShared(KEYS.INCOME, []);
    const row = income.find((e) => e.id === id);
    if (!row) throw new Error('Income entry not found');
    Object.assign(row, patch);
    row.amount = Number(row.amount) || 0;
    await saveShared(KEYS.INCOME, income);
    state.income = income;
    emitChange('income:update');
    return clone(row);
  }
  async function deleteIncome(id) {
    await ensureSeeded();
    requirePnLPerm('canDelete');
    const income = (await loadShared(KEYS.INCOME, [])).filter((e) => e.id !== id);
    await saveShared(KEYS.INCOME, income);
    state.income = income;
    emitChange('income:delete');
    return true;
  }

  async function addExpense(entry) {
    await ensureSeeded();
    const session = requirePnLPerm('canCreate');
    const expenses = await loadShared(KEYS.EXPENSES, []);
    const row = { id: uid('exp'), date: entry.date, category: entry.category, description: entry.description, amount: Number(entry.amount) || 0, recordedBy: entry.recordedBy || session.name || '' };
    expenses.push(row);
    await saveShared(KEYS.EXPENSES, expenses);
    state.expenses = expenses;
    emitChange('expenses:add');
    return clone(row);
  }
  async function updateExpense(id, patch) {
    await ensureSeeded();
    requirePnLPerm('canEdit');
    const expenses = await loadShared(KEYS.EXPENSES, []);
    const row = expenses.find((e) => e.id === id);
    if (!row) throw new Error('Expense entry not found');
    Object.assign(row, patch);
    row.amount = Number(row.amount) || 0;
    await saveShared(KEYS.EXPENSES, expenses);
    state.expenses = expenses;
    emitChange('expenses:update');
    return clone(row);
  }
  async function deleteExpense(id) {
    await ensureSeeded();
    requirePnLPerm('canDelete');
    const expenses = (await loadShared(KEYS.EXPENSES, [])).filter((e) => e.id !== id);
    await saveShared(KEYS.EXPENSES, expenses);
    state.expenses = expenses;
    emitChange('expenses:delete');
    return true;
  }

  function filterByDateRange(list, from, to, field) {
    const f = field || 'date';
    return (list || []).filter((row) => {
      const d = row[f];
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  async function resetDemo() {
    await delay(60);
    await Promise.all([
      saveShared(KEYS.ROOM_TX, []),
      saveShared(KEYS.REST, []),
      saveShared(KEYS.POOLBAR, []),
      saveShared(KEYS.SHIFTS, []),
      saveShared(KEYS.RECON_LOG, []),
      saveShared(KEYS.INCOME, []),
      saveShared(KEYS.EXPENSES, []),
    ]);
    _seeded = false;
    _seedPromise = null;
    await ensureSeeded();
    return getAccountingData();
  }

  /* ══════════════════════════════════════════════════════════════════
     UNIFIED TRANSACTIONS FEED — powers accounting-transactions.html.
     Normalizes Rooms/Restaurant/Pool Bar (Accounting's own ledgers)
     PLUS read-only Booking + Gym payment data into one shape:
       { id, dept, desc, sub, date, method, amount, status, staff, source }
     ('status' is 'completed' | 'pending' | 'voided'; dept is 'Rooms' |
     'Restaurant' | 'Bar' | 'Pool Bar' | 'Gym'.)
     Booking/Gym demo fallbacks are small and stay local to this file —
     those modules own their real seed data; Accounting only displays a
     read-only view of their payments. When 'booking-bookings' /
     'gym-members' exist in shared storage (written by those modules),
     those are used instead automatically.
  ══════════════════════════════════════════════════════════════════ */
  const _FALLBACK_BOOKINGS = [
    { room: '101', guest: 'Mr. Adeyemi, Tunde', rate: 35000, discount: 0, paid: 140000, payMethod: 'Transfer', payStatus: 'Fully Paid', recordedBy: 'Emeka S.', checkin: '2026-03-10', checkout: '2026-03-14', status: 'checkedin' },
    { room: '301', guest: 'Chief Dangote, Emeka', rate: 120000, discount: 0, paid: 600000, payMethod: 'Transfer', payStatus: 'Fully Paid', recordedBy: 'Amaka O.', checkin: '2026-03-10', checkout: '2026-03-15', status: 'checkedin' },
  ];
  const _FALLBACK_GYM = [
    { id: 'gm01', name: 'Chidi Nwankwo', planId: 'pl02', joined: '2026-03-10', amountPaid: 35000 },
    { id: 'gm06', name: 'Ngozi Okafor', planId: 'pl04', joined: '2026-03-17', amountPaid: 60000 },
  ];

  // A restaurant sale is classified as 'Bar' rather than 'Restaurant'
  // when its line items look drink-oriented — same heuristic every
  // page used to hand-roll individually.
  function classifyRestaurantDept(items) {
    const looksLikeDrinks = (items || []).some((i) => /chapman|heineken|guinness|drink|beer|wine|cocktail/i.test(i.meal || i.name || ''));
    return looksLikeDrinks ? 'Bar' : 'Restaurant';
  }

  function _fromPoolBar(sales) {
    return (sales || []).map((s) => ({
      id: s.id, dept: 'Pool Bar',
      desc: (s.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ') || (s.item ? `${s.item} ×${s.qty}` : 'Pool Bar Sale'),
      sub: s.table || '', date: parseAnyDate(s.date || s.time), method: s.method || '—',
      amount: s.total || 0, status: s.status === 'voided' ? 'voided' : 'completed',
      staff: s.staff || '—', source: KEYS.POOLBAR,
    }));
  }
  function _fromRestaurant(sales) {
    return (sales || []).map((s) => {
      const dept = classifyRestaurantDept(s.items);
      return {
        id: s.id, dept,
        desc: (s.items || []).map((i) => `${i.meal} ×${i.qty}`).join(', ') || 'Restaurant Sale',
        sub: s.table || '', date: parseAnyDate(s.date), method: s.method || '—',
        amount: s.total || 0, status: s.status === 'voided' ? 'voided' : 'completed',
        staff: s.staff || '—', source: KEYS.REST,
      };
    });
  }
  function _fromBookings(bookings) {
    return (bookings || []).filter((b) => b.guest && (b.paid || 0) > 0).map((b) => ({
      id: 'RM-' + b.room + '-' + (b.checkin || '').replace(/-/g, ''), dept: 'Rooms',
      desc: `Room ${b.room} — ${b.guest}`, sub: `${b.checkin || '—'} → ${b.checkout || '—'}`,
      date: parseAnyDate(b.checkin) || new Date(), method: b.payMethod || '—',
      amount: b.paid || 0, status: b.payStatus === 'Pending' ? 'pending' : 'completed',
      staff: b.recordedBy || '—', source: KEYS.BOOKINGS,
    }));
  }
  function _fromGym(members) {
    return (members || []).filter((m) => (m.amountPaid || 0) > 0).map((m) => ({
      id: 'GYM-' + m.id, dept: 'Gym',
      desc: `Membership Payment — ${m.name}`, sub: m.planId || '',
      date: parseAnyDate(m.joined) || new Date(), method: 'Cash',
      amount: m.amountPaid || 0, status: 'completed',
      staff: 'Gym Attendant', source: KEYS.GYM,
    }));
  }

  // Also folds Accounting's own Room/Restaurant/Pool Bar ledgers in,
  // via the same normalized shape, so Transactions shows every source
  // in one consistent list without the page touching raw ledger rows.
  async function getAllTransactions() {
    await ensureSeeded();
    const [roomTx, restSales, poolSales, bookings, gym] = await Promise.all([
      loadShared(KEYS.ROOM_TX, []),
      loadShared(KEYS.REST, []),
      loadShared(KEYS.POOLBAR, []),
      loadShared(KEYS.BOOKINGS, _FALLBACK_BOOKINGS),
      loadShared(KEYS.GYM, _FALLBACK_GYM),
    ]);
    // Rooms comes from Booking's own payment ledger (bookings), not
    // accounting-room-tx (that ledger only feeds shift reconciliation
    // expected-cash math) — matches the original page's source list.
    const rows = [
      ..._fromPoolBar(poolSales),
      ..._fromRestaurant(restSales),
      ..._fromBookings(bookings),
      ..._fromGym(gym),
    ].filter((t) => t.date);
    rows.sort((a, b) => b.date - a.date);
    return rows;
  }

  function transactionsKPIs(list) {
    const completed = list.filter((t) => t.status === 'completed');
    const pending = list.filter((t) => t.status === 'pending');
    const voided = list.filter((t) => t.status === 'voided');
    const totalRevenue = completed.reduce((s, t) => s + t.amount, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayRevenue = completed.filter((t) => t.date && t.date >= today).reduce((s, t) => s + t.amount, 0);
    return { total: list.length, completed: completed.length, pending: pending.length, voided: voided.length, totalRevenue, todayRevenue };
  }

  // Pure filter + sort — pages hand over raw filter values (from their
  // own inputs) and get back the matching, sorted rows.
  //   filters = { q, dept, method, status, from, to, sortKey, sortDir }
  function queryTransactions(list, filters) {
    const f = filters || {};
    const q = (f.q || '').toLowerCase();
    let rows = (list || []).filter((t) => {
      const mq = !q || (t.id || '').toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q) || (t.staff || '').toLowerCase().includes(q);
      const mDept = !f.dept || t.dept === f.dept;
      const mMethod = !f.method || t.method === f.method;
      const mStatus = !f.status || t.status === f.status;
      let mDate = true;
      if (f.from || f.to) {
        const ds = t.date ? ymd(t.date) : '';
        if (f.from && ds < f.from) mDate = false;
        if (f.to && ds > f.to) mDate = false;
      }
      return mq && mDept && mMethod && mStatus && mDate;
    });
    const sortKey = f.sortKey || 'date';
    const sortDir = f.sortDir || 'desc';
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date - b.date;
      else if (sortKey === 'amount') cmp = a.amount - b.amount;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return rows;
  }

  /* ── KPI helpers ── */
  function dashboardKPIs() {
    const openShifts = state.shifts.filter(s => s.status === 'open').length;
    const reconciled = state.shifts.filter(s => s.status === 'reconciled').length;
    const variance = state.shifts.filter(s => s.status === 'reconciled' && Math.abs(s.actualCash - expectedCashFor(s, buildTransactions(state.roomTx, state.restSales, state.poolSales))) > (global.AccountingSeed?.VARIANCE_TOLERANCE || 500)).length;
    const totalRevenue = buildTransactions(state.roomTx, state.restSales, state.poolSales).reduce((s, t) => s + t.amount, 0);
    return { openShifts, reconciled, variance, totalRevenue };
  }

  function shiftKPIs() {
    const open = state.shifts.filter(s => s.status === 'open').length;
    const reconciled = state.shifts.filter(s => s.status === 'reconciled').length;
    const variance = state.shifts.filter(s => s.status === 'reconciled' && Math.abs(s.actualCash - expectedCashFor(s, buildTransactions(state.roomTx, state.restSales, state.poolSales))) > (global.AccountingSeed?.VARIANCE_TOLERANCE || 500)).length;
    return { open, reconciled, variance };
  }

  function pnlKPIs(incomeList, expensesList) {
    const inc = incomeList || state.income;
    const exp = expensesList || state.expenses;
    const totalIncome = inc.reduce((s, e) => s + e.amount, 0);
    const totalExpenses = exp.reduce((s, e) => s + e.amount, 0);
    const grossProfit = totalIncome; // = Total Income for now (no per-item cost tracked yet)
    const netProfit = grossProfit - totalExpenses;
    const netMargin = totalIncome > 0 ? (netProfit / totalIncome * 100) : 0;
    return { totalIncome, totalExpenses, grossProfit, netProfit, netMargin };
  }

  function listStaffNames() {
    const names = new Set();
    state.roomTx.forEach(t => { if (t.staff) names.add(t.staff); });
    state.restSales.forEach(s => { if (s.staff) names.add(s.staff); });
    state.poolSales.forEach(s => { if (s.staff) names.add(s.staff); });
    state.shifts.forEach(s => { if (s.staff) names.add(s.staff); });
    return [...names].sort();
  }

  function isManagerLike(session) {
    if (!session) return false;
    return session.role === 'admin' || session.role === 'manager';
  }

  global.AccountingData = {
    KEYS,
    CONFIG,
    configure,
    getSession,
    setSession,

    state,
    onChange,
    loadAll,
    persist,
    seed,

    getRoomTransactions,
    getRestaurantSales,
    getPoolBarSales,
    getShifts,
    getReconciliationLog,
    getIncome,
    getExpenses,
    getAccountingData,

    openShift,
    reconcileShift,
    saveIncome,
    saveExpenses,
    addIncome,
    updateIncome,
    deleteIncome,
    addExpense,
    updateExpense,
    deleteExpense,
    filterByDateRange,
    resetDemo,

    buildTransactions,
    computeShiftTotals,
    cashSalesFor,
    expectedCashFor,
    shiftHealth,

    // range + daily aggregation (Revenue Breakdown)
    filterTransactionsByRange,
    buildDailyBreakdown,
    deptTotals,
    methodTotals,

    // shift detail (Reconciliation)
    findShift,
    txForShift,
    grossForShift,
    txCountForShift,
    methodBreakdownForShift,
    historyForShift,
    getShiftDetail,
    isValidShift,
    isValidShiftsArray,

    // unified cross-module transactions feed (Transactions)
    getAllTransactions,
    queryTransactions,
    transactionsKPIs,
    classifyRestaurantDept,

    shiftKeyFor,
    calendarKeyFor,
    keyForMode,
    parseTxDate,
    parseAnyDate,
    uid,
    fmtN,
    fmtTime,
    fmtDate,
    fmtDateTime,
    nowStamp,
    todayDDMMYY,
    fmtHourLabel,
    shortDateLabel,
    fullDateLabel,
    shiftRangeLabel,
    dayLabel,
    currentShiftKey,

    dashboardKPIs,
    shiftKPIs,
    pnlKPIs,
    listStaffNames,
    isManagerLike,
    can,
    canApprove,
  };
})(window);