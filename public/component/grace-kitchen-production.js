/**
 * grace-kitchen-production.js — Grace Hotel HMS Reusable Kitchen-Production Component
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="grace-kitchen-production.js"></script> in any page,
 * then attach it to a container:
 *
 *   const production = GraceKitchenProduction.attach('#productionPlaceholder', {
 *     recipes: { 'Fried Rice': { 'Rice':0.10, 'Oil':0.01, ... }, ... }, // meal -> {ingredient: qtyPerUnit}
 *     stock: { 'Rice':112, 'Oil':18, ... },      // name -> qty on hand, or a function(name) => qty
 *     stockUnits: { 'Rice':'kg', 'Oil':'Ltr' },  // optional, name -> unit label for display
 *     departments: ['Main Restaurant / POS','Pool Bar','Room Service'], // fallback/default list
 *     departmentsApiUrl: '/api/settings/departments', // optional — used when cfg.USE_DEMO is false
 *     openOrders: [{ id:'ORD-1057', label:'ORD-1057 — Table 4, 2 covers' }, ...],
 *     cfg: { API_BASE:'', API_KEY:'', USE_DEMO:true },
 *     kitchenName: 'Main Kitchen',
 *
 *     // Storage adapter — defaults to window.storage (Claude.ai preview) or
 *     // localStorage. Use the SAME adapter as your other Grace Hotel components
 *     // so everything reads/writes the same shared keys.
 *     storage: myStorageAdapter,
 *
 *     onSave: (batch) => { ... your API call, batch = { batchNo, productions, transfer } ... },
 *   });
 *
 *   production.refresh();   // re-render from current in-memory state
 *   production.setStock(newStockMap);  // update stock-on-hand and re-render
 *   production.destroy();   // remove and clean up
 *
 * ── DATA MODEL ────────────────────────────────────────────────────────
 * Writes to the SAME shared keys the original single-meal production
 * page used, so nothing downstream (transfers/stock pages) breaks:
 *   kitchen-productions  -> JSON array of { no, meal, qty, unit, type, status,
 *                            time, by, remarks, linkedOrder, deductions,
 *                            transferNo, batchNo }
 *   kitchen-transfers    -> JSON array of { transferNo, batchNo, meals:[...],
 *                            kitchen, destination, sentBy, dateSent, status, remarks }
 *   kitchen-stock        -> JSON array of { name, qty, unit, min }
 *   kitchen-movements    -> JSON array of { type, ref, text, time }
 *   kitchen-batches      -> JSON array of { batchNo, meals, mode, destination, date }
 *   (one Production No. per meal — real kitchen practice — grouped under one
 *   shared Batch No. for the collated summary / transfer note.)
 *
 * ── LIGHT / DARK ──────────────────────────────────────────────────────
 * All colors are var(--gkp-*) custom properties — override on the host
 * page or the container element to re-theme without touching this file.
 */

(function () {
  'use strict';

  if (window.__graceKitchenProduction) return;
  window.__graceKitchenProduction = true;

  // ══════════════════════════════════════════════════════════════════
  // CSS (gkp- prefixed, self-contained, injected once)
  // ══════════════════════════════════════════════════════════════════
  const CSS = `
    :root{
      --gkp-gold:#c9a84c; --gkp-gold-light:#e8c96a; --gkp-gold-dim:rgba(201,168,76,.12); --gkp-gold-border:rgba(201,168,76,.25);
      --gkp-green:#4ade80; --gkp-green-bg:rgba(74,222,128,.12);
      --gkp-red:#f87171; --gkp-red-bg:rgba(248,113,113,.12);
      --gkp-amber:#fbbf24; --gkp-amber-bg:rgba(251,191,36,.12);
      --gkp-blue:#60a5fa; --gkp-blue-bg:rgba(96,165,250,.12);
      --gkp-tx:#e8f0f8; --gkp-tx2:#a8bece; --gkp-tx3:#6a8a9e;
      --gkp-border:#1e3045; --gkp-card:#111e2b; --gkp-surface2:#162435; --gkp-surface3:#1c2e40; --gkp-input-bg:#0d1a27;
    }
    .gkp-wrap, .gkp-wrap *, .gkp-wrap *::before, .gkp-wrap *::after{ box-sizing:border-box; margin:0; padding:0; }
    .gkp-wrap{ font-family:'Outfit','Segoe UI',Arial,Helvetica,sans-serif; color:var(--gkp-tx); font-size:14px; display:flex; flex-direction:column; gap:14px; }

    .gkp-panel{ background:var(--gkp-card); border:1px solid var(--gkp-border); border-radius:14px; overflow:hidden; flex-shrink:0; }
    .gkp-panel-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 20px 14px; border-bottom:1px solid var(--gkp-border); flex-wrap:wrap; gap:8px; }
    .gkp-panel-title{ font-size:13px; font-weight:600; color:var(--gkp-tx); }
    .gkp-panel-body{ padding:20px; }
    @media (max-width:480px){ .gkp-panel-body{ padding:16px; } }

    .gkp-section-title{ font-size:9px; text-transform:uppercase; letter-spacing:2px; color:var(--gkp-gold); font-weight:600; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid var(--gkp-gold-border); }
    .gkp-form-row{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:16px; }
    @media (max-width:780px){ .gkp-form-row{ grid-template-columns:1fr 1fr; } }
    @media (max-width:480px){ .gkp-form-row{ grid-template-columns:1fr; } }
    .gkp-form-row.gkp-add-row{ grid-template-columns:2fr 1fr 1fr auto; align-items:end; }
    @media (max-width:700px){ .gkp-form-row.gkp-add-row{ grid-template-columns:1fr 1fr; } }
    .gkp-form-group{ display:flex; flex-direction:column; gap:5px; min-width:0; }
    .gkp-form-group.gkp-span2{ grid-column:span 2; }
    @media (max-width:480px){ .gkp-form-group.gkp-span2{ grid-column:span 1; } }
    .gkp-form-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.5px; color:var(--gkp-tx3); font-weight:500; }
    .gkp-form-label.gkp-req::after{ content:' *'; color:var(--gkp-red); }
    .gkp-input,.gkp-select,.gkp-textarea{ background:var(--gkp-input-bg); border:1px solid var(--gkp-border); border-radius:10px; padding:9px 12px; color:var(--gkp-tx); font-family:'Outfit',sans-serif; font-size:13px; outline:none; transition:border-color .2s; width:100%; }
    .gkp-input:focus,.gkp-select:focus,.gkp-textarea:focus{ border-color:var(--gkp-gold); }
    .gkp-input[readonly]{ opacity:.6; cursor:default; }
    .gkp-textarea{ resize:vertical; min-height:56px; }
    .gkp-qty-unit{ display:flex; gap:6px; }
    .gkp-qty-unit select{ max-width:100px; }

    .gkp-empty-note{ font-size:12.5px; color:var(--gkp-tx3); padding:16px; text-align:center; background:var(--gkp-surface2); border:1px dashed var(--gkp-border); border-radius:10px; margin-bottom:4px; }

    /* Tabs */
    .gkp-tabs{ display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; border-bottom:1px solid var(--gkp-border); padding-bottom:0; }
    .gkp-tab{ display:flex; align-items:center; gap:8px; padding:9px 14px; font-size:12.5px; font-weight:600; color:var(--gkp-tx2); background:var(--gkp-surface2); border:1px solid var(--gkp-border); border-bottom:none; border-radius:10px 10px 0 0; cursor:pointer; transition:all .15s; position:relative; top:1px; }
    .gkp-tab:hover{ color:var(--gkp-gold); }
    .gkp-tab.on{ background:var(--gkp-card); color:var(--gkp-gold); border-color:var(--gkp-gold-border); border-bottom:1px solid var(--gkp-card); }
    .gkp-tab.summary{ margin-left:auto; }
    .gkp-tab.summary.on{ color:var(--gkp-green); border-color:rgba(74,222,128,.35); }
    .gkp-tab .gkp-tab-x{ font-size:11px; color:var(--gkp-tx3); padding:1px 3px; border-radius:5px; line-height:1; }
    .gkp-tab .gkp-tab-x:hover{ color:var(--gkp-red); background:var(--gkp-red-bg); }
    .gkp-tab .gkp-tab-qty{ font-size:10.5px; color:var(--gkp-tx3); font-weight:400; }
    .gkp-tab.on .gkp-tab-qty{ color:var(--gkp-tx2); }

    .gkp-tab-content{ margin-bottom:16px; }

    /* Recipe box (per-meal tab) */
    .gkp-recipe-box{ background:var(--gkp-surface2); border:1px solid var(--gkp-border); border-radius:10px; padding:14px 16px; }
    .gkp-recipe-box-title{ font-size:10.5px; text-transform:uppercase; letter-spacing:1.2px; color:var(--gkp-gold); font-weight:600; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
    .gkp-recipe-edit{ display:flex; gap:8px; align-items:center; }
    .gkp-recipe-edit input{ width:70px; padding:5px 8px; font-size:12px; }
    .gkp-recipe-edit select{ width:auto; padding:5px 8px; font-size:12px; }
    .gkp-remove-meal{ background:none; border:1px solid rgba(248,113,113,.35); color:var(--gkp-red); border-radius:7px; padding:5px 10px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; }
    .gkp-remove-meal:hover{ background:var(--gkp-red-bg); }
    .gkp-ing-row{ display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--gkp-border); font-size:12.5px; flex-wrap:wrap; gap:4px; }
    .gkp-ing-row:last-child{ border-bottom:none; }
    .gkp-ing-name{ color:var(--gkp-tx2); }
    .gkp-ing-qty{ color:var(--gkp-tx); font-weight:600; }
    .gkp-ing-qty.low{ color:var(--gkp-red); }
    .gkp-ing-avail{ font-size:10.5px; color:var(--gkp-tx3); margin-left:8px; }
    .gkp-recipe-hint{ font-size:11px; color:var(--gkp-tx3); margin-top:10px; font-style:italic; }

    /* Summary tab */
    .gkp-summary-table{ width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:16px; }
    .gkp-summary-table th{ text-align:left; padding:8px 10px; font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--gkp-tx3); font-weight:600; background:var(--gkp-surface2); border-bottom:1px solid var(--gkp-border); white-space:nowrap; }
    .gkp-summary-table td{ padding:8px 10px; border-bottom:1px solid var(--gkp-border); color:var(--gkp-tx); }
    .gkp-summary-table tr:last-child td{ border-bottom:none; }
    .gkp-summary-table td.center{ text-align:center; } .gkp-summary-table th.center{ text-align:center; }

    .gkp-mode-row{ display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
    .gkp-mode-card{ flex:1; min-width:220px; display:flex; align-items:center; gap:12px; padding:14px 16px; background:var(--gkp-input-bg); border:1.5px solid var(--gkp-border); border-radius:10px; cursor:pointer; transition:all .18s; }
    .gkp-mode-card:hover{ border-color:var(--gkp-gold-border); }
    .gkp-mode-card.on{ background:var(--gkp-gold-dim); border-color:var(--gkp-gold); }
    .gkp-mode-icon{ width:34px; height:34px; border-radius:9px; background:var(--gkp-surface2); display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
    .gkp-mode-card.on .gkp-mode-icon{ background:rgba(201,168,76,.2); }
    .gkp-mode-title{ font-size:13.5px; font-weight:700; color:var(--gkp-tx); }
    .gkp-mode-sub{ font-size:11px; color:var(--gkp-tx3); margin-top:2px; line-height:1.4; }
    .gkp-mode-card.on .gkp-mode-sub{ color:var(--gkp-tx2); }

    .gkp-toolbar-bottom{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding-top:16px; border-top:1px solid var(--gkp-border); flex-wrap:wrap; }
    .gkp-toolbar-bottom .gkp-btns{ display:flex; gap:10px; flex-wrap:wrap; }

    .gkp-btn{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-family:'Outfit',sans-serif; font-size:12.5px; font-weight:500; cursor:pointer; transition:all .2s; white-space:nowrap; border:1px solid transparent; }
    .gkp-btn-primary{ background:var(--gkp-gold); color:#000; font-weight:600; }
    .gkp-btn-primary:hover{ background:var(--gkp-gold-light); transform:translateY(-1px); }
    .gkp-btn-outline{ background:none; border-color:var(--gkp-border); color:var(--gkp-tx2); }
    .gkp-btn-outline:hover{ border-color:var(--gkp-gold); color:var(--gkp-gold); }
    .gkp-btn-add{ background:var(--gkp-gold-dim); border-color:var(--gkp-gold-border); color:var(--gkp-gold-light); font-weight:600; }
    .gkp-btn-add:hover{ background:var(--gkp-gold-dim); filter:brightness(1.15); }
    .gkp-btn-sm{ padding:6px 12px; font-size:11.5px; }
    .gkp-field-error{ font-size:11px; color:var(--gkp-red); margin-top:2px; display:none; }
    .gkp-field-error.show{ display:block; }
    .gkp-input.err, .gkp-select.err{ border-color:var(--gkp-red); }

    .gkp-toast{ position:fixed; bottom:20px; right:20px; background:var(--gkp-card); border:1px solid var(--gkp-border); border-radius:10px; padding:11px 16px; font-size:12.5px; color:var(--gkp-tx); box-shadow:0 8px 28px rgba(0,0,0,.3); z-index:9999; display:flex; align-items:center; gap:8px; animation:gkpToastIn .3s ease; max-width:calc(100vw - 40px); font-family:'Outfit','Segoe UI',Arial,Helvetica,sans-serif; }
    .gkp-toast.success{ border-left:3px solid var(--gkp-green); }
    .gkp-toast.error{ border-left:3px solid var(--gkp-red); }
    .gkp-toast.info{ border-left:3px solid var(--gkp-blue); }
    @keyframes gkpToastIn{ from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

    .gkp-wrap ::-webkit-scrollbar{ width:6px; height:6px; }
    .gkp-wrap ::-webkit-scrollbar-track{ background:transparent; }
    .gkp-wrap ::-webkit-scrollbar-thumb{ background:var(--gkp-border); border-radius:6px; }
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
  function _injectFonts() {
    if (document.getElementById('gkp-fonts')) return;
    const link = document.createElement('link');
    link.id = 'gkp-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }

  // ══════════════════════════════════════════════════════════════════
  // Defaults
  // ══════════════════════════════════════════════════════════════════
  const DEFAULT_STORAGE = window.storage || {
    async get(key, shared) { const v = localStorage.getItem(key); return v == null ? null : { key, value: v, shared }; },
    async set(key, value, shared) { localStorage.setItem(key, value); return { key, value, shared }; },
    async list(prefix, shared) { const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)); return { keys, prefix, shared }; },
  };

  const DEFAULT_RECIPES = {
    'Fried Rice':  { 'Rice':0.10, 'Oil':0.01, 'Curry':0.02, 'Green Peas':0.015, 'Chicken':0.05, 'Seasoning':0.003 },
    'Jollof Rice': { 'Rice':0.10, 'Oil':0.012, 'Tomato':0.03, 'Pepper':0.015, 'Chicken':0.05, 'Seasoning':0.003 },
    'Egusi Soup':  { 'Egusi':0.06, 'Palm Oil':0.02, 'Spinach':0.04, 'Chicken':0.04, 'Seasoning':0.003 },
    'Pepper Soup': { 'Chicken':0.08, 'Pepper':0.02, 'Seasoning':0.004, 'Scent Leaf':0.01 },
    'Moi Moi':     { 'Beans Flour':0.08, 'Oil':0.01, 'Egg':0.05, 'Seasoning':0.002 },
  };
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

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _fmtQty(n) { return (Math.round((n || 0) * 100) / 100).toString(); }

  let _instanceCounter = 0;

  // ══════════════════════════════════════════════════════════════════
  // attach()
  // ══════════════════════════════════════════════════════════════════
  function attach(target, options) {
    options = options || {};
    _injectFonts();
    _injectStyles();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[GraceKitchenProduction] Target not found:', target); return null; }

    const instId = 'gkp' + (++_instanceCounter);
    const storage = options.storage || DEFAULT_STORAGE;
    const cfg = Object.assign({ API_BASE: '', API_KEY: '', USE_DEMO: true }, options.cfg || {});
    const RECIPES = options.recipes || DEFAULT_RECIPES;
    const KITCHEN_NAME = options.kitchenName || 'Main Kitchen';
    const openOrders = options.openOrders || DEFAULT_OPEN_ORDERS;
    let departments = (options.departments && options.departments.length) ? options.departments.slice() : DEFAULT_DEPARTMENTS.slice();

    let stock = options.stock || DEFAULT_STOCK;
    function stockList() { return Array.isArray(stock) ? stock : Object.keys(stock).map(name => ({ name, qty: stock[name], unit: (options.stockUnits && options.stockUnits[name]) || '' })); }
    function stockFor(name) {
      if (typeof stock === 'function') return stock(name) || 0;
      if (Array.isArray(stock)) { const s = stock.find(x => x.name === name); return s ? s.qty : 0; }
      const k = Object.keys(stock).find(s => s.toLowerCase() === (name || '').trim().toLowerCase());
      return k ? stock[k] : 0;
    }
    function unitFor(name) {
      if (Array.isArray(stock)) { const s = stock.find(x => x.name === name); return s ? s.unit : ''; }
      return (options.stockUnits && options.stockUnits[name]) || '';
    }
    function deductStock(name, amount) {
      if (Array.isArray(stock)) { const s = stock.find(x => x.name === name); if (s) s.qty = Math.max(0, s.qty - amount); }
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

    // ── State ──
    const state = {
      preparedBy: options.preparedBy || '',
      remarks: '',
      mealList: [],          // [{ meal, qty, unit }]
      activeTab: null,       // meal name or 'summary'
      addMeal: Object.keys(RECIPES)[0] || '',
      addQty: 10,
      addUnit: 'Plates',
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
            <div class="gkp-panel-title">📋 Production Form — multi-meal batch</div>
            <span style="font-size:12px;color:var(--gkp-tx3);">Next batch: <b id="${instId}-batchPreview" style="color:var(--gkp-gold-light);">BATCH-00001</b></span>
          </div>
          <div class="gkp-panel-body" id="${instId}-body"></div>
        </div>
      </div>`;

    const bodyEl = document.getElementById(instId + '-body');

    // ── Combined ingredient deduction across every added meal ──
    function combinedDeductions() {
      const map = {};
      state.mealList.forEach(({ meal, qty }) => {
        const recipe = RECIPES[meal] || {};
        Object.entries(recipe).forEach(([ing, perUnit]) => {
          map[ing] = (map[ing] || 0) + perUnit * qty;
        });
      });
      return map;
    }

    // ── Render ──
    function render() {
      const hasMeals = state.mealList.length > 0;

      const addMealOptions = Object.keys(RECIPES).map(m => `<option value="${_esc(m)}" ${state.addMeal === m ? 'selected' : ''}>${_esc(m)}</option>`).join('');

      const tabsHtml = hasMeals ? `
        <div class="gkp-tabs">
          ${state.mealList.map(m => `
            <div class="gkp-tab ${state.activeTab === m.meal ? 'on' : ''}" data-tab="${_esc(m.meal)}">
              <span>${_esc(m.meal)}</span><span class="gkp-tab-qty">×${_fmtQty(m.qty)}</span>
              <span class="gkp-tab-x" data-remove-meal="${_esc(m.meal)}" title="Remove meal">✕</span>
            </div>`).join('')}
          <div class="gkp-tab summary ${state.activeTab === 'summary' ? 'on' : ''}" data-tab="summary">📊 Summary</div>
        </div>` : '';

      let tabContentHtml = '';
      if (!hasMeals) {
        tabContentHtml = `<div class="gkp-empty-note">No meals added yet. Choose a meal and quantity above, then click <b>+ Add Meal</b> to begin building this production batch.</div>`;
      } else if (state.activeTab === 'summary') {
        tabContentHtml = renderSummaryTab();
      } else {
        tabContentHtml = renderMealTab(state.activeTab);
      }

      bodyEl.innerHTML = `
        <div class="gkp-section-title">Production Details</div>
        <div class="gkp-form-row">
          <div class="gkp-form-group"><label class="gkp-form-label">Production Date</label><input class="gkp-input" id="${instId}-date" readonly></div>
          <div class="gkp-form-group"><label class="gkp-form-label gkp-req">Prepared By</label><input class="gkp-input" id="${instId}-by" placeholder="Chef name" value="${_esc(state.preparedBy)}"></div>
          <div class="gkp-form-group"><label class="gkp-form-label">Remarks (whole batch)</label><input class="gkp-input" id="${instId}-remarks" placeholder="e.g. Lunch preparation" value="${_esc(state.remarks)}"></div>
        </div>

        <div class="gkp-section-title">Add Meals to This Production</div>
        <div class="gkp-form-row gkp-add-row">
          <div class="gkp-form-group"><label class="gkp-form-label">Meal</label><select class="gkp-select" id="${instId}-addMeal">${addMealOptions}</select></div>
          <div class="gkp-form-group"><label class="gkp-form-label">Quantity</label>
            <div class="gkp-qty-unit"><input class="gkp-input" type="number" min="1" id="${instId}-addQty" value="${state.addQty}"><select class="gkp-select" id="${instId}-addUnit"><option ${state.addUnit==='Plates'?'selected':''}>Plates</option><option ${state.addUnit==='Portions'?'selected':''}>Portions</option><option ${state.addUnit==='Trays'?'selected':''}>Trays</option></select></div>
          </div>
          <div></div>
          <div><button class="gkp-btn gkp-btn-add" id="${instId}-addBtn">+ Add Meal</button></div>
        </div>

        ${tabsHtml}
        <div class="gkp-tab-content">${tabContentHtml}</div>

        <div class="gkp-toolbar-bottom">
          <div style="font-size:12px;color:var(--gkp-tx3);">${hasMeals ? `${state.mealList.length} meal${state.mealList.length !== 1 ? 's' : ''} in this batch — will save as <b id="${instId}-prodPreview" style="color:var(--gkp-gold-light);"></b>` : 'Add at least one meal to continue'}</div>
          <div class="gkp-btns">
            <button class="gkp-btn gkp-btn-outline gkp-btn-sm" id="${instId}-draftBtn" ${!hasMeals ? 'disabled' : ''}>💾 Save Draft</button>
            <button class="gkp-btn gkp-btn-primary gkp-btn-sm" id="${instId}-saveBtn" ${!hasMeals ? 'disabled' : ''}>✓ Save Production</button>
          </div>
        </div>`;

      document.getElementById(instId + '-date').value = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      updatePreviewNumbers();
      bindEvents();
    }

    function renderMealTab(meal) {
      const entry = state.mealList.find(m => m.meal === meal);
      if (!entry) return '';
      const recipe = RECIPES[meal] || {};
      const rows = Object.entries(recipe).map(([ing, perUnit]) => {
        const need = perUnit * entry.qty;
        const avail = stockFor(ing);
        const unit = unitFor(ing);
        const short = need > avail;
        return `<div class="gkp-ing-row">
          <span class="gkp-ing-name">${_esc(ing)}</span>
          <span><span class="gkp-ing-qty ${short ? 'low' : ''}">${_fmtQty(need)} ${_esc(unit)}</span><span class="gkp-ing-avail">(${_fmtQty(avail)} on hand)</span></span>
        </div>`;
      }).join('');

      return `<div class="gkp-recipe-box">
        <div class="gkp-recipe-box-title">
          <span>${_esc(meal)} — recipe preview</span>
          <div class="gkp-recipe-edit">
            <input type="number" min="1" value="${entry.qty}" data-meal-qty="${_esc(meal)}">
            <select data-meal-unit="${_esc(meal)}"><option ${entry.unit==='Plates'?'selected':''}>Plates</option><option ${entry.unit==='Portions'?'selected':''}>Portions</option><option ${entry.unit==='Trays'?'selected':''}>Trays</option></select>
            <button class="gkp-remove-meal" data-remove-meal="${_esc(meal)}">✕ Remove Meal</button>
          </div>
        </div>
        ${rows || '<div style="font-size:12px;color:var(--gkp-tx3);">No recipe mapped for this meal.</div>'}
        <div class="gkp-recipe-hint">This shows stock on hand only for this single meal. See the Summary tab for the combined check across every meal in this batch before saving.</div>
      </div>`;
    }

    function renderSummaryTab() {
      const combined = combinedDeductions();
      const mealsRows = state.mealList.map(m => `<tr><td>${_esc(m.meal)}</td><td class="center">${_fmtQty(m.qty)}</td><td class="center">${_esc(m.unit)}</td></tr>`).join('');
      const combinedRows = Object.entries(combined).map(([ing, need]) => {
        const avail = stockFor(ing);
        const unit = unitFor(ing);
        const short = need > avail;
        return `<tr><td>${_esc(ing)}</td><td class="center ${short ? 'gkp-ing-qty low' : ''}">${_fmtQty(need)} ${_esc(unit)}</td><td class="center">${_fmtQty(avail)} ${_esc(unit)}</td><td class="center">${short ? '⚠ Short' : '✓ OK'}</td></tr>`;
      }).join('');

      const deptOptions = departments.map(d => `<option value="${_esc(d)}" ${state.department === d ? 'selected' : ''}>${_esc(d)}</option>`).join('')
        + `<option value="${OTHER_VALUE}" ${state.department === OTHER_VALUE ? 'selected' : ''}>+ Other (enter manually)</option>`;
      const orderOptions = openOrders.map(o => `<option value="${_esc(o.id)}" ${state.linkedOrder === o.id ? 'selected' : ''}>${_esc(o.label)}</option>`).join('');

      return `
        <div class="gkp-section-title">Meals in This Batch</div>
        <table class="gkp-summary-table">
          <thead><tr><th>Meal</th><th class="center">Qty</th><th class="center">Unit</th></tr></thead>
          <tbody>${mealsRows}</tbody>
        </table>

        <div class="gkp-section-title">📉 Combined Inventory Deduction — across all meals</div>
        <table class="gkp-summary-table">
          <thead><tr><th>Ingredient</th><th class="center">Total Needed</th><th class="center">On Hand</th><th class="center">Status</th></tr></thead>
          <tbody>${combinedRows || '<tr><td colspan="4" style="text-align:center;color:var(--gkp-tx3);">No recipe ingredients mapped.</td></tr>'}</tbody>
        </table>

        <div class="gkp-section-title">Destination — Ready-to-Serve or Cook-on-Order</div>
        <div class="gkp-mode-row">
          <div class="gkp-mode-card ${state.mode === 'rts' ? 'on' : ''}" data-mode="rts">
            <div class="gkp-mode-icon">🚚</div>
            <div><div class="gkp-mode-title">Ready-to-Serve</div><div class="gkp-mode-sub">Finished meals transfer to a department's stock — sold once accepted.</div></div>
          </div>
          <div class="gkp-mode-card ${state.mode === 'coo' ? 'on' : ''}" data-mode="coo">
            <div class="gkp-mode-icon">🍽</div>
            <div><div class="gkp-mode-title">Cook-on-Order</div><div class="gkp-mode-sub">Linked directly to a customer order — goes straight to the guest.</div></div>
          </div>
        </div>

        ${state.mode === 'rts' ? `
          <div class="gkp-form-row">
            <div class="gkp-form-group gkp-span2"><label class="gkp-form-label gkp-req">Transfer To Department</label>
              <select class="gkp-select" id="${instId}-dept">${deptOptions}</select>
            </div>
            ${state.department === OTHER_VALUE ? `<div class="gkp-form-group"><label class="gkp-form-label gkp-req">Custom Department Name</label><input class="gkp-input" id="${instId}-customDept" placeholder="Type department name" value="${_esc(state.customDept)}"></div>` : ''}
          </div>` : `
          <div class="gkp-form-row">
            <div class="gkp-form-group gkp-span2"><label class="gkp-form-label gkp-req">Linked Order</label>
              <select class="gkp-select" id="${instId}-order">${orderOptions}</select>
            </div>
          </div>`}
      `;
    }

    function updatePreviewNumbers() {
      const bp = document.getElementById(instId + '-batchPreview');
      if (bp) bp.textContent = 'BATCH-' + String(nextSeq(batches, 'batchNo', 'BATCH')).padStart(5, '0');
      const pp = document.getElementById(instId + '-prodPreview');
      if (pp) {
        const start = nextSeq(productions, 'no', 'PROD');
        const count = state.mealList.length;
        pp.textContent = count > 1 ? `PROD-${String(start).padStart(5,'0')} … PROD-${String(start+count-1).padStart(5,'0')}` : `PROD-${String(start).padStart(5,'0')}`;
      }
    }

    // ── Events ──
    function bindEvents() {
      document.getElementById(instId + '-by').addEventListener('input', e => { state.preparedBy = e.target.value; });
      document.getElementById(instId + '-remarks').addEventListener('input', e => { state.remarks = e.target.value; });
      document.getElementById(instId + '-addMeal').addEventListener('change', e => { state.addMeal = e.target.value; });
      document.getElementById(instId + '-addQty').addEventListener('input', e => { state.addQty = parseFloat(e.target.value) || 0; });
      document.getElementById(instId + '-addUnit').addEventListener('change', e => { state.addUnit = e.target.value; });
      document.getElementById(instId + '-addBtn').addEventListener('click', addMeal);

      bodyEl.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { state.activeTab = el.dataset.tab; render(); }));
      bodyEl.querySelectorAll('[data-remove-meal]').forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); removeMeal(el.dataset.removeMeal); }));

      bodyEl.querySelectorAll('[data-meal-qty]').forEach(el => el.addEventListener('input', () => {
        const m = state.mealList.find(x => x.meal === el.dataset.mealQty);
        if (m) { m.qty = parseFloat(el.value) || 0; renderTabsOnly(); }
      }));
      bodyEl.querySelectorAll('[data-meal-unit]').forEach(el => el.addEventListener('change', () => {
        const m = state.mealList.find(x => x.meal === el.dataset.mealUnit);
        if (m) m.unit = el.value;
      }));

      const modeCards = bodyEl.querySelectorAll('[data-mode]');
      modeCards.forEach(el => el.addEventListener('click', () => { state.mode = el.dataset.mode; render(); }));

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

    // Lightweight re-render used only for live-editing a meal's qty from
    // its own tab, so typing in the qty field doesn't steal focus.
    function renderTabsOnly() {
      const activeContent = bodyEl.querySelector('.gkp-tab-content');
      if (state.activeTab && state.activeTab !== 'summary') activeContent.innerHTML = renderMealTab(state.activeTab);
      bodyEl.querySelectorAll('.gkp-tab .gkp-tab-qty').forEach((el, i) => { if (state.mealList[i]) el.textContent = '×' + _fmtQty(state.mealList[i].qty); });
      updatePreviewNumbers();
    }

    function addMeal() {
      if (!state.addMeal) { showToast('Choose a meal first.', 'error'); return; }
      if (state.addQty <= 0) { showToast('Enter a valid quantity.', 'error'); return; }
      const existing = state.mealList.find(m => m.meal === state.addMeal);
      if (existing) {
        existing.qty += state.addQty;
        showToast(`${state.addMeal} was already in this batch — quantity merged.`, 'info');
      } else {
        state.mealList.push({ meal: state.addMeal, qty: state.addQty, unit: state.addUnit });
      }
      state.activeTab = state.addMeal;
      state.addQty = 10;
      render();
    }

    function removeMeal(meal) {
      state.mealList = state.mealList.filter(m => m.meal !== meal);
      if (state.activeTab === meal) state.activeTab = state.mealList[0] ? state.mealList[0].meal : null;
      render();
    }

    // ── Validation + Save ──
    function validate() {
      if (state.mealList.length === 0) return 'Add at least one meal before saving.';
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
        if (err) { showToast(err, 'error'); if (state.activeTab !== 'summary' && state.mealList.length) { state.activeTab = 'summary'; render(); } return; }
      } else if (!state.preparedBy.trim()) {
        showToast('Please enter who prepared this, even for a draft.', 'error');
        return;
      }

      const batchNo = 'BATCH-' + String(nextSeq(batches, 'batchNo', 'BATCH')).padStart(5, '0');
      const time = nowTime();
      const full = nowFull();
      const destination = state.mode === 'rts' ? (state.department === OTHER_VALUE ? state.customDept.trim() : state.department) : '';
      const newProductions = [];

      state.mealList.forEach(({ meal, qty, unit }) => {
        const no = 'PROD-' + String(nextSeq(productions, 'no', 'PROD')).padStart(5, '0');
        const status = isDraft ? 'draft' : (state.mode === 'rts' ? 'sent' : 'completed');
        const deductions = [];

        if (!isDraft) {
          const recipe = RECIPES[meal] || {};
          const parts = [];
          Object.entries(recipe).forEach(([ing, perUnit]) => {
            const need = perUnit * qty;
            deductStock(ing, need);
            deductions.push({ ing, qty: need, unit: unitFor(ing) });
            parts.push(`${ing} −${_fmtQty(need)} ${unitFor(ing)}`);
          });
          movements.unshift({ type: 'Production', ref: no, text: parts.join(', ') || 'No recipe mapped', time });
        }

        const rec = { no, meal, qty, unit, type: state.mode, status, time, by: state.preparedBy, remarks: state.remarks, linkedOrder: state.mode === 'coo' ? state.linkedOrder : '', deductions, transferNo: '', batchNo };
        productions.unshift(rec);
        newProductions.push(rec);
      });

      let transferNo = '';
      if (!isDraft && state.mode === 'rts') {
        transferNo = 'KTN-' + String(nextSeq(transfers, 'transferNo', 'KTN')).padStart(5, '0');
        transfers.unshift({
          transferNo, batchNo,
          meals: newProductions.map(p => ({ prodNo: p.no, meal: p.meal, qty: p.qty, unit: p.unit })),
          kitchen: KITCHEN_NAME, destination,
          sentBy: state.preparedBy, dateSent: full, dateReceived: '',
          status: 'sent', remarks: state.remarks,
        });
        newProductions.forEach(p => { p.transferNo = transferNo; });
      }

      batches.unshift({ batchNo, meals: newProductions.map(p => ({ prodNo: p.no, meal: p.meal, qty: p.qty, unit: p.unit })), mode: state.mode, destination: state.mode === 'rts' ? destination : '', linkedOrder: state.mode === 'coo' ? state.linkedOrder : '', status: isDraft ? 'draft' : 'saved', date: full });

      await Promise.all([
        saveShared(KEY_PRODUCTIONS, productions),
        saveShared(KEY_TRANSFERS, transfers),
        saveShared(KEY_STOCK, stock),
        saveShared(KEY_MOVEMENTS, movements),
        saveShared(KEY_BATCHES, batches),
      ]);

      if (isDraft) showToast(`${batchNo} saved as draft (${newProductions.length} meal${newProductions.length !== 1 ? 's' : ''}).`, 'info');
      else if (state.mode === 'rts') showToast(`${batchNo} saved — transfer ${transferNo} sent to ${destination}.`, 'success');
      else showToast(`${batchNo} saved — linked to ${state.linkedOrder}, served directly to guest.`, 'success');

      if (typeof options.onSave === 'function') options.onSave({ batchNo, productions: newProductions, transferNo });

      // reset for next batch
      state.mealList = [];
      state.activeTab = null;
      state.remarks = '';
      state.department = departments[0] || '';
      state.customDept = '';
      state.mode = 'rts';
      render();
    }

    function showToast(msg, type = 'success') {
      const t = document.createElement('div');
      t.className = `gkp-toast ${type}`;
      t.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : 'ℹ ') + msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3400);
    }

    // ── Live department list (real deployment) ──
    async function loadDepartments() {
      if (cfg.USE_DEMO || !options.departmentsApiUrl) return;
      try {
        const opts = { headers: {} };
        if (cfg.API_KEY) opts.headers['Authorization'] = `Bearer ${cfg.API_KEY}`;
        const res = await fetch(cfg.API_BASE + options.departmentsApiUrl, opts);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.departments || []);
        if (list.length) { departments = list; if (!departments.includes(state.department)) state.department = departments[0]; render(); }
      } catch (e) { console.warn('[GraceKitchenProduction] Falling back to default departments:', e.message); }
    }

    // ── Init ──
    async function init() {
      stock       = await loadShared(KEY_STOCK, Array.isArray(stock) ? stock : stockList());
      productions = await loadShared(KEY_PRODUCTIONS, []);
      transfers   = await loadShared(KEY_TRANSFERS, []);
      movements   = await loadShared(KEY_MOVEMENTS, []);
      batches     = await loadShared(KEY_BATCHES, []);
      render();
      loadDepartments();
    }
    init();

    // ── Public control object ──
    return {
      refresh: render,
      setStock(newStock) { stock = newStock; render(); },
      getState: () => state,
      destroy() { container.innerHTML = ''; },
    };
  }

  window.GraceKitchenProduction = { attach };

})();