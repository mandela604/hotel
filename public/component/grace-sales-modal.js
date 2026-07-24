/**
 * grace-sales-modal.js — Grace Hotel HMS Reusable Sales Detail / Void Modal
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="grace-sales-modal.js"></script> in any page,
 * then attach it once (it lives on document.body, not a container):
 *
 *   const salesModal = GraceHotelSalesModal.attach({
 *     authorizedStaff: [                    // optional — demo credential list
 *       { name:'Amaka O.', role:'Manager', password:'manager123' },
 *     ],
 *     checkAuth: async (name, password) => { ... },  // optional — replace the
 *                                            // demo list with a real backend
 *                                            // call; return {name, role} or null
 *     onVoid: (sale, voidInfo) => {          // REQUIRED to actually do anything —
 *       // sale is the object passed to .open(); voidInfo is
 *       // { reason, authorizedBy, authorizedByRole, voidDate }
 *       // Host page owns restoring stock / persisting to storage here,
 *       // exactly like grace-store-approval.js leaves stock untouched.
 *     },
 *     onClose: () => { ... },                // optional
 *   });
 *
 *   salesModal.open(sale);   // sale shape below
 *   salesModal.close();
 *   salesModal.destroy();
 *
 * ── SALE SHAPE ────────────────────────────────────────────────────────
 *   {
 *     id, items:[{name, qty, price}], subtotal, discount, total,
 *     method, staff, table, notes, date, status: 'completed'|'voided',
 *     voidReason, voidDate, voidedBy, voidedByRole   // only if voided
 *   }
 *
 * ── AUTHORIZATION ──────────────────────────────────────────────────────
 * The component never mutates the sale itself — it only gates the Void
 * action behind a reason + Manager/Admin name+password, then calls
 * onVoid() with what was entered. Pass `checkAuth` to replace the demo
 * credential list with a real (ideally server-side) check.
 *
 * ── LIGHT / DARK ──────────────────────────────────────────────────────
 * Ships dark by default. All colors are var(--ghsd-*) custom properties —
 * override on :root or the modal container to re-theme.
 */

(function () {
  'use strict';

  if (window.__graceSalesModal) return;
  window.__graceSalesModal = true;

  const CSS = `
    :root{
      --ghsd-gold:#c9a84c; --ghsd-gold-light:#e8c96a; --ghsd-gold-dim:rgba(201,168,76,.12); --ghsd-gold-border:rgba(201,168,76,.25);
      --ghsd-green:#4ade80; --ghsd-green-bg:rgba(74,222,128,.12);
      --ghsd-red:#f87171; --ghsd-red-bg:rgba(248,113,113,.12);
      --ghsd-tx:#e8f0f8; --ghsd-tx2:#a8bece; --ghsd-tx3:#6a8a9e;
      --ghsd-border:#1e3045; --ghsd-surface:#111e2b; --ghsd-surface2:#162435; --ghsd-input-bg:#0d1a27;
    }
    .ghsd-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,.7); backdrop-filter:blur(4px); z-index:9500; align-items:flex-start; justify-content:center; padding:24px 16px; overflow-y:auto; font-family:'Outfit','Segoe UI',Arial,Helvetica,sans-serif; }
    .ghsd-overlay.show{ display:flex; }
    .ghsd-modal{ background:var(--ghsd-surface); border:1px solid var(--ghsd-border); border-radius:20px; width:min(560px,96vw); margin:auto; box-shadow:0 40px 100px rgba(0,0,0,.65); animation:ghsdIn .22s cubic-bezier(.4,0,.2,1); overflow:hidden; }
    @keyframes ghsdIn{ from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }
    @media (max-width:480px){ .ghsd-modal{ border-radius:14px; } }

    .ghsd-head{ padding:22px 24px 18px; position:relative; overflow:hidden; }
    .ghsd-head.completed{ background:linear-gradient(135deg, rgba(74,222,128,.14), rgba(74,222,128,.02)); }
    .ghsd-head.voided{ background:linear-gradient(135deg, rgba(248,113,113,.14), rgba(248,113,113,.02)); }
    .ghsd-head.void-form{ background:linear-gradient(135deg, rgba(248,113,113,.14), rgba(248,113,113,.02)); }
    .ghsd-close{ position:absolute; top:16px; right:18px; background:rgba(255,255,255,.06); border:1px solid var(--ghsd-border); color:var(--ghsd-tx2); width:30px; height:30px; border-radius:8px; cursor:pointer; font-size:15px; }
    .ghsd-close:hover{ color:var(--ghsd-tx); border-color:var(--ghsd-gold-border); }
    .ghsd-badge{ display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; padding:4px 11px; border-radius:20px; margin-bottom:10px; }
    .ghsd-badge.completed{ background:var(--ghsd-green-bg); color:var(--ghsd-green); }
    .ghsd-badge.voided, .ghsd-badge.void-form{ background:var(--ghsd-red-bg); color:var(--ghsd-red); }
    .ghsd-id{ font-family:'Cormorant Garamond',serif; font-size:26px; font-weight:700; color:var(--ghsd-tx); }
    .ghsd-total{ font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:700; margin-top:4px; }
    .ghsd-total.completed{ color:var(--ghsd-green); }
    .ghsd-total.voided{ color:var(--ghsd-red); text-decoration:line-through; text-decoration-color:rgba(248,113,113,.5); }

    .ghsd-body{ padding:20px 24px 24px; }
    .ghsd-section-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.3px; color:var(--ghsd-gold); font-weight:700; margin:18px 0 10px; }
    .ghsd-section-label:first-child{ margin-top:0; }
    .ghsd-section-label.danger{ color:var(--ghsd-red); }

    .ghsd-info-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px 18px; background:var(--ghsd-surface2); border:1px solid var(--ghsd-border); border-radius:12px; padding:14px 16px; }
    @media (max-width:420px){ .ghsd-info-grid{ grid-template-columns:1fr; } }
    .ghsd-info-item{ display:flex; flex-direction:column; gap:3px; }
    .ghsd-info-label{ font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--ghsd-tx3); font-weight:600; display:flex; align-items:center; gap:5px; }
    .ghsd-info-value{ font-size:13px; color:var(--ghsd-tx); font-weight:500; }

    .ghsd-receipt{ background:var(--ghsd-surface2); border:1px solid var(--ghsd-border); border-radius:12px; overflow:hidden; }
    .ghsd-receipt-row{ display:flex; align-items:center; gap:10px; padding:11px 16px; border-bottom:1px dashed var(--ghsd-border); }
    .ghsd-receipt-row:last-child{ border-bottom:none; }
    .ghsd-r-qty{ font-size:11.5px; color:var(--ghsd-tx3); background:var(--ghsd-surface); border:1px solid var(--ghsd-border); border-radius:6px; padding:2px 7px; flex-shrink:0; min-width:34px; text-align:center; }
    .ghsd-r-name{ flex:1; font-size:13px; color:var(--ghsd-tx); min-width:0; }
    .ghsd-r-unit{ font-size:10.5px; color:var(--ghsd-tx3); }
    .ghsd-r-total{ font-size:13px; font-weight:600; color:var(--ghsd-gold); flex-shrink:0; }

    .ghsd-totals{ background:var(--ghsd-surface2); border:1px solid var(--ghsd-border); border-radius:12px; padding:14px 16px; margin-top:12px; }
    .ghsd-t-row{ display:flex; justify-content:space-between; font-size:12.5px; color:var(--ghsd-tx2); padding:4px 0; }
    .ghsd-t-row.grand{ font-size:16px; font-weight:700; color:var(--ghsd-tx); margin-top:6px; padding-top:8px; border-top:1px solid var(--ghsd-border); }
    .ghsd-t-row.grand .v{ color:var(--ghsd-gold); font-family:'Cormorant Garamond',serif; font-size:20px; }
    .ghsd-t-row .neg{ color:var(--ghsd-red); }

    .ghsd-void-card{ background:var(--ghsd-red-bg); border:1px solid rgba(248,113,113,.3); border-radius:12px; padding:16px 18px; margin-top:4px; }
    .ghsd-void-head{ display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--ghsd-red); text-transform:uppercase; letter-spacing:.5px; margin-bottom:12px; }
    .ghsd-void-timeline{ display:flex; flex-direction:column; gap:12px; }
    .ghsd-void-step{ display:flex; gap:12px; }
    .ghsd-void-dot{ width:9px; height:9px; border-radius:50%; background:var(--ghsd-red); margin-top:4px; flex-shrink:0; box-shadow:0 0 0 3px rgba(248,113,113,.15); }
    .ghsd-void-step-body{ flex:1; min-width:0; }
    .ghsd-void-step-label{ font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--ghsd-tx3); font-weight:700; margin-bottom:2px; }
    .ghsd-void-step-value{ font-size:12.5px; color:var(--ghsd-tx); font-weight:500; }
    .ghsd-void-reason-box{ background:var(--ghsd-surface); border:1px solid rgba(248,113,113,.25); border-radius:8px; padding:10px 12px; margin-top:4px; font-size:12px; color:var(--ghsd-tx2); line-height:1.5; font-style:italic; }
    .ghsd-void-reason-box b{ color:var(--ghsd-tx); font-style:normal; }

    /* Void form (reason + authorization) */
    .ghsd-form-group{ display:flex; flex-direction:column; gap:5px; margin-bottom:14px; }
    .ghsd-form-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:var(--ghsd-tx3); font-weight:500; }
    .ghsd-form-label.req::after{ content:' *'; color:var(--ghsd-red); }
    .ghsd-textarea, .ghsd-input{ background:var(--ghsd-input-bg); border:1px solid var(--ghsd-border); border-radius:10px; padding:9px 12px; color:var(--ghsd-tx); font-family:inherit; font-size:13px; outline:none; transition:border-color .2s; width:100%; }
    .ghsd-textarea{ resize:vertical; min-height:60px; }
    .ghsd-textarea:focus, .ghsd-input:focus{ border-color:var(--ghsd-gold-border); }
    .ghsd-input.err, .ghsd-textarea.err{ border-color:var(--ghsd-red); }
    .ghsd-field-error{ font-size:11px; color:var(--ghsd-red); margin-top:2px; display:none; }
    .ghsd-field-error.show{ display:block; }
    .ghsd-val-note{ font-size:12px; color:var(--ghsd-tx2); margin-bottom:14px; line-height:1.5; }
    .ghsd-val-note strong{ color:var(--ghsd-tx); }
    .ghsd-auth-divider{ display:flex; align-items:center; gap:10px; margin:16px 0 12px; }
    .ghsd-auth-divider::before, .ghsd-auth-divider::after{ content:''; flex:1; height:1px; background:var(--ghsd-border); }
    .ghsd-auth-divider span{ font-size:10px; text-transform:uppercase; letter-spacing:1.2px; color:var(--ghsd-tx3); font-weight:700; white-space:nowrap; }
    .ghsd-auth-hint{ font-size:11px; color:var(--ghsd-tx3); margin-top:6px; line-height:1.5; display:flex; gap:6px; align-items:flex-start; }

    .ghsd-footer{ display:flex; gap:10px; justify-content:flex-end; padding:16px 24px 22px; border-top:1px solid var(--ghsd-border); flex-wrap:wrap; }
    @media (max-width:420px){ .ghsd-footer{ flex-direction:column-reverse; } .ghsd-footer .ghsd-btn{ width:100%; justify-content:center; } }
    .ghsd-btn{ padding:10px 18px; border-radius:10px; font-size:12.5px; font-weight:600; cursor:pointer; border:1px solid var(--ghsd-border); background:none; color:var(--ghsd-tx2); font-family:inherit; display:inline-flex; align-items:center; gap:6px; }
    .ghsd-btn:hover{ border-color:var(--ghsd-gold); color:var(--ghsd-gold); }
    .ghsd-btn.danger{ background:rgba(248,113,113,.1); border-color:rgba(248,113,113,.3); color:var(--ghsd-red); font-weight:700; }
    .ghsd-btn.danger:hover{ background:rgba(248,113,113,.18); }
    .ghsd-btn:disabled{ opacity:.6; cursor:default; }

    .ghsd-toast{ position:fixed; bottom:20px; right:20px; background:var(--ghsd-surface); border:1px solid var(--ghsd-border); border-radius:10px; padding:11px 16px; font-size:12.5px; color:var(--ghsd-tx); box-shadow:0 8px 28px rgba(0,0,0,.3); z-index:9999; display:flex; align-items:center; gap:8px; animation:ghsdToastIn .3s ease; max-width:calc(100vw - 40px); font-family:inherit; }
    .ghsd-toast.error{ border-left:3px solid var(--ghsd-red); }
    .ghsd-toast.success{ border-left:3px solid var(--ghsd-green); }
    @keyframes ghsdToastIn{ from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'ghsd-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  const DEFAULT_AUTHORIZED_STAFF = [
    { name: 'Amaka O.', role: 'Manager', password: 'manager123' },
    { name: 'Tunde A.', role: 'Admin', password: 'admin123' },
  ];

  function _fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  let _instanceCounter = 0;

  function attach(options) {
    options = options || {};
    _injectStyles();

    const instId = 'ghsd' + (++_instanceCounter);
    const authMode = options.authMode === 'password' ? 'password' : 'name-password';
    const authorizedStaff = options.authorizedStaff || DEFAULT_AUTHORIZED_STAFF;
    const sessionUser = options.currentUser || null;

    // 'name-password' (default): pick/type a Manager/Admin name + their password.
    // 'password': single password box — re-confirms whoever is already signed
    // in (sessionUser), the way a "sudo" prompt re-checks the current user
    // rather than asking them to impersonate someone else.
    const checkAuthFn = typeof options.checkAuth === 'function'
      ? options.checkAuth
      : authMode === 'password'
        ? (password) => (password === (options.password || 'demo123'))
            ? { name: (sessionUser && sessionUser.name) || 'Authorized User', role: (sessionUser && sessionUser.role) || '' }
            : null
        : (name, password) => authorizedStaff.find(a =>
            a.name.toLowerCase() === (name || '').toLowerCase() && a.password === password) || null;

    let currentSale = null;
    let mode = 'detail'; // 'detail' | 'void'

    const overlay = document.createElement('div');
    overlay.className = 'ghsd-overlay';
    overlay.id = instId;
    overlay.innerHTML = `<div class="ghsd-modal" id="${instId}-modal"></div>`;
    document.body.appendChild(overlay);
    const modalEl = overlay.querySelector(`#${instId}-modal`);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    function showToast(msg, type) {
      const t = document.createElement('div');
      t.className = `ghsd-toast ${type === 'error' ? 'error' : 'success'}`;
      t.textContent = (type === 'error' ? '✕ ' : '✓ ') + msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    }

    function renderDetail() {
      const s = currentSale;
      mode = 'detail';

      const discAmt = s.subtotal * (s.discount || 0) / 100;

      modalEl.innerHTML = `
        <div class="ghsd-head ${s.status}">
          <button class="ghsd-close" data-act="close">✕</button>
          <span class="ghsd-badge ${s.status}">${s.status === 'completed' ? '✓ Completed' : '✕ Voided'}</span>
          <div class="ghsd-id">Sale ${_esc(s.id)}</div>
          <div class="ghsd-total ${s.status}">${_fmtN(s.total)}</div>
        </div>
        <div class="ghsd-body">
          <div class="ghsd-section-label">Transaction Info</div>
          <div class="ghsd-info-grid">
            <div class="ghsd-info-item"><div class="ghsd-info-label">👤 Staff</div><div class="ghsd-info-value">${_esc(s.staff||'—')}</div></div>
            <div class="ghsd-info-item"><div class="ghsd-info-label">📍 Location</div><div class="ghsd-info-value">${_esc(s.table||'—')}</div></div>
            <div class="ghsd-info-item"><div class="ghsd-info-label">💳 Payment</div><div class="ghsd-info-value">${_esc(s.method||'—')}</div></div>
            <div class="ghsd-info-item"><div class="ghsd-info-label">🕒 Date &amp; Time</div><div class="ghsd-info-value">${_esc(s.date||'—')}</div></div>
            ${s.notes ? `<div class="ghsd-info-item" style="grid-column:1/-1;"><div class="ghsd-info-label">📝 Notes</div><div class="ghsd-info-value" style="font-style:italic;color:var(--ghsd-tx2);">"${_esc(s.notes)}"</div></div>` : ''}
          </div>

          <div class="ghsd-section-label">Items</div>
          <div class="ghsd-receipt">
            ${s.items.map(i => `
              <div class="ghsd-receipt-row">
                <span class="ghsd-r-qty">×${i.qty}</span>
                <span class="ghsd-r-name">${_esc(i.name)} <span class="ghsd-r-unit">@ ${_fmtN(i.price)}</span></span>
                <span class="ghsd-r-total">${_fmtN(i.price * i.qty)}</span>
              </div>`).join('')}
          </div>

          <div class="ghsd-totals">
            <div class="ghsd-t-row"><span>Subtotal</span><span>${_fmtN(s.subtotal)}</span></div>
            ${s.discount ? `<div class="ghsd-t-row"><span>Discount (${s.discount}%)</span><span class="neg">−${_fmtN(discAmt)}</span></div>` : ''}
            <div class="ghsd-t-row grand"><span>Total</span><span class="v">${_fmtN(s.total)}</span></div>
          </div>

          ${s.status === 'voided' ? `
          <div class="ghsd-section-label danger">Void Audit Trail</div>
          <div class="ghsd-void-card">
            <div class="ghsd-void-head">🚫 This sale was voided</div>
            <div class="ghsd-void-timeline">
              <div class="ghsd-void-step"><div class="ghsd-void-dot"></div><div class="ghsd-void-step-body">
                <div class="ghsd-void-step-label">Original Sale</div>
                <div class="ghsd-void-step-value">${_fmtN(s.total)} · ${_esc(s.date)} · rung up by ${_esc(s.staff||'—')}</div>
              </div></div>
              <div class="ghsd-void-step"><div class="ghsd-void-dot"></div><div class="ghsd-void-step-body">
                <div class="ghsd-void-step-label">Voided On</div>
                <div class="ghsd-void-step-value">${_esc(s.voidDate||'—')}</div>
              </div></div>
              <div class="ghsd-void-step"><div class="ghsd-void-dot"></div><div class="ghsd-void-step-body">
                <div class="ghsd-void-step-label">Authorized By</div>
                <div class="ghsd-void-step-value">${_esc(s.voidedBy||'—')} ${s.voidedByRole?`<span style="color:var(--ghsd-tx3);">(${_esc(s.voidedByRole)})</span>`:''}</div>
              </div></div>
            </div>
            <div class="ghsd-void-reason-box"><b>Reason:</b> "${_esc(s.voidReason||'—')}"</div>
          </div>` : ''}
        </div>
        <div class="ghsd-footer">
          <button class="ghsd-btn" data-act="close">Close</button>
          ${s.status === 'completed' ? `<button class="ghsd-btn danger" data-act="startVoid">✕ Void Sale</button>` : ''}
        </div>`;
    }

    function renderVoidForm() {
      const s = currentSale;
      mode = 'void';

      const authSection = authMode === 'password' ? `
          <div class="ghsd-auth-divider"><span>Confirm It's You</span></div>
          <div class="ghsd-form-group">
            <label class="ghsd-form-label req">Your Password</label>
            <input class="ghsd-input" type="password" id="${instId}-authPass" placeholder="Re-enter your password" autocomplete="off">
            <div class="ghsd-field-error" id="${instId}-authPassErr">Incorrect password.</div>
            <div class="ghsd-auth-hint"><span>🔒</span><span>${_esc(options.authExplanation || 'Voiding removes real revenue and restores stock, so we ask you to re-confirm your password before it goes through — this protects against someone else voiding a sale from your unlocked session, and the action is logged either way.')}</span></div>
          </div>` : `
          <div class="ghsd-auth-divider"><span>Manager / Admin Authorization</span></div>
          <div class="ghsd-form-group">
            <label class="ghsd-form-label req">Authorizing Name</label>
            <input class="ghsd-input" type="text" id="${instId}-authName" list="${instId}-authList" placeholder="Full name of Manager/Admin approving this void" autocomplete="off">
            <datalist id="${instId}-authList">${authorizedStaff.map(a => `<option value="${_esc(a.name)}">`).join('')}</datalist>
            <div class="ghsd-field-error" id="${instId}-authNameErr">Enter the name of the Manager/Admin authorizing this void.</div>
          </div>
          <div class="ghsd-form-group">
            <label class="ghsd-form-label req">Authorization Password</label>
            <input class="ghsd-input" type="password" id="${instId}-authPass" placeholder="Enter authorization password" autocomplete="off">
            <div class="ghsd-field-error" id="${instId}-authPassErr">Incorrect name/password combination.</div>
            <div class="ghsd-auth-hint"><span>🔒</span><span>This action is logged. Only staff with Manager or Admin authorization can void a completed sale.</span></div>
          </div>`;

      modalEl.innerHTML = `
        <div class="ghsd-head void-form">
          <button class="ghsd-close" data-act="close">✕</button>
          <span class="ghsd-badge void-form">✕ Void Sale</span>
          <div class="ghsd-id">${_esc(s.id)}</div>
          <div class="ghsd-total voided">${_fmtN(s.total)}</div>
        </div>
        <div class="ghsd-body">
          <div class="ghsd-val-note">Voiding this sale will remove it from revenue totals and be permanently logged. Your host page decides how stock is restored via <code>onVoid</code>.</div>

          <div class="ghsd-form-group">
            <label class="ghsd-form-label req">Reason for Void</label>
            <textarea class="ghsd-textarea" id="${instId}-reason" placeholder="e.g. Wrong order, customer changed mind, duplicate entry…"></textarea>
            <div class="ghsd-field-error" id="${instId}-reasonErr">Please enter a reason for the void.</div>
          </div>

          ${authSection}
        </div>
        <div class="ghsd-footer">
          <button class="ghsd-btn" data-act="backToDetail">Cancel</button>
          <button class="ghsd-btn danger" data-act="confirmVoid">✕ Confirm Void</button>
        </div>`;
    }

    function setFieldError(fieldId, errId, hasError) {
      const f = modalEl.querySelector('#' + fieldId);
      const e = modalEl.querySelector('#' + errId);
      if (f) f.classList.toggle('err', hasError);
      if (e) e.classList.toggle('show', hasError);
    }

    async function confirmVoid() {
      const s = currentSale;
      const reason = modalEl.querySelector(`#${instId}-reason`).value.trim();
      const authName = modalEl.querySelector(`#${instId}-authName`).value.trim();
      const authPass = modalEl.querySelector(`#${instId}-authPass`).value;

      const reasonMissing = !reason;
      setFieldError(`${instId}-reason`, `${instId}-reasonErr`, reasonMissing);

      const nameMissing = !authName;
      setFieldError(`${instId}-authName`, `${instId}-authNameErr`, nameMissing);

      if (reasonMissing) { showToast('Please enter a reason for the void.', 'error'); return; }
      if (nameMissing || !authPass) { showToast('Enter the authorizing name and password.', 'error'); return; }

      const match = await checkAuthFn(authName, authPass);
      const authFailed = !match;
      setFieldError(`${instId}-authPass`, `${instId}-authPassErr`, authFailed);
      if (authFailed) { showToast('Incorrect authorization credentials. Void cancelled.', 'error'); return; }

      const voidInfo = {
        reason,
        authorizedBy: match.name,
        authorizedByRole: match.role || '',
        voidDate: new Date().toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }).replace(',', ''),
      };

      if (typeof options.onVoid === 'function') {
        try { await options.onVoid(s, voidInfo); }
        catch (e) { showToast('Could not void the sale — please try again.', 'error'); return; }
      }

      showToast(`${s.id} voided by ${match.name}.`, 'success');
      close();
    }

    modalEl.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'close') close();
      else if (a === 'startVoid') renderVoidForm();
      else if (a === 'backToDetail') renderDetail();
      else if (a === 'confirmVoid') confirmVoid();
    });

    function open(sale) {
      currentSale = sale;
      renderDetail();
      overlay.classList.add('show');
    }
    function close() {
      overlay.classList.remove('show');
      if (typeof options.onClose === 'function') options.onClose();
    }
    function destroy() {
      overlay.remove();
    }

    return { open, close, destroy };
  }

  window.GraceHotelSalesModal = { attach };

})();