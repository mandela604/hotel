/* ═══════════════════════════════════════════════════════════════
   RestaurantShell — sidebar + topbar for the standalone Restaurant
   module. Drop this in as component/restaurant-shell.js, replacing
   the previous version. Nav updated: POS folded into Orders (which
   now handles both quick sales and open tabs), Menu added as its
   own page, Reports now points at a real page.

   "Back to Main Suite" link lives right under the logo (same spot
   and same "← Back to Main Suite" wording as kitchen-shell.js) and
   points to "../index.html" — Restaurant pages live one level down
   in their own restaurant/ folder, so the link must climb back out
   to the real Hotel Suite index.html rather than a bare
   "index.html", which would resolve to a non-existent file inside
   restaurant/ itself.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'dashboard',  label: 'Dashboard',            href: 'restaurant-dashboard.html',       icon: '◈' },
    { key: 'transfers',  label: 'Pending Transfers',    href: 'restaurant-transfers.html',       icon: '🚚', badgeKey: 'pending' },
    { key: 'xferhist',   label: 'Transfer History',     href: 'restaurant-transfer-history.html',icon: '📜' },
    { key: 'inventory',  label: 'Restaurant Inventory', href: 'restaurant-inventory.html',       icon: '🍽' },
    { key: 'movement',   label: 'Inventory Movement',   href: 'restaurant-movement.html',        icon: '📉' },
    { key: 'orders',     label: 'Orders',               href: 'restaurant-orders.html',          icon: '🧾' },
    { key: 'menu',       label: 'Menu',                 href: 'restaurant-menu.html',            icon: '🍴' },
    { key: 'sales',      label: 'Sales',                href: 'restaurant-sales.html',           icon: '📋' },
    { key: 'reports',    label: 'Reports',              href: 'restaurant-reports.html',         icon: '📊' },
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
  #rst-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:'Outfit',sans-serif; }
  #rst-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #rst-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #rst-sidebar.open{ transform:translateX(0); }
    #rst-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .rst-head{ display:flex; align-items:center; justify-content:space-between; padding:20px 16px 18px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .rst-logo{ width:34px; height:34px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:'Cormorant Garamond',serif; font-size:18px; font-weight:700; color:#000; flex-shrink:0; }
  .rst-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .rst-brand .name{ font-family:'Cormorant Garamond',serif; font-size:17px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .rst-brand .sub{ font-size:8.5px; letter-spacing:2px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .rst-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; flex-shrink:0; transition:all .2s; }
  .rst-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #rst-sidebar.collapsed .rst-brand,
  #rst-sidebar.collapsed .rst-navtext,
  #rst-sidebar.collapsed .rst-navbadge,
  #rst-sidebar.collapsed .rst-backlabel{ display:none; }
  #rst-sidebar.collapsed .rst-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #rst-sidebar.collapsed .rst-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #rst-sidebar.collapsed .rst-nav{ padding:8px; }
  #rst-sidebar.collapsed .rst-back{ justify-content:center; padding:10px 0; }

  /* "← Back to Main Suite" — same spot (right under the logo, above the
     nav) and same wording as kitchen-shell.js, for a consistent feel
     across every module shell. */
  .rst-back{ display:flex; align-items:center; gap:6px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .rst-back:hover{ color:var(--gold); }

  .rst-navlabel{ font-size:9px; letter-spacing:2.2px; text-transform:uppercase; color:var(--text3); padding:16px 16px 6px; }
  .rst-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .rst-nav::-webkit-scrollbar{ width:3px; }
  .rst-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .rst-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .rst-navitem:hover{ background:var(--surface2); color:var(--text); }
  .rst-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:500; }
  .rst-navitem.active .rst-navicon{ color:var(--gold); }
  .rst-navicon{ font-size:15px; width:20px; text-align:center; flex-shrink:0; }
  .rst-navbadge{ margin-left:auto; background:var(--gold); color:#000; font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:20px; }

  .rst-footer{ padding:10px; border-top:1px solid var(--border); flex-shrink:0; }
  .rst-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:9px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:'Outfit',sans-serif; font-size:12.5px; cursor:pointer; transition:all .2s; }
  .rst-themebtn:hover{ background:var(--surface3); color:var(--text); }
  #rst-sidebar.collapsed .rst-themelabel{ display:none; }
  #rst-sidebar.collapsed .rst-themebtn{ justify-content:center; padding:9px; }

  #rst-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #rst-overlay.show{ display:block; }

  body.rst-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #rst-topbar{ position:sticky; top:0; z-index:100; height:var(--topbar-h); background:var(--bg); border-bottom:1px solid var(--border);
    display:flex; align-items:center; padding:0 22px; gap:12px; font-family:'Outfit',sans-serif; }
  .rst-hamburger{ display:none; background:var(--surface2); border:1px solid var(--border); color:var(--text); width:34px; height:34px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .rst-hamburger{ display:flex; } }
  .rst-titlewrap{ flex:1; min-width:0; }
  .rst-title{ font-family:'Cormorant Garamond',serif; font-size:19px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .rst-subtitle{ font-size:10.5px; color:var(--text3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
  .rst-topright{ display:flex; align-items:center; gap:9px; flex-shrink:0; }
  .rst-date{ font-size:11.5px; color:var(--text3); display:none; }
  @media (min-width:640px){ .rst-date{ display:block; } }
  .rst-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:9.5px; font-weight:600; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(251,191,36,0.12); color:#fbbf24; border:1px solid rgba(251,191,36,0.2); }
  .rst-apibadge.live{ background:rgba(74,222,128,0.12); color:#4ade80; border-color:rgba(74,222,128,0.2); }
  .rst-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:rst-blink 2s infinite; }
  @keyframes rst-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .rst-notif{ width:34px; height:34px; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:var(--text2); }
  .rst-notifdot{ position:absolute; top:6px; right:6px; width:6px; height:6px; background:var(--gold); border-radius:50%; border:1.5px solid var(--bg); }
  .rst-avatar{ width:34px; height:34px; background:var(--gold-dim); border:2px solid var(--gold-border); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; color:var(--gold); cursor:pointer; flex-shrink:0; }
  `;

  function injectCss() {
    if (document.getElementById('rst-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'rst-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function attach(opts) {
    injectCss();

    const sidebarTarget = document.querySelector(opts.sidebarTarget);
    const topbarTarget  = document.querySelector(opts.topbarTarget);
    const activeFile    = opts.activeFile || '';
    const initials      = (opts.user && opts.user.initials) || 'RM';

    sidebarTarget.innerHTML = `
      <div id="rst-overlay"></div>
      <aside id="rst-sidebar">
        <div class="rst-head">
          <div class="rst-logo">R</div>
          <div class="rst-brand">
            <div class="name">Aurum Restaurant</div>
            <div class="sub">Module Suite</div>
          </div>
          <button class="rst-collapse" id="rst-collapseBtn" title="Toggle sidebar">◀</button>
        </div>
        <a class="rst-back" href="../index.html">← <span class="rst-backlabel">Back to Main Suite</span></a>
        <div class="rst-navlabel">Restaurant</div>
        <nav class="rst-nav" id="rst-nav">
          ${NAV.map(n => `
            <a class="rst-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}">
              <span class="rst-navicon">${n.icon}</span>
              <span class="rst-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="rst-navbadge" id="rst-badge-${n.badgeKey}" style="display:none;">0</span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="rst-footer">
          <button class="rst-themebtn" id="rst-themeBtn">
            <span id="rst-themeIcon">☀️</span>
            <span class="rst-themelabel" id="rst-themeLabel">Light Mode</span>
          </button>
        </div>
      </aside>`;

    topbarTarget.innerHTML = `
      <div id="rst-topbar">
        <button class="rst-hamburger" id="rst-hamburger">☰</button>
        <div class="rst-titlewrap">
          <div class="rst-title">${opts.pageTitle || 'Restaurant'}</div>
          ${opts.pageSubtitle ? `<div class="rst-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="rst-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="rst-date" id="rst-date"></div>
          <div class="rst-apibadge" id="rst-apiBadge"><span class="dot"></span><span id="rst-apiLabel">${opts.apiMode || 'Demo'}</span></div>
          <div class="rst-notif">🔔<div class="rst-notifdot"></div></div>
          <div class="rst-avatar" id="rst-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('rst-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const sidebar   = document.getElementById('rst-sidebar');
    const overlay   = document.getElementById('rst-overlay');
    const collapseBtn = document.getElementById('rst-collapseBtn');
    const hamburger = document.getElementById('rst-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('rst-collapsed', collapsed);
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
    const themeBtn   = document.getElementById('rst-themeBtn');
    const themeIcon  = document.getElementById('rst-themeIcon');
    const themeLabel = document.getElementById('rst-themeLabel');
    function applyTheme() {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeIcon.textContent  = isDark ? '☀️' : '🌙';
      themeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      try { localStorage.setItem('restaurant-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    }
    themeBtn.addEventListener('click', () => { isDark = !isDark; applyTheme(); });
    try {
      const saved = localStorage.getItem('restaurant-theme');
      if (saved === 'light') isDark = false;
    } catch (e) {}
    applyTheme();

    const handle = {
      setApiMode(mode) {
        const badge = document.getElementById('rst-apiBadge');
        const label = document.getElementById('rst-apiLabel');
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        const el = document.getElementById('rst-badge-pending');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.style.display = ''; }
        else { el.style.display = 'none'; }
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.rst-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
    };
    return handle;
  }

  global.RestaurantShell = { attach };

})(window);