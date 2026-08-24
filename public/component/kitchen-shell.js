/* ═══════════════════════════════════════════════════════════════
   KitchenShell — sidebar + topbar for the standalone Kitchen
   module. Drop this in as component/kitchen-shell.js.
   Sibling of component/poolbar-shell.js — same structure, same
   CONFIG/session rules, just Kitchen's own nav.

   Session rules:
     USE_DEMO true  → always DEMO_USER
     USE_DEMO false → GET /api/auth/session
                      success → real user
                      failure → redirect to LOGIN_URL (no demo fallback)
   Pages read session only via shell.getUser().
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'dashboard',  label: 'Dashboard',           href: 'kitchen-dashboard.html',          icon: 'fa-solid fa-gauge-high' },
    { key: 'stock',      label: 'Kitchen Stock',       href: 'kitchen-inventory.html',          icon: 'fa-solid fa-box' },
    { key: 'recipes',    label: 'kitchen Recipes',     href: 'kitchen-recipes.html',            icon: 'fa-solid fa-book-open' },
    { key: 'prodhist',   label: 'Production',          href: 'kitchen-production-history.html', icon: 'fa-solid fa-kitchen-set' },
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
  #khs-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:${FONT}; }
  #khs-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #khs-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #khs-sidebar.open{ transform:translateX(0); }
    #khs-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .khs-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .khs-logo{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:${FONT}; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
  .khs-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .khs-brand .name{ font-family:${FONT}; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .khs-brand .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .khs-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
  .khs-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #khs-sidebar.collapsed .khs-brand,
  #khs-sidebar.collapsed .khs-navtext,
  #khs-sidebar.collapsed .khs-navbadge,
  #khs-sidebar.collapsed .khs-backlabel{ display:none; }
  #khs-sidebar.collapsed .khs-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #khs-sidebar.collapsed .khs-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #khs-sidebar.collapsed .khs-nav{ padding:8px; }
  #khs-sidebar.collapsed .khs-back{ justify-content:center; padding:10px 0; }

  .khs-back{ display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .khs-back:hover{ color:var(--gold); }
  .khs-back i{ font-size:11px; width:14px; text-align:center; }

  .khs-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 16px 6px; }
  .khs-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .khs-nav::-webkit-scrollbar{ width:3px; }
  .khs-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .khs-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .khs-navitem:hover{ background:var(--surface2); color:var(--text); }
  .khs-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:600; }
  .khs-navitem.active .khs-navicon{ color:var(--gold); }
  .khs-navicon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
  .khs-navbadge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
  .khs-navbadge.show{ display:inline-block; }

  .khs-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
  .khs-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:${FONT}; font-size:13px; cursor:pointer; transition:all .2s; }
  .khs-themebtn:hover{ background:var(--surface3); color:var(--text); }
  .khs-themelabel{ flex:1; text-align:left; }
  .khs-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
  .khs-toggle-track.on{ background:var(--gold); }
  .khs-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
  .khs-toggle-track.on .khs-toggle-thumb{ transform:translateX(16px); }
  #khs-sidebar.collapsed .khs-themelabel,
  #khs-sidebar.collapsed .khs-toggle-track{ display:none; }
  #khs-sidebar.collapsed .khs-themebtn{ justify-content:center; padding:9px; }
  .khs-copyright{ font-size:10.5px; color:var(--text3); padding:0 16px 16px; flex-shrink:0; }
  #khs-sidebar.collapsed .khs-copyright{ display:none; }

  #khs-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #khs-overlay.show{ display:block; }

  body.khs-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #khs-topbar{
    position:sticky; top:0; z-index:100; height:var(--topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:${FONT};
    color:#1c2440;
  }
  @media (max-width:480px){ #khs-topbar{ padding:0 14px; } }
  .khs-hamburger{ display:none; background:#ffffff; border:1px solid #eef0f6; color:#1c2440; width:36px; height:36px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .khs-hamburger{ display:flex; } }
  .khs-topback{ display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:#ffffff;
    border:1px solid #eef0f6; border-radius:var(--radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0; font-size:14px;
    text-decoration:none; transition:all .15s; }
  .khs-topback:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  .khs-titlewrap{ flex:1; min-width:0; }
  .khs-title{ font-family:${FONT}; font-size:20px; font-weight:800; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .khs-subtitle{ font-size:11.5px; color:#9aa1b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-weight:600; }
  .khs-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .khs-date{ font-size:12px; color:#9aa1b3; display:none; font-weight:600; }
  @media (min-width:640px){ .khs-date{ display:block; } }
  .khs-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
  .khs-apibadge.live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .khs-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:khs-blink 2s infinite; }
  @keyframes khs-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .khs-notif{ width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6; border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:#6b7280; flex-shrink:0; }
  .khs-notifdot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid #f4f6fb; }
  .khs-avatar{ width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; color:#2f6fed; cursor:pointer; flex-shrink:0; }
  `;

  function ensureFontAwesome() {
    if (document.getElementById('khs-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'khs-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function injectCss() {
    if (document.getElementById('khs-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'khs-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── CONFIG — live only, no demo fallback ──
  const CONFIG = {
    API_BASE: '',
    LOGIN_URL: '../login.html',
  };

  function getToken() {
    try { return localStorage.getItem('token'); } catch (e) { return null; }
  }

  function redirectToLogin() {
    try { localStorage.removeItem('token'); localStorage.removeItem('aurum_user'); } catch (e) {}
    window.location.href = CONFIG.LOGIN_URL;
  }

  async function fetchSession() {
    const token = getToken();
    if (!token) { redirectToLogin(); return null; }

    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Session API returned ${res.status}`);
      return {
        name: data.name,
        initials: data.initials,
        role: data.role,
        privilege: data.privilege,
        department: data.department,
      };
    } catch (err) {
      console.warn('[KitchenShell] Session invalid, redirecting to login:', err.message);
      redirectToLogin();
      return null;
    }
  }

  function attach(opts) {
    ensureFontAwesome();
    injectCss();

    const sidebarTarget = document.querySelector(opts.sidebarTarget);
    const topbarTarget  = document.querySelector(opts.topbarTarget);
    const activeFile    = opts.activeFile || '';

    // Provisional user shown immediately while the real session loads;
    // fetchSession() below replaces this or redirects to login if the
    // token is missing/invalid. No demo fallback — a failed session
    // check always ends in a redirect, never a fabricated user.
    let user = opts.user || { name: 'Loading…', initials: '··', role: '', privilege: '' };
    let initials = user.initials || (user.name || 'KM').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

    sidebarTarget.innerHTML = `
      <div id="khs-overlay"></div>
      <aside id="khs-sidebar">
        <div class="khs-head">
          <div class="khs-logo">K</div>
          <div class="khs-brand">
            <div class="name">Grace Kitchen</div>
            <div class="sub">Module Suite</div>
          </div>
          <button class="khs-collapse" id="khs-collapseBtn" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
        </div>
        <a class="khs-back" href="../index.html"><i class="fa-solid fa-arrow-left"></i> <span class="khs-backlabel">Back to Main Suite</span></a>
        <div class="khs-navlabel">Kitchen</div>
        <nav class="khs-nav" id="khs-nav">
          ${NAV.map(n => `
            <a class="khs-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}" data-nav-key="${n.key}">
              <span class="khs-navicon"><i class="${n.icon}"></i></span>
              <span class="khs-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="khs-navbadge" id="khs-badge-${n.badgeKey}"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="khs-footer">
          <button class="khs-themebtn" id="khs-themeBtn">
            <span id="khs-themeIcon"><i class="fa-solid fa-sun"></i></span>
            <span class="khs-themelabel" id="khs-themeLabel">Light Mode</span>
            <div class="khs-toggle-track" id="khs-toggleTrack"><div class="khs-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="khs-copyright">© 2026 Grace Hotel</div>
      </aside>`;

    topbarTarget.innerHTML = `
      <div id="khs-topbar">
        <button class="khs-hamburger" id="khs-hamburger"><i class="fa-solid fa-bars"></i></button>
        ${opts.backHref ? `<a class="khs-topback" href="${opts.backHref}" title="${opts.backLabel || 'Back'}"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
        <div class="khs-titlewrap">
          <div class="khs-title">${opts.pageTitle || 'Kitchen'}</div>
          ${opts.pageSubtitle ? `<div class="khs-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="khs-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="khs-date" id="khs-date"></div>
          <div class="khs-apibadge" id="khs-apiBadge"><span class="dot"></span><span id="khs-apiLabel">Loading</span></div>
          <div class="khs-notif"><i class="fa-regular fa-bell"></i><div class="khs-notifdot"></div></div>
          <div class="khs-avatar" id="khs-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('khs-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const sidebar     = document.getElementById('khs-sidebar');
    const overlay     = document.getElementById('khs-overlay');
    const collapseBtn = document.getElementById('khs-collapseBtn');
    const hamburger   = document.getElementById('khs-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('khs-collapsed', collapsed);
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
    const themeBtn    = document.getElementById('khs-themeBtn');
    const themeIcon   = document.getElementById('khs-themeIcon');
    const themeLabel  = document.getElementById('khs-themeLabel');
    const toggleTrack = document.getElementById('khs-toggleTrack');
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

    const shellApi = {
      setApiMode(mode) {
        const badge = document.getElementById('khs-apiBadge');
        const label = document.getElementById('khs-apiLabel');
        if (!badge || !label) return;
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setReqHistBadge(n) {
        const el = document.getElementById('khs-badge-transfers') || document.getElementById('khs-badge-reqhist');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setPendingBadge(n) {
        const el = document.getElementById('khs-badge-transfers');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.khs-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.khs-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.khs-subtitle');
        if (subtitle != null && s) s.textContent = subtitle;
      },
      getUser() {
        return user;
      },
      getConfig() {
        return Object.assign({}, CONFIG);
      },
    };

    // ── Fetch the real session. A missing/invalid token redirects to
    // LOGIN_URL from inside fetchSession() — nothing below runs in
    // that case since the page is navigating away. ──
    fetchSession().then(sessionUser => {
      if (!sessionUser) return;
      user = Object.assign({}, user, sessionUser);
      const avatar = document.getElementById('khs-avatar');
      if (avatar) {
        avatar.textContent = user.initials || (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        avatar.title = user.name || '';
      }
      shellApi.setApiMode('Live');
    });

    return shellApi;
  }

  global.KitchenShell = { attach: attach, CONFIG: CONFIG };

})(window);