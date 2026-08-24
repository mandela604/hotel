/**
 * component/production-modal.js — Compact Production detail modal
 * ─────────────────────────────────────────────────────────────────
 * Same shape as component/booking-modal.js:
 *   - Self-contained overlay, injects its own scoped CSS
 *   - Ledger table + accordion pattern for "add another entry"
 *   - Confirm-dialog for irreversible actions (void)
 *
 * Replaces the old long inline yield/void form in
 * kitchen-production-history.html with three compact actions:
 *   - Record Actual Yield   (status: in-progress)
 *   - Send to Restaurant / Poolbar (ledger + accordion, status: completed)
 *   - Void this run          (status: not voided, permission-gated)
 *
 * Depends on: services/kitchen-service.js (passed in as `service`)
 */
(function (global) {
  'use strict';

  if (global.ProductionModal) return;

  var CSS_ID = 'pmx-modal-css';
  var FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif";

  var CSS = `
  .pmx-overlay{
    display:none; position:fixed; inset:0; background:rgba(15,20,40,0.55); backdrop-filter:blur(5px);
    z-index:320; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;
    font-family:${FONT};
    --pmx-bg:#f4f6fb; --pmx-surface:#ffffff; --pmx-surface2:#f4f6fb; --pmx-surface3:#eef0f6;
    --pmx-border:#eef0f6; --pmx-border2:#dfe3ec;
    --pmx-text:#1c2440; --pmx-text2:#5b647a; --pmx-text3:#6b7280;
    --pmx-gold:#2f6fed; --pmx-gold-light:#5b8ff9; --pmx-gold-dim:rgba(47,111,237,0.10); --pmx-gold-border:rgba(47,111,237,0.25);
    --pmx-green:#12b76a; --pmx-green-bg:#e9f9f0;
    --pmx-red:#f04438; --pmx-red-bg:#feecec;
    --pmx-amber:#f79009; --pmx-amber-bg:#fff4e5;
    --pmx-blue:#2f6fed; --pmx-blue-bg:#eaf1ff;
    --pmx-purple:#8b5cf6; --pmx-purple-bg:#f4efff;
  }
  .pmx-overlay.show{ display:flex; }
  .pmx-modal{
    background:var(--pmx-surface); border:1px solid var(--pmx-border); border-radius:16px;
    padding:18px 20px 16px; width:min(720px,98vw); box-shadow:0 30px 80px rgba(15,20,40,0.25); margin:auto;
    position:relative; overflow:hidden;
  }
  .pmx-modal::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--pmx-gold); }
  .pmx-head{ display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; gap:10px; }
  .pmx-title{ font-size:16px; font-weight:800; color:var(--pmx-text); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .pmx-sub{ font-size:11px; color:var(--pmx-text3); margin-top:2px; font-weight:600; }
  .pmx-close{
    background:var(--pmx-surface2); border:1px solid var(--pmx-border); border-radius:8px;
    width:28px; height:28px; color:var(--pmx-text2); font-size:13px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .pmx-close:hover{ color:var(--pmx-text); border-color:var(--pmx-gold-border); }
  .pmx-pill{ font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1px; padding:2px 8px; border-radius:20px; white-space:nowrap; }
  .pmx-pill.completed{ background:var(--pmx-green-bg); color:var(--pmx-green); }
  .pmx-pill.voided{ background:var(--pmx-red-bg); color:var(--pmx-red); }
  .pmx-pill.in-progress{ background:var(--pmx-amber-bg); color:var(--pmx-amber); }

  .pmx-notice{
    display:none; align-items:center; gap:7px; font-size:11px; font-weight:600;
    color:var(--pmx-red); background:var(--pmx-red-bg); border:1px solid rgba(240,68,56,.25);
    border-radius:8px; padding:7px 11px; margin-bottom:10px;
  }
  .pmx-notice.show{ display:flex; }

  .pmx-detail-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:12px; }
  @media (max-width:560px){ .pmx-detail-grid{ grid-template-columns:repeat(2,1fr); } }
  .pmx-detail-item{ display:flex; flex-direction:column; gap:2px; }
  .pmx-detail-label{ font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--pmx-text3); font-weight:700; }
  .pmx-detail-value{ font-size:12.5px; font-weight:700; color:var(--pmx-text); }

  .pmx-cols{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
  @media (max-width:560px){ .pmx-cols{ grid-template-columns:1fr; } }
  .pmx-col{ background:var(--pmx-surface2); border:1px solid var(--pmx-border); border-radius:10px; padding:10px 12px; }
  .pmx-col-title{
    font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:var(--pmx-gold); font-weight:800;
    margin-bottom:7px; padding-bottom:5px; border-bottom:1px solid var(--pmx-gold-border);
    display:flex; align-items:center; gap:6px;
  }
  .pmx-line{ display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--pmx-border2); font-size:12px; }
  .pmx-line:last-child{ border-bottom:none; }
  .pmx-line span:last-child{ font-weight:700; color:var(--pmx-text); }
  .pmx-empty-note{ font-size:11.5px; color:var(--pmx-text3); font-weight:600; padding:4px 0; }

  .pmx-remarks{ font-size:12px; color:var(--pmx-text2); background:var(--pmx-surface2); border:1px solid var(--pmx-border); border-radius:10px; padding:9px 12px; margin-bottom:12px; }

  .pmx-section{ border:1px solid var(--pmx-border2); border-radius:10px; overflow:hidden; margin-bottom:10px; background:var(--pmx-surface); }
  .pmx-section[hidden]{ display:none !important; }
  .pmx-section-head{
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    padding:10px 12px; cursor:pointer; user-select:none; background:var(--pmx-surface2);
    border-bottom:1px solid transparent;
  }
  .pmx-section.open .pmx-section-head{ border-bottom-color:var(--pmx-border2); }
  .pmx-section-head-txt{ font-size:11.5px; font-weight:800; color:var(--pmx-text); display:flex; align-items:center; gap:7px; }
  .pmx-section-head-txt.danger{ color:var(--pmx-red); }
  .pmx-section-head i.chev{ font-size:11px; color:var(--pmx-text3); transition:transform .2s; }
  .pmx-section.open .pmx-section-head i.chev{ transform:rotate(180deg); }
  .pmx-section-body{ display:none; padding:12px; }
  .pmx-section.open .pmx-section-body{ display:block; }

  .pmx-ledger-wrap{ overflow-x:auto; max-height:150px; overflow-y:auto; margin-bottom:8px; }
  .pmx-ledger{ width:100%; border-collapse:collapse; min-width:380px; }
  .pmx-ledger th{
    text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--pmx-text3);
    font-weight:700; padding:5px 8px; background:var(--pmx-surface3); border-bottom:1px solid var(--pmx-border);
    white-space:nowrap;
  }
  .pmx-ledger td{
    padding:6px 8px; border-bottom:1px solid var(--pmx-border); font-size:11.5px; color:var(--pmx-text);
    vertical-align:middle; font-weight:600;
  }
  .pmx-ledger tr:last-child td{ border-bottom:none; }
  .pmx-ledger-empty{ font-size:11.5px; color:var(--pmx-text3); font-weight:600; padding:8px 2px; }

  .pmx-fg{ display:flex; flex-direction:column; gap:4px; }
  .pmx-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--pmx-text3); font-weight:700; }
  .pmx-input,.pmx-select{
    background:var(--pmx-surface); border:1px solid var(--pmx-border2); border-radius:8px;
    padding:7px 10px; color:var(--pmx-text); font-family:inherit; font-size:12.5px; outline:none; width:100%;
  }
  .pmx-input:focus,.pmx-select:focus{ border-color:var(--pmx-gold-border); }
  .pmx-input[readonly]{ background:var(--pmx-surface3); color:var(--pmx-text2); }
  .pmx-hint{ font-size:10.5px; color:var(--pmx-text3); margin-top:2px; font-weight:600; }

  .pmx-grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
  .pmx-grid-3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:8px; }
  @media (max-width:560px){ .pmx-grid-3{ grid-template-columns:1fr 1fr; } }

  .pmx-btn{
    display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:9px;
    font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; border:1px solid transparent;
  }
  .pmx-btn-primary{ background:var(--pmx-gold); color:#fff; border-color:var(--pmx-gold); }
  .pmx-btn-primary:hover{ background:var(--pmx-gold-light); }
  .pmx-btn-primary:disabled{ opacity:.5; cursor:not-allowed; }
  .pmx-btn-outline{ background:var(--pmx-surface); border-color:var(--pmx-border); color:var(--pmx-text); }
  .pmx-btn-outline:hover{ border-color:var(--pmx-gold-border); color:var(--pmx-gold); }
  .pmx-btn-danger{ background:var(--pmx-red-bg); border-color:rgba(240,68,56,.3); color:var(--pmx-red); }
  .pmx-btn-danger:hover{ background:#fddede; }
  .pmx-btn-sm{ padding:6px 11px; font-size:11.5px; }

  .pmx-foot{ display:flex; gap:8px; justify-content:flex-end; padding-top:12px; border-top:1px solid var(--pmx-border); flex-wrap:wrap; }

  .pmx-confirm-ov{
    display:none; position:absolute; inset:0; background:rgba(15,20,40,0.45);
    align-items:center; justify-content:center; z-index:20; border-radius:16px; padding:16px;
  }
  .pmx-confirm-ov.show{ display:flex; }
  .pmx-confirm-box{
    background:#fff; border:1px solid var(--pmx-border); border-radius:12px; padding:18px 16px;
    width:min(340px,100%); box-shadow:0 16px 40px rgba(15,20,40,0.2);
  }
  .pmx-confirm-box h4{ font-size:15px; font-weight:800; color:var(--pmx-text); margin:0 0 6px; }
  .pmx-confirm-box p{ font-size:12.5px; color:var(--pmx-text2); margin:0 0 14px; line-height:1.5; font-weight:600; }
  .pmx-confirm-acts{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }

  .pmx-toast{
    position:fixed; bottom:20px; right:20px; background:#fff; border:1px solid #eef0f6; border-radius:10px;
    padding:11px 16px; font-size:12.5px; color:#1c2440; box-shadow:0 8px 28px rgba(15,34,55,0.18);
    z-index:999; display:flex; align-items:center; gap:8px; font-family:${FONT}; max-width:calc(100vw - 40px);
  }
  .pmx-toast.success{ border-left:3px solid #12b76a; }
  .pmx-toast.error{ border-left:3px solid #f04438; }
  .pmx-toast.info{ border-left:3px solid #2f6fed; }
  `;

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function fmtQty(n) { return (Math.round((Number(n) || 0) * 100) / 100).toString(); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var STATUS_LBL = { 'in-progress': 'Awaiting Yield', completed: 'Completed', voided: 'Voided' };
  var TYPE_LBL = { rts: 'Ready-to-Serve', coo: 'Cook-on-Order' };
  var DESTINATIONS = ['Main Restaurant / POS', 'Poolbar'];

  function create(opts) {
    opts = opts || {};
    injectCss();

    var service = opts.service || global.KitchenService || null;
    var onSaved = typeof opts.onSaved === 'function' ? opts.onSaved : function () {};
    var session = opts.session || null;

    var current = null; // the production record
    var sendingTransfer = false;

    var root = document.createElement('div');
    root.className = 'pmx-overlay';
    root.innerHTML =
      '<div class="pmx-modal" role="dialog" aria-modal="true">' +
        '<div class="pmx-confirm-ov" data-role="confirmOv">' +
          '<div class="pmx-confirm-box">' +
            '<h4 data-role="confirmTitle">Are you sure?</h4>' +
            '<p data-role="confirmMsg">This action cannot be reversed.</p>' +
            '<div class="pmx-confirm-acts">' +
              '<button type="button" class="pmx-btn pmx-btn-outline" data-act="confirmNo">Cancel</button>' +
              '<button type="button" class="pmx-btn pmx-btn-danger" data-act="confirmYes">Yes, continue</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="pmx-head">' +
          '<div>' +
            '<div class="pmx-title" data-role="title">Production</div>' +
            '<div class="pmx-sub" data-role="sub">—</div>' +
          '</div>' +
          '<button type="button" class="pmx-close" data-act="close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +

        '<div class="pmx-notice" data-role="voidNotice"><i class="fa-solid fa-ban"></i> <span data-role="voidNoticeText"></span></div>' +

        '<div class="pmx-detail-grid">' +
          '<div class="pmx-detail-item"><div class="pmx-detail-label">Production No.</div><div class="pmx-detail-value" data-role="dNo">—</div></div>' +
          '<div class="pmx-detail-item"><div class="pmx-detail-label">Batch No.</div><div class="pmx-detail-value" data-role="dBatch">—</div></div>' +
          '<div class="pmx-detail-item"><div class="pmx-detail-label">Type</div><div class="pmx-detail-value" data-role="dType">—</div></div>' +
          '<div class="pmx-detail-item"><div class="pmx-detail-label">Prepared By</div><div class="pmx-detail-value" data-role="dBy">—</div></div>' +
          '<div class="pmx-detail-item"><div class="pmx-detail-label">Time</div><div class="pmx-detail-value" data-role="dTime">—</div></div>' +
          '<div class="pmx-detail-item"><div class="pmx-detail-label">Expected Yield</div><div class="pmx-detail-value" data-role="dExpected">—</div></div>' +
        '</div>' +

        '<div class="pmx-cols">' +
          '<div class="pmx-col">' +
            '<div class="pmx-col-title"><i class="fa-solid fa-utensils"></i> Meals Output</div>' +
            '<div data-role="mealsList"></div>' +
          '</div>' +
          '<div class="pmx-col">' +
            '<div class="pmx-col-title"><i class="fa-solid fa-carrot"></i> Ingredients Deducted</div>' +
            '<div data-role="ingList"></div>' +
          '</div>' +
        '</div>' +

        '<div class="pmx-remarks" data-role="remarksWrap" hidden>' +
          '<div class="pmx-detail-label" style="margin-bottom:3px;">Remarks</div>' +
          '<div data-role="remarksText">—</div>' +
        '</div>' +

        '<div class="pmx-section" data-role="yieldSection" hidden>' +
          '<div class="pmx-section-head" data-act="toggleYield">' +
            '<span class="pmx-section-head-txt"><i class="fa-solid fa-clipboard-check" style="color:var(--pmx-gold)"></i> Record Actual Yield</span>' +
            '<i class="fa-solid fa-chevron-down chev"></i>' +
          '</div>' +
          '<div class="pmx-section-body">' +
            '<div class="pmx-hint" data-role="yieldSub" style="margin-bottom:8px;"></div>' +
            '<div class="pmx-grid-2">' +
              '<div class="pmx-fg"><label class="pmx-label">Actual quantity produced</label><input class="pmx-input" data-role="yieldQty" type="number" min="0.1" step="0.1" placeholder="e.g. 27"></div>' +
              '<div class="pmx-fg"><label class="pmx-label">Unit</label><input class="pmx-input" data-role="yieldUnit" type="text" placeholder="plates"></div>' +
            '</div>' +
            '<button type="button" class="pmx-btn pmx-btn-primary" data-act="saveYield"><i class="fa-solid fa-check"></i> Save Yield</button>' +
          '</div>' +
        '</div>' +

        '<div class="pmx-section" data-role="transferSection" hidden>' +
          '<div class="pmx-section-head" data-act="toggleTransfer">' +
            '<span class="pmx-section-head-txt"><i class="fa-solid fa-truck-ramp-box" style="color:var(--pmx-gold)"></i> Send to Restaurant / Poolbar</span>' +
            '<i class="fa-solid fa-chevron-down chev"></i>' +
          '</div>' +
          '<div class="pmx-section-body">' +
            '<div class="pmx-ledger-wrap">' +
              '<table class="pmx-ledger">' +
                '<thead><tr><th>Transfer No.</th><th>Meal</th><th>Qty</th><th>To</th><th>Status</th></tr></thead>' +
                '<tbody data-role="transferBody"></tbody>' +
              '</table>' +
            '</div>' +
            '<div class="pmx-hint" data-role="transferHint" style="margin-bottom:8px;"></div>' +
            '<div class="pmx-fg" style="margin-bottom:8px;">' +
              '<label class="pmx-label">Destination</label>' +
              '<select class="pmx-select" data-role="tDest">' +
                '<option>Main Restaurant / POS</option><option>Poolbar</option>' +
              '</select>' +
            '</div>' +
            '<div class="pmx-grid-3">' +
              '<div class="pmx-fg"><label class="pmx-label">Meal</label><input class="pmx-input" data-role="tMeal" type="text"></div>' +
              '<div class="pmx-fg"><label class="pmx-label">Quantity</label><input class="pmx-input" data-role="tQty" type="number" min="1" step="1"></div>' +
              '<div class="pmx-fg"><label class="pmx-label">Unit</label>' +
                '<select class="pmx-select" data-role="tUnit"><option>Plates</option><option>Portions</option><option>Pieces</option><option>Packs</option></select></div>' +
            '</div>' +
            '<div class="pmx-grid-2">' +
              '<div class="pmx-fg"><label class="pmx-label">Sent by</label><input class="pmx-input" data-role="tSentBy" type="text" readonly></div>' +
              '<div class="pmx-fg"><label class="pmx-label">Remarks</label><input class="pmx-input" data-role="tRemarks" type="text" placeholder="Optional"></div>' +
            '</div>' +
            '<button type="button" class="pmx-btn pmx-btn-primary" data-act="sendTransfer"><i class="fa-solid fa-paper-plane"></i> Send Transfer</button>' +
          '</div>' +
        '</div>' +

        '<div class="pmx-section" data-role="voidSection" hidden>' +
          '<div class="pmx-section-head" data-act="toggleVoid">' +
            '<span class="pmx-section-head-txt danger"><i class="fa-solid fa-ban"></i> Void This Run</span>' +
            '<i class="fa-solid fa-chevron-down chev"></i>' +
          '</div>' +
          '<div class="pmx-section-body">' +
            '<div class="pmx-hint" style="margin-bottom:8px;">Voiding restores all deducted ingredients back into Kitchen Stock. This cannot be undone.</div>' +
            '<div class="pmx-fg" style="margin-bottom:8px;"><label class="pmx-label">Reason for voiding</label><input class="pmx-input" data-role="voidReason" type="text" placeholder="e.g. Over-salted batch, had to discard"></div>' +
            '<button type="button" class="pmx-btn pmx-btn-danger" data-act="requestVoid"><i class="fa-solid fa-ban"></i> Void Run</button>' +
          '</div>' +
        '</div>' +

        '<div class="pmx-foot">' +
          '<a href="javascript:void(0)" class="pmx-btn pmx-btn-outline" data-role="jumpTransfer" hidden><i class="fa-solid fa-arrow-up-right-from-square"></i> View in Transfers</a>' +
          '<button type="button" class="pmx-btn pmx-btn-outline" data-act="close">Close</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    function $(sel) { return root.querySelector(sel); }
    function setText(role, v) { var el = $('[data-role="' + role + '"]'); if (el) el.textContent = v == null ? '—' : v; }
    function setVal(role, v) { var el = $('[data-role="' + role + '"]'); if (el) el.value = v == null ? '' : v; }
    function val(role) { var el = $('[data-role="' + role + '"]'); return el ? el.value : ''; }

    function toast(msg, type) {
      type = type || 'success';
      var t = document.createElement('div');
      t.className = 'pmx-toast ' + type;
      var icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
      t.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + msg;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 3400);
    }

    function showConfirm(title, msg) {
      return new Promise(function (resolve) {
        var ov = $('[data-role="confirmOv"]');
        $('[data-role="confirmTitle"]').textContent = title || 'Are you sure?';
        $('[data-role="confirmMsg"]').textContent = msg || 'This action cannot be reversed.';
        if (ov) ov.classList.add('show');
        root._confirmResolve = resolve;
      });
    }
    function hideConfirm(answer) {
      var ov = $('[data-role="confirmOv"]');
      if (ov) ov.classList.remove('show');
      var r = root._confirmResolve;
      root._confirmResolve = null;
      if (r) r(!!answer);
    }

    function toggleSection(role) {
      var sec = $('[data-role="' + role + '"]');
      if (sec && !sec.hidden) sec.classList.toggle('open');
    }
    function openSection(role) {
      var sec = $('[data-role="' + role + '"]');
      if (sec && !sec.hidden) sec.classList.add('open');
    }

    function getStaffName() {
      return (session && session.name) || 'Head Chef';
    }
    function isManager() {
      return service && service.isManagerLike ? service.isManagerLike(session) : false;
    }

    function renderMeals(p) {
      var meals = p.meals && p.meals.length ? p.meals : (p.dish ? [{ name: p.dish, qty: p.outputQty, unit: p.outputUnit }] : []);
      var el = $('[data-role="mealsList"]');
      if (!meals.length) { el.innerHTML = '<div class="pmx-empty-note">No meals recorded yet — awaiting yield.</div>'; return; }
      el.innerHTML = meals.map(function (m) {
        return '<div class="pmx-line"><span>' + esc(m.name) + '</span><span>' + fmtQty(m.qty) + ' ' + esc(m.unit || '') + '</span></div>';
      }).join('');
    }

    function renderIngredients(p) {
      var ded = p.ingredients || [];
      var el = $('[data-role="ingList"]');
      if (!ded.length) { el.innerHTML = '<div class="pmx-empty-note">No ingredient deduction recorded.</div>'; return; }
      el.innerHTML = ded.map(function (d) {
        return '<div class="pmx-line"><span>' + esc(d.name) + '</span><span style="color:var(--pmx-red);">−' + fmtQty(d.qty) + ' ' + esc(d.unit || '') + '</span></div>';
      }).join('');
    }

    /* ── Yield ── */
    function renderYieldSection(p) {
      var sec = $('[data-role="yieldSection"]');
      if (p.status !== 'in-progress') { sec.hidden = true; return; }
      sec.hidden = false;
      $('[data-role="yieldSub"]').textContent =
        'How much ' + (p.dish || '') + ' actually came out of this batch?' +
        (p.expectedYield ? ' Expected ≈ ' + p.expectedYield + ' ' + (p.expectedYieldUnit || '') + '.' : '');
      setVal('yieldQty', '');
      setVal('yieldUnit', p.expectedYieldUnit || 'plates');
      openSection('yieldSection');
    }

    async function saveYield() {
      if (!current) return;
      var qty = parseFloat(val('yieldQty')) || 0;
      var unit = val('yieldUnit').trim();
      var btn = $('[data-act="saveYield"]');
      if (btn) btn.disabled = true;
      try {
        var pNo = current.id || current.no;
        var row = await service.completeProduction(pNo, { outputQty: qty, outputUnit: unit });
        current = row;
        toast('Actual yield recorded.', 'success');
        onSaved(row);
        renderAll();
      } catch (err) {
        toast((err && err.message) || 'Failed to save yield.', 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    /* ── Transfers ── */
    function transfersForCurrent() {
      if (!current || !service) return [];
      var pNo = current.id || current.no;
      return (service.state.transfers || []).filter(function (t) { return t.productionNo === pNo; });
    }
    function transferredQty(list) {
      return list.reduce(function (s, t) {
        if (t.status === 'cancelled' || t.status === 'rejected') return s;
        return s + (Number(t.quantity) || 0);
      }, 0);
    }

    function renderTransferSection(p) {
      var sec = $('[data-role="transferSection"]');
      if (p.status !== 'completed') { sec.hidden = true; return; }
      sec.hidden = false;

      var list = transfersForCurrent();
      var body = $('[data-role="transferBody"]');
      body.innerHTML = list.length ? list.map(function (t) {
        return '<tr>' +
          '<td>' + esc(t.transferNo) + '</td>' +
          '<td>' + esc(t.meal) + '</td>' +
          '<td>' + fmtQty(t.quantity) + ' ' + esc(t.unit || '') + '</td>' +
          '<td>' + esc(t.restaurant || '—') + '</td>' +
          '<td>' + esc((t.status || '').toUpperCase()) + '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="5" class="pmx-ledger-empty">No transfers sent yet for this production.</td></tr>';

      var sent = transferredQty(list);
      var remaining = Math.max(0, (Number(p.outputQty) || 0) - sent);
      $('[data-role="transferHint"]').textContent =
        sent > 0
          ? fmtQty(sent) + ' of ' + fmtQty(p.outputQty) + ' ' + (p.outputUnit || '') + ' transferred so far · ' + fmtQty(remaining) + ' remaining'
          : fmtQty(p.outputQty) + ' ' + (p.outputUnit || '') + ' available to send';

      setVal('tMeal', p.dish || '');
      setVal('tQty', remaining > 0 ? remaining : (p.outputQty || ''));
      setVal('tUnit', (p.outputUnit && ['Plates', 'Portions', 'Pieces', 'Packs'].indexOf(p.outputUnit) !== -1) ? p.outputUnit : 'Plates');
      setVal('tSentBy', getStaffName());
      setVal('tRemarks', '');
      setVal('tDest', DESTINATIONS[0]);
    }

    async function sendTransfer() {
      if (!current || sendingTransfer) return;
      var meal = val('tMeal').trim();
      var qty = parseFloat(val('tQty')) || 0;
      var unit = val('tUnit');
      var dest = val('tDest');
      var remarks = val('tRemarks').trim();
      if (!meal) { toast('Enter the meal name.', 'error'); return; }
      if (qty <= 0) { toast('Enter a valid quantity.', 'error'); return; }

      sendingTransfer = true;
      var btn = $('[data-act="sendTransfer"]');
      if (btn) btn.disabled = true;
      try {
        var pNo = current.id || current.no;
        var entry = await service.addTransfer({
          meal: meal,
          quantity: qty,
          unit: unit,
          sentBy: getStaffName(),
          remarks: remarks,
          productionNo: pNo,
          restaurant: dest,
        });
        toast(entry.transferNo + ' sent to ' + dest + '.', 'success');
        onSaved(current);
        renderTransferSection(current);
      } catch (err) {
        toast((err && err.message) || 'Failed to send transfer.', 'error');
      } finally {
        sendingTransfer = false;
        if (btn) btn.disabled = false;
      }
    }

    /* ── Void ── */
    function renderVoidSection(p) {
      var sec = $('[data-role="voidSection"]');
      var notice = $('[data-role="voidNotice"]');
      var canVoid = service && service.canVoidProduction ? service.canVoidProduction(session) : true;
      if (p.status === 'voided') {
        sec.hidden = true;
        notice.classList.add('show');
        setText('voidNoticeText', 'Voided' + (p.voidReason ? ' — ' + p.voidReason : '') + (p.voidedBy ? ' by ' + p.voidedBy : ''));
      } else {
        notice.classList.remove('show');
        sec.hidden = !canVoid;
        setVal('voidReason', '');
      }
    }

    async function requestVoid() {
      if (!current) return;
      var reason = val('voidReason').trim();
      var ok = await showConfirm(
        'Void this production run?',
        'This restores all deducted ingredients back into Kitchen Stock and cannot be undone.'
      );
      if (!ok) return;
      try {
        var pNo = current.id || current.no;
        var row = await service.voidProduction(pNo, reason, getStaffName());
        current = row;
        toast('Production run voided — ingredients restored.', 'info');
        onSaved(row);
        renderAll();
      } catch (err) {
        toast((err && err.message) || 'Failed to void run.', 'error');
      }
    }

    /* ── Header / detail ── */
    function renderHeader(p) {
      var pNo = p.id || p.no;
      var pType = p.type || 'coo';
      $('[data-role="title"]').innerHTML =
        'Production ' + esc(pNo) + ' <span class="pmx-pill ' + p.status + '">' + esc(STATUS_LBL[p.status] || p.status) + '</span>';
      $('[data-role="sub"]').textContent = (p.dish || '') + ' · ' + (p.date || '');

      setText('dNo', pNo);
      setText('dBatch', p.batchNo || '—');
      setText('dType', TYPE_LBL[pType] || pType);
      setText('dBy', p.staff || p.by || 'Head Chef');
      setText('dTime', p.time || (p.date ? p.date.split(' ').slice(1).join(' ') : '—'));
      setText('dExpected', p.expectedYield ? (fmtQty(p.expectedYield) + ' ' + (p.expectedYieldUnit || '')) : '—');

      var rm = $('[data-role="remarksWrap"]');
      var rmTxt = $('[data-role="remarksText"]');
      if (p.remarks || p.notes) { rm.hidden = false; rmTxt.textContent = p.remarks || p.notes; }
      else { rm.hidden = true; }

      var jump = $('[data-role="jumpTransfer"]');
      if (jump) {
        jump.hidden = false;
        jump.onclick = function () { window.location.href = 'kitchen-transfers.html?productionNo=' + encodeURIComponent(pNo); };
      }
    }

    function renderAll() {
      if (!current) return;
      renderHeader(current);
      renderMeals(current);
      renderIngredients(current);
      renderYieldSection(current);
      renderTransferSection(current);
      renderVoidSection(current);
    }

    function openView(production) {
      if (!production) return;
      current = production;
      // collapse all sections before render (openSection re-opens yield if in-progress)
      root.querySelectorAll('.pmx-section').forEach(function (s) { s.classList.remove('open'); });
      renderAll();
      root.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      root.classList.remove('show');
      document.body.style.overflow = '';
      hideConfirm(false);
      current = null;
    }

    root.addEventListener('click', function (e) {
      if (e.target === root) { close(); return; }
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');
      if (a === 'close') { close(); return; }
      if (a === 'toggleYield') { toggleSection('yieldSection'); return; }
      if (a === 'toggleTransfer') { toggleSection('transferSection'); return; }
      if (a === 'toggleVoid') { toggleSection('voidSection'); return; }
      if (a === 'saveYield') { saveYield(); return; }
      if (a === 'sendTransfer') { sendTransfer(); return; }
      if (a === 'requestVoid') { requestVoid(); return; }
      if (a === 'confirmYes') { hideConfirm(true); return; }
      if (a === 'confirmNo') { hideConfirm(false); return; }
    });

    return {
      openView: openView,
      close: close,
      setSession: function (s) { session = s; },
      destroy: function () {
        close();
        if (root.parentNode) root.parentNode.removeChild(root);
      },
    };
  }

  global.ProductionModal = { create: create };
})(window);