/**
 * services/accounting-service.js — Shared data + business logic for Accounting
 *
 * PRODUCTION VERSION: talks to the real backend (routes/accounting.js →
 * controllers/accountingController.js) over HTTP. No demo/localStorage.
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
    BOOKINGS: 'booking-bookings',
    GYM: 'gym-members',
  };

  const SHIFT_START_HOUR = 9;

  const CONFIG = {
    API_BASE: '/api/accounting',
  };

  function configure(opts) { Object.assign(CONFIG, opts || {}); }

  /* ═══════════ Token + apiFetch ═══════════ */
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

    return body;
  }

  /* ═══════════ Date / format helpers ═══════════ */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) {
    if (typeof d === 'string') return d.length >= 10 ? d.slice(0, 10) : d;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function shiftKeyFor(dt) {
    const d = new Date(dt);
    if (d.getHours() < SHIFT_START_HOUR) d.setDate(d.getDate() - 1);
    return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  function calendarKeyFor(dt) { return ymd(new Date(dt)); }
  function keyForMode(dt, mode) { return mode === 'calendar' ? calendarKeyFor(dt) : shiftKeyFor(dt); }

  function parseTxDate(str) {
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str.length === 10 ? str + 'T00:00:00' : str);
    const [datePart, timePart, ampm] = String(str).split(' ');
    if (!datePart || !datePart.includes('/')) return null;
    const [d, m, y] = datePart.split('/').map((n) => parseInt(n, 10));
    let hh = 0, mm = 0;
    if (timePart) { const [h, mi] = timePart.split(':').map((n) => parseInt(n, 10)); hh = h; mm = mi || 0; }
    if (ampm) { const u = ampm.toUpperCase(); if (u === 'PM' && hh < 12) hh += 12; if (u === 'AM' && hh === 12) hh = 0; }
    const fullYear = y < 100 ? 2000 + y : y;
    return new Date(fullYear, m - 1, d, hh, mm);
  }
  function parseAnyDate(str) { return parseTxDate(str); }

  function fmtN(n) { return '\u20A6' + Math.round(n || 0).toLocaleString('en-NG'); }
  function fmtTime(d) { return d ? d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : '\u2014'; }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014'; }
  function fmtDateTime(d) { return d ? (fmtDate(d) + ' \u00B7 ' + fmtTime(d)) : '\u2014'; }
  function nowStamp() {
    return new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  }
  function todayDDMMYY() {
    const d = new Date();
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(-2);
  }
  function fmtHourLabel(h) {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ':00 ' + suffix;
  }
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
    return start.toLocaleDateString('en-GB', opt) + ', ' + fmtTime(start) + ' \u2192 ' + end.toLocaleDateString('en-GB', opt) + ', ' + fmtTime(end);
  }
  function dayLabel(key, mode) {
    const [y, m, d] = key.split('-').map(Number);
    if (mode === 'shift') {
      const start = new Date(y, m - 1, d, SHIFT_START_HOUR, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const opt = { day: 'numeric', month: 'short' };
      return start.toLocaleDateString('en-GB', opt) + ' \u2192 ' + end.toLocaleDateString('en-GB', opt);
    }
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function currentShiftKey(transactions) {
    if (!transactions || !transactions.length) return shiftKeyFor(new Date());
    return shiftKeyFor(transactions[0].date);
  }

  function uid(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ═══════════ Pure helpers ═══════════ */
  function buildTransactions(roomTx, restSales, poolSales) {
    const out = [];
    (roomTx || []).forEach((r) => out.push({
      id: r.id, dept: 'Rooms', desc: r.desc, amount: r.amount, method: r.method, staff: r.staff, date: parseTxDate(r.date),
    }));
    (restSales || []).filter((s) => s.status !== 'voided').forEach((s) => {
      const desc = (s.items || []).map((i) => (i.meal || i.name) + ' \u00D7' + i.qty).join(', ') || 'Restaurant sale';
      out.push({ id: s.id, dept: 'Restaurant', desc, amount: s.total, method: s.method, staff: s.staff, date: parseTxDate(s.date) });
    });
    (poolSales || []).forEach((s) => out.push({
      id: s.id, dept: 'Pool Bar', desc: (s.item || s.name || 'Pool Bar') + ' \u00D7' + (s.qty || 1), amount: s.total, method: s.method, staff: s.staff, date: parseTxDate(s.time || s.date),
    }));
    return out.filter((t) => t.date).sort((a, b) => b.date - a.date);
  }

  function computeShiftTotals(transactions, key) {
    const rows = (transactions || []).filter((t) => shiftKeyFor(t.date) === key);
    const rooms = rows.filter((t) => t.dept === 'Rooms').reduce((s, t) => s + t.amount, 0);
    const restaurant = rows.filter((t) => t.dept === 'Restaurant').reduce((s, t) => s + t.amount, 0);
    const poolbar = rows.filter((t) => t.dept === 'Pool Bar').reduce((s, t) => s + t.amount, 0);
    const gross = rooms + restaurant + poolbar;
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

  const PAY_METHODS = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];
  function methodTotals(rows, methods) {
    const list = methods || PAY_METHODS;
    const out = {};
    list.forEach((m) => { out[m] = 0; });
    rows.forEach((t) => { out[t.method] = (out[t.method] || 0) + t.amount; });
    return out;
  }

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

  /* ═══════════ Shift detail helpers ═══════════ */
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
  function getShiftDetail(dept, key) {
    const transactions = buildTransactions(state.roomTx, state.restSales, state.poolSales);
    const s = findShift(state.shifts, key, dept);
    if (!s) return null;
    const mb = methodBreakdownForShift(transactions, dept, key);
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
      notes: s.notes || '',
      varianceTolerance: 500,
      methodBreakdown: Object.keys(mb).map((m) => ({ method: m, amount: mb[m] })),
      history: [],
    };
  }
  function isValidShift(s) {
    return s && typeof s.key === 'string' && typeof s.dept === 'string' && typeof s.staff === 'string'
      && typeof s.openingFloat === 'number' && (s.status === 'open' || s.status === 'reconciled');
  }

  /* ═══════════ State ═══════════ */
  const state = {
    roomTx: [], restSales: [], poolSales: [], shifts: [],
    income: [], expenses: [],
    ready: false,
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[AccountingService] listener error', e); } }); }

  /* ═══════════ Normalize backend pnl income → frontend transaction shapes ═══════════ */
  function _splitIncome(income) {
    const roomTx = [], restSales = [], poolSales = [];
    (income || []).forEach((e) => {
      if (e.source === 'booking') {
        roomTx.push({ id: e.id, date: e.date, desc: e.description, amount: e.amount, method: e.method || '', staff: e.recordedBy || '' });
      } else if (e.source === 'Restaurant') {
        const items = (e.description || '').split(', ').map((s) => { const m = s.match(/(.+)\s*\u00D7\s*(\d+)/); return m ? { meal: m[1].trim(), qty: Number(m[2]) } : { meal: s, qty: 1 }; });
        restSales.push({ id: e.id, date: e.date, items, total: e.amount, method: e.method || '', staff: e.recordedBy || '', status: 'completed' });
      } else if (e.source === 'Poolbar') {
        const desc = e.description || '';
        const m = desc.match(/(.+)\s*\u00D7\s*(\d+)/);
        poolSales.push({ id: e.id, time: e.date, item: m ? m[1].trim() : desc, qty: m ? Number(m[2]) : 1, total: e.amount, method: e.method || '', staff: e.recordedBy || '' });
      }
    });
    return { roomTx, restSales, poolSales };
  }

  /* ═══════════ loadAll ═══════════ */
  async function loadAll() {
    const pnlRes = await apiFetch('/pnl?_=' + Date.now());
    const income = pnlRes.income || [];
    const expenses = pnlRes.expenses || [];

    const { roomTx, restSales, poolSales } = _splitIncome(income);

    let shifts = [];
    try {
      const shiftRes = await apiFetch('/shifts?_=' + Date.now());
      shifts = (shiftRes.data || []).map((s) => ({
        key: s.key || ymd(new Date(s.date)),
        dept: s.dept,
        staff: s.staff,
        openingFloat: s.openingFloat || 0,
        status: s.status,
        actualCash: s.actualCash || 0,
        expectedCash: s.expectedCash || 0,
        variance: s.variance || 0,
        notes: s.notes || '',
        _id: s._id,
      }));
    } catch (e) { console.warn('[AccountingService] shifts load failed:', e.message); }

    state.roomTx = roomTx;
    state.restSales = restSales;
    state.poolSales = poolSales;
    state.shifts = shifts;
    state.income = income;
    state.expenses = expenses;
    state.ready = true;
    emitChange('load');
    return state;
  }

  async function getAccountingData() {
    if (!state.ready) await loadAll();
    return {
      roomTx: clone(state.roomTx),
      restSales: clone(state.restSales),
      poolSales: clone(state.poolSales),
      shifts: clone(state.shifts),
      income: clone(state.income),
      expenses: clone(state.expenses),
    };
  }

  /* ═══════════ P&L CRUD ═══════════ */
  function _mapIncomeEntry(e) {
    return { id: e.id || e._id, date: e.date, department: e.department, description: e.description, amount: e.amount, method: e.method || '', recordedBy: e.recordedBy, autoGenerated: e.autoGenerated, source: e.source };
  }
  function _mapExpenseEntry(e) {
    return { id: e.id || e._id, date: e.date, category: e.category, description: e.description, amount: e.amount, recordedBy: e.recordedBy };
  }

  async function addIncome(entry) {
    const res = await apiFetch('/pnl/income', { method: 'POST', body: JSON.stringify(entry) });
    const row = _mapIncomeEntry(res.data);
    state.income.push(row);
    emitChange('income:add');
    return row;
  }
  async function updateIncome(id, patch) {
    const res = await apiFetch('/pnl/income/' + id, { method: 'PUT', body: JSON.stringify(patch) });
    const row = _mapIncomeEntry(res.data);
    const idx = state.income.findIndex((e) => (e.id || '').toString() === id.toString());
    if (idx > -1) state.income[idx] = row;
    emitChange('income:update');
    return row;
  }
  async function deleteIncome(id) {
    await apiFetch('/pnl/income/' + id, { method: 'DELETE' });
    state.income = state.income.filter((e) => (e.id || '').toString() !== id.toString());
    emitChange('income:delete');
    return true;
  }

  async function addExpense(entry) {
    const res = await apiFetch('/pnl/expense', { method: 'POST', body: JSON.stringify(entry) });
    const row = _mapExpenseEntry(res.data);
    state.expenses.push(row);
    emitChange('expenses:add');
    return row;
  }
  async function updateExpense(id, patch) {
    const res = await apiFetch('/pnl/expense/' + id, { method: 'PUT', body: JSON.stringify(patch) });
    const row = _mapExpenseEntry(res.data);
    const idx = state.expenses.findIndex((e) => (e.id || '').toString() === id.toString());
    if (idx > -1) state.expenses[idx] = row;
    emitChange('expenses:update');
    return row;
  }
  async function deleteExpense(id) {
    await apiFetch('/pnl/expense/' + id, { method: 'DELETE' });
    state.expenses = state.expenses.filter((e) => (e.id || '').toString() !== id.toString());
    emitChange('expenses:delete');
    return true;
  }

  async function saveIncome(income) {
    state.income = income;
    emitChange('income:save');
    return clone(income);
  }
  async function saveExpenses(expenses) {
    state.expenses = expenses;
    emitChange('expenses:save');
    return clone(expenses);
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

  /* ═══════════ Shifts ═══════════ */
  async function openShift(dept, staff, openingFloat) {
    const key = shiftKeyFor(new Date());
    const existing = state.shifts.find((s) => s.key === key && s.dept === dept);
    if (existing) throw new Error('A shift for this department is already open today.');

    const res = await apiFetch('/shifts', { method: 'POST', body: JSON.stringify({ key, dept, staff: staff || '', openingFloat: Number(openingFloat) || 0, status: 'open' }) });
    const row = res.data;
    const norm = { key: row.key || key, dept: row.dept, staff: row.staff, openingFloat: row.openingFloat || 0, status: row.status, actualCash: row.actualCash || 0, notes: row.notes || '', _id: row._id };
    state.shifts.push(norm);
    emitChange('shift:open');
    return clone(norm);
  }

  async function reconcileShift(payload) {
    const idx = state.shifts.findIndex((s) => s.key === payload.key && s.dept === payload.dept);
    if (idx < 0) throw new Error('Shift not found');
    const shift = state.shifts[idx];

    const res = await apiFetch('/shifts/' + (shift._id || '') + '/reconcile', {
      method: 'PUT',
      body: JSON.stringify({ actualCash: Number(payload.actualCash) || 0, expectedCash: payload.expectedCash || 0, notes: payload.notes || '' }),
    });
    const row = res.data;
    Object.assign(shift, { actualCash: row.actualCash, expectedCash: row.expectedCash, variance: row.variance, status: row.status, notes: row.notes || payload.notes || '' });
    emitChange('shift:reconcile');
    return { shift: clone(shift), variance: shift.variance, isCorrection: false, health: Math.abs(shift.variance) <= 500 ? 'ok' : 'bad', rangeLabel: shiftRangeLabel(shift.key) };
  }

  /* ═══════════ Unified transactions feed ═══════════ */
  function classifyRestaurantDept(items) {
    const looksLikeDrinks = (items || []).some((i) => /chapman|heineken|guinness|drink|beer|wine|cocktail/i.test(i.meal || i.name || ''));
    return looksLikeDrinks ? 'Bar' : 'Restaurant';
  }

  function _fromPoolBar(sales) {
    return (sales || []).map((s) => ({
      id: s.id, dept: 'Pool Bar',
      desc: (s.items || []).map((i) => (i.name || i.item || '') + ' \u00D7' + (i.qty || 1)).join(', ') || (s.item ? s.item + ' \u00D7' + (s.qty || 1) : 'Pool Bar Sale'),
      sub: s.table || '', date: parseAnyDate(s.date || s.time), method: s.method || '\u2014',
      amount: s.total || 0, status: s.status === 'voided' ? 'voided' : 'completed',
      staff: s.staff || '\u2014', source: KEYS.POOLBAR,
    }));
  }
  function _fromRestaurant(sales) {
    return (sales || []).map((s) => {
      const dept = classifyRestaurantDept(s.items);
      return {
        id: s.id, dept,
        desc: (s.items || []).map((i) => (i.meal || i.name || '') + ' \u00D7' + (i.qty || 1)).join(', ') || 'Restaurant Sale',
        sub: s.table || '', date: parseAnyDate(s.date), method: s.method || '\u2014',
        amount: s.total || 0, status: s.status === 'voided' ? 'voided' : 'completed',
        staff: s.staff || '\u2014', source: KEYS.REST,
      };
    });
  }
  function _fromBookings(bookings) {
    return (bookings || []).filter((b) => b.guest && (b.paid || 0) > 0).map((b) => ({
      id: 'RM-' + b.room + '-' + (b.checkin || '').replace(/-/g, ''), dept: 'Rooms',
      desc: 'Room ' + b.room + ' \u2014 ' + b.guest, sub: (b.checkin || '\u2014') + ' \u2192 ' + (b.checkout || '\u2014'),
      date: parseAnyDate(b.checkin) || new Date(), method: b.payMethod || '\u2014',
      amount: b.paid || 0, status: b.payStatus === 'Pending' ? 'pending' : 'completed',
      staff: b.recordedBy || '\u2014', source: KEYS.BOOKINGS,
    }));
  }
  function _fromGym(members) {
    return (members || []).filter((m) => (m.amountPaid || 0) > 0).map((m) => ({
      id: 'GYM-' + m.id, dept: 'Gym',
      desc: 'Membership Payment \u2014 ' + m.name, sub: m.planId || '',
      date: parseAnyDate(m.joined) || new Date(), method: 'Cash',
      amount: m.amountPaid || 0, status: 'completed',
      staff: 'Gym Attendant', source: KEYS.GYM,
    }));
  }

  async function getAllTransactions() {
    const pnlRes = await apiFetch('/pnl?_=' + Date.now());
    const income = pnlRes.income || [];

    const rows = (income || []).map((e) => ({
      id: e.id, dept: e.source === 'booking' ? 'Rooms' : e.source === 'gym' ? 'Gym' : e.department || 'Other',
      desc: e.description || '', sub: '', date: parseAnyDate(e.date), method: e.method || '\u2014',
      amount: e.amount || 0, status: e.autoGenerated ? 'completed' : 'completed',
      staff: e.recordedBy || '\u2014', source: e.source || '',
    })).filter((t) => t.date);
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

  /* ═══════════ KPI helpers ═══════════ */
  function dashboardKPIs() {
    const openShifts = state.shifts.filter(s => s.status === 'open').length;
    const reconciled = state.shifts.filter(s => s.status === 'reconciled').length;
    const allTx = buildTransactions(state.roomTx, state.restSales, state.poolSales);
    const variance = state.shifts.filter(s => s.status === 'reconciled' && Math.abs(s.actualCash - expectedCashFor(s, allTx)) > 500).length;
    const totalRevenue = allTx.reduce((s, t) => s + t.amount, 0);
    return { openShifts, reconciled, variance, totalRevenue };
  }

  function shiftKPIs() {
    const open = state.shifts.filter(s => s.status === 'open').length;
    const reconciled = state.shifts.filter(s => s.status === 'reconciled').length;
    const allTx = buildTransactions(state.roomTx, state.restSales, state.poolSales);
    const variance = state.shifts.filter(s => s.status === 'reconciled' && Math.abs(s.actualCash - expectedCashFor(s, allTx)) > 500).length;
    return { open, reconciled, variance };
  }

  function pnlKPIs(incomeList, expensesList) {
    const inc = incomeList || state.income;
    const exp = expensesList || state.expenses;
    const totalIncome = inc.reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpenses = exp.reduce((s, e) => s + (e.amount || 0), 0);
    const grossProfit = totalIncome;
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

  function getSession() {
    try { return JSON.parse(localStorage.getItem(KEYS.SESSION) || 'null') || { name: 'Finance Manager', initials: 'FM', role: 'staff', privilege: 'accountant' }; }
    catch (e) { return { name: 'Finance Manager', initials: 'FM', role: 'staff', privilege: 'accountant' }; }
  }
  function setSession(s) { try { localStorage.setItem(KEYS.SESSION, JSON.stringify(s)); } catch (e) { /* */ } }

  global.AccountingData = {
    KEYS, CONFIG, configure,
    getSession, setSession,

    state, onChange, loadAll,
    getAccountingData,

    addIncome, updateIncome, deleteIncome,
    addExpense, updateExpense, deleteExpense,
    saveIncome, saveExpenses,
    filterByDateRange,

    openShift, reconcileShift,

    buildTransactions, computeShiftTotals,
    cashSalesFor, expectedCashFor, shiftHealth,

    filterTransactionsByRange, buildDailyBreakdown, deptTotals, methodTotals,

    findShift, txForShift, grossForShift, txCountForShift, methodBreakdownForShift, getShiftDetail, isValidShift,

    getAllTransactions, queryTransactions, transactionsKPIs, classifyRestaurantDept,

    shiftKeyFor, calendarKeyFor, keyForMode, parseTxDate, parseAnyDate, uid,
    fmtN, fmtTime, fmtDate, fmtDateTime, nowStamp, todayDDMMYY, fmtHourLabel,
    shortDateLabel, fullDateLabel, shiftRangeLabel, dayLabel, currentShiftKey,

    dashboardKPIs, shiftKPIs, pnlKPIs, listStaffNames, isManagerLike,

    PAY_METHODS,
  };
})(window);
