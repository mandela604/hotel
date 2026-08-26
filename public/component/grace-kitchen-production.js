/**
 * grace-kitchen-production.js — Grace Hotel HMS Reusable Kitchen-Production Component
 * ─────────────────────────────────────────────────────────────────────
 * Compact accordion form · light theme · search-to-add meals & ingredients
 *
 *   const production = GraceKitchenProduction.attach('#productionPlaceholder', {
 *     mealNames: ['Fried Rice','Jollof Rice',...],
 *     stock: [{ name:'Rice', qty:112, unit:'kg' }, ...],
 *     departments: ['Main Restaurant / POS','Pool Bar','Room Service'],
 *     departmentsApiUrl: '/api/settings/departments',
 *     openOrders: [{ id:'ORD-1057', label:'ORD-1057 — Table 4, 2 covers' }, ...],
 *     cfg: { API_BASE:'', API_KEY:'' },
 *     kitchenName: 'Main Kitchen',
 *     storage: myStorageAdapter,
 *     onSave: (batch) => { ... },
 *   });
 *
 *   production.refresh();
 *   production.setStock(newStock);
 *   production.destroy();
 */

(function () {
  'use strict';

  if (window.__graceKitchenProduction) return;
  window.__graceKitchenProduction = true;

  // ══════════════════════════════════════════════════════════════════
  // CSS — light theme (matches dashboard), compact, accordion
  // ══════════════════════════════════════════════════════════════════
  const CSS = `
    .gkp-wrap, .gkp-wrap *, .gkp-wrap *::before, .gkp-wrap *::after{ box-sizing:border-box; margin:0; padding:0; }
    .gkp-wrap{
      --gkp-gold:#2f6fed; --gkp-gold-light:#5b8ff9; --gkp-gold-dim:rgba(47,111,237,.10); --gkp-gold-border:rgba(47,111,237,.25);
      --gkp-green:#12b76a; --gkp-green-bg:#e9f9f0;
      --gkp-red:#f04438; --gkp-red-bg:#feecec;
      --gkp-amber:#f79009; --gkp-amber-bg:#fff4e5;
      --gkp-blue:#2f6fed; --gkp-blue-bg:#eaf1ff;
      --gkp-tx:#1c2440; --gkp-tx2:#6b7280; --gkp-tx3:#9aa1b3;
      --gkp-border:#eef0f6; --gkp-border2:#dfe3ec;
      --gkp-card:#ffffff; --gkp-surface2:#f4f6fb; --gkp-surface3:#eef0f6;
      --gkp-input-bg:#f4f6fb;
      --gkp-shadow:0 4px 20px rgba(15,34,55,.07);
      font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
      color:var(--gkp-tx); font-size:13px; display:flex; flex-direction:column; gap:12px;
    }

    .gkp-panel{ background:var(--gkp-card); border:1px solid var(--gkp-border); border-radius:12px; overflow:hidden; box-shadow:var(--gkp-shadow); }
    .gkp-panel-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--gkp-border); gap:8px; flex-wrap:wrap; }
    .gkp-panel-title{ font-size:11px; font-weight:800; color:var(--gkp-gold); letter-spacing:.8px; text-transform:uppercase; }
    .gkp-panel-meta{ font-size:11px; color:var(--gkp-tx3); }
    .gkp-panel-meta b{ color:var(--gkp-gold); font-weight:700; }

    /* Accordion sections */
    .gkp-acc{ border-bottom:1px solid var(--gkp-border); }
    .gkp-acc:last-child{ border-bottom:none; }
    .gkp-acc-head{
      display:flex; align-items:center; justify-content:space-between; gap:8px;
      padding:10px 14px; cursor:pointer; user-select:none; background:var(--gkp-card);
      transition:background .15s;
    }
    .gkp-acc-head:hover{ background:var(--gkp-surface2); }
    .gkp-acc-left{ display:flex; align-items:center; gap:8px; min-width:0; }
    .gkp-acc-chevron{ font-size:9px; color:var(--gkp-tx3); transition:transform .2s; flex-shrink:0; }
    .gkp-acc.open .gkp-acc-chevron{ transform:rotate(90deg); }
    .gkp-acc-title{ font-size:11px; font-weight:700; color:var(--gkp-tx); letter-spacing:.4px; text-transform:uppercase; }
    .gkp-acc-badge{
      display:inline-flex; align-items:center; justify-content:center;
      min-width:18px; height:18px; padding:0 5px; border-radius:10px;
      font-size:10px; font-weight:700; background:var(--gkp-gold-dim); color:var(--gkp-gold);
    }
    .gkp-acc-badge.empty{ background:var(--gkp-surface3); color:var(--gkp-tx3); }
    .gkp-acc-summary{ font-size:11px; color:var(--gkp-tx3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; }
    .gkp-acc-body{ display:none; padding:10px 14px 12px; background:var(--gkp-surface2); }
    .gkp-acc.open .gkp-acc-body{ display:block; }

    /* Compact form bits */
    .gkp-row{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
    .gkp-row.gkp-3{ grid-template-columns:1fr 1fr 1fr; }
    .gkp-row.gkp-search{ grid-template-columns:1fr auto; align-items:end; margin-bottom:8px; }
    @media (max-width:520px){
      .gkp-row, .gkp-row.gkp-3{ grid-template-columns:1fr; }
      .gkp-row.gkp-search{ grid-template-columns:1fr auto; }
    }
    .gkp-fg{ display:flex; flex-direction:column; gap:3px; min-width:0; }
    .gkp-fl{ font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--gkp-tx3); font-weight:600; }
    .gkp-fl.req::after{ content:' *'; color:var(--gkp-red); }
    .gkp-in, .gkp-sel{
      background:var(--gkp-card); border:1px solid var(--gkp-border2); border-radius:8px;
      padding:7px 10px; color:var(--gkp-tx); font-family:inherit; font-size:12.5px;
      outline:none; transition:border-color .15s; width:100%;
    }
    .gkp-in:focus, .gkp-sel:focus{ border-color:var(--gkp-gold); }
    .gkp-in[readonly]{ opacity:.65; cursor:default; background:var(--gkp-surface3); }

    /* Search-to-add row */
    .gkp-search-wrap{ position:relative; }
    .gkp-search-row{ display:flex; gap:6px; align-items:center; }
    .gkp-search-row .gkp-in{ flex:1; min-width:0; }
    .gkp-qty-in{ width:64px !important; flex-shrink:0; text-align:center; }
    .gkp-unit-sel{ width:88px !important; flex-shrink:0; }

    /* Chip list (meals / ingredients in batch) */
    .gkp-chips{ display:flex; flex-direction:column; gap:4px; }
    .gkp-chip{
      display:flex; align-items:center; gap:8px; padding:6px 8px;
      background:var(--gkp-card); border:1px solid var(--gkp-border); border-radius:8px;
      font-size:12.5px;
    }
    .gkp-chip-name{ flex:1; min-width:0; font-weight:600; color:var(--gkp-tx); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gkp-chip-meta{ font-size:11px; color:var(--gkp-tx2); white-space:nowrap; }
    .gkp-chip-meta.warn{ color:var(--gkp-amber); font-weight:700; }
    .gkp-chip-x{
      background:none; border:none; color:var(--gkp-tx3); cursor:pointer;
      font-size:14px; line-height:1; padding:2px 4px; border-radius:4px;
    }
    .gkp-chip-x:hover{ color:var(--gkp-red); background:var(--gkp-red-bg); }
    .gkp-empty{ font-size:12px; color:var(--gkp-tx3); padding:8px 0; text-align:center; }

    /* Mode toggle — compact pills */
    .gkp-mode{ display:flex; gap:6px; margin-bottom:8px; }
    .gkp-mode-btn{
      flex:1; padding:8px 10px; border-radius:8px; border:1.5px solid var(--gkp-border2);
      background:var(--gkp-card); cursor:pointer; text-align:center; transition:all .15s;
      font-family:inherit;
    }
    .gkp-mode-btn:hover{ border-color:var(--gkp-gold-border); }
    .gkp-mode-btn.on{ background:var(--gkp-gold-dim); border-color:var(--gkp-gold); }
    .gkp-mode-btn .t{ font-size:12px; font-weight:700; color:var(--gkp-tx); display:block; }
    .gkp-mode-btn .s{ font-size:10px; color:var(--gkp-tx3); margin-top:1px; display:block; }
    .gkp-mode-btn.on .s{ color:var(--gkp-tx2); }

    /* Footer actions */
    .gkp-foot{
      display:flex; align-items:center; justify-content:space-between; gap:8px;
      padding:10px 14px; border-top:1px solid var(--gkp-border); flex-wrap:wrap;
      background:var(--gkp-card);
    }
    .gkp-foot-info{ font-size:11.5px; color:var(--gkp-tx3); }
    .gkp-foot-info b{ color:var(--gkp-gold); }
    .gkp-btns{ display:flex; gap:6px; flex-wrap:wrap; }

    .gkp-btn{
      display:inline-flex; align-items:center; gap:5px; padding:7px 12px; border-radius:8px;
      font-family:inherit; font-size:12px; font-weight:600; cursor:pointer;
      transition:all .15s; white-space:nowrap; border:1px solid transparent;
    }
    .gkp-btn-primary{ background:var(--gkp-gold); color:#fff; }
    .gkp-btn-primary:hover{ background:var(--gkp-gold-light); }
    .gkp-btn-outline{ background:var(--gkp-card); border-color:var(--gkp-border2); color:var(--gkp-tx2); }
    .gkp-btn-outline:hover{ border-color:var(--gkp-gold); color:var(--gkp-gold); }
    .gkp-btn:disabled{ opacity:.4; cursor:not-allowed; pointer-events:none; }

    /* Recent batches */
    .gkp-batch-list{ display:flex; flex-direction:column; gap:6px; padding:10px 14px 12px; }
    .gkp-batch-row{ border:1px solid var(--gkp-border); border-radius:8px; overflow:hidden; background:var(--gkp-surface2); }
    .gkp-batch-head{
      display:flex; align-items:center; justify-content:space-between; padding:8px 10px;
      cursor:pointer; gap:8px; flex-wrap:wrap; user-select:none;
    }
    .gkp-batch-head:hover{ background:var(--gkp-surface3); }
    .gkp-batch-hl{ display:flex; align-items:center; gap:7px; flex-wrap:wrap; min-width:0; }
    .gkp-batch-chevron{ font-size:9px; color:var(--gkp-tx3); transition:transform .2s; }
    .gkp-batch-row.open .gkp-batch-chevron{ transform:rotate(90deg); }
    .gkp-batch-meta{ font-size:11px; color:var(--gkp-tx3); }
    .gkp-batch-tag{ display:inline-flex; padding:1px 7px; border-radius:12px; font-size:9.5px; font-weight:700; }
    .gkp-batch-body{ display:none; padding:0 10px 10px; border-top:1px solid var(--gkp-border); }
    .gkp-batch-row.open .gkp-batch-body{ display:block; padding-top:8px; }
    .gkp-batch-sub{ font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--gkp-tx3); font-weight:700; margin:6px 0 4px; }
    .gkp-batch-sub:first-child{ margin-top:0; }
    .gkp-mini{ width:100%; border-collapse:collapse; font-size:12px; }
    .gkp-mini th{ text-align:left; padding:5px 6px; font-size:9px; text-transform:uppercase; letter-spacing:.8px; color:var(--gkp-tx3); font-weight:700; background:var(--gkp-card); border-bottom:1px solid var(--gkp-border); }
    .gkp-mini td{ padding:5px 6px; border-bottom:1px solid var(--gkp-border); color:var(--gkp-tx); }
    .gkp-mini tr:last-child td{ border-bottom:none; }
    .gkp-mini .c{ text-align:center; }
    .gkp-batch-foot{ font-size:11px; color:var(--gkp-tx3); margin-top:4px; }
    .gkp-batch-foot b{ color:var(--gkp-tx2); }

    .gkp-toast{
      position:fixed; bottom:16px; right:16px; background:var(--gkp-card); border:1px solid var(--gkp-border2);
      border-radius:10px; padding:10px 14px; font-size:12.5px; color:var(--gkp-tx);
      box-shadow:0 8px 28px rgba(15,34,55,.12); z-index:9999; display:flex; align-items:center; gap:6px;
      animation:gkpIn .25s ease; max-width:calc(100vw - 32px); font-family:inherit;
    }
    .gkp-toast.success{ border-left:3px solid var(--gkp-green); }
    .gkp-toast.error{ border-left:3px solid var(--gkp-red); }
    .gkp-toast.info{ border-left:3px solid var(--gkp-blue); }
    @keyframes gkpIn{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

    .gkp-wrap ::-webkit-scrollbar{ width:5px; height:5px; }
    .gkp-wrap ::-webkit-scrollbar-track{ background:transparent; }
    .gkp-wrap ::-webkit-scrollbar-thumb{ background:var(--gkp-border2); border-radius:5px; }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'gkp-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  // ══════════════════════════════════════════════════════════════════
  // Defaults
  // ══════════════════════════════════════════════════════════════════
  const DEFAULT_STORAGE = window.storage || {
    async get(key, shared) { const v = localStorage.getItem(key); return v == null ? null : { key, value: v, shared }; },
    async set(key, value, shared) { localStorage.setItem(key, value); return { key, value, shared }; },
    async list(prefix, shared) { const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)); return { keys, prefix, shared }; },
  };

  const DEFAULT_MEAL_NAMES = ['Fried Rice', 'Jollof Rice', 'Egusi Soup', 'Pepper Soup', 'Moi Moi'];
  const DEFAULT_STOCK = [
    { name:'Rice', qty:112, unit:'kg' }, { name:'Oil', qty:18, unit:'Ltr' }, { name:'Curry', qty:4, unit:'kg' },
    { name:'Green Peas', qty:9, unit:'kg' }, { name:'Chicken', qty:38, unit:'kg' }, { name:'Seasoning', qty:6, unit:'kg' },
    { name:'Tomato', qty:22, unit:'kg' }, { name:'Pepper', qty:5, unit:'kg' }, { name:'Egusi', qty:14, unit:'kg' },
    { name:'Palm Oil', qty:3, unit:'Ltr' }, { name:'Spinach', qty:8, unit:'kg' }, { name:'Scent Leaf', qty:2, unit:'kg' },
    { name:'Beans Flour', qty:12, unit:'kg' }, { name:'Egg', qty:60, unit:'pcs' },
  ];
  const DEFAULT_DEPARTMENTS = ['Main Restaurant / POS', 'Pool Bar', 'Room Service', 'Banquets Hall'];
  const OTHER_VALUE = '__other__';
  const DEFAULT_OPEN_ORDERS = [
    { id:'ORD-1057', label:'ORD-1057 — Table 4, 2 covers' },
    { id:'ORD-1058', label:'ORD-1058 — Table 9, 1 cover' },
    { id:'ORD-1059', label:'ORD-1059 — Room Service, Rm 204' },
  ];
const COMMON_UNITS = [
  'kg', 'g', 'Ltr', 'ml',
  'pcs', 'piece', 'dozen',
  'bag', 'sack', 'pack', 'packet', 'carton', 'crate', 'tray',
  'basket', 'bunch', 'bundle',
  'tin', 'can', 'bottle', 'jar',
  'cup', 'bowl', 'portion'
];  const MEAL_UNITS = ['Plates', 'Portions', 'Servings', 'Trays'];

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _fmtQty(n) { return (Math.round((n || 0) * 100) / 100).toString(); }
  function _uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  let _instanceCounter = 0;

  // ══════════════════════════════════════════════════════════════════
  // attach()
  // ══════════════════════════════════════════════════════════════════
  function attach(target, options) {
    options = options || {};
    _injectStyles();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[GraceKitchenProduction] Target not found:', target); return null; }

    const instId = 'gkp' + (++_instanceCounter);
    const storage = options.storage || DEFAULT_STORAGE;
    const cfg = Object.assign({ API_BASE: '', API_KEY: '' }, options.cfg || {});
    const KITCHEN_NAME = options.kitchenName || 'Main Kitchen';
    const openOrders = options.openOrders || DEFAULT_OPEN_ORDERS;
    let departments = (options.departments && options.departments.length) ? options.departments.slice() : DEFAULT_DEPARTMENTS.slice();

    const mealNameSuggestions = (options.mealNames && options.mealNames.length)
      ? options.mealNames.slice()
      : (options.recipes ? Object.keys(options.recipes) : DEFAULT_MEAL_NAMES.slice());

    let stock = options.stock || DEFAULT_STOCK;
    function stockList() {
      return Array.isArray(stock) ? stock : Object.keys(stock).map(name => ({ name, qty: stock[name], unit: (options.stockUnits && options.stockUnits[name]) || '' }));
    }
    function stockFor(name) {
      if (typeof stock === 'function') return stock(name) || 0;
      const list = stockList();
      const s = list.find(x => x.name.toLowerCase() === (name || '').trim().toLowerCase());
      return s ? s.qty : null;
    }
    function unitFor(name) {
      const list = stockList();
      const s = list.find(x => x.name.toLowerCase() === (name || '').trim().toLowerCase());
      return s ? s.unit : '';
    }
    function deductStock(name, amount) {
      if (!Array.isArray(stock)) return;
      const s = stock.find(x => x.name.toLowerCase() === (name || '').trim().toLowerCase());
      if (s) s.qty = Math.max(0, s.qty - amount);
    }

    const KEY_PRODUCTIONS = options.keys?.productions || 'kitchen-productions';
    const KEY_TRANSFERS   = options.keys?.transfers   || 'kitchen-transfers';
    const KEY_STOCK       = options.keys?.stock       || 'kitchen-stock';
    const KEY_MOVEMENTS   = options.keys?.movements   || 'kitchen-movements';
    const KEY_BATCHES     = options.keys?.batches     || 'kitchen-batches';

    async function loadShared(key, fallback) {
      try { const r = await storage.get(key, true); if (r && r.value) { const p = JSON.parse(r.value); if (Array.isArray(p)) return p; } } catch (e) {}
      return fallback;
    }
    async function saveShared(key, value) { try { await storage.set(key, JSON.stringify(value), true); } catch (e) { console.warn('[gkp sync]', key, e); } }

    let productions = [];
    let transfers = [];
    let movements = [];
    let batches = [];
    let expandedBatches = new Set();

    // Accordion open state (default: details + meals open)
    const openSections = new Set(['details', 'meals', 'destination']);

    const state = {
      preparedBy: options.preparedBy || '',
      remarks: '',
      meals: [],
      mealSearch: '',
      mealQty: 10,
      mealUnit: 'Plates',
      ingredients: [],
      ingSearch: '',
      ingQty: '',
      ingUnit: '',
      mode: 'rts',
      department: departments[0] || '',
      customDept: '',
      linkedOrder: openOrders[0] ? openOrders[0].id : '',
    };

    function nextSeq(arr, field, prefix, base) {
      let max = base || 0;
      arr.forEach(x => { const n = parseInt((x[field] || '').replace(prefix + '-', ''), 10); if (!isNaN(n) && n > max) max = n; });
      return max + 1;
    }
    function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
    function nowFull() { return new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''); }

    // ── Shell ──
    container.innerHTML = `
      <div class="gkp-wrap" id="${instId}">
        <div class="gkp-panel">
          <div class="gkp-panel-head">
            <div class="gkp-panel-title">Production Batch</div>
            <span class="gkp-panel-meta">Next: <b id="${instId}-batchPreview">BATCH-00001</b></span>
          </div>
          <div id="${instId}-body"></div>
          <div class="gkp-foot" id="${instId}-foot"></div>
        </div>
        <div class="gkp-panel">
          <div class="gkp-panel-head">
            <div class="gkp-panel-title">Recent Batches</div>
            <span class="gkp-panel-meta">Tap to expand</span>
          </div>
          <div id="${instId}-batchHistory"></div>
        </div>
      </div>`;

    const bodyEl = document.getElementById(instId + '-body');
    const footEl = document.getElementById(instId + '-foot');
    const historyEl = document.getElementById(instId + '-batchHistory');

    function toggleSection(id) {
      if (openSections.has(id)) openSections.delete(id); else openSections.add(id);
      render();
    }

    // ── Render ──
    function render() {
      const mealDl = mealNameSuggestions.map(m => `<option value="${_esc(m)}">`).join('');
      const ingDl = stockList().map(s => `<option value="${_esc(s.name)}">`).join('');
      const unitDl = COMMON_UNITS.map(u => `<option value="${_esc(u)}">`).join('');
      const mealUnitOpts = MEAL_UNITS.map(u => `<option ${state.mealUnit === u ? 'selected' : ''}>${u}</option>`).join('');
      const deptOpts = departments.map(d => `<option value="${_esc(d)}" ${state.department === d ? 'selected' : ''}>${_esc(d)}</option>`).join('')
        + `<option value="${OTHER_VALUE}" ${state.department === OTHER_VALUE ? 'selected' : ''}>+ Other…</option>`;
      const orderOpts = openOrders.map(o => `<option value="${_esc(o.id)}" ${state.linkedOrder === o.id ? 'selected' : ''}>${_esc(o.label)}</option>`).join('');

      const mealSummary = state.meals.length
        ? state.meals.map(m => m.name).slice(0, 2).join(', ') + (state.meals.length > 2 ? ` +${state.meals.length - 2}` : '')
        : 'None';
      const ingSummary = state.ingredients.length
        ? state.ingredients.map(i => i.name).slice(0, 2).join(', ') + (state.ingredients.length > 2 ? ` +${state.ingredients.length - 2}` : '')
        : 'None';
      const destSummary = state.mode === 'rts'
        ? (state.department === OTHER_VALUE ? (state.customDept || 'Custom…') : state.department)
        : (openOrders.find(o => o.id === state.linkedOrder)?.label || state.linkedOrder || '—');

      bodyEl.innerHTML = `
        <!-- Details -->
        <div class="gkp-acc ${openSections.has('details') ? 'open' : ''}" data-sec="details">
          <div class="gkp-acc-head" data-toggle="details">
            <div class="gkp-acc-left">
              <span class="gkp-acc-chevron">▶</span>
              <span class="gkp-acc-title">Details</span>
            </div>
            <span class="gkp-acc-summary">${_esc(state.preparedBy || 'Chef not set')}</span>
          </div>
          <div class="gkp-acc-body">
            <div class="gkp-row gkp-3">
              <div class="gkp-fg"><label class="gkp-fl">Date</label><input class="gkp-in" id="${instId}-date" readonly></div>
              <div class="gkp-fg"><label class="gkp-fl req">Prepared By</label><input class="gkp-in" id="${instId}-by" placeholder="Chef name" value="${_esc(state.preparedBy)}"></div>
              <div class="gkp-fg"><label class="gkp-fl">Remarks</label><input class="gkp-in" id="${instId}-remarks" placeholder="e.g. Lunch prep" value="${_esc(state.remarks)}"></div>
            </div>
          </div>
        </div>

        <!-- Meals — search & add -->
        <div class="gkp-acc ${openSections.has('meals') ? 'open' : ''}" data-sec="meals">
          <div class="gkp-acc-head" data-toggle="meals">
            <div class="gkp-acc-left">
              <span class="gkp-acc-chevron">▶</span>
              <span class="gkp-acc-title">Meals</span>
              <span class="gkp-acc-badge ${state.meals.length ? '' : 'empty'}">${state.meals.length}</span>
            </div>
            <span class="gkp-acc-summary">${_esc(mealSummary)}</span>
          </div>
          <div class="gkp-acc-body">
            <div class="gkp-search-row">
              <input class="gkp-in" id="${instId}-mealSearch" list="${instId}-mealNames" placeholder="Search / type meal name…" value="${_esc(state.mealSearch)}" autocomplete="off">
              <datalist id="${instId}-mealNames">${mealDl}</datalist>
              <input class="gkp-in gkp-qty-in" type="number" min="1" id="${instId}-mealQty" value="${state.mealQty}" title="Qty">
              <select class="gkp-sel gkp-unit-sel" id="${instId}-mealUnit">${mealUnitOpts}</select>
              <button class="gkp-btn gkp-btn-primary" id="${instId}-addMealBtn" title="Add to batch">+</button>
            </div>
            ${renderMealChips()}
          </div>
        </div>

        <!-- Ingredients — search & add -->
        <div class="gkp-acc ${openSections.has('ings') ? 'open' : ''}" data-sec="ings">
          <div class="gkp-acc-head" data-toggle="ings">
            <div class="gkp-acc-left">
              <span class="gkp-acc-chevron">▶</span>
              <span class="gkp-acc-title">Ingredients</span>
              <span class="gkp-acc-badge ${state.ingredients.length ? '' : 'empty'}">${state.ingredients.length}</span>
            </div>
            <span class="gkp-acc-summary">${_esc(ingSummary)}</span>
          </div>
          <div class="gkp-acc-body">
            <div class="gkp-search-row">
              <input class="gkp-in" id="${instId}-ingSearch" list="${instId}-ingNames" placeholder="Search / type ingredient…" value="${_esc(state.ingSearch)}" autocomplete="off">
              <datalist id="${instId}-ingNames">${ingDl}</datalist>
              <input class="gkp-in gkp-qty-in" type="number" min="0" step="0.01" id="${instId}-ingQty" placeholder="Qty" value="${_esc(state.ingQty)}" title="Qty used">
              <input class="gkp-in gkp-unit-sel" id="${instId}-ingUnit" list="${instId}-units" placeholder="Unit" value="${_esc(state.ingUnit)}" title="Unit">
              <datalist id="${instId}-units">${unitDl}</datalist>
              <button class="gkp-btn gkp-btn-primary" id="${instId}-addIngBtn" title="Add to batch">+</button>
            </div>
            ${renderIngChips()}
          </div>
        </div>

        <!-- Destination -->
        <div class="gkp-acc ${openSections.has('destination') ? 'open' : ''}" data-sec="destination">
          <div class="gkp-acc-head" data-toggle="destination">
            <div class="gkp-acc-left">
              <span class="gkp-acc-chevron">▶</span>
              <span class="gkp-acc-title">Destination</span>
            </div>
            <span class="gkp-acc-summary">${state.mode === 'rts' ? 'RTS' : 'COO'} · ${_esc(destSummary)}</span>
          </div>
          <div class="gkp-acc-body">
            <div class="gkp-mode">
              <button type="button" class="gkp-mode-btn ${state.mode === 'rts' ? 'on' : ''}" data-mode="rts">
                <span class="t">Ready-to-Serve</span>
                <span class="s">Transfer to department</span>
              </button>
              <button type="button" class="gkp-mode-btn ${state.mode === 'coo' ? 'on' : ''}" data-mode="coo">
                <span class="t">Cook-on-Order</span>
                <span class="s">Link to guest order</span>
              </button>
            </div>
            ${state.mode === 'rts' ? `
              <div class="gkp-row">
                <div class="gkp-fg" style="${state.department === OTHER_VALUE ? '' : 'grid-column:1/-1'}">
                  <label class="gkp-fl req">Transfer To</label>
                  <select class="gkp-sel" id="${instId}-dept">${deptOpts}</select>
                </div>
                ${state.department === OTHER_VALUE ? `
                <div class="gkp-fg">
                  <label class="gkp-fl req">Custom Name</label>
                  <input class="gkp-in" id="${instId}-customDept" placeholder="Department name" value="${_esc(state.customDept)}">
                </div>` : ''}
              </div>` : `
              <div class="gkp-fg">
                <label class="gkp-fl req">Linked Order</label>
                <select class="gkp-sel" id="${instId}-order">${orderOpts}</select>
              </div>`}
          </div>
        </div>`;

      // Footer
      const hasMeals = state.meals.length > 0;
      footEl.innerHTML = `
        <div class="gkp-foot-info">
          ${hasMeals
            ? `${state.meals.length} meal${state.meals.length !== 1 ? 's' : ''}${state.ingredients.length ? ` · ${state.ingredients.length} ing` : ''} → <b id="${instId}-prodPreview"></b>`
            : 'Add at least one meal'}
        </div>
        <div class="gkp-btns">
          <button class="gkp-btn gkp-btn-outline" id="${instId}-draftBtn" ${!hasMeals ? 'disabled' : ''}>Draft</button>
          <button class="gkp-btn gkp-btn-primary" id="${instId}-saveBtn" ${!hasMeals ? 'disabled' : ''}>Save Production</button>
        </div>`;

      const dateEl = document.getElementById(instId + '-date');
      if (dateEl) dateEl.value = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      updatePreviewNumbers();
      bindEvents();
    }

    function renderMealChips() {
      if (!state.meals.length) return `<div class="gkp-empty">Type a meal name, set qty, press +</div>`;
      return `<div class="gkp-chips">${state.meals.map(m => `
        <div class="gkp-chip">
          <span class="gkp-chip-name">${_esc(m.name)}</span>
          <span class="gkp-chip-meta">${_fmtQty(m.qty)} ${_esc(m.unit)}</span>
          <button type="button" class="gkp-chip-x" data-rm-meal="${m.id}" title="Remove">×</button>
        </div>`).join('')}</div>`;
    }

    function renderIngChips() {
      if (!state.ingredients.length) return `<div class="gkp-empty">Type ingredient, qty used, press +</div>`;
      return `<div class="gkp-chips">${state.ingredients.map(i => {
        const avail = stockFor(i.name);
        const short = avail !== null && i.qty > avail;
        return `<div class="gkp-chip">
          <span class="gkp-chip-name">${_esc(i.name)}</span>
          <span class="gkp-chip-meta ${short ? 'warn' : ''}">${_fmtQty(i.qty)} ${_esc(i.unit)}${avail !== null ? ` · ${ _fmtQty(avail)} on hand` : ''}</span>
          <button type="button" class="gkp-chip-x" data-rm-ing="${i.id}" title="Remove">×</button>
        </div>`;
      }).join('')}</div>`;
    }

    function updatePreviewNumbers() {
      const bp = document.getElementById(instId + '-batchPreview');
      if (bp) bp.textContent = 'BATCH-' + String(nextSeq(batches, 'batchNo', 'BATCH')).padStart(5, '0');
      const pp = document.getElementById(instId + '-prodPreview');
      if (pp) pp.textContent = 'PROD-' + String(nextSeq(productions, 'no', 'PROD')).padStart(5, '0');
    }

    // ── Events ──
    function bindEvents() {
      bodyEl.querySelectorAll('[data-toggle]').forEach(el => {
        el.addEventListener('click', () => toggleSection(el.dataset.toggle));
      });

      const by = document.getElementById(instId + '-by');
      if (by) by.addEventListener('input', e => { state.preparedBy = e.target.value; });
      const rm = document.getElementById(instId + '-remarks');
      if (rm) rm.addEventListener('input', e => { state.remarks = e.target.value; });

      // Meals search-to-add
      const ms = document.getElementById(instId + '-mealSearch');
      if (ms) {
        ms.addEventListener('input', e => { state.mealSearch = e.target.value; });
        ms.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addMealRow(); } });
      }
      const mq = document.getElementById(instId + '-mealQty');
      if (mq) mq.addEventListener('input', e => { state.mealQty = parseFloat(e.target.value) || 0; });
      const mu = document.getElementById(instId + '-mealUnit');
      if (mu) mu.addEventListener('change', e => { state.mealUnit = e.target.value; });
      const amb = document.getElementById(instId + '-addMealBtn');
      if (amb) amb.addEventListener('click', addMealRow);

      // Ingredients search-to-add
      const is = document.getElementById(instId + '-ingSearch');
      if (is) {
        is.addEventListener('input', e => {
          state.ingSearch = e.target.value;
          if (!state.ingUnit) {
            const u = unitFor(e.target.value);
            if (u) {
              state.ingUnit = u;
              const uEl = document.getElementById(instId + '-ingUnit');
              if (uEl) uEl.value = u;
            }
          }
        });
        is.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addIngredientRow(); } });
      }
      const iq = document.getElementById(instId + '-ingQty');
      if (iq) {
        iq.addEventListener('input', e => { state.ingQty = e.target.value; });
        iq.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addIngredientRow(); } });
      }
      const iu = document.getElementById(instId + '-ingUnit');
      if (iu) iu.addEventListener('input', e => { state.ingUnit = e.target.value; });
      const aib = document.getElementById(instId + '-addIngBtn');
      if (aib) aib.addEventListener('click', addIngredientRow);

      bodyEl.querySelectorAll('[data-rm-meal]').forEach(el => el.addEventListener('click', () => removeMealRow(el.dataset.rmMeal)));
      bodyEl.querySelectorAll('[data-rm-ing]').forEach(el => el.addEventListener('click', () => removeIngredientRow(el.dataset.rmIng)));

      bodyEl.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => { state.mode = el.dataset.mode; render(); }));

      const deptSel = document.getElementById(instId + '-dept');
      if (deptSel) deptSel.addEventListener('change', e => { state.department = e.target.value; render(); });
      const customDeptInp = document.getElementById(instId + '-customDept');
      if (customDeptInp) customDeptInp.addEventListener('input', e => { state.customDept = e.target.value; });
      const orderSel = document.getElementById(instId + '-order');
      if (orderSel) orderSel.addEventListener('change', e => { state.linkedOrder = e.target.value; });

      const draftBtn = document.getElementById(instId + '-draftBtn');
      if (draftBtn) draftBtn.addEventListener('click', () => saveBatch(true));
      const saveBtn = document.getElementById(instId + '-saveBtn');
      if (saveBtn) saveBtn.addEventListener('click', () => saveBatch(false));
    }

    function addMealRow() {
      const name = state.mealSearch.trim();
      if (!name) { showToast('Enter a meal name.', 'error'); return; }
      if (!state.mealQty || state.mealQty <= 0) { showToast('Enter a valid quantity.', 'error'); return; }
      // Merge if same meal+unit already in batch
      const existing = state.meals.find(m => m.name.toLowerCase() === name.toLowerCase() && m.unit === state.mealUnit);
      if (existing) {
        existing.qty += state.mealQty;
      } else {
        state.meals.push({ id: _uid('m'), name, qty: state.mealQty, unit: state.mealUnit });
      }
      state.mealSearch = '';
      state.mealQty = 10;
      if (!openSections.has('meals')) openSections.add('meals');
      render();
      // Focus back on search for rapid entry
      setTimeout(() => { const el = document.getElementById(instId + '-mealSearch'); if (el) el.focus(); }, 30);
    }

    function removeMealRow(id) {
      state.meals = state.meals.filter(m => m.id !== id);
      render();
    }

    function addIngredientRow() {
      const name = state.ingSearch.trim();
      if (!name) { showToast('Enter an ingredient name.', 'error'); return; }
      const qty = parseFloat(state.ingQty);
      if (isNaN(qty) || qty <= 0) { showToast('Enter a valid quantity used.', 'error'); return; }
      const unit = state.ingUnit.trim() || unitFor(name) || '';
      const existing = state.ingredients.find(i => i.name.toLowerCase() === name.toLowerCase() && i.unit === unit);
      if (existing) {
        existing.qty += qty;
      } else {
        state.ingredients.push({ id: _uid('i'), name, qty, unit });
      }
      state.ingSearch = '';
      state.ingQty = '';
      state.ingUnit = '';
      if (!openSections.has('ings')) openSections.add('ings');
      render();
      setTimeout(() => { const el = document.getElementById(instId + '-ingSearch'); if (el) el.focus(); }, 30);
    }

    function removeIngredientRow(id) {
      state.ingredients = state.ingredients.filter(i => i.id !== id);
      render();
    }

    // ── Validation + Save ──
    function validate() {
      if (state.meals.length === 0) return 'Add at least one meal to this batch.';
      if (!state.preparedBy.trim()) return 'Please enter who prepared this production.';
      if (state.mode === 'rts') {
        if (!state.department) return 'Select a department to transfer to.';
        if (state.department === OTHER_VALUE && !state.customDept.trim()) return 'Enter the custom department name.';
      } else {
        if (!state.linkedOrder) return 'Select the linked order for Cook-on-Order.';
      }
      return null;
    }

    async function saveBatch(isDraft) {
      if (!isDraft) {
        const err = validate();
        if (err) { showToast(err, 'error'); return; }
      } else if (!state.preparedBy.trim()) {
        showToast('Please enter who prepared this, even for a draft.', 'error');
        return;
      }

      const batchNo = 'BATCH-' + String(nextSeq(batches, 'batchNo', 'BATCH')).padStart(5, '0');
      const no = 'PROD-' + String(nextSeq(productions, 'no', 'PROD')).padStart(5, '0');
      const time = nowTime();
      const full = nowFull();
      const destination = state.mode === 'rts' ? (state.department === OTHER_VALUE ? state.customDept.trim() : state.department) : '';
      const status = isDraft ? 'draft' : (state.mode === 'rts' ? 'sent' : 'completed');

      const mealsSnap = state.meals.map(m => ({ name: m.name, qty: m.qty, unit: m.unit }));
      const ingSnap = state.ingredients.map(i => ({ name: i.name, qty: i.qty, unit: i.unit }));

      if (!isDraft) {
        const parts = [];
        ingSnap.forEach(({ name, qty, unit }) => {
          deductStock(name, qty);
          parts.push(`${name} −${_fmtQty(qty)} ${unit || ''}`.trim());
        });
        movements.unshift({ type: 'Production', ref: no, text: parts.join(', ') || 'No ingredients logged', time });
      }

      const rec = {
        no, batchNo, meals: mealsSnap, ingredients: ingSnap, type: state.mode, status, time,
        by: state.preparedBy, remarks: state.remarks,
        linkedOrder: state.mode === 'coo' ? state.linkedOrder : '',
        destination, transferNo: '',
      };
      productions.unshift(rec);

      let transferNo = '';
      if (!isDraft && state.mode === 'rts') {
        transferNo = 'KTN-' + String(nextSeq(transfers, 'transferNo', 'KTN')).padStart(5, '0');
        transfers.unshift({
          transferNo, batchNo, meals: mealsSnap, kitchen: KITCHEN_NAME, destination,
          sentBy: state.preparedBy, dateSent: full, dateReceived: '', status: 'sent', remarks: state.remarks,
        });
        rec.transferNo = transferNo;
      }

      batches.unshift({
        batchNo, no, meals: mealsSnap, ingredients: ingSnap, mode: state.mode,
        destination: state.mode === 'rts' ? destination : '',
        linkedOrder: state.mode === 'coo' ? state.linkedOrder : '',
        status: isDraft ? 'draft' : 'saved', by: state.preparedBy, remarks: state.remarks, date: full,
      });

      await Promise.all([
        saveShared(KEY_PRODUCTIONS, productions),
        saveShared(KEY_TRANSFERS, transfers),
        saveShared(KEY_STOCK, stock),
        saveShared(KEY_MOVEMENTS, movements),
        saveShared(KEY_BATCHES, batches),
      ]);

      if (isDraft) showToast(`${batchNo} saved as draft (${mealsSnap.length} meal${mealsSnap.length !== 1 ? 's' : ''}).`, 'info');
      else if (state.mode === 'rts') showToast(`${batchNo} saved — transfer ${transferNo} sent to ${destination}.`, 'success');
      else showToast(`${batchNo} saved — linked to ${state.linkedOrder}.`, 'success');

      if (typeof options.onSave === 'function') options.onSave({ batchNo, no, meals: mealsSnap, ingredients: ingSnap, transferNo });

      state.meals = [];
      state.ingredients = [];
      state.remarks = '';
      state.department = departments[0] || '';
      state.customDept = '';
      state.mode = 'rts';
      state.mealSearch = ''; state.mealQty = 10; state.mealUnit = 'Plates';
      state.ingSearch = ''; state.ingQty = ''; state.ingUnit = '';
      openSections.clear();
      openSections.add('details');
      openSections.add('meals');
      openSections.add('destination');
      render();
      renderBatchHistory();
    }

    // ── Recent batches ──
    function renderBatchHistory() {
      if (!historyEl) return;
      if (!batches.length) {
        historyEl.innerHTML = `<div class="gkp-batch-list"><div class="gkp-empty">No batches saved yet.</div></div>`;
        return;
      }
      historyEl.innerHTML = `<div class="gkp-batch-list">${batches.slice(0, 30).map(b => {
        const open = expandedBatches.has(b.batchNo);
        const chip = b.status === 'draft'
          ? { bg: 'var(--gkp-amber-bg)', fg: 'var(--gkp-amber)', label: 'Draft' }
          : (b.mode === 'rts' ? { bg: 'var(--gkp-blue-bg)', fg: 'var(--gkp-blue)', label: 'Transferred' } : { bg: 'var(--gkp-green-bg)', fg: 'var(--gkp-green)', label: 'Cook-on-Order' });
        return `<div class="gkp-batch-row ${open ? 'open' : ''}">
          <div class="gkp-batch-head" data-toggle-batch="${_esc(b.batchNo)}">
            <div class="gkp-batch-hl">
              <span class="gkp-batch-chevron">▶</span>
              <b style="font-size:12.5px;">${_esc(b.batchNo)}</b>
              <span class="gkp-batch-tag" style="background:${chip.bg};color:${chip.fg};">${chip.label}</span>
              <span class="gkp-batch-meta">${b.meals.length} meal${b.meals.length !== 1 ? 's' : ''} · ${_esc(b.by || '—')}</span>
            </div>
            <span class="gkp-batch-meta">${_esc(b.date || '')}</span>
          </div>
          <div class="gkp-batch-body">
            <div class="gkp-batch-sub">Meals</div>
            <table class="gkp-mini">
              <thead><tr><th>Meal</th><th class="c">Qty</th><th class="c">Unit</th></tr></thead>
              <tbody>${b.meals.map(m => `<tr><td>${_esc(m.name)}</td><td class="c">${_fmtQty(m.qty)}</td><td class="c">${_esc(m.unit)}</td></tr>`).join('')}</tbody>
            </table>
            <div class="gkp-batch-sub">Ingredients</div>
            ${b.ingredients && b.ingredients.length
              ? `<table class="gkp-mini"><thead><tr><th>Ingredient</th><th class="c">Qty</th><th class="c">Unit</th></tr></thead><tbody>${b.ingredients.map(i => `<tr><td>${_esc(i.name)}</td><td class="c">${_fmtQty(i.qty)}</td><td class="c">${_esc(i.unit)}</td></tr>`).join('')}</tbody></table>`
              : `<div style="font-size:11px;color:var(--gkp-tx3);margin-bottom:4px;">None logged.</div>`}
            <div class="gkp-batch-foot">${b.mode === 'rts' ? `To <b>${_esc(b.destination || '—')}</b>` : `Order <b>${_esc(b.linkedOrder || '—')}</b>`}${b.remarks ? ` · ${_esc(b.remarks)}` : ''}</div>
          </div>
        </div>`;
      }).join('')}</div>`;

      historyEl.querySelectorAll('[data-toggle-batch]').forEach(el => el.addEventListener('click', () => {
        const id = el.dataset.toggleBatch;
        if (expandedBatches.has(id)) expandedBatches.delete(id); else expandedBatches.add(id);
        renderBatchHistory();
      }));
    }

    function showToast(msg, type = 'success') {
      const t = document.createElement('div');
      t.className = `gkp-toast ${type}`;
      t.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : 'ℹ ') + msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    }

    async function loadDepartments() {
      if (!options.departmentsApiUrl) return;
      try {
        const opts = { headers: {} };
        if (cfg.API_KEY) opts.headers['Authorization'] = `Bearer ${cfg.API_KEY}`;
        const res = await fetch(cfg.API_BASE + options.departmentsApiUrl, opts);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.departments || []);
        if (list.length) {
          departments = list;
          if (!departments.includes(state.department)) state.department = departments[0];
          render();
        }
      } catch (e) { console.warn('[GraceKitchenProduction] Falling back to default departments:', e.message); }
    }

    async function init() {
      stock       = await loadShared(KEY_STOCK, Array.isArray(stock) ? stock : stockList());
      productions = await loadShared(KEY_PRODUCTIONS, []);
      transfers   = await loadShared(KEY_TRANSFERS, []);
      movements   = await loadShared(KEY_MOVEMENTS, []);
      batches     = await loadShared(KEY_BATCHES, []);
      render();
      renderBatchHistory();
      loadDepartments();
    }
    init();

    return {
      refresh: () => { render(); renderBatchHistory(); },
      setStock(newStock) { stock = newStock; render(); },
      getState: () => state,
      destroy() { container.innerHTML = ''; },
    };
  }

  window.GraceKitchenProduction = { attach };

})();