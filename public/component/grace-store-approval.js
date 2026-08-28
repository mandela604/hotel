/**
 * grace-store-approval.js — Grace Hotel HMS Reusable Store-Approval / Delivery-Review Component
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="grace-store-approval.js"></script> in any page,
 * then attach it to a container:
 *
 *   // STORE SIDE — approve a requisition and enter what was issued:
 *   const approval = GraceHotelStoreApproval.attach('#approvalPlaceholder', {
 *     storeService: StoreService,      // REQUIRED — svc.loadAll() must already have resolved
 *     viewerRole: 'store',             // default — omit and it's the same as before
 *     reqNo: 'KREQ-2025-00045',        // omit to read ?req= from the URL instead
 *     preparedBy: 'Store Keeper',
 *     onApprove: (req) => { ... },
 *     onReject:  (req) => { ... },
 *   });
 *
 *   // REQUESTER SIDE — same requisition, but read-only items + Accept /
 *   // Report Issue instead of Approve & Issue / Reject Requisition:
 *   const review = GraceHotelStoreApproval.attach('#reviewPlaceholder', {
 *     storeService: StoreService,
 *     viewerRole: 'requester',
 *     reqNo: 'KREQ-2025-00045',
 *     onConfirm: (req) => { ... },   // fires after svc.confirmReceipt() resolves
 *     onDispute: (req) => { ... },   // fires after svc.rejectDelivery() resolves
 *   });
 *
 *   approval.load('KREQ-2025-00046'); // switch to a different requisition
 *   approval.getReq();                // read the currently loaded requisition
 *   approval.refresh();               // re-render from current in-memory state
 *   approval.destroy();               // remove and clean up
 *
 * ── SERVICE IS REQUIRED — NO STANDALONE MODE ────────────────────────
 * This component has exactly one way to get and change data: through
 * `options.storeService` (services/store-service.js). There is no
 * fallback path that talks to storage/localStorage directly and no
 * built-in demo requisition.
 *
 * Prototyping vs. production is entirely StoreService's concern: it
 * writes to localStorage today and can swap to a real API tomorrow
 * without this component (or any caller of it) changing at all.
 *
 * ── viewerRole DRIVES THE ACTION SIDE ────────────────────────────────
 * The details panel, items table, and summary card are IDENTICAL for
 * both roles — same requisition, same numbers. Only two things change:
 *
 *   'store' (default):
 *     - Issued Qty column is editable (when Pending/Partial) — same as
 *       before.
 *     - Actions: "Reject Requisition" (svc.rejectRequisition) and
 *       "Approve & Issue Items" / "Update Issued Items"
 *       (svc.approveAndIssue).
 *
 *   'requester':
 *     - Issued Qty column is always read-only — the requester is
 *       reviewing what Store already recorded, not editing it.
 *     - Actions only appear once status is Full or Partial (there's
 *       nothing to accept/dispute before Store has issued anything):
 *       "Accept Delivery" (svc.confirmReceipt -> status 'Completed')
 *       and "Report Issue" (svc.rejectDelivery -> status 'Disputed',
 *       opens the same reason modal used for rejection, relabelled).
 *
 * ── DATA MODEL ────────────────────────────────────────────────────────
 * Same requisition shape StoreService owns everywhere else:
 *   {
 *     no, mode: 'store_issue'|'purchase', by, dept, needed, priority,
 *     remark, fulfillStore, supplier, linked,
 *     items: [{ name, unit, qty, cost, remark, issuedQty }],
 *     status: 'Pending'|'Partial'|'Full'|'Completed'|'Disputed'|'Rejected',
 *     rejectReason?, disputeReason?,
 *     dateRaised, dateRaisedDisplay,
 *   }
 *
 * ── BEHAVIOUR ─────────────────────────────────────────────────────────
 * - Requisition comes from `storeService.getRequisition(no)` — StoreService
 *   owns the load, this component never touches req:<NO> / req-index directly.
 * - "Available in Store" per item comes from `storeService.stockQtyFor(name)`.
 * - Store role: approving calls `storeService.approveAndIssue(no, issuedQtyByItem)`;
 *   rejecting calls `storeService.rejectRequisition(no, reason)`.
 * - Requester role: accepting calls `storeService.confirmReceipt(no)`;
 *   disputing calls `storeService.rejectDelivery(no, reason)`.
 * - Subscribes to `storeService.onChange()` so if the same requisition is
 *   edited from another tab/page, this view stays in sync automatically.
 *
 * ── THEME ──────────────────────────────────────────────────────────────
 * Ships light by default — same palette as component/store-item-form.js
 * and the rest of the HMS (white cards, #2f6fed accent, Segoe UI). All
 * colors are still var(--ghsa-*) custom properties — override them on
 * the host page or on the container element to re-theme.
 */

(function () {
  'use strict';

  if (window.__graceStoreApproval) return;
  window.__graceStoreApproval = true;

  // ══════════════════════════════════════════════════════════════════
  // CSS (ghsa- prefixed, self-contained, injected once)
  // ══════════════════════════════════════════════════════════════════
  const CSS = `
    :root{
      --ghsa-gold:#2f6fed; --ghsa-gold-light:#5b8ff9; --ghsa-gold-dim:rgba(47,111,237,0.10); --ghsa-gold-border:rgba(47,111,237,0.25);
      --ghsa-green:#12b76a; --ghsa-green-bg:#e9f9f0;
      --ghsa-amber:#f79009; --ghsa-amber-bg:#fff4e5;
      --ghsa-red:#f04438; --ghsa-red-bg:#feecec;
      --ghsa-purple:#8b5cf6; --ghsa-purple-bg:#f4efff;
      --ghsa-tx:#1c2440; --ghsa-tx2:#6b7280; --ghsa-tx3:#9aa1b3;
      --ghsa-border:#eef0f6; --ghsa-card:#ffffff; --ghsa-surface2:#f4f6fb; --ghsa-input-bg:#f4f6fb;
    }
    .ghsa-wrap, .ghsa-wrap *, .ghsa-wrap *::before, .ghsa-wrap *::after{ box-sizing:border-box; margin:0; padding:0; }
    .ghsa-wrap{ font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; color:var(--ghsa-tx); font-size:14px; display:flex; flex-direction:column; gap:14px; }

    .ghsa-topbar{ display:flex; align-items:center; justify-content:space-between; padding:14px 20px; background:var(--ghsa-card); border:1px solid var(--ghsa-border); border-radius:12px; gap:12px; flex-wrap:wrap; }
    .ghsa-topbar-left{ display:flex; align-items:center; gap:14px; min-width:0; }
    .ghsa-back-btn{ font-size:14px; color:var(--ghsa-tx2); cursor:pointer; background:var(--ghsa-surface2); border:1px solid var(--ghsa-border); width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-decoration:none; }
    .ghsa-back-btn:hover{ border-color:var(--ghsa-gold-border); color:var(--ghsa-gold); }
    .ghsa-page-title{ font-size:17px; font-weight:800; color:var(--ghsa-tx); }
    .ghsa-page-subtitle{ font-size:11.5px; color:var(--ghsa-tx3); margin-top:2px; }
    .ghsa-topbar-right{ display:flex; align-items:center; gap:14px; }
    .ghsa-status-block{ text-align:right; }
    .ghsa-status-label{ font-size:10px; color:var(--ghsa-gold); font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
    .ghsa-status-pill{ display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:12px; padding:5px 11px; border-radius:20px; }
    .ghsa-status-pill.pending{ background:var(--ghsa-amber-bg); color:var(--ghsa-amber); }
    .ghsa-status-pill.partial{ background:var(--ghsa-amber-bg); color:var(--ghsa-amber); }
    .ghsa-status-pill.full{ background:var(--ghsa-green-bg); color:var(--ghsa-green); }
    .ghsa-status-pill.completed{ background:var(--ghsa-purple-bg); color:var(--ghsa-purple); }
    .ghsa-status-pill.disputed{ background:var(--ghsa-red-bg); color:var(--ghsa-red); }
    .ghsa-status-pill.rejected{ background:var(--ghsa-red-bg); color:var(--ghsa-red); }

    .ghsa-content{ max-width:1200px; margin:0 auto; width:100%; display:flex; flex-direction:column; gap:14px; }
    .ghsa-row{ display:flex; gap:14px; align-items:stretch; flex-shrink:0; }
    @media (max-width:760px){ .ghsa-row{ flex-direction:column; } }
    .ghsa-card{ background:var(--ghsa-card); border:1px solid var(--ghsa-border); border-radius:12px; padding:16px 18px; }
    .ghsa-card-header{ display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--ghsa-gold); letter-spacing:0.8px; text-transform:uppercase; margin-bottom:12px; }
    .ghsa-card-header.green{ color:var(--ghsa-green); }
    .ghsa-details-panel{ flex:1.55; } .ghsa-delivery-panel{ flex:1; }
    .ghsa-detail-grid{ display:grid; grid-template-columns:1fr 1fr; row-gap:10px; column-gap:10px; }
    @media (max-width:480px){ .ghsa-detail-grid{ grid-template-columns:1fr; } }
    .ghsa-flabel{ font-size:10.5px; color:var(--ghsa-tx3); margin-bottom:3px; }
    .ghsa-fvalue{ font-size:13px; color:var(--ghsa-tx); font-weight:600; }
    .ghsa-fvalue.link{ color:var(--ghsa-gold); }
    .ghsa-fvalue.small{ font-weight:400; color:var(--ghsa-tx2); line-height:1.4; font-size:12.5px; }
    .ghsa-delivery-field{ margin-bottom:10px; }
    .ghsa-delivery-field .ghsa-flabel{ margin-bottom:5px; }

    .ghsa-items-section{ display:flex; gap:14px; align-items:stretch; flex-shrink:0; }
    @media (max-width:760px){ .ghsa-items-section{ flex-direction:column; } }
    .ghsa-items-card{ flex:2.5; padding:0; overflow:hidden; display:flex; flex-direction:column; min-width:0; }
    .ghsa-items-card .ghsa-card-header{ padding:16px 18px 0; margin-bottom:10px; flex-shrink:0; }
    .ghsa-table-scroll{ overflow-x:auto; overflow-y:auto; max-height:360px; }
    .ghsa-table{ width:100%; min-width:680px; border-collapse:collapse; }
    .ghsa-table thead th{ text-align:left; font-size:10.5px; color:var(--ghsa-tx3); font-weight:700; letter-spacing:0.3px; text-transform:uppercase; padding:9px 12px; border-top:1px solid var(--ghsa-border); border-bottom:1px solid var(--ghsa-border); background:var(--ghsa-surface2); white-space:nowrap; position:sticky; top:0; z-index:2; }
    .ghsa-table thead th.ghsa-num{ text-align:center; width:36px; } .ghsa-table thead th.ghsa-center{ text-align:center; }
    .ghsa-table tbody td{ padding:9px 12px; font-size:12.5px; border-bottom:1px solid var(--ghsa-border); color:var(--ghsa-tx); vertical-align:middle; white-space:nowrap; }
    .ghsa-table td.ghsa-num{ text-align:center; color:var(--ghsa-tx3); } .ghsa-table td.ghsa-center{ text-align:center; }
    .ghsa-table td.ghsa-green-text{ color:var(--ghsa-green); font-weight:600; } .ghsa-table td.ghsa-red-text{ color:var(--ghsa-red); font-weight:600; }
    .ghsa-qty{ width:88px; margin:0 auto; padding:5px 9px; border:1px solid var(--ghsa-border); background:var(--ghsa-input-bg); border-radius:6px; font-size:12.5px; color:var(--ghsa-tx); display:flex; align-items:center; justify-content:space-between; transition:border-color .15s; }
    .ghsa-qty:focus-within{ border-color:var(--ghsa-gold-border); }
    .ghsa-qty input{ border:none; outline:none; width:56px; font-size:12.5px; font-family:inherit; color:var(--ghsa-tx); background:transparent; }
    .ghsa-qty.readonly{ opacity:.75; }
    .ghsa-qty.readonly input{ cursor:default; }
    .ghsa-stepper{ display:flex; flex-direction:column; color:var(--ghsa-tx3); font-size:9px; cursor:pointer; line-height:1; gap:2px; user-select:none; }
    .ghsa-stepper span:hover{ color:var(--ghsa-gold); }
    .ghsa-status-tag{ display:inline-block; padding:3px 11px; border-radius:20px; font-size:10.5px; font-weight:700; letter-spacing:0.3px; }
    .ghsa-status-tag.partial{ background:var(--ghsa-amber-bg); color:var(--ghsa-amber); }
    .ghsa-status-tag.full{ background:var(--ghsa-green-bg); color:var(--ghsa-green); }
    .ghsa-status-tag.none{ background:var(--ghsa-red-bg); color:var(--ghsa-red); }
    .ghsa-table tfoot td{ padding:11px 12px; font-weight:700; font-size:12.5px; color:var(--ghsa-tx); background:var(--ghsa-surface2); border-top:1px solid var(--ghsa-border); white-space:nowrap; position:sticky; bottom:0; }
    .ghsa-legend{ display:flex; gap:22px; align-items:center; padding:10px 18px; font-size:11.5px; color:var(--ghsa-tx2); border-top:1px solid var(--ghsa-border); flex-wrap:wrap; flex-shrink:0; }
    .ghsa-dot{ display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }
    .ghsa-dot.green{ background:var(--ghsa-green); } .ghsa-dot.amber{ background:var(--ghsa-amber); } .ghsa-dot.red{ background:var(--ghsa-red); }

    .ghsa-summary-card{ flex:1; padding:16px; overflow-y:auto; min-width:220px; }
    .ghsa-summary-header{ display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--ghsa-gold); letter-spacing:0.8px; text-transform:uppercase; margin-bottom:12px; }
    .ghsa-summary-item{ display:flex; align-items:center; justify-content:space-between; padding:10px; border:1px solid var(--ghsa-border); border-radius:10px; margin-bottom:8px; }
    .ghsa-summary-item .ghsa-left{ display:flex; align-items:center; gap:10px; }
    .ghsa-summary-icon{ width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
    .ghsa-summary-icon.blue{ background:var(--ghsa-gold-dim); color:var(--ghsa-gold); }
    .ghsa-summary-icon.green{ background:var(--ghsa-green-bg); color:var(--ghsa-green); }
    .ghsa-summary-icon.amber{ background:var(--ghsa-amber-bg); color:var(--ghsa-amber); }
    .ghsa-summary-icon.purple{ background:var(--ghsa-purple-bg); color:var(--ghsa-purple); }
    .ghsa-summary-item .ghsa-flabel{ font-size:12px; color:var(--ghsa-tx2); margin-bottom:0; }
    .ghsa-summary-item .ghsa-val{ font-size:14px; font-weight:700; color:var(--ghsa-tx); }
    .ghsa-breakdown-title{ font-size:11.5px; font-weight:700; color:var(--ghsa-gold); text-transform:uppercase; letter-spacing:0.6px; margin:14px 0 10px; }
    .ghsa-breakdown-row{ display:flex; align-items:center; justify-content:space-between; font-size:12.5px; color:var(--ghsa-tx2); padding:6px 0; }
    .ghsa-breakdown-row .ghsa-left{ display:flex; align-items:center; gap:8px; }
    .ghsa-total-items-row{ display:flex; justify-content:space-between; padding-top:9px; border-top:1px solid var(--ghsa-border); margin-top:6px; font-size:12.5px; font-weight:700; color:var(--ghsa-tx); }

    .ghsa-bottom-row{ display:flex; gap:14px; align-items:stretch; flex-shrink:0; }
    @media (max-width:700px){ .ghsa-bottom-row{ flex-direction:column; } }
    @media (max-width:480px){ .ghsa-actions{ flex-direction:column; width:100%; } .ghsa-actions .ghsa-btn{ width:100%; justify-content:center; } }
    .ghsa-note-card{ flex:1; background:var(--ghsa-amber-bg); border:1px solid rgba(247,144,9,.3); border-radius:10px; padding:12px 16px; display:flex; gap:12px; }
    .ghsa-note-icon{ color:var(--ghsa-amber); font-size:16px; margin-top:2px; }
    .ghsa-note-title{ font-size:11px; font-weight:700; color:var(--ghsa-amber); text-transform:uppercase; margin-bottom:4px; letter-spacing:0.6px; }
    .ghsa-note-text{ font-size:12px; color:var(--ghsa-tx2); line-height:1.45; }
    .ghsa-actions{ display:flex; gap:10px; align-items:center; }
    .ghsa-btn{ padding:11px 20px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; white-space:nowrap; border:none; font-family:inherit; }
    .ghsa-btn-reject{ background:var(--ghsa-card); border:1px solid var(--ghsa-border); color:var(--ghsa-tx); }
    .ghsa-btn-reject:hover{ border-color:var(--ghsa-red); color:var(--ghsa-red); }
    .ghsa-btn-approve{ background:var(--ghsa-gold); border:1px solid var(--ghsa-gold); color:#fff; }
    .ghsa-btn-approve:hover{ background:var(--ghsa-gold-light); }
    .ghsa-btn-confirm{ background:var(--ghsa-green); border:1px solid var(--ghsa-green); color:#fff; }
    .ghsa-btn-confirm:hover{ filter:brightness(1.08); }
    .ghsa-btn:disabled{ opacity:0.5; cursor:default; }
    .ghsa-empty-state{ display:flex; align-items:center; justify-content:center; flex:1; color:var(--ghsa-tx3); font-size:13px; text-align:center; padding:40px; }
    .ghsa-await-note{ font-size:12px; color:var(--ghsa-tx3); font-style:italic; }

    .ghsa-modal-overlay{ display:none; position:fixed; inset:0; background:rgba(15,20,45,.55); backdrop-filter:blur(4px); z-index:9998; align-items:center; justify-content:center; padding:20px; }
    .ghsa-modal-overlay.show{ display:flex; }
    .ghsa-modal-box{ background:var(--ghsa-card); border:1px solid var(--ghsa-border); border-radius:14px; padding:20px; width:min(440px, 92vw); box-shadow:0 32px 80px rgba(15,34,55,.25); }
    .ghsa-modal-title{ font-size:17px; font-weight:800; color:var(--ghsa-tx); margin-bottom:4px; }
    .ghsa-modal-sub{ font-size:12px; color:var(--ghsa-tx3); margin-bottom:14px; line-height:1.5; }
    .ghsa-modal-textarea{ width:100%; background:var(--ghsa-input-bg); border:1px solid var(--ghsa-border); border-radius:8px; padding:10px 12px; color:var(--ghsa-tx); font-family:inherit; font-size:13px; outline:none; resize:vertical; min-height:80px; transition:border-color .15s; }
    .ghsa-modal-textarea:focus{ border-color:var(--ghsa-gold-border); }
    .ghsa-modal-textarea.error{ border-color:var(--ghsa-red); }
    .ghsa-modal-error{ font-size:11.5px; color:var(--ghsa-red); margin-top:6px; display:none; }
    .ghsa-modal-error.show{ display:block; }
    .ghsa-modal-footer{ display:flex; justify-content:flex-end; gap:10px; margin-top:16px; }

    .ghsa-wrap ::-webkit-scrollbar{ width:6px; height:6px; }
    .ghsa-wrap ::-webkit-scrollbar-track{ background:transparent; }
    .ghsa-wrap ::-webkit-scrollbar-thumb{ background:var(--ghsa-border); border-radius:6px; }

    .ghsa-toast{ position:fixed; bottom:20px; right:20px; background:var(--ghsa-card); border:1px solid var(--ghsa-border); border-radius:10px; padding:11px 16px; font-size:12.5px; color:var(--ghsa-tx); box-shadow:0 8px 28px rgba(15,34,55,.18); z-index:9999; display:flex; align-items:center; gap:8px; animation:ghsaToastIn .3s ease; max-width:calc(100vw - 40px); font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; }
    .ghsa-toast.success{ border-left:3px solid var(--ghsa-green); }
    .ghsa-toast.error{ border-left:3px solid var(--ghsa-red); }
    @keyframes ghsaToastIn{ from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'ghsa-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _injectFontAwesome() {
    if (document.getElementById('ghsa-fa') || document.querySelector('link[href*="font-awesome"]')) return;
    const link = document.createElement('link');
    link.id = 'ghsa-fa';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function _fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function _fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function _todayDisplay() { return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  let _instanceCounter = 0;

  // ══════════════════════════════════════════════════════════════════
  // attach()
  // ══════════════════════════════════════════════════════════════════
  function attach(target, options) {
    options = options || {};
    _injectFontAwesome();
    _injectStyles();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[GraceHotelStoreApproval] Target not found:', target); return null; }

    const svc = options.storeService;
    if (!svc || typeof svc.getRequisition !== 'function') {
      console.error('[GraceHotelStoreApproval] options.storeService is required (services/store-service.js) — this component has no standalone/offline mode.');
      container.innerHTML = `<div class="ghsa-empty-state">Store service was not provided. This component cannot load requisitions without it.</div>`;
      return null;
    }
    const viewerSvc = options.viewerService || null;

    const instId = 'ghsa' + (++_instanceCounter);
    const showBack = options.showBackButton !== false;
    const backHref = options.backHref || 'all-requisitions.html';
    const role = options.viewerRole === 'requester' ? 'requester' : 'store';

    function stockFor(name) { return svc.stockQtyFor(name) || 0; }

    let currentNo = options.reqNo || new URLSearchParams(window.location.search).get('req') || '';
    let req = null;
    let workingItems = []; // mutable copy of the requisition's items for editing (store role only)
    let unsubSvc = null;

    // ── Shell (topbar + content placeholder) ──
    container.innerHTML = `
      <div class="ghsa-wrap" id="${instId}">
        <div class="ghsa-topbar">
          <div class="ghsa-topbar-left">
            ${showBack ? `<a class="ghsa-back-btn" href="${_esc(backHref)}" id="${instId}-back" title="Back to requisitions"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
            <div>
              <div class="ghsa-page-title" id="${instId}-title">Requisition</div>
              <div class="ghsa-page-subtitle" id="${instId}-subtitle"></div>
            </div>
          </div>
          <div class="ghsa-topbar-right">
            <div class="ghsa-status-block">
              <div class="ghsa-status-label">Overall Status (auto)</div>
              <div class="ghsa-status-pill pending" id="${instId}-overallStatus">—</div>
            </div>
          </div>
        </div>
        <div class="ghsa-content" id="${instId}-content">
          <div class="ghsa-empty-state">Loading requisition…</div>
        </div>

        <div class="ghsa-modal-overlay" id="${instId}-reasonModal">
          <div class="ghsa-modal-box">
            <div class="ghsa-modal-title" id="${instId}-reasonTitle">Reject Requisition</div>
            <div class="ghsa-modal-sub" id="${instId}-reasonSub">Please give a reason. This will be visible to the requester.</div>
            <textarea class="ghsa-modal-textarea" id="${instId}-reasonInput" placeholder="e.g. Out of stock until next delivery, wrong department code, duplicate request…"></textarea>
            <div class="ghsa-modal-error" id="${instId}-reasonError">A reason is required.</div>
            <div class="ghsa-modal-footer">
              <button class="ghsa-btn ghsa-btn-reject" id="${instId}-reasonCancel">Cancel</button>
              <button class="ghsa-btn ghsa-btn-approve" id="${instId}-reasonConfirm" style="background:var(--ghsa-red); border-color:var(--ghsa-red); color:#fff;"><i class="fa-solid fa-xmark"></i> Confirm</button>
            </div>
          </div>
        </div>
      </div>`;

    const root = container.querySelector('#' + instId);

    if (showBack && typeof options.onBack === 'function') {
      const backBtn = document.getElementById(instId + '-back');
      if (backBtn) backBtn.addEventListener('click', () => options.onBack());
    }

    // ── Reason modal — shared by "Reject Requisition" (store) and
    // "Report Issue" (requester dispute); which action it confirms is set
    // by openReasonModal() each time it's opened. ──
    const reasonModal = document.getElementById(instId + '-reasonModal');
    const reasonTitleEl = document.getElementById(instId + '-reasonTitle');
    const reasonSubEl = document.getElementById(instId + '-reasonSub');
    const reasonInput = document.getElementById(instId + '-reasonInput');
    const reasonErrorEl = document.getElementById(instId + '-reasonError');
    const reasonConfirmBtn = document.getElementById(instId + '-reasonConfirm');
    let reasonSubmitFn = null;

    function openReasonModal({ title, sub, confirmLabel, onSubmit }) {
      reasonTitleEl.textContent = title;
      reasonSubEl.textContent = sub;
      reasonConfirmBtn.innerHTML = confirmLabel;
      reasonSubmitFn = onSubmit;
      reasonInput.value = '';
      reasonInput.classList.remove('error');
      reasonErrorEl.classList.remove('show');
      reasonModal.classList.add('show');
      setTimeout(() => reasonInput.focus(), 50);
    }
    function closeReasonModal() { reasonModal.classList.remove('show'); reasonSubmitFn = null; }

    document.getElementById(instId + '-reasonCancel').addEventListener('click', closeReasonModal);
    reasonModal.addEventListener('click', (e) => { if (e.target === reasonModal) closeReasonModal(); });
    reasonConfirmBtn.addEventListener('click', () => {
      const reason = reasonInput.value.trim();
      if (!reason) {
        reasonInput.classList.add('error');
        reasonErrorEl.classList.add('show');
        reasonInput.focus();
        return;
      }
      const fn = reasonSubmitFn;
      closeReasonModal();
      if (fn) fn(reason);
    });

    function statusFor(issued, requested) {
      if (req.status === 'Rejected' || req.status === 'Disputed') return req.status.toLowerCase();
      if (issued <= 0) return 'pending';
      if (issued >= requested) return 'full';
      return 'partial';
    }

    function buildWorkingItems(source) {
      return source.items.map(i => ({
        ...i,
        issuedQty: (i.issuedQty && i.issuedQty > 0) ? i.issuedQty : Math.min(i.qty, stockFor(i.name)),
      }));
    }

    // ── Load a requisition — always from StoreService's in-memory state ──
    function load(no) {
      if (no) currentNo = no;
      document.getElementById(instId + '-content').innerHTML = `<div class="ghsa-empty-state">Loading requisition…</div>`;

      req = currentNo ? svc.getRequisition(currentNo) : null;
      if (!req && viewerSvc && typeof viewerSvc.getRequisition === 'function') {
        req = currentNo ? viewerSvc.getRequisition(currentNo) : null;
      }
      if (!req) {
        const anyStoreIssue = (svc.getRequisitions({ mode: 'store_issue' }) || [])[0];
        document.getElementById(instId + '-content').innerHTML = currentNo
          ? `<div class="ghsa-empty-state">Requisition <b>${_esc(currentNo)}</b> was not found.${anyStoreIssue ? `<br><br>Try <code>?req=${_esc(anyStoreIssue.no)}</code> instead.` : ''}</div>`
          : `<div class="ghsa-empty-state">No requisition number given.${anyStoreIssue ? `<br><br>Try <code>?req=${_esc(anyStoreIssue.no)}</code>.` : ' There are no store-issue requisitions yet.'}</div>`;
        return;
      }
      workingItems = buildWorkingItems(req);
      render();
    }

    // ── Render ──
    function render() {
      if (!req) return;

      const isStoreRole = role === 'store';

      document.getElementById(instId + '-title').textContent = isStoreRole
        ? `${req.dept} Requisition – Store Approval`
        : `${req.no} – Delivery Review`;
      document.getElementById(instId + '-subtitle').textContent = isStoreRole
        ? `Approve and issue items from Central Store${req.fulfillStore ? ' to ' + req.fulfillStore : ''}`
        : `Review what Store issued and accept it or report an issue`;

      const totalReq = workingItems.reduce((s, i) => s + i.qty, 0);
      const totalIssued = workingItems.reduce((s, i) => s + (parseFloat(i.issuedQty) || 0), 0);
      const totalBalance = totalReq - totalIssued;
      const overall = (req.status || 'Pending').toLowerCase();
      const overallLabel = {
        rejected: '<i class="fa-solid fa-ban"></i> REJECTED',
        disputed: '<i class="fa-solid fa-triangle-exclamation"></i> DISPUTED',
        completed: '<i class="fa-solid fa-circle-check"></i> COMPLETED',
        pending: '<i class="fa-solid fa-hourglass-half"></i> AWAITING ISSUE',
        full: '<i class="fa-solid fa-circle-check"></i> FULLY ISSUED',
        partial: '<i class="fa-solid fa-rotate"></i> PARTIALLY ISSUED',
      }[overall] || 'AWAITING ISSUE';
      const pill = document.getElementById(instId + '-overallStatus');
      pill.className = `ghsa-status-pill ${overall}`;
      pill.innerHTML = overallLabel;

      // Issued-qty is editable only for the store role, and only while
      // the requisition is still Pending/Partial. The requester always
      // sees it read-only — they're reviewing, not editing.
      const issuedEditable = isStoreRole && (req.status === 'Pending' || req.status === 'Partial');

      const rowsHtml = workingItems.map((it, idx) => {
        const avail = stockFor(it.name);
        const st = statusFor(parseFloat(it.issuedQty) || 0, it.qty);
        const balance = Math.max(0, it.qty - (parseFloat(it.issuedQty) || 0));
        const tagClass = st === 'full' ? 'full' : st === 'partial' ? 'partial' : 'none';
        const tagLabel = st === 'full' ? 'FULL' : st === 'partial' ? 'PARTIAL' : 'NOT ISSUED';
        return `<tr>
          <td class="ghsa-num">${idx + 1}</td>
          <td>${_esc(it.name)}</td>
          <td class="ghsa-center">${_esc(it.unit)}</td>
          <td class="ghsa-center">${it.qty.toFixed(2)}</td>
          <td class="ghsa-center ${avail < it.qty ? 'ghsa-red-text' : 'ghsa-green-text'}">${avail.toFixed(2)}</td>
          <td class="ghsa-center"><div class="ghsa-qty${issuedEditable ? '' : ' readonly'}"><input type="text" inputmode="decimal" value="${(parseFloat(it.issuedQty) || 0).toFixed(2)}" data-idx="${idx}" data-role="issuedInput" ${issuedEditable ? '' : 'disabled'}>${issuedEditable ? `<span class="ghsa-stepper"><span data-idx="${idx}" data-delta="1" data-role="issuedStep"><i class="fa-solid fa-caret-up"></i></span><span data-idx="${idx}" data-delta="-1" data-role="issuedStep"><i class="fa-solid fa-caret-down"></i></span></span>` : ''}</div></td>
          <td class="ghsa-center ${balance > 0 ? 'ghsa-red-text' : ''}">${balance.toFixed(2)}</td>
          <td class="ghsa-center"><span class="ghsa-status-tag ${tagClass}">${tagLabel}</span></td>
          <td class="ghsa-center">${it.remark ? `<i class="fa-solid fa-comment" title="${_esc(it.remark)}"></i>` : '—'}</td>
        </tr>`;
      }).join('');

      const fullCount = workingItems.filter(i => (parseFloat(i.issuedQty) || 0) >= i.qty).length;
      const partialCount = workingItems.filter(i => { const iss = parseFloat(i.issuedQty) || 0; return iss > 0 && iss < i.qty; }).length;
      const noneCount = workingItems.length - fullCount - partialCount;
      const totalCost = workingItems.reduce((s, i) => s + (parseFloat(i.issuedQty) || 0) * (i.cost || 0), 0);
      const pct = n => workingItems.length ? Math.round(n / workingItems.length * 100) : 0;

      // ── Bottom action bar — the one part that genuinely differs by role ──
      let actionsHtml;
      if (isStoreRole) {
        const approveLabel = req.status === 'Partial' ? '<i class="fa-solid fa-check"></i> Update Issued Items'
          : req.status === 'Full' ? '<i class="fa-solid fa-check"></i> Approved — Fully Issued'
          : (req.status === 'Completed' || req.status === 'Disputed') ? '<i class="fa-solid fa-check"></i> Closed'
          : '<i class="fa-solid fa-check"></i> Approve &amp; Issue Items';
        actionsHtml = `
          <button class="ghsa-btn ghsa-btn-reject" data-act="reject" ${(req.status === 'Completed' || req.status === 'Rejected' || req.status === 'Disputed') ? 'disabled' : ''}><i class="fa-solid fa-ban"></i> Reject Requisition</button>
          <button class="ghsa-btn ghsa-btn-approve" data-act="approve" ${(req.status === 'Pending' || req.status === 'Partial') ? '' : 'disabled'}>${approveLabel}</button>`;
      } else {
        if (req.status === 'Full' || req.status === 'Partial') {
          actionsHtml = `
            <button class="ghsa-btn ghsa-btn-reject" data-act="dispute"><i class="fa-solid fa-triangle-exclamation"></i> Report Issue</button>
            <button class="ghsa-btn ghsa-btn-confirm" data-act="confirm"><i class="fa-solid fa-check"></i> Accept Delivery</button>`;
        } else if (req.status === 'Completed') {
          actionsHtml = `<span class="ghsa-await-note">You confirmed receipt of this delivery.</span>`;
        } else if (req.status === 'Disputed') {
          actionsHtml = `<span class="ghsa-await-note">Issue reported — waiting on Store to follow up.</span>`;
        } else if (req.status === 'Rejected') {
          actionsHtml = `<span class="ghsa-await-note">This requisition was rejected by Store.</span>`;
        } else {
          actionsHtml = `<span class="ghsa-await-note">Waiting on Store to issue items.</span>`;
        }
      }

      const noteText = options.noteText || (isStoreRole
        ? 'Enter the quantity issued for each item based on availability. Status and balance update automatically. Any items left with a Balance Qty above zero can be escalated to Procurement by linking this requisition number on a new Purchase request.'
        : 'Check what Store actually issued against what you requested. Accept the delivery if it\u2019s correct, or report an issue if something is missing, wrong, or damaged.');

      document.getElementById(instId + '-content').innerHTML = `
        <div class="ghsa-row">
          <div class="ghsa-card ghsa-details-panel">
            <div class="ghsa-card-header"><i class="fa-solid fa-clipboard-list"></i> Requisition Details</div>
            <div class="ghsa-detail-grid">
              <div><div class="ghsa-flabel">Requisition No.</div><div class="ghsa-fvalue link">${_esc(req.no)}</div></div>
              <div><div class="ghsa-flabel">Requisition Date</div><div class="ghsa-fvalue">${_esc(req.dateRaisedDisplay || _fmtDate(req.dateRaised))}</div></div>
              <div><div class="ghsa-flabel">Requested By</div><div class="ghsa-fvalue">${_esc(req.by)}</div></div>
              <div><div class="ghsa-flabel">Required Date</div><div class="ghsa-fvalue">${_fmtDate(req.needed)}</div></div>
              <div><div class="ghsa-flabel">Department</div><div class="ghsa-fvalue">${_esc(req.dept)}</div></div>
              <div><div class="ghsa-flabel">Priority</div><div class="ghsa-fvalue">${_esc(req.priority)}</div></div>
              <div><div class="ghsa-flabel">Kitchen/Fulfilling Store</div><div class="ghsa-fvalue">${_esc(req.fulfillStore || '—')}</div></div>
              <div></div>
              <div style="grid-column:1/-1;"><div class="ghsa-flabel">Purpose / Remark</div><div class="ghsa-fvalue">${_esc(req.remark || '—')}</div></div>
              ${req.status === 'Rejected' && req.rejectReason ? `<div style="grid-column:1/-1;"><div class="ghsa-flabel" style="color:var(--ghsa-red);">Rejection Reason</div><div class="ghsa-fvalue" style="color:var(--ghsa-red);">${_esc(req.rejectReason)}</div></div>` : ''}
              ${req.status === 'Disputed' && req.disputeReason ? `<div style="grid-column:1/-1;"><div class="ghsa-flabel" style="color:var(--ghsa-red);">Reported Issue</div><div class="ghsa-fvalue" style="color:var(--ghsa-red);">${_esc(req.disputeReason)}</div></div>` : ''}
            </div>
          </div>
          <div class="ghsa-card ghsa-delivery-panel">
            <div class="ghsa-card-header green"><i class="fa-solid fa-truck"></i> Delivery / Issue Details</div>
            <div class="ghsa-delivery-field"><div class="ghsa-flabel">Issue / Transfer Date</div><div class="ghsa-fvalue">${_todayDisplay()}</div></div>
            <div class="ghsa-delivery-field"><div class="ghsa-flabel">Prepared By</div><div class="ghsa-fvalue">${_esc(options.preparedBy || 'Store Keeper')}</div></div>
            <div class="ghsa-delivery-field"><div class="ghsa-flabel">Delivery Note No.</div><div class="ghsa-fvalue">DN-${_esc(req.no.split('-').slice(1).join('-'))}</div></div>
            <div class="ghsa-delivery-field" style="margin-bottom:0;"><div class="ghsa-flabel">Remarks</div><div class="ghsa-fvalue small">${req.status === 'Rejected' ? 'Requisition rejected.' : req.status === 'Disputed' ? 'Requester reported an issue with this delivery.' : req.status === 'Completed' ? 'Requester confirmed receipt.' : `Items issued to ${_esc(req.fulfillStore || 'requesting department')}.`}</div></div>
          </div>
        </div>

        <div class="ghsa-items-section">
          <div class="ghsa-card ghsa-items-card">
            <div class="ghsa-card-header"><i class="fa-solid fa-box"></i> Items Requested vs Issued</div>
            <div class="ghsa-table-scroll">
              <table class="ghsa-table">
                <thead><tr>
                  <th class="ghsa-num">#</th><th>Item</th><th class="ghsa-center">Unit</th><th class="ghsa-center">Requested<br>Qty</th>
                  <th class="ghsa-center">Available<br>in Store</th><th class="ghsa-center">Issued Qty${issuedEditable ? ' <i class="fa-solid fa-circle-info"></i><br><span style="font-weight:400;">(Enter Qty)</span>' : ''}</th>
                  <th class="ghsa-center">Balance Qty<br>(Auto)</th><th class="ghsa-center">Status<br>(Auto)</th><th class="ghsa-center">Remarks</th>
                </tr></thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot><tr>
                  <td class="ghsa-num" style="color:var(--ghsa-gold);">TOTAL</td><td></td><td class="ghsa-center"></td>
                  <td class="ghsa-center">${totalReq.toFixed(2)}</td>
                  <td class="ghsa-center">${workingItems.reduce((s, i) => s + stockFor(i.name), 0).toFixed(2)}</td>
                  <td class="ghsa-center">${totalIssued.toFixed(2)}</td>
                  <td class="ghsa-center">${totalBalance.toFixed(2)}</td>
                  <td class="ghsa-center"></td><td class="ghsa-center"></td>
                </tr></tfoot>
              </table>
            </div>
            <div class="ghsa-legend">
              <div><span class="ghsa-dot green"></span>FULL: Issued Qty = Requested Qty</div>
              <div><span class="ghsa-dot amber"></span>PARTIAL: 0 &lt; Issued Qty &lt; Requested Qty</div>
              <div><span class="ghsa-dot red"></span>NOT ISSUED: Issued Qty = 0</div>
            </div>
          </div>
          <div class="ghsa-card ghsa-summary-card">
            <div class="ghsa-summary-header"><i class="fa-solid fa-clock"></i> Issue Summary (auto calculated)</div>
            <div class="ghsa-summary-item"><div class="ghsa-left"><div class="ghsa-summary-icon blue"><i class="fa-solid fa-clipboard-list"></i></div><div class="ghsa-flabel">Total Requested Qty</div></div><div class="ghsa-val">${totalReq.toFixed(2)}</div></div>
            <div class="ghsa-summary-item"><div class="ghsa-left"><div class="ghsa-summary-icon green"><i class="fa-solid fa-box"></i></div><div class="ghsa-flabel">Total Issued Qty</div></div><div class="ghsa-val">${totalIssued.toFixed(2)}</div></div>
            <div class="ghsa-summary-item"><div class="ghsa-left"><div class="ghsa-summary-icon amber"><i class="fa-solid fa-file-lines"></i></div><div class="ghsa-flabel">Total Balance Qty</div></div><div class="ghsa-val">${totalBalance.toFixed(2)}</div></div>
            <div class="ghsa-summary-item"><div class="ghsa-left"><div class="ghsa-summary-icon purple"><i class="fa-solid fa-sack-dollar"></i></div><div class="ghsa-flabel">Total Issue Cost (₦)</div></div><div class="ghsa-val">${_fmtN(totalCost)}</div></div>
            <div class="ghsa-breakdown-title">Item Status Breakdown</div>
            <div class="ghsa-breakdown-row"><div class="ghsa-left"><span class="ghsa-dot green"></span>Full Items</div><div>${fullCount} (${pct(fullCount)}%)</div></div>
            <div class="ghsa-breakdown-row"><div class="ghsa-left"><span class="ghsa-dot amber"></span>Partial Items</div><div>${partialCount} (${pct(partialCount)}%)</div></div>
            <div class="ghsa-breakdown-row"><div class="ghsa-left"><span class="ghsa-dot red"></span>Not Issued Items</div><div>${noneCount} (${pct(noneCount)}%)</div></div>
            <div class="ghsa-total-items-row"><div>Total Items</div><div>${workingItems.length}</div></div>
          </div>
        </div>

        <div class="ghsa-bottom-row">
          <div class="ghsa-note-card">
            <div class="ghsa-note-icon"><i class="fa-solid fa-circle-info"></i></div>
            <div><div class="ghsa-note-title">Note</div><div class="ghsa-note-text">${_esc(noteText)}</div></div>
          </div>
          <div class="ghsa-actions">${actionsHtml}</div>
        </div>`;

      bindContentEvents();
    }

    function bindContentEvents() {
      const content = document.getElementById(instId + '-content');
      content.querySelectorAll('[data-role="issuedInput"]').forEach(inp => {
        inp.addEventListener('change', () => updateIssued(parseInt(inp.dataset.idx, 10), inp.value));
      });
      content.querySelectorAll('[data-role="issuedStep"]').forEach(btn => {
        btn.addEventListener('click', () => stepIssued(parseInt(btn.dataset.idx, 10), parseFloat(btn.dataset.delta)));
      });

      // Store-role actions
      const rejectBtn = content.querySelector('[data-act="reject"]');
      if (rejectBtn) rejectBtn.addEventListener('click', () => {
        openReasonModal({
          title: 'Reject Requisition',
          sub: 'Please give a reason for rejecting this requisition. This will be visible to the requester.',
          confirmLabel: '<i class="fa-solid fa-xmark"></i> Confirm Rejection',
          onSubmit: rejectReq,
        });
      });
      const approveBtn = content.querySelector('[data-act="approve"]');
      if (approveBtn) approveBtn.addEventListener('click', approveReq);

      // Requester-role actions
      const confirmBtn = content.querySelector('[data-act="confirm"]');
      if (confirmBtn) confirmBtn.addEventListener('click', confirmReq);
      const disputeBtn = content.querySelector('[data-act="dispute"]');
      if (disputeBtn) disputeBtn.addEventListener('click', () => {
        openReasonModal({
          title: 'Report Issue',
          sub: 'Let Store know what\u2019s wrong with this delivery — missing item, wrong quantity, damaged goods, etc.',
          confirmLabel: '<i class="fa-solid fa-triangle-exclamation"></i> Submit Report',
          onSubmit: disputeReq,
        });
      });
    }

    function updateIssued(idx, value) {
      if (role !== 'store') return;
      if (req.status !== 'Pending' && req.status !== 'Partial') return;
      const it = workingItems[idx];
      let v = parseFloat(value) || 0;
      v = Math.max(0, Math.min(v, stockFor(it.name)));
      it.issuedQty = v;
      render();
    }
    function stepIssued(idx, delta) {
      if (role !== 'store') return;
      if (req.status !== 'Pending' && req.status !== 'Partial') return;
      const it = workingItems[idx];
      const cur = parseFloat(it.issuedQty) || 0;
      it.issuedQty = Math.max(0, Math.min(cur + delta, stockFor(it.name)));
      render();
    }

    // ── Store actions ──
    async function approveReq() {
      // Build { itemName: issuedQty } and let StoreService deduct stock +
      // decide Pending/Partial/Full — this component never computes
      // status or touches storage itself.
      const issuedQtyByItem = {};
      workingItems.forEach(i => { issuedQtyByItem[i.name] = parseFloat(i.issuedQty) || 0; });
      try {
        const updated = await svc.approveAndIssue(req.no, issuedQtyByItem);
        req = updated;
        workingItems = buildWorkingItems(req);
        render();
        showToast(`${req.no} marked ${req.status}.`, 'success');
        if (typeof options.onApprove === 'function') options.onApprove(req);
      } catch (err) {
        showToast((err && err.message) || 'Could not approve requisition.', 'error');
      }
    }

    async function rejectReq(reason) {
      try {
        const updated = await svc.rejectRequisition(req.no, reason);
        req = updated;
        workingItems = buildWorkingItems(req);
        render();
        showToast(`${req.no} rejected.`, 'error');
        if (typeof options.onReject === 'function') options.onReject(req);
      } catch (err) {
        showToast((err && err.message) || 'Could not reject requisition.', 'error');
      }
    }

    // ── Requester actions ──
    async function confirmReq() {
      try {
        const actionSvc = (viewerSvc && typeof viewerSvc.confirmReceipt === 'function') ? viewerSvc : svc;
        const updated = await actionSvc.confirmReceipt(req.no);
        req = updated;
        workingItems = buildWorkingItems(req);
        render();
        showToast(`${req.no} marked Completed.`, 'success');
        if (typeof options.onConfirm === 'function') options.onConfirm(req);
      } catch (err) {
        showToast((err && err.message) || 'Could not confirm receipt.', 'error');
      }
    }

    async function disputeReq(reason) {
      try {
        const actionSvc = (viewerSvc && typeof viewerSvc.rejectDelivery === 'function') ? viewerSvc : svc;
        const updated = await actionSvc.rejectDelivery(req.no, reason);
        req = updated;
        workingItems = buildWorkingItems(req);
        render();
        showToast(`${req.no} marked Disputed.`, 'error');
        if (typeof options.onDispute === 'function') options.onDispute(req);
      } catch (err) {
        showToast((err && err.message) || 'Could not report this issue.', 'error');
      }
    }

    function showToast(msg, type) {
      const t = document.createElement('div');
      t.className = `ghsa-toast ${type === 'error' ? 'error' : 'success'}`;
      t.innerHTML = (type === 'error' ? '<i class="fa-solid fa-circle-xmark"></i> ' : '<i class="fa-solid fa-circle-check"></i> ') + _esc(msg);
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    }

    // ── Stay in sync if the same requisition changes elsewhere (e.g.
    // Store issuing it while the requester already has this open) ──
    if (typeof svc.onChange === 'function') {
      unsubSvc = svc.onChange(() => {
        if (!req) return;
        const fresh = svc.getRequisition(req.no);
        if (!fresh) return;
        req = fresh;
        workingItems = buildWorkingItems(req);
        render();
      });
    }

    // ── Init ──
    load(currentNo);

    // ── Public control object ──
    return {
      load,
      getReq: () => req,
      refresh: render,
      getRole: () => role,
      destroy() {
        if (typeof unsubSvc === 'function') { try { unsubSvc(); } catch (e) {} }
        container.innerHTML = '';
      },
    };
  }

  window.GraceHotelStoreApproval = { attach };

})();