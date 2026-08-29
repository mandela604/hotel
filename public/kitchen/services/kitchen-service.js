/**
 * services/kitchen-service.js — Shared data + business logic for the Kitchen module
 *
 * PRODUCTION VERSION: talks to the real backend (routes/kitchen.js →
 * controllers/kitchenController.js) instead of shared client-side
 * storage. The public interface (KitchenService.*) is unchanged from
 * the demo version, so pages that already call KitchenService.loadAll(),
 * .addStockItem(), .startProduction(), etc. don't need to change.
 *
 * IDs: never generated client-side anymore. Every record's `id` is a
 * uuidv4 assigned by the server; human-readable numbers (no,
 * transferNo, requisitionNo) are also server-assigned and only used
 * for display, never for lookups.
 *
 * ASSUMPTION — auth header: this file reads a bearer token from
 * window.AuthService.getToken() if present, else localStorage 'token'.
 * Adjust getAuthHeaders() below if this app's real auth convention is
 * different.
 *
 * ASSUMPTION — API base: defaults to '/api/kitchen'. Override by
 * setting window.KITCHEN_API_BASE before this script loads.
 */
(function (global) {
  'use strict';

  const API_BASE = global.KITCHEN_API_BASE || '/api/kitchen';

  function getAuthHeaders() {
    // httpOnly cookie is sent automatically — no Authorization header needed.
    return {};
  }

  /**
   * Every backend response follows { success, data|error }. This throws
   * a plain Error with the server's message on failure, so existing
   * try/catch(e => e.message) callers keep working unchanged.
   */
  async function request(path, options = {}) {
    const res = await fetch(API_BASE + path, {
      credentials: 'include',
      method: options.method || 'GET',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        getAuthHeaders(),
        options.headers || {}
      ),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    let payload;
    try { payload = await res.json(); }
    catch (e) { throw new Error(`Server returned an unreadable response (${res.status}).`); }

    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `Request failed (${res.status}).`);
    }
    return payload.data;
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

  function normalizeProductionType(t) {
    return (t === 'cook_on_order' || t === 'coo') ? 'coo' : 'rts';
  }

  function stockLevel(i) { return i.qty <= 0 ? 'out' : (i.qty <= i.min ? 'low' : 'ok'); }
  const LEVEL_CHIP = { ok: 'chip-ok', low: 'chip-low', out: 'chip-out' };
  const LEVEL_LABEL = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };

  const state = {
    stock: [],
    recipes: [],
    production: [],
    movements: [],
    transfers: [],
    requisitions: [],
    ready: false,
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state, reason); } catch (e) { console.warn('[KitchenService] listener error', e); } }); }

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

  function normalizeRecipe(r) {
    if (!r) return r;
    r.baseQty = Number(r.baseQty) || 1;
    r.expectedYield = Number(r.expectedYield) || 0;
    r.ingredients = (r.ingredients || []).map(i => ({ name: i.name, qty: Number(i.qty) || 0, unit: i.unit || '' }));
    return r;
  }

  /**
   * Loads all Kitchen data from the server. No more seed-merging — the
   * backend is the single source of truth, so an empty collection just
   * means the backend genuinely has no rows yet (nothing to paper over
   * client-side).
   */
  async function loadAll() {
    const [stock, recipes, production, movements, transfers] = await Promise.all([
      request('/stock'),
      request('/recipes'),
      request('/production'),
      request('/movements'),
      request('/transfers'),
    ]);

    state.stock = (stock || []).map(normalizeItem);
    state.recipes = (recipes || []).map(normalizeRecipe);
    state.production = production || [];
    state.movements = movements || [];
    state.transfers = transfers || [];

    // Requisitions are read-only status watching from Kitchen's side —
    // fetched separately so a failure here (e.g. route not deployed
    // yet) doesn't block the rest of the page from loading.
    try {
      state.requisitions = await request('/requisitions');
    } catch (e) {
      console.warn('[KitchenService] requisitions fetch failed:', e.message);
      state.requisitions = [];
    }

    state.ready = true;
    emitChange('load');
    return state;
  }

  function findStock(name) {
    if (!name) return null;
    const clean = String(name).toLowerCase().trim();
    return state.stock.find(i => i.name.toLowerCase().trim() === clean);
  }

  /* ── Stock CRUD ── */
  async function addStockItem(raw) {
    const item = await request('/stock', {
      method: 'POST',
      body: {
        name: raw.name,
        category: raw.category || raw.cat,
        unit: raw.unit,
        qty: raw.qty,
        min: raw.min,
        price: raw.price != null ? raw.price : raw.cost,
        batch: raw.batch,
        received: raw.received,
        desc: raw.desc,
      },
    });
    normalizeItem(item);
    state.stock.push(item);
    emitChange('stock:add');
    return item;
  }

  /**
   * Now keyed by the item's server `id` (uuidv4), not its name — the
   * caller should pass the stock item's `id`. `name` is accepted for
   * backward compatibility and resolved to an id via findStock().
   */
  async function editStockItem(nameOrId, updates) {
    const existing = state.stock.find(i => i.id === nameOrId) || findStock(nameOrId);
    if (!existing) throw new Error(`"${nameOrId}" not found in stock.`);

    const item = await request(`/stock/${existing.id}`, { method: 'PUT', body: updates });
    normalizeItem(item);
    const idx = state.stock.findIndex(i => i.id === existing.id);
    if (idx > -1) state.stock[idx] = item; else state.stock.push(item);
    emitChange('stock:edit');
    return item;
  }

  async function deleteStockItem(nameOrId) {
    const existing = state.stock.find(i => i.id === nameOrId) || findStock(nameOrId);
    if (!existing) throw new Error(`"${nameOrId}" not found in stock.`);

    await request(`/stock/${existing.id}`, { method: 'DELETE' });
    state.stock = state.stock.filter(i => i.id !== existing.id);
    emitChange('stock:delete');
  }

  async function deductStock(name, qty, reason, notes) {
    const item = await request('/stock/deduct', { method: 'POST', body: { name, qty, reason, notes } });
    normalizeItem(item);
    const idx = state.stock.findIndex(i => i.id === item.id);
    if (idx > -1) state.stock[idx] = item; else state.stock.push(item);
    state.movements.unshift({ date: nowStamp(), item: item.name, qtyIn: 0, qtyOut: qty, balance: item.qty, reason: notes ? `${reason} — ${notes}` : reason });
    emitChange('stock:deduct');
    return item;
  }

  function ingredientCost(name, qty) {
    const i = findStock(name);
    return (i ? i.price : 0) * qty;
  }

  /* ── Recipes ── */
  function findRecipe(dish) {
    if (!dish) return null;
    const clean = String(dish).toLowerCase().trim();
    return state.recipes.find(r => r.dish.toLowerCase().trim() === clean);
  }
  function findRecipeById(id) {
    return state.recipes.find(r => r.id === id);
  }

  async function addRecipe(raw) {
    const recipe = await request('/recipes', {
      method: 'POST',
      body: {
        dish: raw.dish,
        baseQty: raw.baseQty,
        baseUnit: raw.baseUnit,
        baseIngredient: raw.baseIngredient,
        ingredients: (raw.ingredients || []).filter(i => i.name && Number(i.qty) > 0),
        expectedYield: raw.expectedYield,
        expectedYieldUnit: raw.expectedYieldUnit,
        notes: raw.notes,
      },
    });
    normalizeRecipe(recipe);
    state.recipes.push(recipe);
    emitChange('recipe:add');
    return recipe;
  }

  async function editRecipe(id, updates) {
    if (updates.ingredients) {
      updates = { ...updates, ingredients: updates.ingredients.filter(i => i.name && Number(i.qty) > 0) };
    }
    const recipe = await request(`/recipes/${id}`, { method: 'PUT', body: updates });
    normalizeRecipe(recipe);
    const idx = state.recipes.findIndex(r => r.id === id);
    if (idx > -1) state.recipes[idx] = recipe; else state.recipes.push(recipe);
    emitChange('recipe:edit');
    return recipe;
  }

  async function deleteRecipe(id) {
    await request(`/recipes/${id}`, { method: 'DELETE' });
    state.recipes = state.recipes.filter(r => r.id !== id);
    emitChange('recipe:delete');
  }

  function scaleRecipe(recipe, targetQty) {
    if (!recipe) throw new Error('Recipe not found.');
    const qty = Number(targetQty) || 0;
    const factor = recipe.baseQty > 0 ? qty / recipe.baseQty : 0;
    return {
      factor,
      targetQty: qty,
      ingredients: recipe.ingredients.map(i => ({
        name: i.name,
        unit: i.unit,
        qty: Math.round(i.qty * factor * 1000) / 1000,
      })),
      expectedYield: Math.round(recipe.expectedYield * factor * 100) / 100,
      expectedYieldUnit: recipe.expectedYieldUnit,
    };
  }

  function estimateRecipeCost(recipe, targetQty) {
    const scaled = scaleRecipe(recipe, targetQty);
    return scaled.ingredients.reduce((s, i) => s + ingredientCost(i.name, i.qty), 0);
  }

  /**
   * No dedicated plate-cost endpoint on the backend — derived from the
   * most recently completed production run for that dish, same number
   * the old localStorage-cached plateCost store held, just computed
   * on the fly from state.production instead of a separate persisted key.
   */
  function getPlateCost(dish) {
    if (!dish) return null;
    const clean = String(dish).toLowerCase().trim();
    const runs = state.production
      .filter(p => p.status === 'completed' && p.costPerUnit != null && (p.dish || '').toLowerCase().trim() === clean)
      .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
    return runs.length ? runs[0].costPerUnit : null;
  }

  /* ── Production Runs ──
     Two-phase, matching the backend: POST /production deducts
     ingredients immediately and creates the run 'in-progress' with no
     output yet (this is what the backend calls recordProduction, but
     its behavior is exactly "start"). PUT /production/:id/complete
     records the actual yield once cooking finishes. */
  async function startProduction({ dish, recipeId, type, expectedYield, expectedYieldUnit, ingredients, staff, notes = '' }) {
    const run = await request('/production', {
      method: 'POST',
      body: {
        dish,
        recipeId,
        type: normalizeProductionType(type),
        expectedYield,
        expectedYieldUnit,
        ingredients,
        staff,
        notes,
      },
    });
    state.production.unshift(run);
    // Stock was deducted server-side — refresh local stock/movement
    // views for the ingredients that were used so the UI reflects it
    // without needing a full reload.
    (run.ingredients || []).forEach(ing => {
      const s = findStock(ing.name);
      if (s) s.qty = Math.max(0, s.qty - ing.qty);
    });
    emitChange('production:start');
    return run;
  }

  async function completeProduction(productionId, { outputQty, outputUnit }) {
    const run = await request(`/production/${productionId}/complete`, {
      method: 'PUT',
      body: { outputQty, outputUnit },
    });
    const idx = state.production.findIndex(p => p.id === productionId);
    if (idx > -1) state.production[idx] = run; else state.production.unshift(run);
    emitChange('production:complete');
    return run;
  }

  /**
   * Legacy single-step path, kept only for backward compatibility with
   * any caller still using it. The backend has no single-call
   * "start + immediately complete" endpoint, so this now performs the
   * same two HTTP calls startProduction()+completeProduction() would.
   */
  async function recordProduction({ dish, recipeId, type, expectedYield, expectedYieldUnit, outputQty, outputUnit, ingredients, staff, notes = '' }) {
    const run = await startProduction({ dish, recipeId, type, expectedYield, expectedYieldUnit, ingredients, staff, notes });
    return completeProduction(run.id, { outputQty, outputUnit });
  }

  async function voidProduction(productionId, reason) {
    const run = await request(`/production/${productionId}/void`, { method: 'POST', body: { reason } });
    const idx = state.production.findIndex(p => p.id === productionId);
    if (idx > -1) state.production[idx] = run; else state.production.unshift(run);
    // Stock was restored server-side — bump local qty for each restored
    // ingredient so the UI reflects it without a full reload.
    (run.ingredients || []).forEach(ing => {
      const s = findStock(ing.name);
      if (s) s.qty += Number(ing.qty) || 0;
    });
    emitChange('production:void');
    return run;
  }

  /* ── Transfers to Restaurant/Poolbar ──
     No more client-side "bridge" write into Restaurant's own storage —
     that only worked because everything shared one localStorage/demo
     store. In production, Restaurant reads its own incoming-transfers
     list from its own API, backed by the same Transfer collection. */
  async function addTransfer({ meal, quantity, unit, sentBy, remarks = '', productionNo = '', restaurant = 'Main Restaurant / POS' }) {
    const transfer = await request('/transfers', {
      method: 'POST',
      body: { meal, quantity, unit, sentBy, remarks, productionNo, restaurant },
    });
    state.transfers.unshift(transfer);
    emitChange('transfer:add');
    return transfer;
  }

  async function updateTransferStatus(id, status, details = {}) {
    const transfer = await request(`/transfers/${id}/status`, {
      method: 'PATCH',
      body: { status, ...details },
    });
    const idx = state.transfers.findIndex(t => t.id === id);
    if (idx > -1) state.transfers[idx] = transfer; else state.transfers.unshift(transfer);
    emitChange('transfer:update');
    return transfer;
  }

  /* ── Requisitions ──
     Kitchen only watches fulfillment status here — raising/fulfilling
     happens on the Store side, via Store's own screens/API. There is
     no client-side stock crediting anymore (the old demo version
     wrote directly to stock, which only made sense with one shared
     storage bucket and no real Store-side workflow). */
  async function getKitchenRequisitions() {
    state.requisitions = await request('/requisitions');
    return state.requisitions;
  }

  function receivedSoFar(reqNo, itemName) {
    const req = state.requisitions.find(r => r.no === reqNo);
    const line = req && (req.items || []).find(i => i.name === itemName);
    return line ? Number(line.issuedQty) || 0 : 0;
  }

  /* ── KPIs (client-side aggregation over already-loaded state; the
     backend has no dedicated Kitchen dashboard endpoint) ── */
  function dashboardKPIs() {
    const lowStock = state.stock.filter(i => stockLevel(i) !== 'ok').length;
    const todayStr = todayDDMMYY();
    const todayRuns = state.production.filter(p => (p.status === 'completed' || p.status === 'in-progress') && (p.date || '').startsWith(todayStr));
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
    const withVariance = completed.filter(x => x.yieldVariancePct != null);
    const avgVariancePct = withVariance.length
      ? Math.round((withVariance.reduce((s, x) => s + x.yieldVariancePct, 0) / withVariance.length) * 10) / 10
      : null;
    return { total: rows.length, completed: completed.length, voided: voided.length, cost, outputUnits, avgVariancePct };
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

  function recipeKPIs() {
    const total = state.recipes.length;
    const dishesProduced = new Set(state.production.filter(p => p.recipeId).map(p => p.recipeId)).size;
    return { total, dishesProduced };
  }

  function can(session, permission) {
    if (!global.Permissions || typeof global.Permissions.hasPermission !== 'function') return true;
    return global.Permissions.hasPermission(session, permission, 'kitchen');
  }
  function canVoidProduction(session) {
    if (!global.Permissions || typeof global.Permissions.canVoid !== 'function') return true;
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

  function post(path, body) {
    return request(path, { method: 'POST', body: body || {} });
  }

  function normalizeRequisition(r) {
    return Object.assign({}, r, { no: r.no || r.requisitionNo || r.id });
  }

  async function receiveRequisition(req) {
    if (!req) throw new Error('Invalid requisition — nothing to receive.');
    const id = (typeof req === 'string' ? req : (req.no || req.requisitionNo || req.id || req._id));
    if (!id) throw new Error('Requisition has no id/number.');
    const res = await post('/requisitions/' + encodeURIComponent(id) + '/receive');
    const norm = normalizeRequisition(res.data || res);
    await loadAll().catch(function () {});
    emitChange('requisition:received');
    return norm;
  }

  async function confirmReceipt(no) {
    return receiveRequisition(no);
  }

  /* ── Requisition CRUD (Kitchen → Store) ── */

  async function submitRequisition(opts) {
    opts = opts || {};
    const items = opts.items || [];
    const requester = opts.requester || opts.by || 'Kitchen';
    const dept = opts.dept || 'Kitchen';
    const priority = opts.priority || 'Normal';
    const remark = opts.remark || '';
    const neededBy = opts.neededBy || opts.needed || '';

    const res = await post('/requisitions', {
      items: items.map(function (i) {
        return { name: i.name, stockId: i.stockId || '', unit: i.unit || 'kg', qty: Number(i.qty) || 0, cost: Number(i.cost) || 0, remark: i.remark || '' };
      }),
      requester: requester,
      dept: dept,
      priority: priority,
      remark: remark,
      neededBy: neededBy,
    });
    const doc = normalizeRequisition(res.data || res);
    state.requisitions.unshift(doc);
    emitChange('requisition:submit');
    return doc;
  }

  function getDepartmentHistory(dept) {
    return (state.requisitions || [])
      .filter(function (r) { return r.dept === dept || (!r.dept && dept === 'Kitchen'); })
      .map(function (r) { return Object.assign({}, r, { _kind: 'requisition' }); });
  }

  function filterHistory(rows, filters) {
    if (!filters) return rows;
    var search = (filters.search || '').toLowerCase().trim();
    var status = filters.status || '';
    var priority = filters.priority || '';

    return rows.filter(function (r) {
      if (search) {
        var hay = ((r.no || '') + ' ' + (r.by || '') + ' ' + (r.requester || '') + ' ' + (r.items || []).map(function (i) { return i.name; }).join(' ')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      if (status && r.status !== status) return false;
      if (priority && (r.priority || 'Normal') !== priority) return false;
      return true;
    });
  }

  function sortHistory(rows, sortKey, sortDir) {
    var dir = sortDir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      if (sortKey === 'date') {
        var da = a.dateRaised || a.date || '';
        var db = b.dateRaised || b.date || '';
        return da < db ? -dir : da > db ? dir : 0;
      }
      if (sortKey === 'items') {
        return ((a.items || []).length - (b.items || []).length) * dir;
      }
      return 0;
    });
  }

  function getHistoryKPIs(rows) {
    var pending = 0, completed = 0, rejected = 0, totalUnits = 0;
    (rows || []).forEach(function (r) {
      var s = r.status || '';
      if (s === 'Pending' || s === 'Partial' || s === 'Full' || s === 'Issued') pending++;
      if (s === 'Completed') { completed++; (r.items || []).forEach(function (i) { totalUnits += Number(i.issuedQty || i.qty) || 0; }); }
      if (s === 'Rejected' || s === 'Disputed') rejected++;
    });
    return { pending: pending, completed: completed, rejected: rejected, transfers: 0, totalUnits: totalUnits };
  }

  function getHistoryStatusDisplay(kind, status) {
    var map = {
      Pending:  { label: 'Pending',              cls: 'chip-pending' },
      Partial:  { label: 'Partially Issued',     cls: 'chip-partial' },
      Full:     { label: 'Issued — Awaiting You', cls: 'chip-issued' },
      Issued:   { label: 'Issued — Awaiting You', cls: 'chip-issued' },
      Completed:{ label: 'Completed',            cls: 'chip-completed' },
      Disputed: { label: 'Disputed',             cls: 'chip-disputed' },
      Rejected: { label: 'Rejected',             cls: 'chip-rejected' },
    };
    return map[status] || { label: status || '—', cls: '' };
  }

  global.KitchenService = {
    API_BASE,
    fmtN, nowStamp, fmtStamp, todayDDMMYY, todayISO,
    stockLevel, LEVEL_CHIP, LEVEL_LABEL,
    state,
    onChange,
    loadAll,
    findStock,
    addStockItem, editStockItem, deleteStockItem, deductStock,
    findRecipe, findRecipeById, addRecipe, editRecipe, deleteRecipe, scaleRecipe, estimateRecipeCost, getPlateCost,
    recordProduction, voidProduction, startProduction, completeProduction,
    addTransfer, updateTransferStatus,
    getKitchenRequisitions, receivedSoFar,
    submitRequisition, receiveRequisition, confirmReceipt,
    getDepartmentHistory, filterHistory, sortHistory, getHistoryKPIs, getHistoryStatusDisplay,
    dashboardKPIs, productionKPIs, stockKPIs, transferKPIs, recipeKPIs,
    can, canVoidProduction,
    listStaffNames,
    getShiftProduction, isManagerLike,
  };
})(window);