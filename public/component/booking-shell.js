/* ═══════════════════════════════════════════════════════════════
   BookingShell — sidebar + topbar for Front Desk / Booking module.
   Drop this in as component/booking-shell.js.

   Session rules (same as PoolBar / Restaurant):
     USE_DEMO true  → always DEMO_USER
     USE_DEMO false → GET /api/auth/session
                      success → real user
                      failure → redirect to LOGIN_URL (no demo fallback)
   Pages read session only via shell.getUser().

   FIXES vs. the previous version of this file:
   1. USE_DEMO now derives from window.BookingData.CONFIG.USE_PROD when
      that's available, instead of being a second, independent toggle.
      Before, booking-service.js's USE_PROD and this file's USE_DEMO
      could disagree — e.g. USE_PROD:true (real API calls) with
      USE_DEMO:true (still shows the fake "Front Desk Staff" user in the
      topbar and never actually hits /api/auth/session). Flipping
      booking-service.js's USE_PROD is now the ONLY switch needed.
   2. fetchSession() now authenticates the SAME way every other module
      shell (poolbar-shell.js) and every other API call in this app does:
      Authorization: Bearer <token> read from localStorage, matching
      middleware/auth.js exactly. The previous version sent
      credentials:'include' (cookies) and only attached a header if
      CONFIG.API_KEY was set (it never is) — against a Bearer-only
      auth.js, that 401'd every time, so live-mode session fetch could
      never succeed.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'rooms',    label: 'Front Desk',        href: 'booking-rooms.html',   icon: 'fa-solid fa-bed' },
    { key: 'guests',   label: 'Guests',             href: 'guests.html',          icon: 'fa-solid fa-user' },
    { key: 'bookings', label: 'All Bookings',       href: 'booking-list.html',    icon: 'fa-solid fa-clipboard-list', badgeKey: 'bookings' },
    { key: 'reports',  label: 'Reports & Revenue',  href: 'booking-reports.html', icon: 'fa-solid fa-chart-column' },
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
    --input-bg:#0a1848; --modal-bg:#0a1848;
  }
  [data-theme="light"]{
    --bg:#f4f6fb; --surface:#ffffff; --surface2:#f4f6fb; --surface3:#eef0f6;
    --border:#eef0f6; --border2:#dfe3ec; --text:#1c2440; --text2:#6b7280; --text3:#9aa1b3;
    --sidebar-bg:#ffffff; --shadow:0 4px 20px rgba(15,34,55,0.07); --shadow-lg:0 8px 40px rgba(15,34,55,0.10);
    --input-bg:#f4f6fb; --modal-bg:#ffffff;
  }
  #bks-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:${FONT}; }
  #bks-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #bks-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #bks-sidebar.open{ transform:translateX(0); }
    #bks-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .bks-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .bks-logo{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:${FONT}; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
  .bks-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .bks-brand .name{ font-family:${FONT}; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .bks-brand .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .bks-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
  .bks-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #bks-sidebar.collapsed .bks-brand,
  #bks-sidebar.collapsed .bks-navtext,
  #bks-sidebar.collapsed .bks-navbadge,
  #bks-sidebar.collapsed .bks-backlabel{ display:none; }
  #bks-sidebar.collapsed .bks-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #bks-sidebar.collapsed .bks-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #bks-sidebar.collapsed .bks-nav{ padding:8px; }
  #bks-sidebar.collapsed .bks-back{ justify-content:center; padding:10px 0; }

  .bks-back{ display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .bks-back:hover{ color:var(--gold); }
  .bks-back i{ font-size:11px; width:14px; text-align:center; }

  .bks-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 16px 6px; }
  .bks-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .bks-nav::-webkit-scrollbar{ width:3px; }
  .bks-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .bks-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .bks-navitem:hover{ background:var(--surface2); color:var(--text); }
  .bks-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:600; }
  .bks-navitem.active .bks-navicon{ color:var(--gold); }
  .bks-navicon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
  .bks-navbadge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
  .bks-navbadge.show{ display:inline-block; }

  .bks-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
  .bks-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:${FONT}; font-size:13px; cursor:pointer; transition:all .2s; }
  .bks-themebtn:hover{ background:var(--surface3); color:var(--text); }
  .bks-themelabel{ flex:1; text-align:left; }
  .bks-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
  .bks-toggle-track.on{ background:var(--gold); }
  .bks-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
  .bks-toggle-track.on .bks-toggle-thumb{ transform:translateX(16px); }
  #bks-sidebar.collapsed .bks-themelabel,
  #bks-sidebar.collapsed .bks-toggle-track{ display:none; }
  #bks-sidebar.collapsed .bks-themebtn{ justify-content:center; padding:9px; }
  .bks-copyright{ font-size:10.5px; color:var(--text3); padding:0 16px 16px; flex-shrink:0; }
  #bks-sidebar.collapsed .bks-copyright{ display:none; }

  #bks-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #bks-overlay.show{ display:block; }

  body.bks-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #bks-topbar{
    position:sticky; top:0; z-index:100; height:var(--topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:${FONT};
    color:#1c2440;
  }
  @media (max-width:480px){ #bks-topbar{ padding:0 14px; } }
  .bks-hamburger{ display:none; background:#ffffff; border:1px solid #eef0f6; color:#1c2440; width:36px; height:36px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .bks-hamburger{ display:flex; } }
  .bks-topback{ display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:#ffffff;
    border:1px solid #eef0f6; border-radius:var(--radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0; font-size:14px;
    text-decoration:none; transition:all .15s; }
  .bks-topback:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  .bks-titlewrap{ flex:1; min-width:0; }
  .bks-title{ font-family:${FONT}; font-size:20px; font-weight:800; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .bks-subtitle{ font-size:11.5px; color:#9aa1b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-weight:600; }
  .bks-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .bks-date{ font-size:12px; color:#9aa1b3; display:none; font-weight:600; }
  @media (min-width:640px){ .bks-date{ display:block; } }
  .bks-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
  .bks-apibadge.live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .bks-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:bks-blink 2s infinite; }
  @keyframes bks-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .bks-notif{ width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6; border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:#6b7280; flex-shrink:0; }
  .bks-notifdot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid #f4f6fb; }
  .bks-avatar{ width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; color:#2f6fed; cursor:pointer; flex-shrink:0; }
  `;

  function ensureFontAwesome() {
    if (document.getElementById('bks-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'bks-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function injectCss() {
    if (document.getElementById('bks-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'bks-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── CONFIG ──
  // USE_DEMO is resolved lazily inside resolveUseDemo() rather than fixed
  // here, so it can follow booking-service.js's own CONFIG.USE_PROD flag
  // when that script is loaded (script order per booking-service.js's own
  // header comment: booking-service.js loads before this shell attaches).
  const CONFIG = {
    API_BASE: '',
    USE_DEMO: true, // fallback only, used if BookingData isn't found — see resolveUseDemo()
    LOGIN_URL: '../login.html',
    DEMO_USER: { name: 'Front Desk Staff', initials: 'FD', role: 'staff', privilege: 'front_desk' },
  };

  // Single source of truth: if booking-service.js is loaded, its
  // CONFIG.USE_PROD flag decides demo vs. live for the WHOLE module —
  // this shell no longer has its own independent toggle that can drift
  // out of sync with it.
  function resolveUseDemo() {
    if (global.BookingData && global.BookingData.CONFIG && typeof global.BookingData.CONFIG.USE_PROD === 'boolean') {
      return !global.BookingData.CONFIG.USE_PROD;
    }
    return CONFIG.USE_DEMO;
  }

  // Same token lookup as every other module shell (poolbar-shell.js) and
  // every other API call in this app — matches middleware/auth.js exactly
  // (Authorization: Bearer <token>, no cookies).
  function getAuthToken() {
    try {
      return localStorage.getItem('gh_token') || localStorage.getItem('token') || '';
    } catch (e) { return ''; }
  }

  function goLogin(reason) {
    console.warn('[BookingShell] Auth failed — redirecting to login:', reason || '');
    const next = encodeURIComponent(location.pathname + location.search);
    const base = CONFIG.LOGIN_URL || '../login.html';
    location.href = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'next=' + next;
  }

  /**
   * Demo  → DEMO_USER
   * Live  → real user from API, authenticated the SAME way as every
   *         other API call in this module: Authorization: Bearer <token>,
   *         matching middleware/auth.js exactly. No cookies.
   * Live fail (no token, 401/403, bad response) → redirect (never
   * returns demo).
   */
  async function fetchSession() {
    if (resolveUseDemo()) {
      return CONFIG.DEMO_USER;
    }

    const token = getAuthToken();
    if (!token) {
      goLogin('no auth token in localStorage');
      return null;
    }

    try {
      const res = await fetch(CONFIG.API_BASE + '/api/auth/session', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.status === 401 || res.status === 403) {
        goLogin('HTTP ' + res.status);
        return null;
      }
      if (!res.ok) throw new Error('Session API returned ' + res.status);
      const data = await res.json();
      const user = (data && data.data) ? data.data : data; // tolerate {success,data:{...}} or a bare user object
      if (!user || !user.role) {
        goLogin('missing role');
        return null;
      }
      return {
        name: user.name,
        initials: user.initials,
        role: user.role,
        privilege: user.privilege || null,
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
    const useDemo       = resolveUseDemo();

    // Demo: start with DEMO_USER. Live: start empty until API responds (or redirect).
    let user = useDemo ? (opts.user || CONFIG.DEMO_USER) : (opts.user || null);
    let initials = user
      ? (user.initials || (user.name || 'FD').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(''))
      : '…';

    sidebarTarget.innerHTML = `
      <div id="bks-overlay"></div>
      <aside id="bks-sidebar">
        <div class="bks-head">
          <div class="bks-logo">G</div>
          <div class="bks-brand">
            <div class="name">Grace Hotel</div>
            <div class="sub">Front Desk</div>
          </div>
          <button class="bks-collapse" id="bks-collapseBtn" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
        </div>
        <a class="bks-back" href="../index.html"><i class="fa-solid fa-arrow-left"></i> <span class="bks-backlabel">Back to Main Suite</span></a>
        <div class="bks-navlabel">Front Desk</div>
        <nav class="bks-nav" id="bks-nav">
          ${NAV.map(n => `
            <a class="bks-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}" data-nav-key="${n.key}">
              <span class="bks-navicon"><i class="${n.icon}"></i></span>
              <span class="bks-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="bks-navbadge" id="bks-badge-${n.badgeKey}"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="bks-footer">
          <button class="bks-themebtn" id="bks-themeBtn">
            <span id="bks-themeIcon"><i class="fa-solid fa-sun"></i></span>
            <span class="bks-themelabel" id="bks-themeLabel">Light Mode</span>
            <div class="bks-toggle-track" id="bks-toggleTrack"><div class="bks-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="bks-copyright">© 2026 Grace Hotel</div>
      </aside>`;

    topbarTarget.innerHTML = `
      <div id="bks-topbar">
        <button class="bks-hamburger" id="bks-hamburger"><i class="fa-solid fa-bars"></i></button>
        ${opts.backHref ? `<a class="bks-topback" href="${opts.backHref}" title="${opts.backLabel || 'Back'}"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
        <div class="bks-titlewrap">
          <div class="bks-title">${opts.pageTitle || 'Front Desk (Rooms)'}</div>
          ${opts.pageSubtitle ? `<div class="bks-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="bks-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="bks-date" id="bks-date"></div>
          <div class="bks-apibadge" id="bks-apiBadge"><span class="dot"></span><span id="bks-apiLabel">${useDemo ? 'Demo' : 'Live'}</span></div>
          <div class="bks-notif"><i class="fa-regular fa-bell"></i><div class="bks-notifdot"></div></div>
          <div class="bks-avatar" id="bks-avatar" title="${user ? (user.name || '') : ''}">${initials}</div>
        </div>
      </div>`;

    document.getElementById('bks-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const sidebar   = document.getElementById('bks-sidebar');
    const overlay   = document.getElementById('bks-overlay');
    const collapseBtn = document.getElementById('bks-collapseBtn');
    const hamburger = document.getElementById('bks-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('bks-collapsed', collapsed);
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
    const themeBtn    = document.getElementById('bks-themeBtn');
    const themeIcon   = document.getElementById('bks-themeIcon');
    const themeLabel  = document.getElementById('bks-themeLabel');
    const toggleTrack = document.getElementById('bks-toggleTrack');
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
        const badge = document.getElementById('bks-apiBadge');
        const label = document.getElementById('bks-apiLabel');
        if (!badge || !label) return;
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        const el = document.getElementById('bks-badge-bookings');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.bks-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.bks-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.bks-subtitle');
        if (subtitle != null && s) s.textContent = subtitle;
      },
      getUser() {
        return user;
      },
      getConfig() {
        return Object.assign({}, CONFIG, { USE_DEMO: useDemo });
      },
    };

    fetchSession().then(function (sessionUser) {
      if (!sessionUser) return; // live fail → already redirected
      user = sessionUser;
      initials = user.initials || (user.name || 'FD').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
      const avatar = document.getElementById('bks-avatar');
      if (avatar) {
        avatar.textContent = initials;
        avatar.title = user.name || '';
      }
      handle.setApiMode(useDemo ? 'Demo' : 'Live');
    });

    return handle;
  }

  global.BookingShell = { attach: attach, CONFIG: CONFIG };

})(window);