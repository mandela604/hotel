/* ═══════════════════════════════════════════════════════════════
   StoreShell — sidebar + topbar for the standalone Store module.
   Drop this in as component/store-shell.js.

   Session rules:
     GET /api/auth/session (httpOnly cookie)
     success → real user
     failure → redirect to LOGIN_URL
   Pages read session only via shell.getUser().
   AUTH: httpOnly cookie sent automatically via credentials:'include'.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'dashboard',    label: 'Dashboard',          href: 'store-dashboard.html',       icon: 'fa-solid fa-gauge-high' },
    { key: 'stock',        label: 'Stock',              href: 'stock.html',                 icon: 'fa-solid fa-box' },
    { key: 'approval',     label: 'Approve Issue',      href: 'store-approval.html',        icon: 'fa-solid fa-check-double', badgeKey: 'pending' },
    { key: 'newrequest',   label: 'New Request',        href: 'store-new-request.html',     icon: 'fa-solid fa-plus-circle' },
    { key: 'requisitions', label: 'All Requisitions',   href: 'all-requisitions.html',      icon: 'fa-solid fa-clipboard-list' },
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
  #gs-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:${FONT}; }
  #gs-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #gs-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #gs-sidebar.open{ transform:translateX(0); }
    #gs-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .gs-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .gs-logo{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:${FONT}; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
  .gs-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .gs-brand .name{ font-family:${FONT}; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .gs-brand .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .gs-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
  .gs-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #gs-sidebar.collapsed .gs-brand,
  #gs-sidebar.collapsed .gs-navtext,
  #gs-sidebar.collapsed .gs-navbadge,
  #gs-sidebar.collapsed .gs-backlabel{ display:none; }
  #gs-sidebar.collapsed .gs-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #gs-sidebar.collapsed .gs-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #gs-sidebar.collapsed .gs-nav{ padding:8px; }
  #gs-sidebar.collapsed .gs-back{ justify-content:center; padding:10px 0; }

  .gs-back{ display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .gs-back:hover{ color:var(--gold); }
  .gs-back i{ font-size:11px; width:14px; text-align:center; }

  .gs-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 16px 6px; }
  .gs-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .gs-nav::-webkit-scrollbar{ width:3px; }
  .gs-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .gs-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .gs-navitem:hover{ background:var(--surface2); color:var(--text); }
  .gs-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:600; }
  .gs-navitem.active .gs-navicon{ color:var(--gold); }
  .gs-navicon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
  .gs-navbadge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
  .gs-navbadge.show{ display:inline-block; }

  .gs-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
  .gs-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:${FONT}; font-size:13px; cursor:pointer; transition:all .2s; }
  .gs-themebtn:hover{ background:var(--surface3); color:var(--text); }
  .gs-themelabel{ flex:1; text-align:left; }
  .gs-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
  .gs-toggle-track.on{ background:var(--gold); }
  .gs-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
  .gs-toggle-track.on .gs-toggle-thumb{ transform:translateX(16px); }
  #gs-sidebar.collapsed .gs-themelabel,
  #gs-sidebar.collapsed .gs-toggle-track{ display:none; }
  #gs-sidebar.collapsed .gs-themebtn{ justify-content:center; padding:9px; }
  .gs-copyright{ font-size:10.5px; color:var(--text3); padding:0 16px 16px; flex-shrink:0; }
  #gs-sidebar.collapsed .gs-copyright{ display:none; }

  #gs-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #gs-overlay.show{ display:block; }

  body.gs-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #gs-topbar{
    position:sticky; top:0; z-index:100; height:var(--topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:${FONT};
    color:#1c2440;
  }
  @media (max-width:480px){ #gs-topbar{ padding:0 14px; } }
  .gs-hamburger{ display:none; background:#ffffff; border:1px solid #eef0f6; color:#1c2440; width:36px; height:36px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .gs-hamburger{ display:flex; } }
  .gs-topback{ display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:#ffffff;
    border:1px solid #eef0f6; border-radius:var(--radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0; font-size:14px;
    text-decoration:none; transition:all .15s; }
  .gs-topback:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  .gs-titlewrap{ flex:1; min-width:0; }
  .gs-title{ font-family:${FONT}; font-size:20px; font-weight:800; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .gs-subtitle{ font-size:11.5px; color:#9aa1b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-weight:600; }
  .gs-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .gs-date{ font-size:12px; color:#9aa1b3; display:none; font-weight:600; }
  @media (min-width:640px){ .gs-date{ display:block; } }
  .gs-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
  .gs-apibadge.live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .gs-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:gs-blink 2s infinite; }
  @keyframes gs-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .gs-notif{ width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6; border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:#6b7280; flex-shrink:0; }
  .gs-notifdot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid #f4f6fb; }
  .gs-avatar{ width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; color:#2f6fed; cursor:pointer; flex-shrink:0; }
  `;

  function ensureFontAwesome() {
    if (document.getElementById('gs-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'gs-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function injectCss() {
    if (document.getElementById('gs-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'gs-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── CONFIG ──
  const CONFIG = {
    API_BASE: '',
    LOGIN_URL: '../login.html',
  };

  function goLogin(reason) {
    console.warn('[StoreShell] Auth failed — redirecting to login:', reason || '');
    const next = encodeURIComponent(location.pathname + location.search);
    const base = CONFIG.LOGIN_URL || '../login.html';
    location.href = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'next=' + next;
  }

  /**
   * Live  → real user from API. The httpOnly cookie is sent automatically.
   * Live fail (401/403, bad response) → redirect.
   */
  async function fetchSession() {
    try {
      const res = await fetch(CONFIG.API_BASE + '/api/auth/session', {
        credentials: 'include',
        headers: CONFIG.API_KEY ? { 'Authorization': 'Bearer ' + CONFIG.API_KEY } : {},
      });
      if (res.status === 401 || res.status === 403) {
        goLogin('HTTP ' + res.status);
        return null;
      }
      if (!res.ok) throw new Error('Session API returned ' + res.status);
      const data = await res.json();
      if (!data || !data.role) {
        goLogin('missing role');
        return null;
      }
      return {
        name: data.name,
        initials: data.initials,
        role: data.role,
        privilege: data.privilege || null,
      };
    } catch (err) {
      goLogin(err && err.message);
      return null;
    }
  }

  function attach(opts) {
    ensureFontAwesome();
    injectCss();

    const sidebarTarget = document.querySelector(opts.sidebarTarget);
    const topbarTarget  = document.querySelector(opts.topbarTarget);
    const activeFile    = opts.activeFile || '';

    // Start empty until API responds (or redirect).
    let user = opts.user || null;
    let initials = user
      ? (user.initials || (user.name || 'SM').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(''))
      : '…';

    sidebarTarget.innerHTML = `
      <div id="gs-overlay"></div>
      <aside id="gs-sidebar">
        <div class="gs-head">
          <div class="gs-logo">S</div>
          <div class="gs-brand">
            <div class="name">Grace Store</div>
            <div class="sub">Module Suite</div>
          </div>
          <button class="gs-collapse" id="gs-collapseBtn" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
        </div>
        <a class="gs-back" href="../index.html"><i class="fa-solid fa-arrow-left"></i> <span class="gs-backlabel">Back to Main Suite</span></a>
        <div class="gs-navlabel">Store</div>
        <nav class="gs-nav" id="gs-nav">
          ${NAV.map(n => `
            <a class="gs-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}" data-nav-key="${n.key}">
              <span class="gs-navicon"><i class="${n.icon}"></i></span>
              <span class="gs-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="gs-navbadge" id="gs-badge-${n.badgeKey}"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="gs-footer">
          <button class="gs-themebtn" id="gs-themeBtn">
            <span id="gs-themeIcon"><i class="fa-solid fa-sun"></i></span>
            <span class="gs-themelabel" id="gs-themeLabel">Light Mode</span>
            <div class="gs-toggle-track" id="gs-toggleTrack"><div class="gs-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="gs-copyright">© 2026 Grace Hotel</div>
      </aside>`;

    topbarTarget.innerHTML = `
      <div id="gs-topbar">
        <button class="gs-hamburger" id="gs-hamburger"><i class="fa-solid fa-bars"></i></button>
        ${opts.backHref ? `<a class="gs-topback" href="${opts.backHref}" title="${opts.backLabel || 'Back'}"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
        <div class="gs-titlewrap">
          <div class="gs-title">${opts.pageTitle || 'Store'}</div>
          ${opts.pageSubtitle ? `<div class="gs-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="gs-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="gs-date" id="gs-date"></div>
          <div class="gs-apibadge" id="gs-apiBadge"><span class="dot"></span><span id="gs-apiLabel">Live</span></div>
          <div class="gs-notif"><i class="fa-regular fa-bell"></i><div class="gs-notifdot"></div></div>
          <div class="gs-avatar" id="gs-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('gs-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const sidebar   = document.getElementById('gs-sidebar');
    const overlay   = document.getElementById('gs-overlay');
    const collapseBtn = document.getElementById('gs-collapseBtn');
    const hamburger = document.getElementById('gs-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('gs-collapsed', collapsed);
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

    let isDark = false;
    const themeBtn   = document.getElementById('gs-themeBtn');
    const themeIcon  = document.getElementById('gs-themeIcon');
    const themeLabel = document.getElementById('gs-themeLabel');
    const toggleTrack = document.getElementById('gs-toggleTrack');
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

    const handle = {
      setApiMode(mode) {
        const badge = document.getElementById('gs-apiBadge');
        const label = document.getElementById('gs-apiLabel');
        if (!badge || !label) return;
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        const el = document.getElementById('gs-badge-pending');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.gs-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.gs-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.gs-subtitle');
        if (subtitle != null && s) s.textContent = subtitle;
      },
      getUser() {
        return user;
      },
      getConfig() {
        return Object.assign({}, CONFIG);
      },
    };

    fetchSession().then(function (sessionUser) {
      if (!sessionUser) return; // live fail → already redirected
      user = sessionUser;
      initials = user.initials || (user.name || 'SM').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
      const avatar = document.getElementById('gs-avatar');
      if (avatar) {
        avatar.textContent = initials;
        avatar.title = user.name || '';
      }
      handle.setApiMode('Live');
    });

    return handle;
  }

  global.StoreShell = { attach: attach, CONFIG: CONFIG };

})(window);