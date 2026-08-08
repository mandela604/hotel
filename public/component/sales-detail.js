/**
 * sales-detail.js — Reusable "View Sale" detail modal
 * ─────────────────────────────────────────────────────────────────────
 * Same pattern as booking-shell.js / poolbar-shell.js / restaurant-shell.js:
 * drop one <script> tag, call create() once per page, get back a small
 * controller { open, close, destroy }. Fully self-contained CSS
 * (sd- prefixed) — no dependency on the host page's stylesheet.
 *
 * Matches the platform's shared design system: Segoe UI font stack,
 * Font Awesome 6 icons, and the same blue (--gold:#2f6fed) theme
 * tokens used across booking-shell.js, poolbar-shell.js,
 * restaurant-shell.js and the Accounting module. Automatically follows
 * the platform's dark/light theme (reads localStorage('aurum-theme')
 * on load, and listens for the 'aurum:themechange' event dispatched on
 * toggle by the shells / theme-bridge snippets used on Sales pages).
 *
 * Works equally well wired into the Pool Bar, Restaurant, or
 * Accounting (Transactions/Reports) pages — nothing here is specific
 * to any one module.
 *
 * ── SALE SHAPE (host page supplies this to .open()) ─────────────────────
 *   {
 *     id:       'SALE-1043',
 *     dept:     'Restaurant',              // label only, any string
 *     table:    'Table 4',                 // or room/location, optional
 *     staff:    'Amaka O.',
 *     date:     '17/07/26 11:05 AM',       // any human string, shown as-is
 *     method:   'Cash',                    // Cash | POS | Transfer | Room Charge | Complimentary
 *     items:    [{ name:'Egusi Soup', qty:2, price:6000 }],
 *     discount: 0,                         // naira amount, optional
 *     status:   'completed',               // 'completed' | 'voided'
 *     voidReason: '',                      // shown if status === 'voided'
 *     notes:    '',                        // optional
 *   }
 *
 * ── USAGE ──────────────────────────────────────────────────────────────
 *   <script src="component/sales-detail.js"></script>
 *   <script>
 *     const salesDetail = SalesDetail.create({
 *       onVoid: (sale) => { voidSale.open(sale); }, // wire to void-sale.js, or omit to hide the Void button
 *     });
 *
 *     // anywhere a row is clicked:
 *     salesDetail.open(sale);
 *   </script>
 *
 * Multiple instances are fine (e.g. Sales tab + Reports tab each with
 * their own onVoid wiring) — they share one overlay/DOM node lazily
 * created on first open(), scoped by a unique instance id.
 */

(function () {
  'use strict';

  const CSS = `
    .sd-overlay{ display:none; position:fixed; inset:0; background:rgba(15,20,40,0.55); backdrop-filter:blur(5px); z-index:400; align-items:flex-start; justify-content:center; padding:20px 16px; overflow-y:auto; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; }
    .sd-overlay.sd-show{ display:flex; }
    .sd-modal{ background:var(--sd-modal-bg); border:1px solid var(--sd-border); border-radius:18px; padding:24px; width:min(560px,96vw); box-shadow:0 30px 80px rgba(15,20,40,0.25); margin:auto; position:relative; overflow:hidden; animation:sd-in .22s cubic-bezier(.4,0,.2,1); color:var(--sd-text); }
    .sd-modal::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--sd-gold); }
    @keyframes sd-in{ from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    .sd-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; gap:10px; }
    .sd-title{ font-size:18px; font-weight:800; color:var(--sd-text); }
    .sd-close{ background:var(--sd-surface2); border:1px solid var(--sd-border); border-radius:8px; width:30px; height:30px; color:var(--sd-text2); font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; flex-shrink:0; }
    .sd-close:hover{ border-color:var(--sd-red); color:var(--sd-red); }
    .sd-status-row{ margin-bottom:16px; }
    .sd-chip{ display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; letter-spacing:.3px; }
    .sd-chip i{ font-size:6px; }
    .sd-chip.ok{ background:var(--sd-green-bg); color:var(--sd-green); }
    .sd-chip.void{ background:var(--sd-red-bg); color:var(--sd-red); }

    .sd-meta-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px 18px; margin-bottom:16px; }
    @media (max-width:480px){ .sd-meta-grid{ grid-template-columns:1fr; } }
    .sd-meta-item .sd-ml{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.1px; color:var(--sd-text3); margin-bottom:3px; font-weight:700; }
    .sd-meta-item .sd-mv{ font-size:13px; font-weight:600; color:var(--sd-text); }

    .sd-section-title{ font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:var(--sd-gold); font-weight:700; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid var(--sd-gold-border); }
    .sd-tbl-wrap{ overflow-x:auto; margin-bottom:4px; border:1px solid var(--sd-border); border-radius:10px; }
    .sd-table{ width:100%; border-collapse:collapse; font-size:12.5px; min-width:380px; }
    .sd-table thead th{ text-align:left; padding:8px 10px; font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--sd-text3); font-weight:700; background:var(--sd-surface2); border-bottom:1px solid var(--sd-border); }
    .sd-table thead th.sd-r{ text-align:right; }
    .sd-table tbody td{ padding:9px 10px; border-bottom:1px solid var(--sd-border); color:var(--sd-text); }
    .sd-table tbody td.sd-r{ text-align:right; }
    .sd-table tbody tr:last-child td{ border-bottom:none; }

    .sd-totals{ margin-top:10px; }
    .sd-trow{ display:flex; justify-content:space-between; padding:5px 0; font-size:12.5px; color:var(--sd-text2); }
    .sd-trow.sd-grand{ border-top:1px solid var(--sd-border); margin-top:4px; padding-top:10px; font-size:15px; font-weight:800; color:var(--sd-gold); }
    .sd-trow.sd-grand .sd-tv{ font-size:19px; }

    .sd-note-box{ background:var(--sd-surface2); border:1px solid var(--sd-border); border-radius:10px; padding:11px 13px; font-size:12px; color:var(--sd-text2); line-height:1.5; margin-top:14px; }
    .sd-note-box.sd-void{ background:var(--sd-red-bg); border-color:rgba(240,68,56,.3); color:var(--sd-red); }
    .sd-note-box b{ color:var(--sd-text); }

    .sd-footer{ display:flex; gap:8px; justify-content:flex-end; margin-top:18px; padding-top:14px; border-top:1px solid var(--sd-border); flex-wrap:wrap; }
    .sd-btn{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:12.5px; font-weight:700; cursor:pointer; transition:all .2s; white-space:nowrap; border:1px solid transparent; }
    .sd-btn i{ font-size:11px; }
    .sd-btn-outline{ background:var(--sd-surface2); border-color:var(--sd-border); color:var(--sd-text2); }
    .sd-btn-outline:hover{ border-color:var(--sd-gold-border); color:var(--sd-gold); }
    .sd-btn-danger{ background:var(--sd-red-bg); border-color:rgba(240,68,56,.3); color:var(--sd-red); }
    .sd-btn-danger:hover{ background:rgba(240,68,56,.18); }
    .sd-btn-primary{ background:var(--sd-gold); border-color:transparent; color:#fff; box-shadow:0 4px 10px rgba(47,111,237,0.28); }
    .sd-btn-primary:hover{ background:var(--sd-gold-light); transform:translateY(-1px); }
  `;

  const THEME_VARS = {
    dark:  `--sd-bg:#081540; --sd-modal-bg:#0a1848; --sd-surface2:#0e2158; --sd-border:rgba(255,255,255,0.08);
             --sd-text:#ffffff; --sd-text2:#aab0d0; --sd-text3:#8891bd;
             --sd-gold:#2f6fed; --sd-gold-light:#5b8ff9; --sd-gold-border:rgba(47,111,237,0.25);
             --sd-green:#12b76a; --sd-green-bg:rgba(18,183,106,0.12);
             --sd-red:#f04438; --sd-red-bg:rgba(240,68,56,0.12);`,
    light: `--sd-bg:#f4f6fb; --sd-modal-bg:#ffffff; --sd-surface2:#f4f6fb; --sd-border:#eef0f6;
             --sd-text:#1c2440; --sd-text2:#6b7280; --sd-text3:#9aa1b3;
             --sd-gold:#2f6fed; --sd-gold-light:#5b8ff9; --sd-gold-border:rgba(47,111,237,0.25);
             --sd-green:#12b76a; --sd-green-bg:#e9f9f0;
             --sd-red:#f04438; --sd-red-bg:#feecec;`,
  };

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'sd-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }
  function _injectFontAwesome() {
    if (document.getElementById('sd-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'sd-fa-css'; link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }
  function _esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _currentTheme(){ try { return localStorage.getItem('aurum-theme') || 'dark'; } catch(e){ return 'dark'; } }

  let _counter = 0;

  function create(options) {
    options = options || {};
    _injectFontAwesome();
    _injectStyles();

    const instId = 'sd' + (++_counter);
    const currency = options.currency || '₦';
    let theme = options.theme || _currentTheme();

    const overlay = document.createElement('div');
    overlay.className = 'sd-overlay';
    overlay.id = instId + '-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    function applyTheme() { overlay.setAttribute('style', `${THEME_VARS[theme] || THEME_VARS.dark}`); }
    applyTheme();
    document.addEventListener('aurum:themechange', (e) => { theme = (e.detail && e.detail.theme) || theme; applyTheme(); });

    function fmtN(n){ return currency + Math.round(n||0).toLocaleString('en-NG'); }

    let currentSale = null;

    function render(sale) {
      currentSale = sale;
      const isVoid = sale.status === 'voided';
      const items = sale.items || [];
      const subtotal = items.reduce((s,i)=>s+(i.qty||0)*(i.price||0),0);
      const discount = sale.discount || 0;
      const total = sale.total != null ? sale.total : Math.max(0, subtotal - discount);

      overlay.innerHTML = `
        <div class="sd-modal">
          <div class="sd-head">
            <div class="sd-title">${_esc(sale.id || 'Sale')}</div>
            <button class="sd-close" id="${instId}-close"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="sd-status-row">
            <span class="sd-chip ${isVoid ? 'void' : 'ok'}"><i class="fa-solid fa-circle"></i>${isVoid ? 'Voided' : 'Completed'}</span>
          </div>
          <div class="sd-meta-grid">
            <div class="sd-meta-item"><div class="sd-ml">Department</div><div class="sd-mv">${_esc(sale.dept || '—')}</div></div>
            <div class="sd-meta-item"><div class="sd-ml">Table / Location</div><div class="sd-mv">${_esc(sale.table || '—')}</div></div>
            <div class="sd-meta-item"><div class="sd-ml">Staff</div><div class="sd-mv">${_esc(sale.staff || '—')}</div></div>
            <div class="sd-meta-item"><div class="sd-ml">Payment Method</div><div class="sd-mv">${_esc(sale.method || '—')}</div></div>
            <div class="sd-meta-item"><div class="sd-ml">Date &amp; Time</div><div class="sd-mv">${_esc(sale.date || '—')}</div></div>
          </div>

          <div class="sd-section-title">Items</div>
          <div class="sd-tbl-wrap">
            <table class="sd-table">
              <thead><tr><th>Item</th><th class="sd-r">Qty</th><th class="sd-r">Price</th><th class="sd-r">Subtotal</th></tr></thead>
              <tbody>
                ${items.length ? items.map(i => `<tr><td>${_esc(i.name)}</td><td class="sd-r">${i.qty}</td><td class="sd-r">${fmtN(i.price)}</td><td class="sd-r">${fmtN((i.qty||0)*(i.price||0))}</td></tr>`).join('')
                  : `<tr><td colspan="4" style="text-align:center;color:var(--sd-text3);padding:16px;">No items recorded</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="sd-totals">
            <div class="sd-trow"><span>Subtotal</span><span>${fmtN(subtotal)}</span></div>
            ${discount ? `<div class="sd-trow"><span>Discount</span><span>−${fmtN(discount)}</span></div>` : ''}
            <div class="sd-trow sd-grand"><span>Total</span><span class="sd-tv">${fmtN(total)}</span></div>
          </div>

          ${isVoid
            ? `<div class="sd-note-box sd-void"><b>Void reason:</b> ${_esc(sale.voidReason || 'No reason provided')}</div>`
            : (sale.notes ? `<div class="sd-note-box"><b>Notes:</b> ${_esc(sale.notes)}</div>` : '')}

          <div class="sd-footer" id="${instId}-footer">
            <button class="sd-btn sd-btn-outline" id="${instId}-closeBtn">Close</button>
            ${(!isVoid && typeof options.onVoid === 'function') ? `<button class="sd-btn sd-btn-danger" id="${instId}-voidBtn"><i class="fa-solid fa-ban"></i> Void Sale</button>` : ''}
            ${typeof options.onPrint === 'function' ? `<button class="sd-btn sd-btn-primary" id="${instId}-printBtn"><i class="fa-solid fa-print"></i> Print Receipt</button>` : ''}
          </div>
        </div>`;

      overlay.querySelector('#' + instId + '-close').addEventListener('click', close);
      overlay.querySelector('#' + instId + '-closeBtn').addEventListener('click', close);
      const voidBtn = overlay.querySelector('#' + instId + '-voidBtn');
      if (voidBtn) voidBtn.addEventListener('click', () => { const s = currentSale; close(); options.onVoid(s); });
      const printBtn = overlay.querySelector('#' + instId + '-printBtn');
      if (printBtn) printBtn.addEventListener('click', () => options.onPrint(currentSale));
    }

    function open(sale) {
      if (!sale) { console.warn('[SalesDetail] open() called without a sale object.'); return; }
      render(sale);
      overlay.classList.add('sd-show');
    }
    function close() { overlay.classList.remove('sd-show'); }
    function destroy() { overlay.remove(); }

    return { open, close, destroy };
  }

  window.SalesDetail = { create };

})();