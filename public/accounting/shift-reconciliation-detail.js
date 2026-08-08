/**
 * accounting/shift-reconciliation-detail.js
 * ─────────────────────────────────────────────────────────────────────
 * Reusable "Shift Reconciliation" detail modal — same pattern as
 * component/sales-detail.js: drop one <script> tag, call create() once
 * per page, get back a small controller { open, close, destroy }.
 * Fully self-contained CSS (srd- prefixed) — no dependency on the host
 * page's stylesheet. Lives inside the accounting module (not the shared
 * /component folder) because it is Accounting-specific: it understands
 * shift/reconciliation vocabulary, not just generic transactions.
 *
 * This ONE component covers everything needed to reconcile a shift:
 *   - Shift meta (department, shift window, cashier, opening float, tx count)
 *   - Gross / cash sales breakdown
 *   - Full payment-method REVENUE BREAKDOWN — one row per method showing
 *     the method name, the amount collected via it, and its share of
 *     gross sales, so it's obvious at a glance which methods make up
 *     the shift's total (e.g. Room Charge ₦X, Cash ₦Y, POS ₦Z, Transfer ₦W)
 *   - Expected vs actual cash + variance box
 *   - Reconciliation audit history (who counted what, when, corrections)
 *   - The count form itself (actor name, actual cash, notes) with a
 *     live variance preview as the user types
 *   - Handles all three states a shift can be in:
 *       'open'        → shows the count form directly
 *       'reconciled'  → shows the view (breakdown/history) + "Correct Entry"
 *       (mid-correction) → clicking Correct Entry swaps the same modal
 *                          into the count form, pre-filled, flagged as a
 *                          correction
 *
 * ── HOST PAGE SUPPLIES EVERYTHING PRE-COMPUTED ─────────────────────────
 * This component does NOT know about your transactions array, shift-day
 * cutoffs, or storage. You compute the numbers (same as
 * accounting-reconciliation.html already does) and pass a flat object
 * to .open(). This keeps the component reusable from any Accounting
 * page without duplicating shift-day logic in two places.
 *
 *   shiftDetail.open({
 *     dept: 'Restaurant',
 *     key: '2026-07-17',                 // shift date key (YYYY-MM-DD)
 *     rangeLabel: '17 Jul, 9:00 AM → 18 Jul, 9:00 AM',
 *     staff: 'Amaka O. (Restaurant Cashier)',
 *     openingFloat: 20000,
 *     txCount: 4,
 *     grossSales: 43500,
 *     cashSales: 30500,
 *     expectedCash: 50500,               // openingFloat + cashSales
 *     status: 'reconciled',              // 'open' | 'reconciled'
 *     actualCash: 49000,                 // omit / null if status:'open'
 *     notes: 'Till was short — investigating.',
 *     varianceTolerance: 500,            // ₦ — within this = 'ok'
 *     methodBreakdown: [
 *       { method:'Cash', amount:30500 },
 *       { method:'POS',  amount:13000 },
 *     ],
 *     history: [
 *       { actor:'Amaka O.', actualCash:49000, expected:50500, variance:-1500,
 *         notes:'', type:'initial', date:'17/07/26 09:05 AM' },
 *     ],
 *   }, {
 *     onReconcile: async ({ dept, key, actor, actualCash, notes, isCorrection }) => {
 *       // persist to storage/API, update your own shifts array, etc.
 *       // throw an Error to keep the modal open and show an inline error.
 *     },
 *     onSuccess: (payload) => { /* re-render your table, show a toast, etc. *\/ },
 *   });
 *
 * ── USAGE ──────────────────────────────────────────────────────────────
 *   <script src="shift-reconciliation-detail.js"></script>
 *   <script>
 *     const shiftDetail = ShiftReconciliationDetail.create();
 *     // on a row click:
 *     shiftDetail.open(shiftPayload, { onReconcile, onSuccess });
 *   </script>
 *
 * Multiple instances are fine — each gets its own overlay node created
 * lazily on first open(), scoped by a unique instance id.
 */

(function () {
  'use strict';

  /* ── Same light palette + Segoe UI + Font Awesome as every other
     Accounting/Store/Restaurant/Booking page in this suite. ── */
  const CSS = `
    .srd-overlay{ display:none; position:fixed; inset:0; background:rgba(15,26,42,0.5); backdrop-filter:blur(4px); z-index:500; align-items:flex-start; justify-content:center; padding:20px 16px; overflow-y:auto; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; }
    .srd-overlay.srd-show{ display:flex; }
    .srd-modal{ background:#ffffff; border:1px solid #eef0f6; border-radius:18px; padding:24px; width:min(560px,96vw); box-shadow:0 30px 80px rgba(15,34,55,0.2); animation:srd-in .22s cubic-bezier(.4,0,.2,1); margin:auto; position:relative; overflow:hidden; color:#1c2440; font-size:13px; }
    .srd-modal::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:#2f6fed; }
    .srd-modal.srd-mode-ok::before{ background:#12b76a; }
    .srd-modal.srd-mode-bad::before{ background:#f04438; }
    @keyframes srd-in{ from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

    .srd-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:10px; }
    .srd-title{ font-size:19px; font-weight:800; color:#1c2440; display:flex; align-items:center; gap:8px; min-width:0; }
    .srd-title i{ color:#2f6fed; font-size:16px; flex-shrink:0; }
    .srd-close{ background:#f4f6fb; border:1px solid #eef0f6; border-radius:8px; width:30px; height:30px; color:#6b7280; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; flex-shrink:0; }
    .srd-close:hover{ color:#1c2440; border-color:rgba(47,111,237,.25); }

    .srd-meta{ font-size:12px; color:#9aa1b3; margin-bottom:16px; line-height:1.6; }
    .srd-meta b{ color:#1c2440; }
    .srd-meta .srd-warn{ color:#f79009; }

    .srd-breakdown{ display:grid; grid-template-columns:1fr 1fr; gap:10px 14px; margin-bottom:14px; }
    @media (max-width:460px){ .srd-breakdown{ grid-template-columns:1fr; } }
    .srd-bd-item{ background:#f4f6fb; border:1px solid #eef0f6; border-radius:10px; padding:10px 12px; }
    .srd-bd-item.srd-span2{ grid-column:1/-1; }
    .srd-bd-label{ font-size:9px; text-transform:uppercase; letter-spacing:1.1px; color:#9aa1b3; font-weight:700; margin-bottom:4px; }
    .srd-bd-val{ font-size:15.5px; font-weight:800; color:#1c2440; }
    .srd-bd-val.srd-gold{ color:#2f6fed; }

    /* ── Payment Method revenue breakdown — flex rows instead of a
       <table>, so the amount + share always render at full width and
       never get clipped or collapse on narrow screens. One row per
       method: dot + name (+ "In till" tag for Cash) on the left,
       amount + share stacked on the right. ── */
    .srd-method-wrap{ border:1px solid #eef0f6; border-radius:10px; overflow:hidden; margin-bottom:16px; }
    .srd-method-head-row{ display:flex; align-items:center; justify-content:space-between; padding:8px 14px; font-size:9px; text-transform:uppercase; letter-spacing:1.1px; color:#9aa1b3; font-weight:700; background:#f4f6fb; border-bottom:1px solid #eef0f6; }
    .srd-method-rows{ background:#fff; }
    .srd-method-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 14px; border-bottom:1px solid #eef0f6; }
    .srd-method-row:last-child{ border-bottom:none; }
    .srd-method-row.srd-cash-row{ background:rgba(18,183,106,.06); }
    .srd-method-left{ display:flex; align-items:center; gap:8px; min-width:0; }
    .srd-method-dot{ width:9px; height:9px; border-radius:50%; flex-shrink:0; }
    .srd-method-name{ font-size:13px; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .srd-method-cash-tag{ font-size:8px; text-transform:uppercase; font-weight:700; letter-spacing:.4px; color:#12b76a; background:#eafcf3; border-radius:20px; padding:2px 7px; flex-shrink:0; }
    .srd-method-right{ display:flex; align-items:baseline; gap:8px; flex-shrink:0; }
    .srd-method-amount{ font-size:14px; font-weight:800; color:#1c2440; white-space:nowrap; }
    .srd-method-pct{ font-size:11px; color:#9aa1b3; font-weight:600; white-space:nowrap; min-width:42px; text-align:right; }
    .srd-method-foot-row{ display:flex; align-items:center; justify-content:space-between; padding:10px 14px; font-weight:800; background:#f4f6fb; border-top:1px solid #eef0f6; color:#1c2440; }
    .srd-method-foot-row .srd-method-amount{ color:#2f6fed; font-size:15px; }
    .srd-empty-note{ text-align:center; color:#9aa1b3; padding:18px 14px; font-size:12.5px; }
    .srd-method-footnote{ font-size:10.5px; color:#9aa1b3; padding:9px 14px; background:#fff; border-top:1px dashed #eef0f6; line-height:1.5; }
    .srd-method-footnote b{ color:#1c2440; }

    .srd-variance-box{ background:#f4f6fb; border:1px solid #eef0f6; border-radius:10px; padding:12px 14px; margin:12px 0 16px; text-align:center; }
    .srd-variance-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:#9aa1b3; font-weight:700; margin-bottom:4px; }
    .srd-variance-val{ font-size:24px; font-weight:800; }
    .srd-variance-val.srd-ok{ color:#12b76a; } .srd-variance-val.srd-bad{ color:#f04438; } .srd-variance-val.srd-neutral{ color:#9aa1b3; }

    .srd-history{ margin-top:6px; }
    .srd-history-head{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:#2f6fed; font-weight:700; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(47,111,237,.25); }
    .srd-history-entry{ background:#f4f6fb; border:1px solid #eef0f6; border-radius:10px; padding:10px 12px; margin-bottom:8px; }
    .srd-history-entry:last-child{ margin-bottom:0; }
    .srd-history-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px; }
    .srd-history-actor{ font-size:12.5px; font-weight:700; color:#1c2440; }
    .srd-history-time{ font-size:10.5px; color:#9aa1b3; white-space:nowrap; }
    .srd-history-meta{ font-size:11.5px; color:#6b7280; display:flex; gap:12px; flex-wrap:wrap; margin-bottom:3px; }
    .srd-history-meta span b{ color:#1c2440; }
    .srd-history-note{ font-size:11.5px; color:#6b7280; font-style:italic; margin-top:4px; line-height:1.4; }
    .srd-tag{ font-size:8.5px; text-transform:uppercase; font-weight:700; letter-spacing:.5px; padding:1px 7px; border-radius:20px; flex-shrink:0; }
    .srd-tag.srd-initial{ background:#eaf1ff; color:#2f6fed; }
    .srd-tag.srd-correction{ background:#fff4e5; color:#f79009; }

    .srd-form-group{ display:flex; flex-direction:column; gap:5px; margin-bottom:12px; }
    .srd-form-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:#9aa1b3; font-weight:700; }
    .srd-form-label.srd-req::after{ content:' *'; color:#f04438; }
    .srd-form-input, .srd-form-textarea{ background:#f4f6fb; border:1px solid #eef0f6; border-radius:10px; padding:9px 12px; color:#1c2440; font-family:inherit; font-size:13px; outline:none; transition:border-color .2s; width:100%; box-sizing:border-box; }
    .srd-form-input:focus, .srd-form-textarea:focus{ border-color:rgba(47,111,237,.25); }
    .srd-form-textarea{ resize:vertical; min-height:60px; }

    .srd-error-box{ display:none; background:#feecec; border:1px solid rgba(240,68,56,.3); color:#f04438; border-radius:10px; padding:9px 12px; font-size:12px; font-weight:600; margin-bottom:12px; align-items:center; gap:8px; }
    .srd-error-box.srd-show{ display:flex; }

    .srd-footer{ display:flex; gap:8px; justify-content:flex-end; margin-top:16px; padding-top:14px; border-top:1px solid #eef0f6; flex-wrap:wrap; }
    .srd-btn{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; transition:all .2s; white-space:nowrap; border:1px solid transparent; font-family:inherit; }
    .srd-btn-outline{ background:none; border-color:#eef0f6; color:#6b7280; }
    .srd-btn-outline:hover{ border-color:#2f6fed; color:#2f6fed; }
    .srd-btn-primary{ background:#2f6fed; color:#fff; }
    .srd-btn-primary:hover{ background:#5b8ff9; }
    .srd-btn-primary:disabled{ opacity:.55; cursor:default; pointer-events:none; }
    .srd-btn[disabled]{ opacity:.55; cursor:default; pointer-events:none; }

    .srd-spin{ animation:srd-spin 0.8s linear infinite; }
    @keyframes srd-spin{ to{ transform:rotate(360deg); } }
  `;

  function _ensureFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"]') || document.getElementById('srd-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'srd-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'srd-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }

  const METHOD_COLOR = { Cash: '#12b76a', POS: '#2f6fed', Transfer: '#8b5cf6', 'Room Charge': '#f79009', Complimentary: '#9aa1b3' };

  let _counter = 0;

  function create(defaultOptions) {
    defaultOptions = defaultOptions || {};
    _ensureFontAwesome();
    _injectStyles();

    const instId = 'srd' + (++_counter);
    const defaultTolerance = defaultOptions.varianceTolerance != null ? defaultOptions.varianceTolerance : 500;

    const overlay = document.createElement('div');
    overlay.className = 'srd-overlay';
    overlay.id = instId + '-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('srd-show')) close(); });

    let currentPayload = null;
    let currentCallbacks = {};
    let inCorrectionMode = false;
    let submitting = false;

    function tolerance() {
      return currentPayload && currentPayload.varianceTolerance != null ? currentPayload.varianceTolerance : defaultTolerance;
    }

    /* ── Payment-method REVENUE BREAKDOWN.
       Every row shows: the method, the ₦ amount collected via it, and
       what share of gross sales it represents — e.g. "Room Charge —
       ₦12,000 (28%)", "Cash — ₦30,500 (70%)", "POS — ₦13,000 (—%)" —
       so it's obvious at a glance which methods make up the shift's
       total revenue. The Cash row is highlighted and tagged "In till",
       because it's the ONLY row that feeds "Expected Cash" (opening
       float + cash sales) — POS/Transfer/etc. never touch the
       physical till, so they don't factor into the cash count below. ── */
    function methodBreakdownHtml(methodBreakdown) {
      const rows = methodBreakdown || [];
      if (!rows.length) {
        return { rowsHtml: `<div class="srd-empty-note">No transactions recorded for this shift yet.</div>`, total: 0 };
      }
      const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
      const rowsHtml = rows.map(r => {
        const amount = r.amount || 0;
        const pct = total > 0 ? (amount / total * 100) : 0;
        const color = METHOD_COLOR[r.method] || '#9aa1b3';
        const isCash = r.method === 'Cash';
        return `<div class="srd-method-row${isCash ? ' srd-cash-row' : ''}">
          <div class="srd-method-left">
            <span class="srd-method-dot" style="background:${color}"></span>
            <span class="srd-method-name">${_esc(r.method)}</span>
            ${isCash ? '<span class="srd-method-cash-tag">In till</span>' : ''}
          </div>
          <div class="srd-method-right">
            <span class="srd-method-amount">${_fmtN(amount)}</span>
            <span class="srd-method-pct">${pct.toFixed(1)}%</span>
          </div>
        </div>`;
      }).join('');
      return { rowsHtml, total };
    }

    /* Shared markup for the method breakdown + footnote, used by both
       the view state and the form state so the two never drift apart. */
    function methodTableSection(p) {
      const mb = methodBreakdownHtml(p.methodBreakdown);
      return `
        <div class="srd-method-wrap">
          <div class="srd-method-head-row"><span>Payment Method</span><span>Amount &amp; Share</span></div>
          <div class="srd-method-rows">${mb.rowsHtml}</div>
          <div class="srd-method-foot-row"><span>Total (Gross Sales)</span><span class="srd-method-amount">${_fmtN(mb.total)}</span></div>
          <div class="srd-method-footnote">Only the <b>Cash</b> row lands in the till — it's what, combined with the opening float, makes up the <b>Expected Cash</b> figure below. Other methods settle outside the drawer and don't affect the cash count.</div>
        </div>`;
    }

    function historyHtml(history) {
      const entries = history || [];
      if (!entries.length) return `<div class="srd-empty-note">No reconciliation entries recorded yet.</div>`;
      return entries.map(h => `
        <div class="srd-history-entry">
          <div class="srd-history-top">
            <span class="srd-history-actor">${_esc(h.actor)}</span>
            <span class="srd-tag ${h.type === 'correction' ? 'srd-correction' : 'srd-initial'}">${h.type === 'correction' ? 'Correction' : 'Initial Count'}</span>
          </div>
          <div class="srd-history-meta">
            <span>Actual: <b>${_fmtN(h.actualCash)}</b></span>
            <span>Expected: <b>${_fmtN(h.expected)}</b></span>
            <span>Variance: <b style="color:${Math.abs(h.variance) <= tolerance() ? '#12b76a' : '#f04438'};">${h.variance >= 0 ? '+' : ''}${_fmtN(h.variance)}</b></span>
          </div>
          <div class="srd-history-time">${_esc(h.date)}</div>
          ${h.notes ? `<div class="srd-history-note">"${_esc(h.notes)}"</div>` : ''}
        </div>`).join('');
    }

    /* ── VIEW state — reconciled shift: breakdown, methods, variance, history ── */
    function renderView() {
      const p = currentPayload;
      const variance = p.actualCash - p.expectedCash;
      const health = Math.abs(variance) <= tolerance() ? 'ok' : 'bad';

      overlay.querySelector('.srd-modal').classList.remove('srd-mode-ok', 'srd-mode-bad');
      overlay.querySelector('.srd-modal').classList.add(health === 'ok' ? 'srd-mode-ok' : 'srd-mode-bad');

      overlay.querySelector('.srd-body').innerHTML = `
        <div class="srd-meta">
          Cashier: <b>${_esc(p.staff)}</b> &nbsp;·&nbsp; Opening float <b>${_fmtN(p.openingFloat)}</b> &nbsp;·&nbsp; ${p.txCount} transaction${p.txCount !== 1 ? 's' : ''} this shift
        </div>
        <div class="srd-breakdown">
          <div class="srd-bd-item"><div class="srd-bd-label">Gross Sales (All Methods)</div><div class="srd-bd-val">${_fmtN(p.grossSales)}</div></div>
          <div class="srd-bd-item"><div class="srd-bd-label">Cash Sales</div><div class="srd-bd-val">${_fmtN(p.cashSales)}</div></div>
          <div class="srd-bd-item"><div class="srd-bd-label">Expected Cash</div><div class="srd-bd-val">${_fmtN(p.expectedCash)}</div></div>
          <div class="srd-bd-item"><div class="srd-bd-label">Actual Cash Counted</div><div class="srd-bd-val">${_fmtN(p.actualCash)}</div></div>
        </div>
        ${methodTableSection(p)}
        <div class="srd-variance-box">
          <div class="srd-variance-label">Cash Variance</div>
          <div class="srd-variance-val ${health}">${variance >= 0 ? '+' : ''}${_fmtN(variance)}</div>
        </div>
        <div class="srd-history">
          <div class="srd-history-head">Reconciliation History</div>
          ${historyHtml(p.history)}
        </div>`;

      overlay.querySelector('.srd-title').innerHTML = `<i class="fa-solid fa-receipt"></i> ${_esc(p.dept)} — ${_esc(p.rangeLabel)}`;

      overlay.querySelector('.srd-footer').innerHTML = `
        <button class="srd-btn srd-btn-outline" id="${instId}-closeBtn">Close</button>
        <button class="srd-btn srd-btn-primary" id="${instId}-correctBtn"><i class="fa-solid fa-pen"></i> Correct Entry</button>`;
      overlay.querySelector('#' + instId + '-closeBtn').addEventListener('click', close);
      overlay.querySelector('#' + instId + '-correctBtn').addEventListener('click', () => { inCorrectionMode = true; renderForm(); });
    }

    /* ── FORM state — open shift (initial count) or correcting a reconciled one ── */
    function renderForm() {
      const p = currentPayload;
      const isCorrection = inCorrectionMode;
      const prefillActor = isCorrection ? (p.lastActor || '') : '';
      const prefillCash = isCorrection && p.actualCash != null ? p.actualCash : '';
      const prefillNotes = isCorrection ? (p.notes || '') : '';

      overlay.querySelector('.srd-modal').classList.remove('srd-mode-ok', 'srd-mode-bad');

      overlay.querySelector('.srd-title').innerHTML = `<i class="fa-solid fa-clock"></i> ${isCorrection ? 'Correct Reconciliation' : 'Reconcile Shift'} — ${_esc(p.dept)}`;

      overlay.querySelector('.srd-body').innerHTML = `
        <div class="srd-meta">
          Cashier: <b>${_esc(p.staff)}</b> &nbsp;·&nbsp; Opening float <b>${_fmtN(p.openingFloat)}</b> &nbsp;·&nbsp; ${p.txCount} transaction${p.txCount !== 1 ? 's' : ''} this shift
          ${isCorrection ? ` &nbsp;·&nbsp; <span class="srd-warn">Amending a previous count — this will be logged as a correction.</span>` : ''}
        </div>
        <div class="srd-breakdown">
          <div class="srd-bd-item"><div class="srd-bd-label">Gross Sales (All Methods)</div><div class="srd-bd-val">${_fmtN(p.grossSales)}</div></div>
          <div class="srd-bd-item"><div class="srd-bd-label">Cash Sales</div><div class="srd-bd-val">${_fmtN(p.cashSales)}</div></div>
          <div class="srd-bd-item srd-span2"><div class="srd-bd-label">Expected Cash (Opening Float + Cash Sales)</div><div class="srd-bd-val srd-gold">${_fmtN(p.expectedCash)}</div></div>
        </div>
        ${methodTableSection(p)}
        <div class="srd-error-box" id="${instId}-errBox"><i class="fa-solid fa-triangle-exclamation"></i> <span id="${instId}-errMsg"></span></div>
        <div class="srd-form-group">
          <label class="srd-form-label srd-req">Your Name (performing this count)</label>
          <input class="srd-form-input" type="text" id="${instId}-actor" placeholder="e.g. Amaka Okonkwo (Front Desk Cashier)" value="${_esc(prefillActor)}">
        </div>
        <div class="srd-form-group">
          <label class="srd-form-label srd-req">Actual Cash Counted (₦)</label>
          <input class="srd-form-input" type="number" id="${instId}-actual" placeholder="0" min="0" value="${prefillCash}">
        </div>
        <div class="srd-variance-box">
          <div class="srd-variance-label">Cash Variance (Actual − Expected)</div>
          <div class="srd-variance-val srd-neutral" id="${instId}-varPreview">₦0</div>
        </div>
        <div class="srd-form-group">
          <label class="srd-form-label">Notes <span style="text-transform:none;color:#9aa1b3;">(explain any shortfall, overage, or reason for a correction)</span></label>
          <textarea class="srd-form-textarea" id="${instId}-notes" placeholder="Optional…">${_esc(prefillNotes)}</textarea>
        </div>`;

      overlay.querySelector('.srd-footer').innerHTML = `
        <button class="srd-btn srd-btn-outline" id="${instId}-cancelBtn">${isCorrection ? 'Back' : 'Cancel'}</button>
        <button class="srd-btn srd-btn-primary" id="${instId}-confirmBtn"><i class="fa-solid fa-check"></i> Confirm Reconciliation</button>`;

      const actualInput = overlay.querySelector('#' + instId + '-actual');
      const varPreview = overlay.querySelector('#' + instId + '-varPreview');
      function updateVariancePreview() {
        const actual = parseFloat(actualInput.value) || 0;
        const variance = actual - p.expectedCash;
        varPreview.textContent = (variance >= 0 ? '+' : '') + _fmtN(variance);
        varPreview.className = 'srd-variance-val ' + (Math.abs(variance) <= tolerance() ? 'srd-ok' : 'srd-bad');
      }
      actualInput.addEventListener('input', updateVariancePreview);
      updateVariancePreview();

      overlay.querySelector('#' + instId + '-cancelBtn').addEventListener('click', () => {
        if (isCorrection && p.status === 'reconciled') { inCorrectionMode = false; renderView(); }
        else close();
      });

      overlay.querySelector('#' + instId + '-confirmBtn').addEventListener('click', () => submitReconcile(isCorrection));
    }

    function showError(msg) {
      const box = overlay.querySelector('#' + instId + '-errBox');
      const label = overlay.querySelector('#' + instId + '-errMsg');
      if (!box || !label) return;
      label.textContent = msg;
      box.classList.add('srd-show');
    }
    function hideError() {
      const box = overlay.querySelector('#' + instId + '-errBox');
      if (box) box.classList.remove('srd-show');
    }

    async function submitReconcile(isCorrection) {
      if (submitting) return;
      hideError();
      const p = currentPayload;
      const actorEl = overlay.querySelector('#' + instId + '-actor');
      const actualEl = overlay.querySelector('#' + instId + '-actual');
      const notesEl = overlay.querySelector('#' + instId + '-notes');

      const actor = actorEl.value.trim();
      const actualStr = actualEl.value;
      if (!actor) { showError('Enter your name — every reconciliation is logged.'); return; }
      if (actualStr === '' || parseFloat(actualStr) < 0) { showError('Enter the actual cash counted.'); return; }

      const actualCash = parseFloat(actualStr);
      const notes = notesEl.value.trim();
      const variance = actualCash - p.expectedCash;

      const payload = {
        dept: p.dept, key: p.key, rangeLabel: p.rangeLabel,
        actor, actualCash, notes, variance, expected: p.expectedCash,
        isCorrection: !!isCorrection,
        health: Math.abs(variance) <= tolerance() ? 'ok' : 'bad',
      };

      const cb = currentCallbacks.onReconcile || defaultOptions.onReconcile;
      const confirmBtn = overlay.querySelector('#' + instId + '-confirmBtn');

      if (typeof cb !== 'function') { close(); return; }

      submitting = true;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<i class="fa-solid fa-spinner srd-spin"></i> Saving…`;

      try {
        await cb(payload);
        submitting = false;
        close();
        const onSuccess = currentCallbacks.onSuccess || defaultOptions.onSuccess;
        if (typeof onSuccess === 'function') onSuccess(payload);
      } catch (err) {
        submitting = false;
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> Confirm Reconciliation`;
        showError((err && err.message) || 'Failed to save reconciliation. Please try again.');
      }
    }

    function render() {
      overlay.innerHTML = `
        <div class="srd-modal">
          <div class="srd-header">
            <div class="srd-title"></div>
            <button class="srd-close" id="${instId}-x"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="srd-body"></div>
          <div class="srd-footer"></div>
        </div>`;
      overlay.querySelector('#' + instId + '-x').addEventListener('click', close);

      const p = currentPayload;
      if (p.status === 'open' || inCorrectionMode) renderForm();
      else renderView();
    }

    /**
     * Open the modal for a given shift.
     * @param {object} payload - see file header for shape.
     * @param {object} [callbacks] - { onReconcile(payload), onSuccess(payload) } —
     *   overrides/extends whatever was passed to create().
     */
    function open(payload, callbacks) {
      if (!payload) { console.warn('[ShiftReconciliationDetail] open() called without a payload.'); return; }
      currentPayload = payload;
      currentCallbacks = callbacks || {};
      inCorrectionMode = false;
      submitting = false;
      render();
      overlay.classList.add('srd-show');
    }
    function close() { overlay.classList.remove('srd-show'); }
    function destroy() { overlay.remove(); }

    return { open, close, destroy };
  }

  window.ShiftReconciliationDetail = { create };

})();