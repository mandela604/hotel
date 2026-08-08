/* ═══════════════════════════════════════════════════════════════
   KitchenShell — sidebar + topbar for the standalone Kitchen
   module. Drop this in as component/kitchen-shell.js.

   Rebuilt to match booking-shell.js pattern exactly: fetches session
   from API when USE_DEMO = false, falls back to demo user otherwise.
   All pages get session via shell.getUser() for permission checks.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'dashboard', label: 'Dashboard',           href: 'kitchen-dashboard.html',          icon: 'fa-solid fa-gauge-high' },
    { key: 'history',   label: 'Production History',  href: 'kitchen-production-history.html', icon: 'fa-solid fa-clock-rotate-left' },
    { key: 'inventory', label: 'Inventory',            href: 'kitchen-inventory.html',           icon: 'fa-solid fa-box', badgeKey: 'inventory' },
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
  #kit-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:${FONT}; }
  #kit-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #kit-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #kit-sidebar.open{ transform:translateX(0); }
    #kit-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .kit-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .kit-logo{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:${FONT}; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
  .kit-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .kit-brand .name{ font-family:${FONT}; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .kit-brand .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .kit-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
  .kit-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #kit-sidebar.collapsed .kit-brand,
  #kit-sidebar.collapsed .kit-navtext,
  #kit-sidebar.collapsed .kit-navbadge,
  #kit-sidebar.collapsed .kit-backlabel{ display:none; }
  #kit-sidebar.collapsed .kit-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #kit-sidebar.collapsed .kit-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #kit-sidebar.collapsed .kit-nav{ padding:8px; }
  #kit-sidebar.collapsed .kit-back{ justify-content:center; padding:10px 0; }

  .kit-back{ display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .kit-back:hover{ color:var(--gold); }
  .kit-back i{ font-size:11px; width:14px; text-align:center; }

  .kit-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 16px 6px; }
  .kit-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .kit-nav::-webkit-scrollbar{ width:3px; }
  .kit-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .kit-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .kit-navitem:hover{ background:var(--surface2); color:var(--text); }
  .kit-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:600; }
  .kit-navitem.active .kit-navicon{ color:var(--gold); }
  .kit-navicon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
  .kit-navbadge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
  .kit-navbadge.show{ display:inline-block; }

  .kit-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
  .kit-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:${FONT}; font-size:13px; cursor:pointer; transition:all .2s; }
  .kit-themebtn:hover{ background:var(--surface3); color:var(--text); }
  .kit-themelabel{ flex:1; text-align:left; }
  .kit-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
  .kit-toggle-track.on{ background:var(--gold); }
  .kit-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
  .kit-toggle-track.on .kit-toggle-thumb{ transform:translateX(16px); }
  #kit-sidebar.collapsed .kit-themelabel,
  #kit-sidebar.collapsed .kit-toggle-track{ display:none; }
  #kit-sidebar.collapsed .kit-themebtn{ justify-content:center; padding:9px; }
  .kit-copyright{ font-size:10.5px; color:var(--text3); padding:0 16px 16px; flex-shrink:0; }
  #kit-sidebar.collapsed .kit-copyright{ display:none; }

  #kit-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #kit-overlay.show{ display:block; }

  body.kit-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #kit-topbar{
    position:sticky; top:0; z-index:100; height:var(--topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:${FONT};
    color:#1c2440;
  }
  @media (max-width:480px){ #kit-topbar{ padding:0 14px; } }
  .kit-hamburger{ display:none; background:#ffffff; border:1px solid #eef0f6; color:#1c2440; width:36px; height:36px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .kit-hamburger{ display:flex; } }
  .kit-topback{ display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:#ffffff;
    border:1px solid #eef0f6; border-radius:var(--radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0; font-size:14px;
    text-decoration:none; transition:all .15s; }
  .kit-topback:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  .kit-titlewrap{ flex:1; min-width:0; }
  .kit-title{ font-family:${FONT}; font-size:20px; font-weight:800; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .kit-subtitle{ font-size:11.5px; color:#9aa1b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-weight:600; }
  .kit-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .kit-date{ font-size:12px; color:#9aa1b3; display:none; font-weight:600; }
  @media (min-width:640px){ .kit-date{ display:block; } }
  .kit-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
  .kit-apibadge.live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .kit-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:kit-blink 2s infinite; }
  @keyframes kit-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .kit-notif{ width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6; border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:#6b7280; flex-shrink:0; }
  .kit-notifdot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid #f4f6fb; }
  .kit-avatar{ width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; color:#2f6fed; cursor:pointer; flex-shrink:0; }
  `;

  function ensureFontAwesome() {
    if (document.getElementById('kit-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'kit-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function injectCss() {
    if (document.getElementById('kit-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'kit-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── CONFIG — the only place to change Demo↔Live ──
  const CONFIG = {
    API_BASE: '',
    USE_DEMO: true,
    DEMO_USER: { name: 'Head Chef', initials: 'HC', role: 'staff', privilege: 'chef' },
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
        console.warn('[KitchenShell] Session fetch failed, using demo user:', err.message);
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
    let initials = user.initials || (user.name || 'K').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

    // ── Render sidebar ──
    sidebarTarget.innerHTML = `
      <div id="kit-overlay"></div>
      <aside id="kit-sidebar">
        <div class="kit-head">
          <div class="kit-logo">A</div>
          <div class="kit-brand">
            <div class="name">Aurum Hotel</div>
            <div class="sub">Kitchen Module</div>
          </div>
          <button class="kit-collapse" id="kit-collapseBtn" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
        </div>
        <a class="kit-back" href="../index.html"><i class="fa-solid fa-arrow-left"></i> <span class="kit-backlabel">Back to Main Suite</span></a>
        <div class="kit-navlabel">Kitchen</div>
        <nav class="kit-nav" id="kit-nav">
          ${NAV.map(n => `
            <a class="kit-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}" data-nav-key="${n.key}">
              <span class="kit-navicon"><i class="${n.icon}"></i></span>
              <span class="kit-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="kit-navbadge" id="kit-badge-${n.badgeKey}"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="kit-footer">
          <button class="kit-themebtn" id="kit-themeBtn">
            <span id="kit-themeIcon"><i class="fa-solid fa-sun"></i></span>
            <span class="kit-themelabel" id="kit-themeLabel">Light Mode</span>
            <div class="kit-toggle-track" id="kit-toggleTrack"><div class="kit-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="kit-copyright">© 2026 Aurum Hotel</div>
      </aside>`;

    // ── Render topbar ──
    topbarTarget.innerHTML = `
      <div id="kit-topbar">
        <button class="kit-hamburger" id="kit-hamburger"><i class="fa-solid fa-bars"></i></button>
        ${opts.backHref ? `<a class="kit-topback" href="${opts.backHref}" title="${opts.backLabel || 'Back'}"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
        <div class="kit-titlewrap">
          <div class="kit-title">${opts.pageTitle || 'Kitchen'}</div>
          ${opts.pageSubtitle ? `<div class="kit-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="kit-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="kit-date" id="kit-date"></div>
          <div class="kit-apibadge" id="kit-apiBadge"><span class="dot"></span><span id="kit-apiLabel">${CONFIG.USE_DEMO ? 'Demo' : 'Live'}</span></div>
          <div class="kit-notif"><i class="fa-regular fa-bell"></i><div class="kit-notifdot"></div></div>
          <div class="kit-avatar" id="kit-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('kit-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    // ── Sidebar toggle logic ──
    const sidebar   = document.getElementById('kit-sidebar');
    const overlay   = document.getElementById('kit-overlay');
    const collapseBtn = document.getElementById('kit-collapseBtn');
    const hamburger = document.getElementById('kit-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('kit-collapsed', collapsed);
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
    const themeBtn   = document.getElementById('kit-themeBtn');
    const themeIcon  = document.getElementById('kit-themeIcon');
    const themeLabel = document.getElementById('kit-themeLabel');
    const toggleTrack = document.getElementById('kit-toggleTrack');
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
        const badge = document.getElementById('kit-apiBadge');
        const label = document.getElementById('kit-apiLabel');
        if (!badge || !label) return;
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(_n) {},
      setInventoryBadge(n) {
        const el = document.getElementById('kit-badge-inventory');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.kit-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.kit-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.kit-subtitle');
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
        initials = user.initials || (user.name || 'K').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
        const avatar = document.getElementById('kit-avatar');
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
  global.KitchenShell = { attach, CONFIG };

})(window);