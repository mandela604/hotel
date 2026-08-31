/* ═══════════════════════════════════════════════════════════════
   GymShell — sidebar + topbar for the standalone Gym module.
   Drop this in as component/gym-shell.js.

   Session: GET /api/auth/session
            success → real user
            failure → redirect to LOGIN_URL
   Pages read session only via shell.getUser().

   Nav visibility:
     Items flagged managerOnly stay hidden (display:none) until the
     real session resolves and confirms role === 'admin' || 'manager'.
     This is UX only — pages must still gate access themselves.

   Usage:
     const shell = GymShell.attach({
       sidebarTarget: '#sidebarSlot',
       topbarTarget:  '#topbarSlot',
       activeFile:    'gym-dashboard.html',
       pageTitle:     'Dashboard',
       pageSubtitle:  'Gym operations overview',
     });
     shell.setPendingBadge(3);    // badge on "Check-in Log"
     shell.setExpiringBadge(2);   // badge on "Members" (expiring count)
     shell.getUser();             // current session user (null until session resolves)
     shell.getConfig();           // { API_BASE, LOGIN_URL }
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'dashboard', label: 'Dashboard',        href: 'gym-dashboard.html', icon: 'fa-solid fa-gauge-high' },
    { key: 'members',   label: 'Members',          href: 'gym-members.html',  icon: 'fa-solid fa-user-group', badgeKey: 'expiring' },
    { key: 'plans',     label: 'Membership Plans', href: 'gym-plans.html',    icon: 'fa-solid fa-tags' },
    { key: 'checkins',  label: 'Check-in Log',     href: 'gym-checkins.html', icon: 'fa-solid fa-clipboard-check', badgeKey: 'pending' },
    { key: 'revenue',   label: 'Revenue',          href: 'gym-revenue.html',  icon: 'fa-solid fa-chart-column', managerOnly: true },
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
  #gym-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:${FONT}; }
  #gym-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #gym-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #gym-sidebar.open{ transform:translateX(0); }
    #gym-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .gym-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .gym-logo{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:${FONT}; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
  .gym-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .gym-brand .name{ font-family:${FONT}; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .gym-brand .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .gym-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
  .gym-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #gym-sidebar.collapsed .gym-brand,
  #gym-sidebar.collapsed .gym-navtext,
  #gym-sidebar.collapsed .gym-navbadge,
  #gym-sidebar.collapsed .gym-backlabel{ display:none; }
  #gym-sidebar.collapsed .gym-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #gym-sidebar.collapsed .gym-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #gym-sidebar.collapsed .gym-nav{ padding:8px; }
  #gym-sidebar.collapsed .gym-back{ justify-content:center; padding:10px 0; }

  .gym-back{ display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .gym-back:hover{ color:var(--gold); }
  .gym-back i{ font-size:11px; width:14px; text-align:center; }

  .gym-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 16px 6px; }
  .gym-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .gym-nav::-webkit-scrollbar{ width:3px; }
  .gym-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .gym-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .gym-navitem:hover{ background:var(--surface2); color:var(--text); }
  .gym-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:600; }
  .gym-navitem.active .gym-navicon{ color:var(--gold); }
  .gym-navicon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
  .gym-navbadge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
  .gym-navbadge.show{ display:inline-block; }

  .gym-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
  .gym-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:${FONT}; font-size:13px; cursor:pointer; transition:all .2s; }
  .gym-themebtn:hover{ background:var(--surface3); color:var(--text); }
  .gym-themelabel{ flex:1; text-align:left; }
  .gym-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
  .gym-toggle-track.on{ background:var(--gold); }
  .gym-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
  .gym-toggle-track.on .gym-toggle-thumb{ transform:translateX(16px); }
  #gym-sidebar.collapsed .gym-themelabel,
  #gym-sidebar.collapsed .gym-toggle-track{ display:none; }
  #gym-sidebar.collapsed .gym-themebtn{ justify-content:center; padding:9px; }
  .gym-copyright{ font-size:10.5px; color:var(--text3); padding:0 16px 16px; flex-shrink:0; }
  #gym-sidebar.collapsed .gym-copyright{ display:none; }

  #gym-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #gym-overlay.show{ display:block; }

  body.gym-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #gym-topbar{
    position:sticky; top:0; z-index:100; height:var(--topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:${FONT};
    color:#1c2440;
  }
  @media (max-width:480px){ #gym-topbar{ padding:0 14px; } }
  .gym-hamburger{ display:none; background:#ffffff; border:1px solid #eef0f6; color:#1c2440; width:36px; height:36px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .gym-hamburger{ display:flex; } }
  .gym-topback{ display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:#ffffff;
    border:1px solid #eef0f6; border-radius:var(--radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0; font-size:14px;
    text-decoration:none; transition:all .15s; }
  .gym-topback:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  .gym-titlewrap{ flex:1; min-width:0; }
  .gym-title{ font-family:${FONT}; font-size:20px; font-weight:800; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .gym-subtitle{ font-size:11.5px; color:#9aa1b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-weight:600; }
  .gym-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .gym-date{ font-size:12px; color:#9aa1b3; display:none; font-weight:600; }
  @media (min-width:640px){ .gym-date{ display:block; } }
  .gym-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
  .gym-apibadge.live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .gym-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:gym-blink 2s infinite; }
  @keyframes gym-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .gym-notif{ width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6; border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:#6b7280; flex-shrink:0; }
  .gym-notifdot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid #f4f6fb; }
  .gym-avatar{ width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; color:#2f6fed; cursor:pointer; flex-shrink:0; }
  `;

  function ensureFontAwesome() {
    if (document.getElementById('gym-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'gym-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function injectCss() {
    if (document.getElementById('gym-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'gym-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── CONFIG ──
  const CONFIG = {
    API_BASE: '',
    LOGIN_URL: '../login.html',
  };

  function goLogin(reason) {
    console.warn('[GymShell] Auth failed — redirecting to login:', reason || '');
    const next = encodeURIComponent(location.pathname + location.search);
    const base = CONFIG.LOGIN_URL || '../login.html';
    location.href = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'next=' + next;
  }

  /**
   * GET /api/auth/session → real user
   * Failure → redirect to login (never returns fallback)
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

  function applyNavVisibility(sessionUser) {
    const role = ((sessionUser && sessionUser.role) || '').toLowerCase();
    const isManagerLike = role === 'admin' || role === 'manager';
    document.querySelectorAll('[data-manager-only]').forEach(function (el) {
      el.style.display = isManagerLike ? '' : 'none';
    });
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
      ? (user.initials || (user.name || 'GA').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(''))
      : '…';

    sidebarTarget.innerHTML = `
      <div id="gym-overlay"></div>
      <aside id="gym-sidebar">
        <div class="gym-head">
          <div class="gym-logo">G</div>
          <div class="gym-brand">
            <div class="name">Grace Hotel</div>
            <div class="sub">Gym & Fitness</div>
          </div>
          <button class="gym-collapse" id="gym-collapseBtn" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
        </div>
        <a class="gym-back" id="gym-backBtn" href="../index.html"><i class="fa-solid fa-arrow-left"></i> <span class="gym-backlabel">Back to Main Suite</span></a>
        <div class="gym-navlabel">Gym & Fitness</div>
        <nav class="gym-nav" id="gym-nav">
          ${NAV.map(n => `
            <a class="gym-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}" data-nav-key="${n.key}"${n.managerOnly ? ' data-manager-only style="display:none;"' : ''}>
              <span class="gym-navicon"><i class="${n.icon}"></i></span>
              <span class="gym-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="gym-navbadge" id="gym-badge-${n.badgeKey}"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="gym-footer">
          <button class="gym-themebtn" id="gym-themeBtn">
            <span id="gym-themeIcon"><i class="fa-solid fa-sun"></i></span>
            <span class="gym-themelabel" id="gym-themeLabel">Light Mode</span>
            <div class="gym-toggle-track" id="gym-toggleTrack"><div class="gym-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="gym-copyright">© 2026 Grace Hotel</div>
      </aside>`;

    topbarTarget.innerHTML = `
      <div id="gym-topbar">
        <button class="gym-hamburger" id="gym-hamburger"><i class="fa-solid fa-bars"></i></button>
        ${opts.backHref ? `<a class="gym-topback" href="${opts.backHref}" title="${opts.backLabel || 'Back'}"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
        <div class="gym-titlewrap">
          <div class="gym-title">${opts.pageTitle || 'Gym'}</div>
          ${opts.pageSubtitle ? `<div class="gym-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="gym-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="gym-date" id="gym-date"></div>
          <div class="gym-apibadge" id="gym-apiBadge"><span class="dot"></span><span id="gym-apiLabel">Live</span></div>
          <div class="gym-notif"><i class="fa-regular fa-bell"></i><div class="gym-notifdot"></div></div>
          <div class="gym-avatar" id="gym-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('gym-date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const sidebar      = document.getElementById('gym-sidebar');
    const overlay       = document.getElementById('gym-overlay');
    const collapseBtn   = document.getElementById('gym-collapseBtn');
    const hamburger      = document.getElementById('gym-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('gym-collapsed', collapsed);
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
    const themeBtn    = document.getElementById('gym-themeBtn');
    const themeIcon   = document.getElementById('gym-themeIcon');
    const themeLabel  = document.getElementById('gym-themeLabel');
    const toggleTrack = document.getElementById('gym-toggleTrack');
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
        const badge = document.getElementById('gym-apiBadge');
        const label = document.getElementById('gym-apiLabel');
        if (!badge || !label) return;
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        const el = document.getElementById('gym-badge-pending');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setExpiringBadge(n) {
        const el = document.getElementById('gym-badge-expiring');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.gym-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.gym-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.gym-subtitle');
        if (subtitle != null && s) s.textContent = subtitle;
      },
      getUser() {
        return user;
      },
      getConfig() {
        return Object.assign({}, CONFIG);
      },
    };

    applyNavVisibility(user);

    fetchSession().then(function (sessionUser) {
      if (!sessionUser) return; // live fail → already redirected
      user = sessionUser;
      initials = user.initials || (user.name || 'GA').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
      const avatar = document.getElementById('gym-avatar');
      if (avatar) {
        avatar.textContent = initials;
        avatar.title = user.name || '';
      }
      handle.setApiMode('Live');
      applyNavVisibility(user);
      if (user.role !== 'admin' && user.role !== 'manager') { var bb = document.getElementById('gym-backBtn'); if (bb) bb.style.display = 'none'; }
    });

    return handle;
  }

  global.GymShell = { attach: attach, CONFIG: CONFIG };

})(window);