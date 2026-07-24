/**
 * void-sale.js — Reusable "Void Sale" confirmation modal
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script> tag, call create() once per page, get back
 * { open, close, destroy }. Fully self-contained CSS (vs- prefixed).
 * Follows the Aurum dark/light theme automatically
 * (localStorage('aurum-theme') + 'aurum:themechange').
 *
 * This component collects a REASON and shows WHO is voiding the sale —
 * it does NOT mutate any data itself. Each host page owns its own
 * sales array / storage key, so the actual void logic (mark
 * status='voided', deduct from totals, write back to storage) happens
 * in onConfirm.
 *
 * ── WHO IS VOIDING? (session-aware, demo-safe) ──────────────────────
 * There is no manual name/password entry anymore — the assumption is
 * that only an already-authenticated staff member can reach this
 * screen at all, so re-typing credentials here is redundant. Instead,
 * the modal shows whoever the session says is logged in:
 *
 *   - options.currentUser: a plain object used immediately, no async
 *     round-trip — { name, role }. This is what you set today, e.g. a
 *     hardcoded demo user, so the UI is fully functional before a real
 *     auth system exists.
 *   - options.getCurrentUser: an optional function (sync or returning
 *     a Promise) called fresh every time open() runs. When you wire up
 *     real sessions later, point this at your session/auth lookup and
 *     currentUser becomes unnecessary — nothing else about the
 *     component changes.
 *
 * If neither is provided, a built-in demo user is used so the modal
 * still renders sensibly out of the box.
 *
 * ── USAGE ──────────────────────────────────────────────────────────────
 *   <script src="component/void-sale.js"></script>
 *   <script>
 *     const voidSale = VoidSale.create({
 *       // Today: hardcoded demo user (no login system yet)
 *       currentUser: { name: 'Adaeze Nwankwo', role: 'Duty Manager' },
 *
 *       // Later: swap to a real session lookup — everything else
 *       // about the modal (validation, layout, onConfirm) stays the same.
 *       // getCurrentUser: async () => {
 *       //   const res = await fetch('/api/session/me');
 *       //   const me = await res.json();
 *       //   return { name: me.name, role: me.role };
 *       // },
 *
 *       onConfirm: (sale, reason, voidedBy) => {
 *         sale.status = 'voided';
 *         sale.voidReason = reason;
 *         sale.voidedBy = voidedBy; // "Adaeze Nwankwo (Duty Manager)"
 *         saveShared('poolbar-sales', sales); // whatever the host page uses
 *         renderTable();
 *       },
 *       requireReason: true,   // default true — set false to make the reason optional
 *     });
 *
 *     voidSale.open(sale); // sale = the same shape used by sales-detail.js
 *   </script>
 *
 * Typically wired as the onVoid callback of a SalesDetail instance:
 *   const salesDetail = SalesDetail.create({ onVoid: (sale) => voidSale.open(sale) });
 */

(function () {
  'use strict';

  const CSS = `
    .vs-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); z-index:410; align-items:flex-start; justify-content:center; padding:20px 16px; overflow-y:auto; font-family:'Outfit',sans-serif; }
    .vs-overlay.vs-show{ display:flex; }
    .vs-modal{ background:var(--vs-modal-bg); border:1px solid var(--vs-border); border-radius:18px; padding:24px; width:min(420px,96vw); box-shadow:0 32px 80px rgba(0,0,0,0.6); margin:auto; position:relative; overflow:hidden; animation:vs-in .22s cubic-bezier(.4,0,.2,1); color:var(--vs-text); }
    .vs-modal::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--vs-red); }
    @keyframes vs-in{ from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    .vs-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; gap:10px; }
    .vs-title{ font-family:'Cormorant Garamond',serif; font-size:19px; font-weight:700; color:var(--vs-red); display:flex; align-items:center; gap:8px; }
    .vs-close{ background:none; border:none; color:var(--vs-text3); font-size:18px; cursor:pointer; padding:4px; line-height:1; }
    .vs-close:hover{ color:var(--vs-text); }
    .vs-warn-box{ background:var(--vs-red-bg); border:1px solid rgba(248,113,113,.25); border-radius:10px; padding:12px 14px; font-size:12px; color:var(--vs-text2); line-height:1.5; margin-bottom:16px; }
    .vs-warn-box b{ color:var(--vs-text); }
    .vs-meta-row{ display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--vs-border); font-size:12.5px; }
    .vs-meta-row:last-of-type{ border-bottom:none; margin-bottom:14px; }
    .vs-meta-row .vs-l{ color:var(--vs-text3); } .vs-meta-row .vs-v{ color:var(--vs-text); font-weight:600; }

    .vs-auth-card{ display:flex; align-items:center; gap:10px; background:var(--vs-surface2); border:1px solid var(--vs-border); border-radius:10px; padding:10px 12px; margin-bottom:14px; }
    .vs-auth-avatar{ width:32px; height:32px; border-radius:50%; background:var(--vs-red-bg); color:var(--vs-red); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; }
    .vs-auth-info{ min-width:0; flex:1; }
    .vs-auth-name{ font-size:13px; font-weight:600; color:var(--vs-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .vs-auth-role{ font-size:10.5px; color:var(--vs-text3); }
    .vs-auth-tag{ font-size:8.5px; text-transform:uppercase; letter-spacing:1px; font-weight:700; color:var(--vs-text3); background:var(--vs-modal-bg); border:1px solid var(--vs-border2); border-radius:20px; padding:2px 8px; flex-shrink:0; }

    .vs-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:var(--vs-text3); font-weight:500; display:block; margin-bottom:6px; }
    .vs-textarea{ width:100%; background:var(--vs-surface2); border:1px solid var(--vs-border); border-radius:10px; padding:10px 12px; color:var(--vs-text); font-family:'Outfit',sans-serif; font-size:13px; outline:none; resize:vertical; min-height:70px; }
    .vs-textarea:focus{ border-color:rgba(248,113,113,.5); }
    .vs-err{ font-size:11px; color:var(--vs-red); margin-top:6px; display:none; }
    .vs-err.vs-show-err{ display:block; }
    .vs-footer{ display:flex; gap:8px; justify-content:flex-end; margin-top:18px; padding-top:14px; border-top:1px solid var(--vs-border); flex-wrap:wrap; }
    .vs-btn{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-family:'Outfit',sans-serif; font-size:12.5px; font-weight:500; cursor:pointer; transition:all .2s; white-space:nowrap; border:1px solid transparent; }
    .vs-btn-outline{ background:none; border-color:var(--vs-border); color:var(--vs-text2); }
    .vs-btn-outline:hover{ border-color:var(--vs-border2); color:var(--vs-text); }
    .vs-btn-danger{ background:var(--vs-red); border-color:transparent; color:#fff; font-weight:600; }
    .vs-btn-danger:hover{ filter:brightness(1.08); }
    .vs-btn:disabled{ opacity:.5; cursor:default; }
  `;

  const THEME_VARS = {
    dark:  `--vs-modal-bg:#0c1824; --vs-surface2:#162435; --vs-border:#1e3045; --vs-border2:#2a4258;
             --vs-text:#e8f0f8; --vs-text2:#a8bece; --vs-text3:#6a8a9e;
             --vs-red:#f87171; --vs-red-bg:rgba(248,113,113,0.1);`,
    light: `--vs-modal-bg:#f8fafc; --vs-surface2:#f4f7fb; --vs-border:#dce4ef; --vs-border2:#c7d3e2;
             --vs-text:#0f2237; --vs-text2:#4a6580; --vs-text3:#8aa0b8;
             --vs-red:#dc2626; --vs-red-bg:rgba(220,38,38,0.08);`,
  };

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'vs-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }
  function _injectFonts() {
    if (document.getElementById('vs-fonts')) return;
    const link = document.createElement('link');
    link.id = 'vs-fonts'; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }
  function _esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _currentTheme(){ try { return localStorage.getItem('aurum-theme') || 'dark'; } catch(e){ return 'dark'; } }
  function _initials(name){
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  // Falls back to this if the host page supplies neither currentUser
  // nor getCurrentUser — keeps the modal sensible out of the box.
  const DEFAULT_DEMO_USER = { name: 'Adaeze Nwankwo', role: 'Duty Manager' };

  let _counter = 0;

  function create(options) {
    options = options || {};
    _injectFonts();
    _injectStyles();

    const instId = 'vs' + (++_counter);
    const currency = options.currency || '₦';
    const requireReason = options.requireReason !== false;
    let theme = options.theme || _currentTheme();

    const overlay = document.createElement('div');
    overlay.className = 'vs-overlay';
    overlay.id = instId + '-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    function applyTheme() { overlay.setAttribute('style', THEME_VARS[theme] || THEME_VARS.dark); }
    applyTheme();
    document.addEventListener('aurum:themechange', (e) => { theme = (e.detail && e.detail.theme) || theme; applyTheme(); });

    function fmtN(n){ return currency + Math.round(n||0).toLocaleString('en-NG'); }

    let currentSale = null;
    let currentUser = options.currentUser || DEFAULT_DEMO_USER;

    /* Session lookup — if the host page provides getCurrentUser (sync
       or async), it's called fresh every time the modal opens, so a
       real login system can be dropped in later with zero changes to
       this component. Falls back to options.currentUser / the demo
       user if it's absent, still pending, or throws. */
    async function resolveUser() {
      if (typeof options.getCurrentUser === 'function') {
        try {
          const u = await options.getCurrentUser();
          if (u && u.name) return u;
        } catch (e) { console.warn('[VoidSale] getCurrentUser failed, falling back:', e); }
      }
      return options.currentUser || DEFAULT_DEMO_USER;
    }

    function renderShell(sale, user, loadingUser) {
      currentSale = sale;
      const total = sale.total != null ? sale.total : (sale.items||[]).reduce((s,i)=>s+(i.qty||0)*(i.price||0),0);

      overlay.innerHTML = `
        <div class="vs-modal">
          <div class="vs-head">
            <div class="vs-title">⚠ Void Sale</div>
            <button class="vs-close" id="${instId}-close">✕</button>
          </div>
          <div class="vs-warn-box"><b>This cannot be undone.</b> Voiding removes this sale from revenue totals and reports. The record stays visible, marked as Voided, for audit purposes.</div>

          <div class="vs-meta-row"><span class="vs-l">Sale</span><span class="vs-v">${_esc(sale.id || '—')}</span></div>
          <div class="vs-meta-row"><span class="vs-l">Total</span><span class="vs-v">${fmtN(total)}</span></div>
          <div class="vs-meta-row"><span class="vs-l">Staff on Sale</span><span class="vs-v">${_esc(sale.staff || '—')}</span></div>

          <label class="vs-label">Voiding As</label>
          <div class="vs-auth-card">
            <div class="vs-auth-avatar">${loadingUser ? '…' : _esc(_initials(user.name))}</div>
            <div class="vs-auth-info">
              <div class="vs-auth-name">${loadingUser ? 'Checking session…' : _esc(user.name)}</div>
              <div class="vs-auth-role">${loadingUser ? '' : _esc(user.role || '')}</div>
            </div>
            <div class="vs-auth-tag">Session</div>
          </div>

          <label class="vs-label" for="${instId}-reason">Reason ${requireReason ? '(required)' : '(optional)'}</label>
          <textarea class="vs-textarea" id="${instId}-reason" placeholder="e.g. Order entered in error, customer complaint, duplicate charge…"></textarea>
          <div class="vs-err" id="${instId}-err">Please enter a reason before voiding this sale.</div>

          <div class="vs-footer">
            <button class="vs-btn vs-btn-outline" id="${instId}-cancelBtn">Cancel</button>
            <button class="vs-btn vs-btn-danger" id="${instId}-confirmBtn" ${loadingUser ? 'disabled' : ''}>✕ Confirm Void</button>
          </div>
        </div>`;

      overlay.querySelector('#' + instId + '-close').addEventListener('click', close);
      overlay.querySelector('#' + instId + '-cancelBtn').addEventListener('click', close);
      const confirmBtn = overlay.querySelector('#' + instId + '-confirmBtn');
      confirmBtn.addEventListener('click', () => {
        const reasonEl = overlay.querySelector('#' + instId + '-reason');
        const reason = reasonEl.value.trim();
        if (requireReason && !reason) {
          overlay.querySelector('#' + instId + '-err').classList.add('vs-show-err');
          reasonEl.focus();
          return;
        }
        const s = currentSale;
        const voidedBy = user.role ? `${user.name} (${user.role})` : user.name;
        close();
        if (typeof options.onConfirm === 'function') options.onConfirm(s, reason, voidedBy);
      });
    }

    async function open(sale) {
      if (!sale) { console.warn('[VoidSale] open() called without a sale object.'); return; }
      // Render immediately with whatever's known synchronously, then
      // resolve the session user (which may be async) and re-render.
      renderShell(sale, currentUser, typeof options.getCurrentUser === 'function');
      overlay.classList.add('vs-show');
      if (typeof options.getCurrentUser === 'function') {
        currentUser = await resolveUser();
        if (overlay.classList.contains('vs-show') && currentSale === sale) renderShell(sale, currentUser, false);
      }
    }
    function close() { overlay.classList.remove('vs-show'); }
    function destroy() { overlay.remove(); }

    return { open, close, destroy };
  }

  window.VoidSale = { create };

})();