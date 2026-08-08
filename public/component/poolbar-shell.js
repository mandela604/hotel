/* ═══════════════════════════════════════════════════════════════
   PoolBarShell — sidebar + topbar for the standalone Pool Bar
   module. Drop this in as component/poolbar-shell.js.

   Rebuilt to match booking-shell.js pattern exactly: fetches session
   from API when USE_DEMO = false, falls back to demo user otherwise.
   All pages get session via shell.getUser() for permission checks.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'dashboard', label: 'Dashboard',              href: 'poolbar-dashboard.html',            icon: 'fa-solid fa-gauge-high' },
    { key: 'reqhist',   label: 'Requisition History',    href: 'poolbar-requisition-history.html',  icon: 'fa-solid fa-clock-rotate-left', badgeKey: 'reqhist' },
    { key: 'stock',     label: 'Pool Bar Stock',         href: 'poolbar-stock.html',                icon: 'fa-solid fa-box' },
    { key: 'sales',     label: 'Sales',                  href: 'poolbar-sales.html',                icon: 'fa-solid fa-file-invoice-dollar' },
    { key: 'reports',   label: 'Reports',                href: 'poolbar-reports.html',              icon: 'fa-solid fa-chart-column' },
  ];

  const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif";

  const CSS = `
  :root{
    --gold:#2f6fed; --gold-light:#5b8ff9; --gold-dim:rgba(47,111,237,0.12); --gold-border:rgba(47,111,237,0.25);
    --green:#12b76a; --green-bg:rgba(18,183,106,0.12);
    --red:#f04438; --red-bg:rgba(240,68,56,0.12);
    --amber:#f79009; --amber-bg:rgba(247,144,9,0.12);
    --blue:#2f6fed; --blue-bg:rgba(47,111,237,0.12);
    --purple:#8b5cf6; --purple-bg:rgba(139,92,246,0.12);
    --sidebar-w:256px; --sidebar-col-w:68px; --topbar-h:62px; --radius-sm:10px;
    --transition:.3s cubic-bezier(.4,0,.2,1);
  }
  [data-theme="dark"]{
    --bg:#081540; --surface:#0a1848; --surface2:#0e2158; --surface3:#122868;
    --border:rgba(255,255,255,0.08); --border2:rgba(255,255,255,0.14); --text:#ffffff; --text2:#aab0d0; --text3:#8891bd;
    --sidebar-bg:linear-gradient(180deg,#0a1848 0%,#0c1c58 100%); --shadow:0 8px 32px rgba(0,0,0,0.5); --shadow-lg:0 16px 48px rgba(0,0,0,0.6);
  }
  [data-theme="light"]{
    --bg:#f4f6fb; --surface:#ffffff; --surface2:#f4f6fb; --surface3:#eef0f6;
    --border:#eef0f6; --border2:#dfe3ec; --text:#1c2440; --text2:#6b7280; --text3:#9aa1b3;
    --sidebar-bg:#ffffff; --shadow:0 4px 20px rgba(15,34,55,0.07); --shadow-lg:0 8px 40px rgba(15,34,55,0.10);
  }
  #pbs-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:${FONT}; }
  #pbs-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #pbs-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #pbs-sidebar.open{ transform:translateX(0); }
    #pbs-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .pbs-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .pbs-logo{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:${FONT}; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
  .pbs-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .pbs-brand .name{ font-family:${FONT}; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .pbs-brand .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .pbs-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
  .pbs-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #pbs-sidebar.collapsed .pbs-brand,
  #pbs-sidebar.collapsed .pbs-navtext,
  #pbs-sidebar.collapsed .pbs-navbadge,
  #pbs-sidebar.collapsed .pbs-backlabel{ display:none; }
  #pbs-sidebar.collapsed .pbs-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #pbs-sidebar.collapsed .pbs-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #pbs-sidebar.collapsed .pbs-nav{ padding:8px; }
  #pbs-sidebar.collapsed .pbs-back{ justify-content:center; padding:10px 0; }

  .pbs-back{ display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .pbs-back:hover{ color:var(--gold); }
  .pbs-back i{ font-size:11px; width:14px; text-align:center; }

  .pbs-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 16px 6px; }
  .pbs-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .pbs-nav::-webkit-scrollbar{ width:3px; }
  .pbs-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .pbs-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .pbs-navitem:hover{ background:var(--surface2); color:var(--text); }
  .pbs-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:600; }
  .pbs-navitem.active .pbs-navicon{ color:var(--gold); }
  .pbs-navicon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
  .pbs-navbadge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
  .pbs-navbadge.show{ display:inline-block; }

  .pbs-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
  .pbs-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:${FONT}; font-size:13px; cursor:pointer; transition:all .2s; }
  .pbs-themebtn:hover{ background:var(--surface3); color:var(--text); }
  .pbs-themelabel{ flex:1; text-align:left; }
  .pbs-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
  .pbs-toggle-track.on{ background:var(--gold); }
  .pbs-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
  .pbs-toggle-track.on .pbs-toggle-thumb{ transform:translateX(16px); }
  #pbs-sidebar.collapsed .pbs-themelabel,
  #pbs-sidebar.collapsed .pbs-toggle-track{ display:none; }
  #pbs-sidebar.collapsed .pbs-themebtn{ justify-content:center; padding:9px; }
  .pbs-copyright{ font-size:10.5px; color:var(--text3); padding:0 16px 16px; flex-shrink:0; }
  #pbs-sidebar.collapsed .pbs-copyright{ display:none; }

  #pbs-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #pbs-overlay.show{ display:block; }

  body.pbs-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #pbs-topbar{
    position:sticky; top:0; z-index:100; height:var(--topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:${FONT};
    color:#1c2440;
  }
  @media (max-width:480px){ #pbs-topbar{ padding:0 14px; } }
  .pbs-hamburger{ display:none; background:#ffffff; border:1px solid #eef0f6; color:#1c2440; width:36px; height:36px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .pbs-hamburger{ display:flex; } }
  .pbs-topback{ display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:#ffffff;
    border:1px solid #eef0f6; border-radius:var(--radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0; font-size:14px;
    text-decoration:none; transition:all .15s; }
  .pbs-topback:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  .pbs-titlewrap{ flex:1; min-width:0; }
  .pbs-title{ font-family:${FONT}; font-size:20px; font-weight:800; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .pbs-subtitle{ font-size:11.5px; color:#9aa1b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-weight:600; }
  .pbs-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .pbs-date{ font-size:12px; color:#9aa1b3; display:none; font-weight:600; }
  @media (min-width:640px){ .pbs-date{ display:block; } }
  .pbs-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
  .pbs-apibadge.live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .pbs-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:pbs-blink 2s infinite; }
  @keyframes pbs-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .pbs-notif{ width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6; border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:#6b7280; flex-shrink:0; }
  .pbs-notifdot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid #f4f6fb; }
  .pbs-avatar{ width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; color:#2f6fed; cursor:pointer; flex-shrink:0; }
  `;

  function ensureFontAwesome() {
    if (document.getElementById('pbs-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'pbs-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function injectCss() {
    if (document.getElementById('pbs-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'pbs-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── CONFIG — the only place to change Demo↔Live ──
  const CONFIG = {
    API_BASE: '',
    USE_DEMO: true,
    DEMO_USER: { name: 'Pool Bar Manager', initials: 'PB', role: 'staff', privilege: 'pool_bar_staff' },
  };

  async function fetchSession() {
    if (!CONFIG.USE_DEMO) {
      try {
        const res = await fetch(`${CONFIG.API_BASE}/api/auth/session`, {
          headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
        });
        if (!res.ok) throw new Error(`Session API returned ${res.status}`);
        const data = await res.json();
        return { name: data.name, initials: data.initials, role: data.role, privilege: data.privilege };
      } catch (err) {
        console.warn('[PoolBarShell] Session fetch failed, using demo user:', err.message);
      }
    }
    return CONFIG.DEMO_USER;
  }

  function attach(opts) {
    ensureFontAwesome();
    injectCss();

    const sidebarTarget = document.querySelector(opts.sidebarTarget);
    const topbarTarget  = document.querySelector(opts.topbarTarget);
    const activeFile    = opts.activeFile || '';

    // Start with passed user or demo default
    let user = opts.user || CONFIG.DEMO_USER;
    let initials = user.initials || (user.name || 'PB').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

    // ── Render sidebar ──
    sidebarTarget.innerHTML = `
      <div id="pbs-overlay"></div>
      <aside id="pbs-sidebar">
        <div class="pbs-head">
          <div class="pbs-logo">P</div>
          <div class="pbs-brand">
            <div class="name">Grace Pool Bar</div>
            <div class="sub">Module Suite</div>
          </div>
          <button class="pbs-collapse" id="pbs-collapseBtn" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
        </div>
        <a class="pbs-back" href="../index.html"><i class="fa-solid fa-arrow-left"></i> <span class="pbs-backlabel">Back to Main Suite</span></a>
        <div class="pbs-navlabel">Pool Bar</div>
        <nav class="pbs-nav" id="pbs-nav">
          ${NAV.map(n => `
            <a class="pbs-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}" data-nav-key="${n.key}">
              <span class="pbs-navicon"><i class="${n.icon}"></i></span>
              <span class="pbs-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="pbs-navbadge" id="pbs-badge-${n.badgeKey}"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="pbs-footer">
          <button class="pbs-themebtn" id="pbs-themeBtn">
            <span id="pbs-themeIcon"><i class="fa-solid fa-sun"></i></span>
            <span class="pbs-themelabel" id="pbs-themeLabel">Light Mode</span>
            <div class="pbs-toggle-track" id="pbs-toggleTrack"><div class="pbs-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="pbs-copyright">© 2026 Grace Hotel</div>
      </aside>`;

    // ── Render topbar ──
    topbarTarget.innerHTML = `
      <div id="pbs-topbar">
        <button class="pbs-hamburger" id="pbs-hamburger"><i class="fa-solid fa-bars"></i></button>
        ${opts.backHref ? `<a class="pbs-topback" href="${opts.backHref}" title="${opts.backLabel || 'Back'}"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
        <div class="pbs-titlewrap">
          <div class="pbs-title">${opts.pageTitle || 'Pool Bar'}</div>
          ${opts.pageSubtitle ? `<div class="pbs-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="pbs-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="pbs-date" id="pbs-date"></div>
          <div class="pbs-apibadge" id="pbs-apiBadge"><span class="dot"></span><span id="pbs-apiLabel">${CONFIG.USE_DEMO ? 'Demo' : 'Live'}</span></div>
          <div class="pbs-notif"><i class="fa-regular fa-bell"></i><div class="pbs-notifdot"></div></div>
          <div class="pbs-avatar" id="pbs-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('pbs-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    // ── Sidebar toggle logic ──
    const sidebar   = document.getElementById('pbs-sidebar');
    const overlay   = document.getElementById('pbs-overlay');
    const collapseBtn = document.getElementById('pbs-collapseBtn');
    const hamburger = document.getElementById('pbs-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('pbs-collapsed', collapsed);
      collapseBtn.innerHTML = collapsed
        ? '<i class="fa-solid fa-chevron-right"></i>'
        : '<i class="fa-solid fa-chevron-left"></i>';
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

    // ── Theme toggle ──
    let isDark = false;
    const themeBtn   = document.getElementById('pbs-themeBtn');
    const themeIcon  = document.getElementById('pbs-themeIcon');
    const themeLabel = document.getElementById('pbs-themeLabel');
    const toggleTrack = document.getElementById('pbs-toggleTrack');
    function applyTheme() {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeIcon.innerHTML = isDark
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
      themeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      if (toggleTrack) toggleTrack.classList.toggle('on', !isDark);
      try { localStorage.setItem('aurum-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    }
    themeBtn.addEventListener('click', () => { isDark = !isDark; applyTheme(); });
    try {
      const saved = localStorage.getItem('aurum-theme');
      if (saved === 'dark') isDark = true;
    } catch (e) {}
    applyTheme();

    // ── Fetch real session and update avatar ──
    const handle = {
      setApiMode(mode) {
        const badge = document.getElementById('pbs-apiBadge');
        const label = document.getElementById('pbs-apiLabel');
        if (!badge || !label) return;
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        const el = document.getElementById('pbs-badge-pending');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setReqHistBadge(n) {
        const el = document.getElementById('pbs-badge-reqhist');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.pbs-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.pbs-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.pbs-subtitle');
        if (subtitle != null && s) s.textContent = subtitle;
      },
      getUser() {
        return user;
      },
      getConfig() {
        return { ...CONFIG };
      },
    };

    // Fetch session and update avatar + user
    fetchSession().then(sessionUser => {
      if (sessionUser) {
        user = sessionUser;
        initials = user.initials || (user.name || 'PB').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
        const avatar = document.getElementById('pbs-avatar');
        if (avatar) {
          avatar.textContent = initials;
          avatar.title = user.name || '';
        }
        handle.setApiMode(CONFIG.USE_DEMO ? 'Demo' : 'Live');
      }
    });

    return handle;
  }

  // Expose CONFIG so pages can use it
  global.PoolBarShell = { attach, CONFIG };

})(window);