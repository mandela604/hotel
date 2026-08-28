/**
 * grace-request-form.js — Grace Hotel HMS Reusable Request Form Component
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="grace-request-form.js"></script> in any page,
 * then attach it to a container:
 *
 *   // Restaurant / Pool Bar page (can only requisition FROM Store):
 *   const form = GraceHotelRequestForm.attach('#requestFormPlaceholder', {
 *     section: 'restaurant',                // 'restaurant' | 'poolbar' | 'store'
 *     currentUser: { name: 'Ngozi Adeyemi' },// view-only "Requested By" — never typed
 *     service: RestaurantService,           // owns this section's own item list
 *     storeService: StoreService,           // REQUIRED — owns requisition numbering/persistence
 *     fulfillCenters: ['Central Store'],
 *     onSubmit: (entry) => { ... },
 *   });
 *
 *   // Store's own page (can only requisition FROM Procurement):
 *   const form = GraceHotelRequestForm.attach('#requestFormPlaceholder', {
 *     section: 'store',
 *     currentUser: { name: 'Abu Ibrahim' },
 *     service: StoreService,                // its own inventory is the catalog
 *     storeService: StoreService,
 *   });
 *
 *   form.reset();              // clear the form back to zero items
 *   form.destroy();            // remove and clean up
 *
 * ── SERVICE IS REQUIRED — NO STANDALONE MODE ────────────────────────
 * `options.storeService` (services/store-service.js) is required. This
 * component has no fallback path that talks to storage/localStorage
 * directly — every submission goes through
 * `storeService.submitRequisition()`, which owns numbering + persistence.
 *
 * Prototyping vs. production is entirely StoreService's concern (it can
 * write to localStorage today and a real API tomorrow) — this component
 * never needs to know which, because it never touches storage itself.
 *
 * ── SECTION DRIVES EVERYTHING ────────────────────────────────────────
 * `section` is who is opening the form, and it is the single source of
 * truth for three things that used to be user-editable and are now not:
 *
 *   1. Requesting From (routing) — fixed, not a picker. Only Store can
 *      ever raise a request to Procurement; Restaurant and Pool Bar have
 *      no route to Procurement at all — they can only requisition FROM
 *      Store. So:
 *        section: 'restaurant' | 'poolbar'  -> mode is always 'store_issue',
 *                                               destination is always Store
 *        section: 'store'                   -> mode is always 'purchase',
 *                                               destination is always Procurement
 *
 *   2. Requested By / Department — both render as read-only. "Requested
 *      By" comes from `currentUser` (the signed-in session), never typed.
 *      "Department" is always the section's own label — never an
 *      independent dropdown a Restaurant user could set to "Store".
 *      (Fields are still locked/readonly exactly as before — only the
 *      "🔒 from your session" / "🔒 from section" label text has been
 *      removed.)
 *
 *   3. Item catalog — you can only requisition items your OWN department
 *      actually tracks: Restaurant/Pool Bar search their own menu/stock
 *      (`service.state.stock`), Store searches its own inventory
 *      (`service.state.catalog` / `service.state.stock`). The search box
 *      only accepts an exact catalog match — no free-text "unknown item".
 *
 * `section` is optional for backward compatibility: omit it and the form
 * falls back to its original behavior (editable Department dropdown,
 * clickable Store/Procurement picker, "Store can't issue to itself"
 * auto-lock). The item catalog restriction (point 3) applies either way —
 * pass `catalog` or `getCatalog` if you're not passing `section`+`service`.
 *
 * ── DATA MODEL ────────────────────────────────────────────────────────
 *   {
 *     no, mode: 'store_issue'|'purchase', by, dept, needed, priority: 'Normal'|'Urgent',
 *     remark, fulfillStore, supplier, linked,
 *     items: [{ name, unit, qty, cost, remark, issuedQty:0 }],
 *     status: 'Pending', dateRaised, dateRaisedDisplay,
 *   }
 *
 * ── LIGHT / DARK ──────────────────────────────────────────────────────
 * Ships dark by default. All colors are var(--ghrf-*) custom properties —
 * override them on the host page or on the container element to re-theme.
 */

(function () {
  'use strict';

  if (window.__graceRequestForm) return;
  window.__graceRequestForm = true;

  // ══════════════════════════════════════════════════════════════════
  // CSS (ghrf- prefixed, self-contained, injected once)
  // ══════════════════════════════════════════════════════════════════
  const CSS = `
    :root{
      --ghrf-gold:#c9a84c; --ghrf-gold-light:#e8c96a; --ghrf-gold-dim:rgba(201,168,76,.12); --ghrf-gold-border:rgba(201,168,76,.25);
      --ghrf-green:#4ade80; --ghrf-green-bg:rgba(74,222,128,.12);
      --ghrf-amber:#fbbf24; --ghrf-amber-bg:rgba(251,191,36,.12);
      --ghrf-red:#f87171; --ghrf-red-bg:rgba(248,113,113,.12);
      --ghrf-blue:#60a5fa; --ghrf-blue-bg:rgba(96,165,250,.12);
      --ghrf-purple:#a78bfa; --ghrf-purple-bg:rgba(167,139,250,.12);
      --ghrf-tx:#e8f0f8; --ghrf-tx2:#a8bece; --ghrf-tx3:#6a8a9e;
      --ghrf-border:#1e3045; --ghrf-card:#111e2b; --ghrf-surface2:#162435; --ghrf-input-bg:#0d1a27;
    }
    .ghrf-wrap{font-family:'Outfit','Segoe UI',Arial,Helvetica,sans-serif; color:var(--ghrf-tx); font-size:14px; display:flex; flex-direction:column; gap:16px;}
    .ghrf-card{ background:var(--ghrf-card); border:1px solid var(--ghrf-border); border-radius:12px; padding:18px 20px; }
    .ghrf-card-header{ display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--ghrf-gold); letter-spacing:.8px; text-transform:uppercase; margin-bottom:14px; }
    .ghrf-card-sub{ font-size:11.5px; color:var(--ghrf-tx3); margin:-8px 0 14px; }
    .ghrf-mode-row{ display:flex; gap:12px; flex-wrap:wrap; }
    .ghrf-mode-card{ flex:1; min-width:220px; display:flex; align-items:center; gap:12px; padding:16px 18px; background:var(--ghrf-input-bg); border:1.5px solid var(--ghrf-border); border-radius:12px; cursor:pointer; transition:all .18s; }
    .ghrf-mode-card:hover{ border-color:var(--ghrf-gold-border); }
    .ghrf-mode-card.on{ background:var(--ghrf-gold-dim); border-color:var(--ghrf-gold); box-shadow:0 4px 16px rgba(201,168,76,.12); }
    .ghrf-mode-card.disabled{ opacity:.4; cursor:not-allowed; pointer-events:none; }
    .ghrf-mode-card.fixed{ cursor:default; background:var(--ghrf-gold-dim); border-color:var(--ghrf-gold); box-shadow:0 4px 16px rgba(201,168,76,.12); }
    .ghrf-mode-icon{ width:38px; height:38px; border-radius:10px; background:var(--ghrf-surface2); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
    .ghrf-mode-card.on .ghrf-mode-icon, .ghrf-mode-card.fixed .ghrf-mode-icon{ background:rgba(201,168,76,.2); }
    .ghrf-mode-title{ font-size:14px; font-weight:700; color:var(--ghrf-tx); }
    .ghrf-mode-sub{ font-size:11.5px; color:var(--ghrf-tx3); margin-top:2px; line-height:1.4; }
    .ghrf-mode-card.on .ghrf-mode-sub, .ghrf-mode-card.fixed .ghrf-mode-sub{ color:var(--ghrf-tx2); }
    .ghrf-mode-note{ display:flex; align-items:flex-start; gap:8px; background:rgba(96,165,250,.06); border:1px solid var(--ghrf-blue-bg); border-radius:8px; padding:9px 12px; font-size:11.5px; color:var(--ghrf-tx2); line-height:1.5; margin-top:12px; }
    .ghrf-mode-note b{ color:var(--ghrf-blue); }
    .ghrf-mode-fixed-note{ display:flex; align-items:center; gap:7px; font-size:11px; color:var(--ghrf-tx3); margin-top:12px; }
    .ghrf-mode-fixed-note b{ color:var(--ghrf-tx2); }
    .ghrf-form-row{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px; }
    @media (max-width:780px){ .ghrf-form-row{ grid-template-columns:1fr 1fr; } }
    @media (max-width:480px){ .ghrf-form-row{ grid-template-columns:1fr; } }
    .ghrf-fg{ display:flex; flex-direction:column; gap:5px; }
    .ghrf-fg.span2{ grid-column:span 2; } .ghrf-fg.span3{ grid-column:span 3; }
    @media (max-width:780px){ .ghrf-fg.span3{ grid-column:span 2; } }
    @media (max-width:480px){ .ghrf-fg.span2, .ghrf-fg.span3{ grid-column:span 1; } }
    .ghrf-label{ font-size:10px; text-transform:uppercase; letter-spacing:1.2px; color:var(--ghrf-tx3); font-weight:500; display:flex; align-items:center; gap:6px; }
    .ghrf-input, .ghrf-select, .ghrf-textarea{ background:var(--ghrf-input-bg); border:1px solid var(--ghrf-border); border-radius:8px; padding:9px 12px; color:var(--ghrf-tx); font-family:inherit; font-size:13px; outline:none; transition:border-color .2s; width:100%; }
    .ghrf-input:focus, .ghrf-select:focus, .ghrf-textarea:focus{ border-color:var(--ghrf-gold-border); }
    .ghrf-input[readonly]{ opacity:.65; cursor:default; background:var(--ghrf-surface2); }
    .ghrf-textarea{ resize:vertical; min-height:58px; }
    .ghrf-prio-row{ display:flex; gap:8px; }
    .ghrf-prio-btn{ flex:1; text-align:center; padding:9px 8px; border:1px solid var(--ghrf-border); border-radius:8px; font-size:12.5px; font-weight:600; color:var(--ghrf-tx2); cursor:pointer; transition:all .15s; background:var(--ghrf-input-bg); }
    .ghrf-prio-btn.on.normal{ background:var(--ghrf-blue-bg); border-color:rgba(96,165,250,.4); color:var(--ghrf-blue); }
    .ghrf-prio-btn.on.urgent{ background:var(--ghrf-red-bg); border-color:rgba(248,113,113,.4); color:var(--ghrf-red); }
    .ghrf-link-note{ display:flex; align-items:flex-start; gap:8px; background:rgba(251,191,36,.06); border:1px solid var(--ghrf-amber-bg); border-radius:8px; padding:9px 12px; font-size:11.5px; color:var(--ghrf-tx2); line-height:1.5; margin-top:4px; }
    .ghrf-link-note b{ color:var(--ghrf-amber); }
    .ghrf-item-search-row{ display:flex; gap:10px; align-items:flex-end; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--ghrf-border); flex-wrap:wrap; }
    .ghrf-item-search-row .ghrf-fg{ flex:1; min-width:200px; }
    .ghrf-btn-add-item{ background:var(--ghrf-gold); color:#0a1520; border:none; border-radius:8px; padding:9px 18px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap; transition:background .15s; font-family:inherit; }
    .ghrf-btn-add-item:hover{ background:var(--ghrf-gold-light); }
    .ghrf-item-hint{ font-size:10.5px; color:var(--ghrf-tx3); margin-top:4px; }
    .ghrf-items-table-wrap{ overflow-x:auto; border:1px solid var(--ghrf-border); border-radius:10px; }
    .ghrf-items-table{ width:100%; min-width:640px; border-collapse:collapse; }
    .ghrf-items-table thead th{ text-align:left; font-size:10px; color:var(--ghrf-tx3); font-weight:700; letter-spacing:.5px; text-transform:uppercase; padding:9px 12px; background:var(--ghrf-surface2); border-bottom:1px solid var(--ghrf-border); white-space:nowrap; }
    .ghrf-items-table thead th.center{ text-align:center; }
    .ghrf-items-table tbody td{ padding:8px 12px; font-size:12.5px; border-bottom:1px solid var(--ghrf-border); color:var(--ghrf-tx); vertical-align:middle; }
    .ghrf-items-table tbody tr:last-child td{ border-bottom:none; }
    .ghrf-items-table tbody td.center{ text-align:center; }
    .ghrf-items-table .ghrf-item-name-cell{ font-weight:600; white-space:nowrap; }
    .ghrf-items-table .ghrf-item-unit-cell{ color:var(--ghrf-tx3); white-space:nowrap; }
    .ghrf-items-table input.ghrf-input{ padding:7px 9px; font-size:12.5px; }
    .ghrf-items-empty-row td{ text-align:center; padding:20px; color:var(--ghrf-tx3); font-size:12.5px; }
    .ghrf-qty{ padding:5px 9px; border:1px solid var(--ghrf-border); background:var(--ghrf-card); border-radius:6px; font-size:12.5px; color:var(--ghrf-tx); display:flex; align-items:center; justify-content:space-between; transition:border-color .15s; min-width:90px; }
    .ghrf-qty:focus-within{ border-color:var(--ghrf-gold-border); }
    .ghrf-qty input{ border:none; outline:none; flex:1; min-width:0; font-size:12.5px; font-family:inherit; color:var(--ghrf-tx); background:transparent; text-align:center; }
    .ghrf-stepper{ display:flex; flex-direction:column; color:var(--ghrf-tx3); font-size:9px; cursor:pointer; line-height:1; gap:2px; user-select:none; }
    .ghrf-stepper span:hover{ color:var(--ghrf-gold); }
    .ghrf-item-remove{ background:none; border:1px solid var(--ghrf-border); border-radius:6px; width:26px; height:26px; color:var(--ghrf-tx3); cursor:pointer; font-size:12px; transition:all .15s; flex-shrink:0; }
    .ghrf-item-remove:hover{ border-color:var(--ghrf-red); color:var(--ghrf-red); }
    .ghrf-items-summary{ display:flex; gap:20px; flex-wrap:wrap; padding-top:14px; margin-top:12px; border-top:1px solid var(--ghrf-border); font-size:12.5px; color:var(--ghrf-tx2); }
    .ghrf-items-summary b{ color:var(--ghrf-tx); }
    .ghrf-submit-bar{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
    .ghrf-preview{ font-size:12.5px; color:var(--ghrf-tx2); }
    .ghrf-preview b{ color:var(--ghrf-gold-light); font-size:15px; }
    .ghrf-actions{ display:flex; gap:10px; }
    .ghrf-btn{ padding:11px 20px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; white-space:nowrap; border:none; font-family:inherit; }
    .ghrf-btn-reset{ background:var(--ghrf-card); border:1px solid var(--ghrf-border); color:var(--ghrf-tx); }
    .ghrf-btn-reset:hover{ border-color:var(--ghrf-red); color:var(--ghrf-red); }
    .ghrf-btn-submit{ background:var(--ghrf-gold); color:#0a1520; }
    .ghrf-btn-submit:hover{ background:var(--ghrf-gold-light); }
    .ghrf-btn-submit:disabled{ opacity:.6; cursor:default; }
    .ghrf-toast{ position:fixed; bottom:20px; right:20px; background:var(--ghrf-card); border:1px solid var(--ghrf-border); border-radius:10px; padding:11px 16px; font-size:12.5px; color:var(--ghrf-tx); box-shadow:0 8px 28px rgba(0,0,0,.3); z-index:9999; display:flex; align-items:center; gap:8px; animation:ghrfToastIn .3s ease; max-width:calc(100vw - 40px); font-family:inherit; }
    .ghrf-toast.success{ border-left:3px solid var(--ghrf-green); }
    .ghrf-toast.error{ border-left:3px solid var(--ghrf-red); }
    @keyframes ghrfToastIn{ from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'ghrf-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  // ══════════════════════════════════════════════════════════════════
  // Defaults (catalog-only — no storage adapter, that's StoreService's job)
  // ══════════════════════════════════════════════════════════════════
  const DEFAULT_DEPARTMENTS = ['Kitchen', 'Housekeeping', 'Bar', 'Front Desk', 'Maintenance', 'Store'];
  const DEFAULT_FULFILL_CENTERS = ['Central Store', 'Main Kitchen Store', 'Housekeeping Store'];
  const DEFAULT_CATALOG = [
    { name: 'Rice (Long Grain)', unit: 'kg' }, { name: 'Palm Oil', unit: 'Ltr' },
    { name: 'Chicken (Frozen)', unit: 'kg' }, { name: 'Tomatoes', unit: 'kg' }, { name: 'Onions', unit: 'kg' },
    { name: 'Star Lager', unit: 'Bottles' }, { name: 'Heineken', unit: 'Bottles' }, { name: 'Hennessy VS', unit: 'Bottles' },
    { name: 'Bottled Water 1.5L', unit: 'Cartons' }, { name: 'Ice Cream Tubs', unit: 'Pieces' },
    { name: 'Bleach 5L', unit: 'Ltr' }, { name: 'Floor Cleaner 5L', unit: 'Ltr' }, { name: 'Industrial Detergent 10kg', unit: 'Bags' },
    { name: 'Glass Cleaner 1L', unit: 'Ltr' }, { name: 'King Duvet Set', unit: 'Pieces' }, { name: 'Pillow Cases (pair)', unit: 'Pieces' },
    { name: 'Guest Shampoo 250ml', unit: 'Pieces' }, { name: 'Commercial Dishwasher', unit: 'Pieces' },
    { name: 'POS Terminal', unit: 'Pieces' }, { name: 'Branded Envelopes', unit: 'Packs' },
  ];

  // Only Store can ever raise a request to Procurement — Restaurant and
  // Pool Bar have no route to Procurement at all, they can only
  // requisition FROM Store. This is the single place that routing rule
  // lives when `section` is supplied.
  const SECTION_META = {
    restaurant: {
      deptLabel: 'Restaurant / Bar', mode: 'store_issue',
      destIcon: '🏬', destTitle: 'Store',
      destSub: 'Issue items already held in stock — the classic department requisition.',
      fixedNote: 'Restaurant / Bar can only requisition from Store.',
    },
    poolbar: {
      deptLabel: 'Pool Bar', mode: 'store_issue',
      destIcon: '🏬', destTitle: 'Store',
      destSub: 'Issue items already held in stock — the classic department requisition.',
      fixedNote: 'Pool Bar can only requisition from Store.',
    },
    store: {
      deptLabel: 'Store', mode: 'purchase',
      destIcon: '🛒', destTitle: 'Procurement',
      destSub: 'Buy something new or restock from a supplier — routed to Procurement.',
      fixedNote: 'Store is the only department that can raise a request to Procurement.',
    },
  };

  function _fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function _todayDisplay() { return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function _escAttr(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  let _instanceCounter = 0;

  // ══════════════════════════════════════════════════════════════════
  // attach()
  // ══════════════════════════════════════════════════════════════════
  function attach(target, options) {
    options = options || {};
    _injectStyles();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[GraceHotelRequestForm] Target not found:', target); return null; }

    const storeService = options.storeService;
    if (!storeService || typeof storeService.submitRequisition !== 'function') {
      console.error('[GraceHotelRequestForm] options.storeService is required (services/store-service.js) — this component has no standalone/offline mode.');
      container.innerHTML = `<div class="ghrf-wrap"><div class="ghrf-card">Store service was not provided. This component cannot submit requisitions without it.</div></div>`;
      return null;
    }

    const instId = 'ghrf' + (++_instanceCounter);
    const dataService = options.service || null; // owns this section's own item list
    const DEPARTMENTS = options.departments || DEFAULT_DEPARTMENTS;
    const FULFILL_CENTERS = options.fulfillCenters || options.fulfillStores || DEFAULT_FULFILL_CENTERS;
    const currentUser = Object.assign({ name: '' }, options.currentUser || {});

    // section is optional — when present it locks routing + requester +
    // department + catalog source, per the header docs above.
    const section = options.section && SECTION_META[options.section] ? options.section : null;
    const meta = section ? SECTION_META[section] : null;

    // ── Catalog — resolved live (not cached) so it always reflects the
    // current service state, since RestaurantService/PoolBarService/
    // StoreService load their stock asynchronously after attach().
    function resolveCatalog() {
      if (typeof options.getCatalog === 'function') {
        const c = options.getCatalog();
        return Array.isArray(c) ? c : [];
      }
      if (Array.isArray(options.catalog)) return options.catalog;
      // For store_issue mode (departments requesting from Store), use
      // Store's stock catalog so departments pick items Store actually has.
      if (mode === 'store_issue' && storeService && storeService.state) {
        if (storeService.state.catalog && storeService.state.catalog.length) {
          return storeService.state.catalog;
        }
        if (Array.isArray(storeService.state.stock)) {
          return storeService.state.stock.map(i => ({ name: i.name, unit: i.unit, id: i.id, stockQty: i.qty }));
        }
      }
      if (dataService && dataService.state) {
        if (dataService.state.catalog && dataService.state.catalog.length) {
          return dataService.state.catalog;
        }
        if (Array.isArray(dataService.state.stock)) {
          return dataService.state.stock.map(i => ({ name: i.name, unit: i.unit }));
        }
      }
      return DEFAULT_CATALOG;
    }
    function findCatalogItem(name) {
      const n = (name || '').trim().toLowerCase();
      return resolveCatalog().find(c => c.name.toLowerCase() === n) || null;
    }

    // ── Instance state ──
    let mode = meta ? meta.mode : (options.defaultMode || 'store_issue');
    let priority = 'Normal';
    let items = [];
    let itemSeq = 0;
    let unsubService = null;

    function newItemRow(catalogItem) {
      itemSeq++;
      return { rid: itemSeq, name: catalogItem.name, unit: catalogItem.unit, stockId: catalogItem.id || catalogItem.stockId || '', qty: '', cost: '', remark: '' };
    }

    // ── Shell ──
    const modeCardHtml = section
      ? `<div class="ghrf-mode-card fixed" data-fixed="1">
           <div class="ghrf-mode-icon">${meta.destIcon}</div>
           <div><div class="ghrf-mode-title">${meta.destTitle}</div><div class="ghrf-mode-sub">${meta.destSub}</div></div>
         </div>`
      : `<div class="ghrf-mode-card on" data-mode="store_issue">
           <div class="ghrf-mode-icon">🏬</div>
           <div><div class="ghrf-mode-title">Store</div><div class="ghrf-mode-sub">Issue items already held in stock — the classic department requisition.</div></div>
         </div>
         <div class="ghrf-mode-card" data-mode="purchase">
           <div class="ghrf-mode-icon">🛒</div>
           <div><div class="ghrf-mode-title">Procurement</div><div class="ghrf-mode-sub">Buy something new or restock from a supplier — routed to Procurement.</div></div>
         </div>`;

    const byFieldHtml = section
      ? `<input class="ghrf-input" data-f="by" readonly>`
      : `<input class="ghrf-input" data-f="by" placeholder="Your name">`;
    const deptFieldHtml = section
      ? `<input class="ghrf-input" data-f="dept" readonly>`
      : `<select class="ghrf-select" data-f="dept">${DEPARTMENTS.map(d => `<option>${d}</option>`).join('')}</select>`;

    container.innerHTML = `
      <div class="ghrf-wrap" id="${instId}">
        <div class="ghrf-card">
          <div class="ghrf-card-header">📨 Requesting From</div>
          <div class="ghrf-mode-row">${modeCardHtml}</div>
          ${section
            ? `<div class="ghrf-mode-fixed-note"><span>🔒</span><span>Fixed by department — <b>${meta.fixedNote}</b></span></div>`
            : `<div class="ghrf-mode-note" data-wrap="storenote" style="display:none;">
                 <span>ℹ️</span><div><b>Store</b> already holds the stock, so it can't issue to itself — a Store-department request is always routed to <b>Procurement</b> instead.</div>
               </div>`}
        </div>

        <div class="ghrf-card">
          <div class="ghrf-card-header">📋 Request Details</div>
          <div class="ghrf-form-row">
            <div class="ghrf-fg"><label class="ghrf-label">Requested By</label>${byFieldHtml}</div>
            <div class="ghrf-fg"><label class="ghrf-label">Department</label>${deptFieldHtml}</div>
            <div class="ghrf-fg"><label class="ghrf-label">Date Raised</label><input class="ghrf-input" data-f="dateRaised" readonly></div>
            <div class="ghrf-fg"><label class="ghrf-label">Needed By</label><input class="ghrf-input" type="date" data-f="needed"></div>
            <div class="ghrf-fg" data-wrap="fulfill"><label class="ghrf-label">Fulfilling Center</label>
              <select class="ghrf-select" data-f="fulfillStore">${FULFILL_CENTERS.map(s => `<option>${s}</option>`).join('')}</select>
            </div>
            <div class="ghrf-fg" data-wrap="supplier" style="display:none;"><label class="ghrf-label">Preferred Supplier</label><input class="ghrf-input" data-f="supplier" placeholder="e.g. Zenith Foods Ltd."></div>
            <div class="ghrf-fg"><label class="ghrf-label">Priority</label>
              <div class="ghrf-prio-row"><div class="ghrf-prio-btn on normal" data-prio="Normal">Normal</div><div class="ghrf-prio-btn urgent" data-prio="Urgent">Urgent</div></div>
            </div>
            <div class="ghrf-fg span2" data-wrap="linked" style="display:none;"><label class="ghrf-label">Linked Requisition</label><input class="ghrf-input" data-f="linked" placeholder="e.g. KREQ-2025-00045 — escalating a stock shortfall"></div>
            <div class="ghrf-fg span3"><label class="ghrf-label">Purpose / Remark</label><textarea class="ghrf-textarea" data-f="remark" placeholder="What is this request for?"></textarea></div>
          </div>
          <div class="ghrf-link-note" data-wrap="linknote" style="display:none;">
            <span>🔗</span><div>If Store couldn't fully issue an item on a requisition, reference that requisition number above — the shortfall stays traceable back to where it started instead of becoming a disconnected purchase request.</div>
          </div>
        </div>

        <div class="ghrf-card">
          <div class="ghrf-card-header">📦 Items</div>
          <div class="ghrf-card-sub" data-role="catalogNote">Search an item, add it, then fill in the quantity and any details.</div>
          <div class="ghrf-item-search-row">
            <div class="ghrf-fg">
              <label class="ghrf-label">Search Item</label>
              <input class="ghrf-input" list="${instId}-catalog" data-role="itemSearch" placeholder="Type to search…">
              <div class="ghrf-item-hint" data-role="itemHint"></div>
            </div>
            <button type="button" class="ghrf-btn-add-item" data-act="addSearchedItem">＋ Add Item</button>
          </div>
          <datalist id="${instId}-catalog"></datalist>
          <div class="ghrf-items-table-wrap">
            <table class="ghrf-items-table">
              <thead data-role="itemsThead"></thead>
              <tbody data-role="itemsBody"></tbody>
            </table>
          </div>
          <div class="ghrf-items-summary" data-role="itemsSummary"></div>
        </div>

        <div class="ghrf-card">
          <div class="ghrf-submit-bar">
            <div class="ghrf-preview">This will be raised as <b data-role="previewNumber">—</b> · routed to <b data-role="previewRoute">Store</b></div>
            <div class="ghrf-actions">
              <button class="ghrf-btn ghrf-btn-reset" data-act="reset">↺ Reset</button>
              <button class="ghrf-btn ghrf-btn-submit" data-act="submit">✓ Submit Request</button>
            </div>
          </div>
        </div>
      </div>`;

    const root = container.querySelector('#' + instId);

    function populateCatalogDatalist() {
      root.querySelector(`#${instId}-catalog`).innerHTML =
        resolveCatalog().map(c => `<option value="${_escAttr(c.name)}">`).join('');
    }
    populateCatalogDatalist();

    // ── Mode / priority ──
    function setMode(m) {
      if (section) {
        console.warn('[GraceHotelRequestForm] setMode() has no effect — routing is fixed by section:', section);
        return;
      }
      mode = m;
      root.querySelectorAll('.ghrf-mode-card').forEach(c => c.classList.toggle('on', c.dataset.mode === m));
      applyModeVisibility();
      renderItems();
      updatePreview();
      if (typeof options.onModeChange === 'function') options.onModeChange(m);
    }
    function applyModeVisibility() {
      root.querySelector('[data-wrap="fulfill"]').style.display = mode === 'store_issue' ? '' : 'none';
      root.querySelector('[data-wrap="supplier"]').style.display = mode === 'purchase' ? '' : 'none';
      root.querySelector('[data-wrap="linked"]').style.display = mode === 'purchase' ? '' : 'none';
      root.querySelector('[data-wrap="linknote"]').style.display = mode === 'purchase' ? 'flex' : 'none';
    }
    function setPriority(p) {
      priority = p;
      root.querySelector('[data-prio="Normal"]').classList.toggle('on', p === 'Normal');
      root.querySelector('[data-prio="Urgent"]').classList.toggle('on', p === 'Urgent');
    }

    // Legacy-only: Store can't issue stock to itself — when Department =
    // Store, lock the mode picker to Procurement. Not needed when
    // `section` is supplied, since Department is no longer editable.
    function updateModeAvailability() {
      if (section) return;
      const dept = root.querySelector('[data-f="dept"]').value;
      const storeCard = root.querySelector('.ghrf-mode-card[data-mode="store_issue"]');
      const noteEl = root.querySelector('[data-wrap="storenote"]');
      const isStore = dept === 'Store';
      storeCard.classList.toggle('disabled', isStore);
      noteEl.style.display = isStore ? 'flex' : 'none';
      if (isStore && mode === 'store_issue') setMode('purchase');
    }

    // ── Items — search-then-add. Only an exact catalog match can be
    // added; there is no free-text "unknown item" path. ──
    function onSearchInput() {
      const val = root.querySelector('[data-role="itemSearch"]').value.trim();
      const hint = root.querySelector('[data-role="itemHint"]');
      if (!val) { hint.textContent = ''; return; }
      const match = findCatalogItem(val);
      const deptLabel = meta ? meta.deptLabel : 'this department';
      hint.textContent = match
        ? `✓ ${match.name} — ${match.unit}. Press Enter or "＋ Add Item" to add.`
        : `Not in ${deptLabel}'s item list — pick a suggestion from the dropdown.`;
    }
    function tryAddSearchedItem() {
      const input = root.querySelector('[data-role="itemSearch"]');
      const val = input.value.trim();
      const deptLabel = meta ? meta.deptLabel : 'this department';
      if (!val) { showToast('Type or select an item to add.', 'error'); return; }
      const match = findCatalogItem(val);
      if (!match) { showToast(`"${val}" is not in ${deptLabel}'s item list.`, 'error'); return; }
      if (items.some(i => i.name.toLowerCase() === match.name.toLowerCase())) {
        showToast(`${match.name} is already on this request.`, 'error');
        return;
      }
      items.push(newItemRow(match));
      input.value = '';
      root.querySelector('[data-role="itemHint"]').textContent = '';
      renderItems();
    }

    function removeItemRow(rid) { items = items.filter(i => i.rid !== rid); renderItems(); }
    function updateItemField(rid, field, value) { const it = items.find(i => i.rid === rid); if (it) it[field] = value; if (field === 'qty' || field === 'cost') renderItems(true); }
    function stepField(rid, field, delta) { const it = items.find(i => i.rid === rid); if (!it) return; const cur = parseFloat(it[field]) || 0; it[field] = Math.max(0, cur + delta); renderItems(); }

    // ── Items table (header changes with mode: purchase adds Cost + Total) ──
    function renderItemsTableHead() {
      const thead = root.querySelector('[data-role="itemsThead"]');
      thead.innerHTML = `<tr>
          <th>Item</th>
          <th>Unit</th>
          <th class="center">Qty Requested</th>
          ${mode === 'purchase' ? '<th class="center">Est. Unit Cost (₦)</th><th class="center">Est. Total (₦)</th>' : ''}
          <th>Remarks</th>
          <th class="center"></th>
        </tr>`;
    }

    function renderItems(quiet) {
      renderItemsTableHead();
      const body = root.querySelector('[data-role="itemsBody"]');
      const deptLabel = meta ? meta.deptLabel : 'this department';
      const colspan = mode === 'purchase' ? 7 : 5;

      if (!items.length) {
        body.innerHTML = `<tr class="ghrf-items-empty-row"><td colspan="${colspan}">No items yet — search ${deptLabel}'s items above and add one.</td></tr>`;
      } else {
        body.innerHTML = items.map(it => {
          const qty = parseFloat(it.qty) || 0, cost = parseFloat(it.cost) || 0, total = qty * cost;
          const costCells = mode === 'purchase' ? `
            <td class="center"><div class="ghrf-qty"><input type="text" inputmode="decimal" placeholder="0" value="${_escAttr(it.cost)}" data-item="${it.rid}" data-field="cost"><span class="ghrf-stepper"><span data-step="${it.rid}" data-stepfield="cost" data-delta="100">▲</span><span data-step="${it.rid}" data-stepfield="cost" data-delta="-100">▼</span></span></div></td>
            <td class="center">${_fmtN(total)}</td>` : '';
          return `<tr>
            <td class="ghrf-item-name-cell">${_escAttr(it.name)}</td>
            <td class="ghrf-item-unit-cell">${_escAttr(it.unit)}</td>
            <td class="center"><div class="ghrf-qty"><input type="text" inputmode="decimal" placeholder="0" value="${_escAttr(it.qty)}" data-item="${it.rid}" data-field="qty"><span class="ghrf-stepper"><span data-step="${it.rid}" data-stepfield="qty" data-delta="1">▲</span><span data-step="${it.rid}" data-stepfield="qty" data-delta="-1">▼</span></span></div></td>
            ${costCells}
            <td><input class="ghrf-input" placeholder="Optional note" value="${_escAttr(it.remark)}" data-item="${it.rid}" data-field="remark"></td>
            <td class="center"><button class="ghrf-item-remove" data-removeitem="${it.rid}" title="Remove this item">✕</button></td>
          </tr>`;
        }).join('');
      }

      const totalCost = items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.cost) || 0), 0);
      root.querySelector('[data-role="itemsSummary"]').innerHTML = mode === 'purchase'
        ? `<span><b>${items.length}</b> item${items.length !== 1 ? 's' : ''}</span><span>Est. total cost: <b>${_fmtN(totalCost)}</b></span>`
        : `<span><b>${items.length}</b> item${items.length !== 1 ? 's' : ''} requested</span>`;

      body.querySelectorAll('[data-item]').forEach(inp => {
        const rid = parseInt(inp.dataset.item, 10), field = inp.dataset.field;
        inp.addEventListener('input', () => updateItemField(rid, field, inp.value));
      });
      body.querySelectorAll('[data-step]').forEach(btn => {
        btn.addEventListener('click', () => stepField(parseInt(btn.dataset.step, 10), btn.dataset.stepfield, parseFloat(btn.dataset.delta)));
      });
      body.querySelectorAll('[data-removeitem]').forEach(btn => {
        btn.addEventListener('click', () => removeItemRow(parseInt(btn.dataset.removeitem, 10)));
      });

      if (!quiet) updatePreview();
    }

    // ── Numbering — always via StoreService, which owns the counter ──
    async function peekNextNumber() {
      return storeService.peekNextNumber(root.querySelector('[data-f="dept"]').value, mode);
    }
    async function updatePreview() {
      root.querySelector('[data-role="previewNumber"]').textContent = await peekNextNumber();
      root.querySelector('[data-role="previewRoute"]').textContent = meta ? meta.destTitle : (mode === 'purchase' ? 'Procurement' : 'Store');
    }

    // ── Reset / submit ──
    function resetForm() {
      if (section) {
        root.querySelector('[data-f="by"]').value = currentUser.name || '';
        root.querySelector('[data-f="dept"]').value = meta.deptLabel;
      } else {
        root.querySelector('[data-f="by"]').value = currentUser.name || '';
        root.querySelector('[data-f="dept"]').value = mode === 'purchase' ? 'Store' : DEPARTMENTS[0];
      }
      root.querySelector('[data-f="needed"]').value = '';
      const sup = root.querySelector('[data-f="supplier"]'); if (sup) sup.value = '';
      const lnk = root.querySelector('[data-f="linked"]'); if (lnk) lnk.value = '';
      root.querySelector('[data-f="remark"]').value = '';
      const fs = root.querySelector('[data-f="fulfillStore"]'); if (fs) fs.value = FULFILL_CENTERS[0];
      const search = root.querySelector('[data-role="itemSearch"]'); if (search) search.value = '';
      const hint = root.querySelector('[data-role="itemHint"]'); if (hint) hint.textContent = '';
      setPriority('Normal');
      items = [];
      renderItems();
      if (!section) { applyModeVisibility(); updateModeAvailability(); }
    }

    async function submitRequest() {
      const by = root.querySelector('[data-f="by"]').value.trim();
      const dept = root.querySelector('[data-f="dept"]').value;
      const needed = root.querySelector('[data-f="needed"]').value;
      const validItems = items.filter(i => i.name.trim() && (parseFloat(i.qty) || 0) > 0);

      if (!by) { showToast(section ? 'No requester on session — please sign in again.' : 'Please enter who is requesting.', 'error'); return; }
      if (!needed) { showToast('Please choose a needed-by date.', 'error'); return; }
      if (validItems.length === 0) { showToast('Add at least one item and enter its quantity.', 'error'); return; }
      if (!section && dept === 'Store' && mode === 'store_issue') { showToast('Store cannot issue stock to itself — switch to Procurement.', 'error'); return; }

      const btn = root.querySelector('[data-act="submit"]');
      btn.disabled = true; btn.textContent = 'Submitting…';

      const payload = {
        mode, by, dept, needed, priority,
        remark: root.querySelector('[data-f="remark"]').value.trim(),
        fulfillStore: mode === 'store_issue' ? root.querySelector('[data-f="fulfillStore"]').value : null,
        supplier: mode === 'purchase' ? (root.querySelector('[data-f="supplier"]')?.value || '').trim() : null,
        linked: mode === 'purchase' ? (root.querySelector('[data-f="linked"]')?.value || '').trim() : null,
        items: validItems.map(i => ({ name: i.name, stockId: i.stockId || '', unit: i.unit, qty: parseFloat(i.qty) || 0, cost: parseFloat(i.cost) || 0, remark: i.remark, issuedQty: 0 })),
      };

      try {
        // StoreService owns numbering + persistence — this component
        // never writes storage itself.
        const entry = await storeService.submitRequisition(payload);

        showToast(`${entry.no} submitted to ${meta ? meta.destTitle : (mode === 'purchase' ? 'Procurement' : 'Store')}.`, 'success');
        resetForm();
        if (typeof options.onSubmit === 'function') options.onSubmit(entry);
      } catch (e) {
        showToast(e && e.message ? e.message : 'Could not save this request — please try again.', 'error');
      } finally {
        btn.disabled = false; btn.textContent = '✓ Submit Request';
      }
    }

    // ── Toast ──
    function showToast(msg, type = 'success') {
      const t = document.createElement('div');
      t.className = `ghrf-toast ${type}`;
      t.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    }

    // ── Event delegation ──
    root.addEventListener('click', e => {
      const modeCard = e.target.closest('[data-mode]');
      if (modeCard) { setMode(modeCard.dataset.mode); return; }
      const prioBtn = e.target.closest('[data-prio]');
      if (prioBtn) { setPriority(prioBtn.dataset.prio); return; }
      const act = e.target.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'addSearchedItem') tryAddSearchedItem();
        else if (act.dataset.act === 'reset') resetForm();
        else if (act.dataset.act === 'submit') submitRequest();
        return;
      }
    });
    root.querySelector('[data-role="itemSearch"]').addEventListener('input', onSearchInput);
    root.querySelector('[data-role="itemSearch"]').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); tryAddSearchedItem(); }
    });
    if (!section) {
      root.querySelector('[data-f="dept"]').addEventListener('change', () => {
        updatePreview();
        updateModeAvailability();
      });
    }

    // Keep the item catalog + datalist fresh as the owning service's data
    // loads/changes (e.g. RestaurantService.loadAll() resolving after attach()).
    if (dataService && typeof dataService.onChange === 'function') {
      unsubService = dataService.onChange(() => populateCatalogDatalist());
    }

    // ── Init ──
    root.querySelector('[data-f="dateRaised"]').value = _todayDisplay();
    if (section) {
      root.querySelector('[data-f="by"]').value = currentUser.name || '';
      root.querySelector('[data-f="dept"]').value = meta.deptLabel;
      root.querySelector('[data-role="catalogNote"]').textContent =
        `Search an item from ${meta.deptLabel}'s list, add it, then fill in the quantity and any details.`;
      applyModeVisibility();
    } else {
      root.querySelector('[data-f="by"]').value = currentUser.name || '';
      root.querySelector('[data-f="dept"]').value = mode === 'purchase' ? 'Store' : DEPARTMENTS[0];
      setMode(mode);
      updateModeAvailability();
    }
    items = [];
    renderItems();
    updatePreview();

    // ── Public control object ──
    return {
      reset: resetForm,
      submit: submitRequest,
      getMode: () => mode,
      setMode,
      getSection: () => section,
      destroy() {
        if (unsubService) unsubService();
        container.innerHTML = '';
      },
    };
  }

  window.GraceHotelRequestForm = { attach };

})();