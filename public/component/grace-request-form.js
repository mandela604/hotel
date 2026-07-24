/**
 * grace-request-form.js — Grace Hotel HMS Reusable Request Form Component
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="grace-request-form.js"></script> in any page,
 * then attach it to a container:
 *
 *   const form = GraceHotelRequestForm.attach('#requestFormPlaceholder', {
 *     defaultMode: 'store_issue',      // 'store_issue' | 'purchase'
 *     pageSize: 5,                     // "Recently Submitted" rows per page
 *     showRecent: true,                // false = hide the recent-requests table entirely
 *     departments: ['Kitchen','Housekeeping','Bar','Front Desk','Maintenance','Store'],
 *     fulfillStores: ['Central Store','Main Kitchen Store','Housekeeping Store'],
 *     catalog: [ { name:'Rice (Long Grain)', unit:'kg' }, ... ],   // for item-name autocomplete
 *     currentUser: { name:'' },        // optional — prefills "Requested By"
 *
 *     // Storage adapter — defaults to window.storage (Claude.ai preview) or
 *     // localStorage. Swap this for your real backend by implementing the
 *     // same 4-method async shape: get/set/delete/list(key, shared).
 *     storage: myStorageAdapter,
 *
 *     onSubmit:     (entry) => { ... your API call, entry is the saved requisition ... },
 *     onOpenRequest: (reqNo) => { window.location.href = `store-approval.html?req=${reqNo}`; },
 *   });
 *
 *   form.reset();              // clear the form back to one empty item row
 *   form.setMode('purchase');  // switch mode programmatically
 *   form.refreshRecent();      // re-pull "Recently Submitted" from storage
 *   form.getSubmitted();       // read the in-memory list of loaded requisitions
 *   form.destroy();            // remove and clean up
 *
 * ── STORE CANNOT ISSUE TO ITSELF ─────────────────────────────────────
 * "Store Issue" means Store hands over stock it already holds. If the
 * requesting Department is set to "Store" itself, that mode is disabled
 * automatically and the form is locked to "Procurement" — Store raising
 * a requisition means it needs to buy something new, not issue stock to
 * itself. Switching the department away from "Store" re-enables it.
 *
 * ── DATA MODEL ────────────────────────────────────────────────────────
 * Every submission is written to the shared storage adapter as:
 *   req:<REQ_NO>   -> full requisition JSON (see shape below)
 *   req-index      -> JSON array of every REQ_NO ever created, newest first
 *   counter:<PFX>  -> running number per prefix (KREQ/HREQ/BREQ/FREQ/MREQ/PR)
 * This is the exact same contract used by store-approval.html, so any page
 * that reads req-index + req:<NO> keeps working with this component.
 *
 *   {
 *     no, mode: 'store_issue'|'purchase', by, dept, needed, priority: 'Normal'|'Urgent',
 *     remark, fulfillStore, supplier, linked,
 *     items: [{ name, unit, qty, cost, remark, issuedQty:0 }],
 *     status: 'Pending', dateRaised, dateRaisedDisplay,
 *   }
 *
 * ── LIGHT / DARK ──────────────────────────────────────────────────────
 * Ships dark by default (matches the rest of Grace Hotel HMS). All colors
 * are var(--ghrf-*) custom properties — override them on the host page
 * or on the container element to re-theme without touching this file.
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
    .ghrf-mode-row{ display:flex; gap:12px; flex-wrap:wrap; }
    .ghrf-mode-card{ flex:1; min-width:220px; display:flex; align-items:center; gap:12px; padding:16px 18px; background:var(--ghrf-input-bg); border:1.5px solid var(--ghrf-border); border-radius:12px; cursor:pointer; transition:all .18s; }
    .ghrf-mode-card:hover{ border-color:var(--ghrf-gold-border); }
    .ghrf-mode-card.on{ background:var(--ghrf-gold-dim); border-color:var(--ghrf-gold); box-shadow:0 4px 16px rgba(201,168,76,.12); }
    .ghrf-mode-card.disabled{ opacity:.4; cursor:not-allowed; pointer-events:none; }
    .ghrf-mode-icon{ width:38px; height:38px; border-radius:10px; background:var(--ghrf-surface2); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
    .ghrf-mode-card.on .ghrf-mode-icon{ background:rgba(201,168,76,.2); }
    .ghrf-mode-title{ font-size:14px; font-weight:700; color:var(--ghrf-tx); }
    .ghrf-mode-sub{ font-size:11.5px; color:var(--ghrf-tx3); margin-top:2px; line-height:1.4; }
    .ghrf-mode-card.on .ghrf-mode-sub{ color:var(--ghrf-tx2); }
    .ghrf-mode-note{ display:flex; align-items:flex-start; gap:8px; background:rgba(96,165,250,.06); border:1px solid var(--ghrf-blue-bg); border-radius:8px; padding:9px 12px; font-size:11.5px; color:var(--ghrf-tx2); line-height:1.5; margin-top:12px; }
    .ghrf-mode-note b{ color:var(--ghrf-blue); }
    .ghrf-form-row{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px; }
    @media (max-width:780px){ .ghrf-form-row{ grid-template-columns:1fr 1fr; } }
    @media (max-width:480px){ .ghrf-form-row{ grid-template-columns:1fr; } }
    .ghrf-fg{ display:flex; flex-direction:column; gap:5px; }
    .ghrf-fg.span2{ grid-column:span 2; } .ghrf-fg.span3{ grid-column:span 3; }
    @media (max-width:780px){ .ghrf-fg.span3{ grid-column:span 2; } }
    @media (max-width:480px){ .ghrf-fg.span2, .ghrf-fg.span3{ grid-column:span 1; } }
    .ghrf-label{ font-size:10px; text-transform:uppercase; letter-spacing:1.2px; color:var(--ghrf-tx3); font-weight:500; display:flex; align-items:center; gap:6px; }
    .ghrf-label .opt{ font-size:9px; color:var(--ghrf-tx3); text-transform:none; letter-spacing:0; font-weight:400; }
    .ghrf-input, .ghrf-select, .ghrf-textarea{ background:var(--ghrf-input-bg); border:1px solid var(--ghrf-border); border-radius:8px; padding:9px 12px; color:var(--ghrf-tx); font-family:inherit; font-size:13px; outline:none; transition:border-color .2s; width:100%; }
    .ghrf-input:focus, .ghrf-select:focus, .ghrf-textarea:focus{ border-color:var(--ghrf-gold-border); }
    .ghrf-input[readonly]{ opacity:.6; cursor:default; }
    .ghrf-textarea{ resize:vertical; min-height:58px; }
    .ghrf-prio-row{ display:flex; gap:8px; }
    .ghrf-prio-btn{ flex:1; text-align:center; padding:9px 8px; border:1px solid var(--ghrf-border); border-radius:8px; font-size:12.5px; font-weight:600; color:var(--ghrf-tx2); cursor:pointer; transition:all .15s; background:var(--ghrf-input-bg); }
    .ghrf-prio-btn.on.normal{ background:var(--ghrf-blue-bg); border-color:rgba(96,165,250,.4); color:var(--ghrf-blue); }
    .ghrf-prio-btn.on.urgent{ background:var(--ghrf-red-bg); border-color:rgba(248,113,113,.4); color:var(--ghrf-red); }
    .ghrf-link-note{ display:flex; align-items:flex-start; gap:8px; background:rgba(251,191,36,.06); border:1px solid var(--ghrf-amber-bg); border-radius:8px; padding:9px 12px; font-size:11.5px; color:var(--ghrf-tx2); line-height:1.5; margin-top:4px; }
    .ghrf-link-note b{ color:var(--ghrf-amber); }
    .ghrf-item-card{ background:var(--ghrf-input-bg); border:1px solid var(--ghrf-border); border-radius:10px; padding:14px 16px 16px; margin-bottom:12px; position:relative; }
    .ghrf-item-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .ghrf-item-idx{ font-size:10.5px; font-weight:700; color:var(--ghrf-gold); text-transform:uppercase; letter-spacing:1.2px; }
    .ghrf-item-remove{ background:none; border:1px solid var(--ghrf-border); border-radius:6px; width:26px; height:26px; color:var(--ghrf-tx3); cursor:pointer; font-size:12px; transition:all .15s; flex-shrink:0; }
    .ghrf-item-remove:hover{ border-color:var(--ghrf-red); color:var(--ghrf-red); }
    .ghrf-item-fields{ display:grid; grid-template-columns:2.2fr 1fr 1fr 2fr; gap:12px; }
    .ghrf-item-fields.purchase{ grid-template-columns:2fr 1fr 1fr 1fr 1fr 2fr; }
    @media (max-width:900px){ .ghrf-item-fields, .ghrf-item-fields.purchase{ grid-template-columns:1fr 1fr; } }
    @media (max-width:480px){ .ghrf-item-fields, .ghrf-item-fields.purchase{ grid-template-columns:1fr; } }
    .ghrf-unknown-flag{ font-size:9.5px; margin-top:5px; }
    .ghrf-qty{ padding:5px 9px; border:1px solid var(--ghrf-border); background:var(--ghrf-card); border-radius:6px; font-size:12.5px; color:var(--ghrf-tx); display:flex; align-items:center; justify-content:space-between; transition:border-color .15s; }
    .ghrf-qty:focus-within{ border-color:var(--ghrf-gold-border); }
    .ghrf-qty input{ border:none; outline:none; flex:1; min-width:0; font-size:12.5px; font-family:inherit; color:var(--ghrf-tx); background:transparent; text-align:center; }
    .ghrf-stepper{ display:flex; flex-direction:column; color:var(--ghrf-tx3); font-size:9px; cursor:pointer; line-height:1; gap:2px; user-select:none; }
    .ghrf-stepper span:hover{ color:var(--ghrf-gold); }
    .ghrf-add-row{ background:none; border:1px dashed var(--ghrf-border); border-radius:8px; padding:8px 16px; font-size:12.5px; font-weight:600; color:var(--ghrf-gold); cursor:pointer; transition:all .15s; width:100%; text-align:center; font-family:inherit; }
    .ghrf-add-row:hover{ border-color:var(--ghrf-gold-border); background:var(--ghrf-gold-dim); }
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
    .ghrf-sub-title-row{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:8px; }
    .ghrf-sub-title{ font-size:12px; font-weight:700; color:var(--ghrf-gold); letter-spacing:.8px; text-transform:uppercase; }
    .ghrf-sub-count{ font-size:11.5px; color:var(--ghrf-tx3); }
    .ghrf-table-scroll{ overflow-x:auto; }
    .ghrf-table{ width:100%; min-width:600px; border-collapse:collapse; }
    .ghrf-table thead th{ text-align:left; font-size:10.5px; color:var(--ghrf-tx3); font-weight:700; letter-spacing:.3px; text-transform:uppercase; padding:9px 12px; border-top:1px solid var(--ghrf-border); border-bottom:1px solid var(--ghrf-border); background:var(--ghrf-surface2); white-space:nowrap; }
    .ghrf-table thead th.center{ text-align:center; }
    .ghrf-table tbody td{ padding:9px 12px; font-size:12.5px; border-bottom:1px solid var(--ghrf-border); color:var(--ghrf-tx); vertical-align:middle; white-space:nowrap; }
    .ghrf-table tbody tr{ cursor:pointer; transition:background .15s; }
    .ghrf-table tbody tr:hover{ background:var(--ghrf-surface2); }
    .ghrf-table tbody td.center{ text-align:center; }
    .ghrf-req-link{ color:var(--ghrf-gold-light); font-weight:600; }
    .ghrf-type-chip{ display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:10.5px; font-weight:700; white-space:nowrap; }
    .ghrf-type-chip::before{ content:''; width:6px; height:6px; border-radius:50%; }
    .ghrf-chip-store{ background:var(--ghrf-blue-bg); color:var(--ghrf-blue); } .ghrf-chip-store::before{ background:var(--ghrf-blue); }
    .ghrf-chip-purchase{ background:var(--ghrf-purple-bg); color:var(--ghrf-purple); } .ghrf-chip-purchase::before{ background:var(--ghrf-purple); }
    .ghrf-status-chip{ display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:10.5px; font-weight:700; }
    .ghrf-status-chip::before{ content:''; width:6px; height:6px; border-radius:50%; }
    .ghrf-status-chip.pending{ background:var(--ghrf-amber-bg); color:var(--ghrf-amber); } .ghrf-status-chip.pending::before{ background:var(--ghrf-amber); }
    .ghrf-status-chip.partial{ background:var(--ghrf-amber-bg); color:var(--ghrf-amber); } .ghrf-status-chip.partial::before{ background:var(--ghrf-amber); }
    .ghrf-status-chip.full, .ghrf-status-chip.completed{ background:var(--ghrf-green-bg); color:var(--ghrf-green); } .ghrf-status-chip.full::before, .ghrf-status-chip.completed::before{ background:var(--ghrf-green); }
    .ghrf-status-chip.rejected{ background:var(--ghrf-red-bg); color:var(--ghrf-red); } .ghrf-status-chip.rejected::before{ background:var(--ghrf-red); }
    .ghrf-empty-row td{ text-align:center; padding:26px; color:var(--ghrf-tx3); }
    .ghrf-pagination{ display:flex; align-items:center; justify-content:space-between; padding-top:12px; margin-top:4px; border-top:1px solid var(--ghrf-border); font-size:12px; color:var(--ghrf-tx3); flex-wrap:wrap; gap:8px; }
    .ghrf-page-btns{ display:flex; gap:3px; flex-wrap:wrap; }
    .ghrf-page-btn{ min-width:28px; height:28px; border-radius:7px; border:1px solid var(--ghrf-border); background:none; color:var(--ghrf-tx3); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; transition:all .15s; font-family:inherit; padding:0 7px; }
    .ghrf-page-btn:hover{ border-color:var(--ghrf-gold-border); color:var(--ghrf-gold); }
    .ghrf-page-btn.active{ background:var(--ghrf-gold-dim); border-color:var(--ghrf-gold-border); color:var(--ghrf-gold); font-weight:600; }
    .ghrf-page-btn:disabled{ opacity:.3; cursor:default; pointer-events:none; }
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
  // Defaults
  // ══════════════════════════════════════════════════════════════════
  const DEFAULT_STORAGE = window.storage || {
    async get(key, shared) { const v = localStorage.getItem(key); return v == null ? null : { key, value: v, shared }; },
    async set(key, value, shared) { localStorage.setItem(key, value); return { key, value, shared }; },
    async delete(key, shared) { localStorage.removeItem(key); return { key, deleted: true, shared }; },
    async list(prefix, shared) { const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)); return { keys, prefix, shared }; },
  };

  const DEFAULT_DEPT_PREFIX = { Kitchen: 'KREQ', Housekeeping: 'HREQ', Bar: 'BREQ', 'Front Desk': 'FREQ', Maintenance: 'MREQ', Store: 'PR' };
  const DEFAULT_DEPARTMENTS = ['Kitchen', 'Housekeeping', 'Bar', 'Front Desk', 'Maintenance', 'Store'];
  const DEFAULT_FULFILL_STORES = ['Central Store', 'Main Kitchen Store', 'Housekeeping Store'];
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

  function _fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function _todayISO() { return new Date().toISOString().split('T')[0]; }
  function _todayDisplay() { return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function _fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
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

    const instId = 'ghrf' + (++_instanceCounter);
    const storage = options.storage || DEFAULT_STORAGE;
    const DEPT_PREFIX = options.deptPrefixes || DEFAULT_DEPT_PREFIX;
    const DEPARTMENTS = options.departments || DEFAULT_DEPARTMENTS;
    const FULFILL_STORES = options.fulfillStores || DEFAULT_FULFILL_STORES;
    const CATALOG = options.catalog || DEFAULT_CATALOG;
    const currentUser = Object.assign({ name: '' }, options.currentUser || {});
    const PAGE_SIZE = options.pageSize || 5;
    const showRecent = options.showRecent !== false;

    function findCatalogItem(name) { const n = (name || '').trim().toLowerCase(); return CATALOG.find(c => c.name.toLowerCase() === n) || null; }

    // ── Instance state ──
    let mode = options.defaultMode || 'store_issue';
    let priority = 'Normal';
    let items = [];
    let itemSeq = 0;
    let submittedAll = [];
    let submittedPage = 1;

    function newItemRow() { itemSeq++; return { rid: itemSeq, name: '', unit: 'kg', qty: '', cost: '', remark: '' }; }

    // ── Shell ──
    container.innerHTML = `
      <div class="ghrf-wrap" id="${instId}">
        <div class="ghrf-card">
          <div class="ghrf-card-header">📨 Requesting From</div>
          <div class="ghrf-mode-row">
            <div class="ghrf-mode-card on" data-mode="store_issue">
              <div class="ghrf-mode-icon">🏬</div>
              <div><div class="ghrf-mode-title">Store</div><div class="ghrf-mode-sub">Issue items already held in stock — the classic department requisition.</div></div>
            </div>
            <div class="ghrf-mode-card" data-mode="purchase">
              <div class="ghrf-mode-icon">🛒</div>
              <div><div class="ghrf-mode-title">Procurement</div><div class="ghrf-mode-sub">Buy something new or restock from a supplier — routed to Procurement.</div></div>
            </div>
          </div>
          <div class="ghrf-mode-note" data-wrap="storenote" style="display:none;">
            <span>ℹ️</span><div><b>Store</b> already holds the stock, so it can't issue to itself — a Store-department request is always routed to <b>Procurement</b> instead.</div>
          </div>
        </div>

        <div class="ghrf-card">
          <div class="ghrf-card-header">📋 Request Details</div>
          <div class="ghrf-form-row">
            <div class="ghrf-fg"><label class="ghrf-label">Requested By</label><input class="ghrf-input" data-f="by" placeholder="Your name"></div>
            <div class="ghrf-fg"><label class="ghrf-label">Department</label>
              <select class="ghrf-select" data-f="dept">${DEPARTMENTS.map(d => `<option>${d}</option>`).join('')}</select>
            </div>
            <div class="ghrf-fg"><label class="ghrf-label">Date Raised</label><input class="ghrf-input" data-f="dateRaised" readonly></div>
            <div class="ghrf-fg"><label class="ghrf-label">Needed By</label><input class="ghrf-input" type="date" data-f="needed"></div>
            <div class="ghrf-fg" data-wrap="fulfill"><label class="ghrf-label">Fulfilling Store</label>
              <select class="ghrf-select" data-f="fulfillStore">${FULFILL_STORES.map(s => `<option>${s}</option>`).join('')}</select>
            </div>
            <div class="ghrf-fg" data-wrap="supplier" style="display:none;"><label class="ghrf-label">Preferred Supplier <span class="opt">(optional)</span></label><input class="ghrf-input" data-f="supplier" placeholder="e.g. Zenith Foods Ltd."></div>
            <div class="ghrf-fg"><label class="ghrf-label">Priority</label>
              <div class="ghrf-prio-row"><div class="ghrf-prio-btn on normal" data-prio="Normal">Normal</div><div class="ghrf-prio-btn urgent" data-prio="Urgent">Urgent</div></div>
            </div>
            <div class="ghrf-fg span2" data-wrap="linked" style="display:none;"><label class="ghrf-label">Linked Requisition <span class="opt">(optional — e.g. escalating a stock shortfall)</span></label><input class="ghrf-input" data-f="linked" placeholder="e.g. KREQ-2025-00045"></div>
            <div class="ghrf-fg span3"><label class="ghrf-label">Purpose / Remark</label><textarea class="ghrf-textarea" data-f="remark" placeholder="What is this request for?"></textarea></div>
          </div>
          <div class="ghrf-link-note" data-wrap="linknote" style="display:none;">
            <span>🔗</span><div>If Store couldn't fully issue an item on a requisition, reference that requisition number above — the shortfall stays traceable back to where it started instead of becoming a disconnected purchase request.</div>
          </div>
        </div>

        <div class="ghrf-card">
          <div class="ghrf-card-header">📦 Items — enter the item name, unit, and quantity requested for each line</div>
          <div data-role="itemsList"></div>
          <datalist id="${instId}-catalog"></datalist>
          <button class="ghrf-add-row" data-act="addItem">＋ Add Item</button>
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

        ${showRecent ? `
        <div class="ghrf-card">
          <div class="ghrf-sub-title-row">
            <div class="ghrf-sub-title">Recently Submitted</div>
            <div class="ghrf-sub-count" data-role="submittedCount">—</div>
          </div>
          <div class="ghrf-table-scroll">
            <table class="ghrf-table">
              <thead><tr><th>Req. No.</th><th>Type</th><th>Department</th><th class="center">Items</th><th>Needed By</th><th>Status</th></tr></thead>
              <tbody data-role="submittedBody"><tr class="ghrf-empty-row"><td colspan="6">Loading…</td></tr></tbody>
            </table>
          </div>
          <div class="ghrf-pagination">
            <span data-role="paginLabel">—</span>
            <div class="ghrf-page-btns" data-role="pageBtns"></div>
          </div>
        </div>` : ''}
      </div>`;

    const root = container.querySelector('#' + instId);
    const $ = sel => root.querySelector(sel);
    const $$ = sel => root.querySelectorAll(sel);

    $(`#${instId}-catalog`).innerHTML = CATALOG.map(c => `<option value="${c.name}">`).join('');

    // ── Mode / priority ──
    function setMode(m) {
      mode = m;
      $$('.ghrf-mode-card').forEach(c => c.classList.toggle('on', c.dataset.mode === m));
      root.querySelector('[data-wrap="fulfill"]').style.display = m === 'store_issue' ? '' : 'none';
      root.querySelector('[data-wrap="supplier"]').style.display = m === 'purchase' ? '' : 'none';
      root.querySelector('[data-wrap="linked"]').style.display = m === 'purchase' ? '' : 'none';
      root.querySelector('[data-wrap="linknote"]').style.display = m === 'purchase' ? 'flex' : 'none';
      renderItems();
      updatePreview();
      if (typeof options.onModeChange === 'function') options.onModeChange(m);
    }
    function setPriority(p) {
      priority = p;
      root.querySelector('[data-prio="Normal"]').classList.toggle('on', p === 'Normal');
      root.querySelector('[data-prio="Urgent"]').classList.toggle('on', p === 'Urgent');
    }

    // Store can't issue stock to itself — when Department = Store, lock the
    // mode picker to Procurement and disable the Store Issue card. Restores
    // automatically when the department is changed away from Store.
    function updateModeAvailability() {
      const dept = root.querySelector('[data-f="dept"]').value;
      const storeCard = root.querySelector('.ghrf-mode-card[data-mode="store_issue"]');
      const noteEl = root.querySelector('[data-wrap="storenote"]');
      const isStore = dept === 'Store';
      storeCard.classList.toggle('disabled', isStore);
      noteEl.style.display = isStore ? 'flex' : 'none';
      if (isStore && mode === 'store_issue') setMode('purchase');
    }

    // ── Items ──
    function addItemRow() { items.push(newItemRow()); renderItems(); }
    function removeItemRow(rid) { items = items.filter(i => i.rid !== rid); renderItems(); }
    function updateItemField(rid, field, value) { const it = items.find(i => i.rid === rid); if (it) it[field] = value; if (field === 'qty' || field === 'cost') renderItems(true); }
    function stepField(rid, field, delta) { const it = items.find(i => i.rid === rid); if (!it) return; const cur = parseFloat(it[field]) || 0; it[field] = Math.max(0, cur + delta); renderItems(); }
    function onItemNameInput(rid, value) { const it = items.find(i => i.rid === rid); if (!it) return; it.name = value; const m = findCatalogItem(value); if (m) it.unit = m.unit; renderItems(); }

    function renderItems(quiet) {
      const list = root.querySelector('[data-role="itemsList"]');
      list.innerHTML = items.map((it, idx) => {
        const qty = parseFloat(it.qty) || 0, cost = parseFloat(it.cost) || 0, total = qty * cost;
        const known = findCatalogItem(it.name);
        const unknownFlag = (!known && it.name.trim())
          ? `<div class="ghrf-unknown-flag" style="color:${mode === 'purchase' ? 'var(--ghrf-purple)' : 'var(--ghrf-red)'};">${mode === 'purchase' ? '🆕 New item — not yet in Store catalog' : '⚠ Not a recognized stock item'}</div>` : '';
        const costFields = mode === 'purchase' ? `
          <div class="ghrf-fg"><label class="ghrf-label">Est. Unit Cost (₦)</label><div class="ghrf-qty"><input type="text" inputmode="decimal" placeholder="0" value="${_escAttr(it.cost)}" data-item="${it.rid}" data-field="cost"><span class="ghrf-stepper"><span data-step="${it.rid}" data-stepfield="cost" data-delta="100">▲</span><span data-step="${it.rid}" data-stepfield="cost" data-delta="-100">▼</span></span></div></div>
          <div class="ghrf-fg"><label class="ghrf-label">Est. Total (₦)</label><input class="ghrf-input" readonly value="${_fmtN(total)}"></div>` : '';
        return `<div class="ghrf-item-card">
          <div class="ghrf-item-top"><span class="ghrf-item-idx">Item ${idx + 1}</span><button class="ghrf-item-remove" data-removeitem="${it.rid}" title="Remove this item">✕</button></div>
          <div class="ghrf-item-fields${mode === 'purchase' ? ' purchase' : ''}">
            <div class="ghrf-fg"><label class="ghrf-label">Item Name</label><input class="ghrf-input" list="${instId}-catalog" placeholder="Type or pick a stock item…" value="${_escAttr(it.name)}" data-item="${it.rid}" data-field="name">${unknownFlag}</div>
            <div class="ghrf-fg"><label class="ghrf-label">Unit</label><input class="ghrf-input" placeholder="kg, Ltr, Pieces…" value="${_escAttr(it.unit)}" data-item="${it.rid}" data-field="unit"></div>
            <div class="ghrf-fg"><label class="ghrf-label">Qty Requested</label><div class="ghrf-qty"><input type="text" inputmode="decimal" placeholder="0" value="${_escAttr(it.qty)}" data-item="${it.rid}" data-field="qty"><span class="ghrf-stepper"><span data-step="${it.rid}" data-stepfield="qty" data-delta="1">▲</span><span data-step="${it.rid}" data-stepfield="qty" data-delta="-1">▼</span></span></div></div>
            ${costFields}
            <div class="ghrf-fg"><label class="ghrf-label">Remarks <span class="opt">(optional)</span></label><input class="ghrf-input" placeholder="Optional note" value="${_escAttr(it.remark)}" data-item="${it.rid}" data-field="remark"></div>
          </div></div>`;
      }).join('') || `<div class="ghrf-unknown-flag" style="text-align:center;padding:16px;color:var(--ghrf-tx3);font-size:12.5px;">No items yet — click "＋ Add Item" below.</div>`;

      const totalCost = items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.cost) || 0), 0);
      root.querySelector('[data-role="itemsSummary"]').innerHTML = mode === 'purchase'
        ? `<span><b>${items.length}</b> item${items.length !== 1 ? 's' : ''}</span><span>Est. total cost: <b>${_fmtN(totalCost)}</b></span>`
        : `<span><b>${items.length}</b> item${items.length !== 1 ? 's' : ''} requested</span>`;

      // Rebind the two name-based item inputs that need custom logic (name + generic field write)
      list.querySelectorAll('[data-item]').forEach(inp => {
        const rid = parseInt(inp.dataset.item, 10), field = inp.dataset.field;
        inp.addEventListener('input', () => {
          if (field === 'name') onItemNameInput(rid, inp.value);
          else updateItemField(rid, field, inp.value);
        });
      });
      list.querySelectorAll('[data-step]').forEach(btn => {
        btn.addEventListener('click', () => stepField(parseInt(btn.dataset.step, 10), btn.dataset.stepfield, parseFloat(btn.dataset.delta)));
      });
      list.querySelectorAll('[data-removeitem]').forEach(btn => {
        btn.addEventListener('click', () => removeItemRow(parseInt(btn.dataset.removeitem, 10)));
      });

      if (!quiet) updatePreview();
    }

    // ── Numbering ──
    function previewPrefix() { return mode === 'purchase' ? 'PR' : (DEPT_PREFIX[root.querySelector('[data-f="dept"]').value] || 'REQ'); }
    async function peekNextNumber() {
      const prefix = previewPrefix();
      let n = 45;
      try { const r = await storage.get(`counter:${prefix}`, true); n = r ? parseInt(r.value, 10) : n; } catch (e) {}
      return `${prefix}-2025-${String(n + 1).padStart(5, '0')}`;
    }
    async function updatePreview() {
      root.querySelector('[data-role="previewNumber"]').textContent = await peekNextNumber();
      root.querySelector('[data-role="previewRoute"]').textContent = mode === 'purchase' ? 'Procurement' : 'Store';
    }
    async function nextNumber() {
      const prefix = previewPrefix();
      let n = 45;
      try { const r = await storage.get(`counter:${prefix}`, true); n = r ? parseInt(r.value, 10) : n; } catch (e) {}
      n += 1;
      await storage.set(`counter:${prefix}`, String(n), true);
      return `${prefix}-2025-${String(n).padStart(5, '0')}`;
    }

    // ── Reset / submit ──
    function resetForm() {
      root.querySelector('[data-f="by"]').value = currentUser.name || '';
      root.querySelector('[data-f="dept"]').value = mode === 'purchase' ? 'Store' : DEPARTMENTS[0];
      root.querySelector('[data-f="needed"]').value = '';
      const sup = root.querySelector('[data-f="supplier"]'); if (sup) sup.value = '';
      const lnk = root.querySelector('[data-f="linked"]'); if (lnk) lnk.value = '';
      root.querySelector('[data-f="remark"]').value = '';
      const fs = root.querySelector('[data-f="fulfillStore"]'); if (fs) fs.value = FULFILL_STORES[0];
      setPriority('Normal');
      items = [newItemRow()];
      renderItems();
      updateModeAvailability();
    }

    async function submitRequest() {
      const by = root.querySelector('[data-f="by"]').value.trim();
      const dept = root.querySelector('[data-f="dept"]').value;
      const needed = root.querySelector('[data-f="needed"]').value;
      const validItems = items.filter(i => i.name.trim() && (parseFloat(i.qty) || 0) > 0);

      if (!by) { showToast('Please enter who is requesting.', 'error'); return; }
      if (!needed) { showToast('Please choose a needed-by date.', 'error'); return; }
      if (validItems.length === 0) { showToast('Add at least one item with a name and quantity.', 'error'); return; }
      if (dept === 'Store' && mode === 'store_issue') { showToast('Store cannot issue stock to itself — switch to Procurement.', 'error'); return; }

      const btn = root.querySelector('[data-act="submit"]');
      btn.disabled = true; btn.textContent = 'Submitting…';

      try {
        const num = await nextNumber();
        const entry = {
          no: num, mode, by, dept, needed, priority,
          remark: root.querySelector('[data-f="remark"]').value.trim(),
          fulfillStore: mode === 'store_issue' ? root.querySelector('[data-f="fulfillStore"]').value : null,
          supplier: mode === 'purchase' ? (root.querySelector('[data-f="supplier"]')?.value || '').trim() : null,
          linked: mode === 'purchase' ? (root.querySelector('[data-f="linked"]')?.value || '').trim() : null,
          items: validItems.map(i => ({ name: i.name, unit: i.unit, qty: parseFloat(i.qty) || 0, cost: parseFloat(i.cost) || 0, remark: i.remark, issuedQty: 0 })),
          status: 'Pending',
          dateRaised: _todayISO(),
          dateRaisedDisplay: _todayDisplay(),
        };

        await storage.set(`req:${num}`, JSON.stringify(entry), true);
        const idxRes = await storage.get('req-index', true).catch(() => null);
        const idx = idxRes ? JSON.parse(idxRes.value) : [];
        idx.unshift(num);
        await storage.set('req-index', JSON.stringify(idx), true);

        showToast(`${num} submitted to ${mode === 'purchase' ? 'Procurement' : 'Store'}.`, 'success');
        resetForm();
        submittedPage = 1;
        if (showRecent) loadRecent();
        if (typeof options.onSubmit === 'function') options.onSubmit(entry);
      } catch (e) {
        showToast('Could not save this request — please try again.', 'error');
      } finally {
        btn.disabled = false; btn.textContent = '✓ Submit Request';
      }
    }

    // ── Recently Submitted (paginated) ──
    async function loadRecent() {
      if (!showRecent) return;
      let idx = [];
      try { const r = await storage.get('req-index', true); idx = r ? JSON.parse(r.value) : []; } catch (e) {}
      const rows = [];
      for (const no of idx) {
        try { const r = await storage.get(`req:${no}`, true); if (r) rows.push(JSON.parse(r.value)); } catch (e) {}
      }
      submittedAll = rows;
      renderSubmittedPage();
    }

    function renderSubmittedPage() {
      const body = root.querySelector('[data-role="submittedBody"]');
      if (!body) return;
      const total = submittedAll.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (submittedPage > totalPages) submittedPage = totalPages;

      root.querySelector('[data-role="submittedCount"]').textContent = total + ' request' + (total !== 1 ? 's' : '');

      if (total === 0) {
        body.innerHTML = `<tr class="ghrf-empty-row"><td colspan="6">No requests submitted yet.</td></tr>`;
        root.querySelector('[data-role="paginLabel"]').textContent = 'No records';
        root.querySelector('[data-role="pageBtns"]').innerHTML = '';
        return;
      }

      const start = (submittedPage - 1) * PAGE_SIZE;
      const pageRows = submittedAll.slice(start, start + PAGE_SIZE);

      body.innerHTML = pageRows.map(e => `
        <tr data-openreq="${e.no}">
          <td class="ghrf-req-link">${e.no}</td>
          <td><span class="ghrf-type-chip ${e.mode === 'purchase' ? 'ghrf-chip-purchase' : 'ghrf-chip-store'}">${e.mode === 'purchase' ? 'Procurement' : 'Store'}</span></td>
          <td>${e.dept}</td>
          <td class="center">${e.items.length}</td>
          <td>${_fmtDate(e.needed)}</td>
          <td><span class="ghrf-status-chip ${e.status.toLowerCase()}">${e.status}</span></td>
        </tr>`).join('');

      body.querySelectorAll('[data-openreq]').forEach(tr => {
        tr.addEventListener('click', () => {
          const no = tr.dataset.openreq;
          if (typeof options.onOpenRequest === 'function') options.onOpenRequest(no);
        });
      });

      renderPagination(total, totalPages);
    }

    function renderPagination(total, totalPages) {
      const from = (submittedPage - 1) * PAGE_SIZE + 1;
      const to = Math.min(submittedPage * PAGE_SIZE, total);
      root.querySelector('[data-role="paginLabel"]').textContent = `${from}–${to} of ${total}`;

      const wrap = root.querySelector('[data-role="pageBtns"]');
      wrap.innerHTML = '';
      const mkBtn = (txt, disabled, onClick, active) => {
        const b = document.createElement('button');
        b.className = 'ghrf-page-btn' + (active ? ' active' : '');
        b.textContent = txt; b.disabled = !!disabled;
        if (!disabled) b.onclick = onClick;
        return b;
      };
      wrap.appendChild(mkBtn('‹', submittedPage === 1, () => { submittedPage--; renderSubmittedPage(); }));
      let start = Math.max(1, submittedPage - 2), end = Math.min(totalPages, start + 4);
      start = Math.max(1, end - 4);
      for (let i = start; i <= end; i++) wrap.appendChild(mkBtn(i, false, () => { submittedPage = i; renderSubmittedPage(); }, i === submittedPage));
      wrap.appendChild(mkBtn('›', submittedPage >= totalPages, () => { submittedPage++; renderSubmittedPage(); }));
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
        if (act.dataset.act === 'addItem') addItemRow();
        else if (act.dataset.act === 'reset') resetForm();
        else if (act.dataset.act === 'submit') submitRequest();
        return;
      }
    });
    root.querySelector('[data-f="dept"]').addEventListener('change', () => {
      updatePreview();
      updateModeAvailability();
    });

    // ── Init ──
    root.querySelector('[data-f="dateRaised"]').value = _todayDisplay();
    root.querySelector('[data-f="by"]').value = currentUser.name || '';
    items = [newItemRow()];
    setMode(mode);
    renderItems();
    updateModeAvailability();
    if (showRecent) loadRecent();

    // ── Public control object ──
    return {
      reset: resetForm,
      submit: submitRequest,
      getMode: () => mode,
      setMode,
      refreshRecent: loadRecent,
      getSubmitted: () => submittedAll,
      destroy() { container.innerHTML = ''; },
    };
  }

  window.GraceHotelRequestForm = { attach };

})();