/* ═══════════════════════════════════════════════════════════════
   AccountingShell — sidebar + topbar for the standalone Accounting
   module. Drop this in as component/accounting-shell.js.
   Mirrors component/restaurant-shell.js and component/poolbar-shell.js
   exactly (same tokens, same structure), "acc-" prefixed classes.

   This module owns ONLY its own pages:
     Dashboard → Shift Reconciliation → Revenue Breakdown →
     Transactions → Reports
   It does not show the rest of the hotel suite.

   Also mirrors Kitchen/Booking's "Back to Main Suite" link: a
   dedicated row right under the header, same wording/placement.
   The old footer-based back link has been removed to avoid
   duplication.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'dashboard', label: 'Dashboard',           href: 'accounting-dashboard.html',      icon: '◈' },
    { key: 'recon',     label: 'Shift Reconciliation',href: 'accounting-reconciliation.html', icon: '🕘', badgeKey: 'pending' },
    { key: 'breakdown', label: 'Revenue Breakdown',   href: 'accounting-breakdown.html',      icon: '📊' },
    { key: 'tx',        label: 'Transactions',        href: 'accounting-transactions.html',   icon: '🧾' },
    { key: 'reports',   label: 'Reports',             href: 'accounting-reports.html',        icon: '📋' },
  ];

  const CSS = `
  :root{
    --gold:#c9a84c; --gold-light:#e8c96a; --gold-dim:rgba(201,168,76,0.12); --gold-border:rgba(201,168,76,0.25);
    --sidebar-w:250px; --sidebar-col-w:68px; --topbar-h:62px; --radius-sm:10px;
    --transition:.3s cubic-bezier(.4,0,.2,1);
  }
  [data-theme="dark"]{
    --bg:#080f18; --surface:#111e2b; --surface2:#162435; --surface3:#1c2e40;
    --border:#1e3045; --border2:#243850; --text:#e8f0f8; --text2:#a8bece; --text3:#6a8a9e;
    --sidebar-bg:#0a1520; --shadow:0 8px 32px rgba(0,0,0,0.5); --shadow-lg:0 16px 48px rgba(0,0,0,0.6);
  }
  [data-theme="light"]{
    --bg:#eef2f7; --surface:#ffffff; --surface2:#f4f7fb; --surface3:#e8edf5;
    --border:#dce4ef; --border2:#ccd6e5; --text:#0f2237; --text2:#4a6580; --text3:#8aa0b8;
    --sidebar-bg:#ffffff; --shadow:0 4px 20px rgba(15,34,55,0.07); --shadow-lg:0 8px 40px rgba(15,34,55,0.10);
  }
  #acc-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:'Outfit',sans-serif; }
  #acc-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #acc-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #acc-sidebar.open{ transform:translateX(0); }
    #acc-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .acc-head{ display:flex; align-items:center; justify-content:space-between; padding:20px 16px 18px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .acc-logo{ width:34px; height:34px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:'Cormorant Garamond',serif; font-size:18px; font-weight:700; color:#000; flex-shrink:0; text-decoration:none; }
  .acc-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .acc-brand .name{ font-family:'Cormorant Garamond',serif; font-size:17px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .acc-brand .sub{ font-size:8.5px; letter-spacing:2px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .acc-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; flex-shrink:0; transition:all .2s; }
  .acc-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #acc-sidebar.collapsed .acc-brand,
  #acc-sidebar.collapsed .acc-navtext,
  #acc-sidebar.collapsed .acc-navbadge{ display:none; }
  #acc-sidebar.collapsed .acc-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #acc-sidebar.collapsed .acc-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #acc-sidebar.collapsed .acc-nav{ padding:8px; }

  .acc-backlink{ display:flex; align-items:center; gap:6px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .acc-backlink:hover{ color:var(--gold); }
  #acc-sidebar.collapsed .acc-backlink{ justify-content:center; padding:10px 0; }
  #acc-sidebar.collapsed .acc-backlink .acc-backlabel{ display:none; }

  .acc-navlabel{ font-size:9px; letter-spacing:2.2px; text-transform:uppercase; color:var(--text3); padding:16px 16px 6px; }
  .acc-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .acc-nav::-webkit-scrollbar{ width:3px; }
  .acc-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .acc-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .acc-navitem:hover{ background:var(--surface2); color:var(--text); }
  .acc-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:500; }
  .acc-navitem.active .acc-navicon{ color:var(--gold); }
  .acc-navicon{ font-size:15px; width:20px; text-align:center; flex-shrink:0; }
  .acc-navbadge{ margin-left:auto; background:var(--gold); color:#000; font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:20px; }

  .acc-footer{ padding:10px; border-top:1px solid var(--border); flex-shrink:0; }
  .acc-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:9px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:'Outfit',sans-serif; font-size:12.5px; cursor:pointer; transition:all .2s; }
  .acc-themebtn:hover{ background:var(--surface3); color:var(--text); }
  #acc-sidebar.collapsed .acc-themelabel{ display:none; }
  #acc-sidebar.collapsed .acc-themebtn{ justify-content:center; padding:9px; }

  #acc-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #acc-overlay.show{ display:block; }

  body.acc-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #acc-topbar{ position:sticky; top:0; z-index:100; height:var(--topbar-h); background:var(--bg); border-bottom:1px solid var(--border);
    display:flex; align-items:center; padding:0 22px; gap:12px; font-family:'Outfit',sans-serif; }
  .acc-hamburger{ display:none; background:var(--surface2); border:1px solid var(--border); color:var(--text); width:34px; height:34px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .acc-hamburger{ display:flex; } }
  .acc-titlewrap{ flex:1; min-width:0; }
  .acc-title{ font-family:'Cormorant Garamond',serif; font-size:19px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .acc-subtitle{ font-size:10.5px; color:var(--text3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
  .acc-topright{ display:flex; align-items:center; gap:9px; flex-shrink:0; }
  .acc-date{ font-size:11.5px; color:var(--text3); display:none; }
  @media (min-width:640px){ .acc-date{ display:block; } }
  .acc-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:9.5px; font-weight:600; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(251,191,36,0.12); color:#fbbf24; border:1px solid rgba(251,191,36,0.2); }
  .acc-apibadge.live{ background:rgba(74,222,128,0.12); color:#4ade80; border-color:rgba(74,222,128,0.2); }
  .acc-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:acc-blink 2s infinite; }
  @keyframes acc-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .acc-notif{ width:34px; height:34px; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:var(--text2); }
  .acc-notifdot{ position:absolute; top:6px; right:6px; width:6px; height:6px; background:var(--gold); border-radius:50%; border:1.5px solid var(--bg); }
  .acc-avatar{ width:34px; height:34px; background:var(--gold-dim); border:2px solid var(--gold-border); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; color:var(--gold); cursor:pointer; flex-shrink:0; }
  `;

  function injectCss() {
    if (document.getElementById('acc-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'acc-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function attach(opts) {
    injectCss();

    const sidebarTarget = document.querySelector(opts.sidebarTarget);
    const topbarTarget  = document.querySelector(opts.topbarTarget);
    const activeFile    = opts.activeFile || '';
    const initials      = (opts.user && opts.user.initials) || 'FM';

    sidebarTarget.innerHTML = `
      <div id="acc-overlay"></div>
      <aside id="acc-sidebar">
        <div class="acc-head">
          <a class="acc-logo" href="../index.html" title="Back to Aurum Hotel">A</a>
          <div class="acc-brand">
            <div class="name">Aurum Accounting</div>
            <div class="sub">Module Suite</div>
          </div>
          <button class="acc-collapse" id="acc-collapseBtn" title="Toggle sidebar">◀</button>
        </div>
        <a class="acc-backlink" href="../index.html">
          <span>←</span><span class="acc-backlabel">Back to Main Suite</span>
        </a>
        <div class="acc-navlabel">Accounting</div>
        <nav class="acc-nav" id="acc-nav">
          ${NAV.map(n => `
            <a class="acc-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}">
              <span class="acc-navicon">${n.icon}</span>
              <span class="acc-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="acc-navbadge" id="acc-badge-${n.badgeKey}" style="display:none;">0</span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="acc-footer">
          <button class="acc-themebtn" id="acc-themeBtn">
            <span id="acc-themeIcon">☀️</span>
            <span class="acc-themelabel" id="acc-themeLabel">Light Mode</span>
          </button>
        </div>
      </aside>`;

    topbarTarget.innerHTML = `
      <div id="acc-topbar">
        <button class="acc-hamburger" id="acc-hamburger">☰</button>
        <div class="acc-titlewrap">
          <div class="acc-title">${opts.pageTitle || 'Accounting'}</div>
          ${opts.pageSubtitle ? `<div class="acc-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="acc-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="acc-date" id="acc-date"></div>
          <div class="acc-apibadge" id="acc-apiBadge"><span class="dot"></span><span id="acc-apiLabel">${opts.apiMode || 'Demo'}</span></div>
          <div class="acc-notif">🔔<div class="acc-notifdot"></div></div>
          <div class="acc-avatar" id="acc-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('acc-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const sidebar   = document.getElementById('acc-sidebar');
    const overlay   = document.getElementById('acc-overlay');
    const collapseBtn = document.getElementById('acc-collapseBtn');
    const hamburger = document.getElementById('acc-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('acc-collapsed', collapsed);
      collapseBtn.textContent = collapsed ? '▶' : '◀';
    });
    hamburger.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    });

    let isDark = true;
    const themeBtn   = document.getElementById('acc-themeBtn');
    const themeIcon  = document.getElementById('acc-themeIcon');
    const themeLabel = document.getElementById('acc-themeLabel');
    function applyTheme() {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeIcon.textContent  = isDark ? '☀️' : '🌙';
      themeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      try { localStorage.setItem('accounting-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    }
    themeBtn.addEventListener('click', () => { isDark = !isDark; applyTheme(); });
    try {
      const saved = localStorage.getItem('accounting-theme');
      if (saved === 'light') isDark = false;
    } catch (e) {}
    applyTheme();

    const handle = {
      setApiMode(mode) {
        const badge = document.getElementById('acc-apiBadge');
        const label = document.getElementById('acc-apiLabel');
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        const el = document.getElementById('acc-badge-pending');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.style.display = ''; }
        else { el.style.display = 'none'; }
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.acc-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
    };
    return handle;
  }

  global.AccountingShell = { attach };

})(window);