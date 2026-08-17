/**
 * services/kitchen-service.js — Shared data + business logic for the Kitchen module
 * Depends on: data/kitchen-seed.js (window.KitchenSeed), optionally services/permissions.js
 * Load order: kitchen-seed.js, THEN this file, then the page's own <script>.
 */
(function (global) {
  'use strict';

  const KEYS = {
    STOCK: 'kitchen-stock',
    PRODUCTION: 'kitchen-production',
    MOVEMENTS: 'kitchen-movements',
    RECEIVED_REQS: 'kitchen-received-req-lines',
    TRANSFERS: 'kitchen-transfers',
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
      if (r && r.value) { const parsed = JSON.parse(r.value); if (Array.isArray(parsed)) return parsed; if (parsed && typeof parsed === 'object') return parsed; }
    } catch (e) { /* first run */ }
    return fallback;
  }
  async function saveShared(key, value) {
    try { await storage.set(key, JSON.stringify(value), true); return true; }
    catch (e) { console.warn('[KitchenService] sync failed:', key, e); return false; }
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function fmtStamp(date) {
    let h = date.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad2(h)}:${pad2(date.getMinutes())} ${ampm}`;
  }
  function nowStamp() { return fmtStamp(new Date()); }
  function todayDDMMYY() { const d = new Date(); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`; }
  function todayISO() { return new Date().toISOString().split('T')[0]; }

  function stockLevel(i) { return i.qty <= 0 ? 'out' : (i.qty <= i.min ? 'low' : 'ok'); }
  const LEVEL_CHIP = { ok: 'chip-ok', low: 'chip-low', out: 'chip-out' };
  const LEVEL_LABEL = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };

  function nextProductionId(list) {
    let max = 1000;
    (list || []).forEach(p => {
      const idStr = String(p.id || p.no || '');
      const n = parseInt(idStr.replace(/^(KPR-|PROD-)/, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'PROD-' + String(max + 1).padStart(5, '0');
  }

  function nextTransferNo(list) {
    let max = 40;
    (list || []).forEach(t => {
      const n = parseInt((t.transferNo || '').replace('KTN-', ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'KTN-' + String(max + 1).padStart(5, '0');
  }

  const state = {
    stock: [],
    production: [],
    movements: [],
    transfers: [],
    receivedReqLines: {},
    ready: false,
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[KitchenService] listener error', e); } }); }

  function seed() {
    const s = global.KitchenSeed || {};
    return {
      stock: s.DEMO_STOCK || [],
      production: s.DEMO_PRODUCTION || [],
      movements: s.DEMO_MOVEMENTS || [],
      transfers: s.DEMO_TRANSFERS || [],
    };
  }

  function normalizeItem(i) {
    if (!i) return i;
    const cat = i.category || i.cat || 'Grains';
    const cost = Number(i.price != null ? i.price : (i.cost != null ? i.cost : 0));
    i.category = cat;
    i.cat = cat;
    i.price = cost;
    i.cost = cost;
    i.qty = Number(i.qty || 0);
    i.min = Number(i.min || 0);
    return i;
  }

  async function loadAll() {
    const s = seed();
    const [stock, production, movements, transfers, receivedReqLines] = await Promise.all([
      loadShared(KEYS.STOCK, s.stock),
      loadShared(KEYS.PRODUCTION, s.production),
      loadShared(KEYS.MOVEMENTS, s.movements),
      loadShared(KEYS.TRANSFERS, s.transfers),
      loadShared(KEYS.RECEIVED_REQS, {}),
    ]);
    state.stock = (stock || []).map(normalizeItem);
    state.production = production || [];
    state.movements = movements || [];
    state.transfers = transfers || [];
    state.receivedReqLines = receivedReqLines || {};
    state.ready = true;

    await Promise.all([
      saveShared(KEYS.STOCK, state.stock),
      saveShared(KEYS.PRODUCTION, state.production),
      saveShared(KEYS.MOVEMENTS, state.movements),
      saveShared(KEYS.TRANSFERS, state.transfers),
      saveShared(KEYS.RECEIVED_REQS, state.receivedReqLines),
    ]);
    emitChange('load');
    return state;
  }

  async function persist(keys) {
    const map = {
      stock: KEYS.STOCK,
      production: KEYS.PRODUCTION,
      movements: KEYS.MOVEMENTS,
      transfers: KEYS.TRANSFERS,
      receivedReqLines: KEYS.RECEIVED_REQS,
    };
    const list = keys && keys.length ? keys : Object.keys(map);
    await Promise.all(list.map(k => saveShared(map[k], state[k])));
  }

  function findStock(name) {
    if (!name) return null;
    const clean = String(name).toLowerCase().trim();
    return state.stock.find(i => i.name.toLowerCase().trim() === clean);
  }

  /* ── Stock CRUD ── */
  async function addStockItem(raw) {
    const name = (raw.name || '').trim();
    if (!name) throw new Error('Item name is required.');
    if (findStock(name)) throw new Error(`"${name}" is already tracked — edit it instead.`);
    const entry = normalizeItem({
      name: name,
      category: raw.category || raw.cat || 'Grains',
      unit: raw.unit || 'kg',
      qty: raw.qty != null ? Number(raw.qty) : 0,
      min: Number(raw.min) || 0,
      price: raw.price != null ? Number(raw.price) : (raw.cost != null ? Number(raw.cost) : 0),
      batch: raw.batch || '—',
      received: raw.received || todayDDMMYY(),
      desc: raw.desc || '',
    });
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
    normalizeItem(i);
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
    if (qty < 0) throw new Error('Enter a valid quantity.');
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

  function ingredientCost(name, qty) {
    const i = findStock(name);
    return (i ? i.price : 0) * qty;
  }

  /* ── Production Runs ── */
  async function recordProduction({ dish, outputQty, outputUnit, ingredients, staff, notes = '' }) {
    if (!dish || !dish.trim()) throw new Error('Enter the dish or item name.');
    if (!outputQty || outputQty <= 0) throw new Error('Enter how many were produced.');
    if (!ingredients || !ingredients.length) throw new Error('Add at least one ingredient used.');
    if (!staff) throw new Error('Please enter the staff name.');

    const cleanIngredients = ingredients.map(function (ing) {
      const stockItem = findStock(ing.name);
      const qty = Number(ing.qty) || 0;
      if (!stockItem) throw new Error(`"${ing.name}" is not a tracked ingredient.`);
      if (qty <= 0) throw new Error(`Enter a valid quantity for ${ing.name}.`);
      if (qty > stockItem.qty) throw new Error(`Not enough ${ing.name} on hand (have ${stockItem.qty} ${stockItem.unit}).`);
      return { name: stockItem.name, qty, unit: stockItem.unit };
    });

    const cost = cleanIngredients.reduce(function (s, ing) { return s + ingredientCost(ing.name, ing.qty); }, 0);
    const stamp = nowStamp();
    const idStr = nextProductionId(state.production);
    const record = {
      id: idStr,
      no: idStr,
      batchNo: 'BATCH-' + String(Math.floor(Math.random() * 900) + 100),
      dish: dish.trim(),
      outputQty: Number(outputQty),
      outputUnit: outputUnit || 'units',
      meals: [{ name: dish.trim(), qty: Number(outputQty), unit: outputUnit || 'units' }],
      ingredients: cleanIngredients,
      cost,
      staff,
      by: staff,
      notes,
      remarks: notes,
      date: stamp,
      time: stamp.split(' ')[1] + ' ' + (stamp.split(' ')[2] || ''),
      status: 'completed',
      type: 'coo',
    };

    cleanIngredients.forEach(function (ing) {
      const stockItem = findStock(ing.name);
      stockItem.qty = Math.max(0, stockItem.qty - ing.qty);
      state.movements.unshift({ date: stamp, item: ing.name, qtyIn: 0, qtyOut: ing.qty, balance: stockItem.qty, reason: `Production (${record.id})` });
    });

    state.production.unshift(record);
    await persist(['production', 'stock', 'movements']);
    emitChange('production:record');
    return record;
  }

  async function voidProduction(productionId, reason, voidedBy) {
    const p = state.production.find(x => x.id === productionId || x.no === productionId);
    if (!p) throw new Error(`Production run ${productionId} not found.`);
    if (p.status === 'voided') return p;
    const stamp = nowStamp();
    (p.ingredients || []).forEach(function (ing) {
      restoreStock(ing.name, ing.qty, `Voided Production (${p.id || p.no})`);
    });
    p.status = 'voided'; p.voidReason = reason; p.voidDate = stamp; p.voidedBy = voidedBy;
    await persist(['production', 'stock', 'movements']);
    emitChange('production:void');
    return p;
  }

  /* ── Transfers to Restaurant/Poolbar ── */
  async function addTransfer({ meal, quantity, unit, sentBy, remarks = '', productionNo = '', restaurant = 'Main Restaurant / POS' }) {
    if (!meal || !meal.trim()) throw new Error('Please enter a meal.');
    if (!quantity || quantity <= 0) throw new Error('Please enter a valid quantity.');
    if (!sentBy || !sentBy.trim()) throw new Error('Please enter who is sending this transfer.');

    const entry = {
      transferNo: nextTransferNo(state.transfers),
      productionNo: productionNo.trim(),
      meal: meal.trim(),
      quantity: Number(quantity),
      unit: unit || 'Plates',
      kitchen: 'Main Kitchen',
      restaurant: restaurant || 'Main Restaurant / POS',
      sentBy: sentBy.trim(),
      receivedBy: '',
      dateSent: nowStamp(),
      dateReceived: '',
      status: 'sent',
      remarks: remarks.trim(),
    };

    state.transfers.unshift(entry);
    await persist(['transfers']);
    emitChange('transfer:add');
    return entry;
  }

  async function updateTransferStatus(transferNo, status, details = {}) {
    const t = state.transfers.find(x => x.transferNo === transferNo);
    if (!t) throw new Error(`Transfer ${transferNo} not found.`);
    t.status = status;
    if (details.cancelReason) t.cancelReason = details.cancelReason;
    if (details.rejectReason) t.rejectReason = details.rejectReason;
    if (details.receivedBy) t.receivedBy = details.receivedBy;
    if (details.dateReceived) t.dateReceived = details.dateReceived;
    await persist(['transfers']);
    emitChange('transfer:update');
    return t;
  }

  /* ── Requisitions ── */
  async function getKitchenRequisitions() {
    let idx = [];
    try {
      const r = await storage.get('req-index', true);
      idx = r ? JSON.parse(r.value) : [];
    } catch (e) { idx = []; }

    const reqs = [];
    for (const no of idx) {
      try {
        const r = await storage.get(`req:${no}`, true);
        if (r) {
          const parsed = JSON.parse(r.value);
          if (parsed && parsed.dept === 'Kitchen') reqs.push(parsed);
        }
      } catch (e) { /* skip unreadable entry */ }
    }
    return reqs;
  }

  function receivedSoFar(reqNo, itemName) {
    return (state.receivedReqLines[reqNo] && state.receivedReqLines[reqNo][itemName]) || 0;
  }

  async function receiveRequisition(reqNo) {
    let req;
    try {
      const r = await storage.get(`req:${reqNo}`, true);
      req = r ? JSON.parse(r.value) : null;
    } catch (e) { req = null; }
    if (!req || req.dept !== 'Kitchen') throw new Error(`Requisition ${reqNo} not found for Kitchen.`);

    let receivedAny = false;
    (req.items || []).forEach(function (it) {
      const issued = Number(it.issuedQty) || 0;
      const already = receivedSoFar(reqNo, it.name);
      const delta = issued - already;
      if (delta <= 0) return;
      receivedAny = true;

      let stockItem = findStock(it.name);
      if (!stockItem) {
        stockItem = { name: it.name, category: 'Uncategorized', unit: it.unit || 'units', qty: 0, min: 0, price: Number(it.cost) || 0, batch: reqNo, received: todayDDMMYY(), desc: '' };
        state.stock.push(stockItem);
      }
      stockItem.qty += delta;
      stockItem.batch = reqNo;
      stockItem.received = todayDDMMYY();
      state.movements.unshift({ date: nowStamp(), item: stockItem.name, qtyIn: delta, qtyOut: 0, balance: stockItem.qty, reason: `Requisition Received (${reqNo})` });

      state.receivedReqLines[reqNo] = state.receivedReqLines[reqNo] || {};
      state.receivedReqLines[reqNo][it.name] = issued;
    });

    if (!receivedAny) throw new Error('Nothing new to receive on this requisition yet.');

    await persist(['stock', 'movements', 'receivedReqLines']);
    emitChange('requisition:received');
    return req;
  }

  /* ── KPIs ── */
  function dashboardKPIs() {
    const lowStock = state.stock.filter(i => stockLevel(i) !== 'ok').length;
    const todayStr = todayDDMMYY();
    const todayRuns = state.production.filter(p => p.status === 'completed' && (p.date || '').startsWith(todayStr));
    const todayCost = todayRuns.reduce((s, x) => s + (x.cost || 0), 0);
    const units = state.stock.reduce((s, i) => s + i.qty, 0);
    return { lowStock, todayRunsCount: todayRuns.length, todayCost, units, itemCount: state.stock.length };
  }

  function productionKPIs(list) {
    const rows = list || state.production;
    const completed = rows.filter(p => p.status === 'completed' || p.status === 'accepted');
    const voided = rows.filter(p => p.status === 'voided' || p.status === 'rejected');
    const cost = completed.reduce((s, x) => s + (x.cost || 0), 0);
    const outputUnits = completed.reduce((s, x) => s + (x.outputQty || 0), 0);
    return { total: rows.length, completed: completed.length, voided: voided.length, cost, outputUnits };
  }

  function stockKPIs() {
    const total = state.stock.length;
    const low = state.stock.filter(i => stockLevel(i) === 'low').length;
    const out = state.stock.filter(i => stockLevel(i) === 'out').length;
    const units = state.stock.reduce((s, i) => s + i.qty, 0);
    return { total, low, out, units };
  }

  function transferKPIs() {
    const total = state.transfers.length;
    const sent = state.transfers.filter(t => t.status === 'sent').length;
    const accepted = state.transfers.filter(t => t.status === 'accepted').length;
    const needsAttention = state.transfers.filter(t => t.status === 'rejected' || t.status === 'cancelled').length;
    return { total, sent, accepted, needsAttention };
  }

  function can(session, permission) {
    if (!global.Permissions) return true;
    return global.Permissions.hasPermission(session, permission, 'kitchen');
  }
  function canVoidProduction(session) {
    if (!global.Permissions) return true;
    return global.Permissions.canVoid(session, 'kitchen');
  }

  function listStaffNames() {
    const names = new Set();
    state.production.forEach(p => { if (p.staff || p.by) names.add(p.staff || p.by); });
    return [...names].sort();
  }

  function isManagerLike(session) {
    if (!session) return false;
    return session.role === 'admin' || session.role === 'manager';
  }

  function getShiftProduction(session) {
    const today = todayDDMMYY();
    const me = ((session && session.name) || '').toLowerCase();
    const allStaff = isManagerLike(session);

    return (state.production || []).filter(function (p) {
      if (!(p.date || '').startsWith(today)) return false;
      if (!allStaff) {
        if (!me) return false;
        if (((p.staff || p.by) || '').toLowerCase() !== me) return false;
      }
      return true;
    });
  }

  global.KitchenService = {
    KEYS,
    storage, loadShared, saveShared,
    fmtN, nowStamp, fmtStamp, todayDDMMYY, todayISO,
    stockLevel, LEVEL_CHIP, LEVEL_LABEL,
    nextProductionId, nextTransferNo,
    state,
    onChange,
    loadAll,
    persist,
    findStock,
    addStockItem, editStockItem, deleteStockItem, deductStock, restoreStock,
    recordProduction, voidProduction,
    addTransfer, updateTransferStatus,
    getKitchenRequisitions, receiveRequisition, receivedSoFar,
    dashboardKPIs, productionKPIs, stockKPIs, transferKPIs,
    can, canVoidProduction,
    listStaffNames,
    getShiftProduction, isManagerLike,
  };
})(window);