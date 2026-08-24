/* ═══════════════════════════════════════════════════════════════
   SettingsShell — sidebar + topbar for the standalone Settings
   module. Drop this in as component/settings-shell.js.
   Sibling of component/kitchen-shell.js / component/poolbar-shell.js
   — same structure, same CONFIG/session rules, just Settings' own nav.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'general', label: 'General Settings', href: 'platform-settings.html', icon: 'fa-solid fa-gear' },
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
  #sts-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:${FONT}; }
  #sts-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #sts-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #sts-sidebar.open{ transform:translateX(0); }
    #sts-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .sts-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .sts-logo{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:${FONT}; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
  .sts-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .sts-brand .name{ font-family:${FONT}; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .sts-brand .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .sts-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
  .sts-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #sts-sidebar.collapsed .sts-brand,
  #sts-sidebar.collapsed .sts-navtext,
  #sts-sidebar.collapsed .sts-navbadge,
  #sts-sidebar.collapsed .sts-backlabel{ display:none; }
  #sts-sidebar.collapsed .sts-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #sts-sidebar.collapsed .sts-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #sts-sidebar.collapsed .sts-nav{ padding:8px; }
  #sts-sidebar.collapsed .sts-back{ justify-content:center; padding:10px 0; }

  .sts-back{ display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .sts-back:hover{ color:var(--gold); }
  .sts-back i{ font-size:11px; width:14px; text-align:center; }

  .sts-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 16px 6px; }
  .sts-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .sts-nav::-webkit-scrollbar{ width:3px; }
  .sts-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .sts-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .sts-navitem:hover{ background:var(--surface2); color:var(--text); }
  .sts-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:600; }
  .sts-navitem.active .sts-navicon{ color:var(--gold); }
  .sts-navicon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
  .sts-navbadge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
  .sts-navbadge.show{ display:inline-block; }

  .sts-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
  .sts-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:${FONT}; font-size:13px; cursor:pointer; transition:all .2s; }
  .sts-themebtn:hover{ background:var(--surface3); color:var(--text); }
  .sts-themelabel{ flex:1; text-align:left; }
  .sts-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
  .sts-toggle-track.on{ background:var(--gold); }
  .sts-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
  .sts-toggle-track.on .sts-toggle-thumb{ transform:translateX(16px); }
  #sts-sidebar.collapsed .sts-themelabel,
  #sts-sidebar.collapsed .sts-toggle-track{ display:none; }
  #sts-sidebar.collapsed .sts-themebtn{ justify-content:center; padding:9px; }
  .sts-copyright{ font-size:10.5px; color:var(--text3); padding:0 16px 16px; flex-shrink:0; }
  #sts-sidebar.collapsed .sts-copyright{ display:none; }

  #sts-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #sts-overlay.show{ display:block; }

  body.sts-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #sts-topbar{
    position:sticky; top:0; z-index:100; height:var(--topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:${FONT};
    color:#1c2440;
  }
  @media (max-width:480px){ #sts-topbar{ padding:0 14px; } }
  .sts-hamburger{ display:none; background:#ffffff; border:1px solid #eef0f6; color:#1c2440; width:36px; height:36px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .sts-hamburger{ display:flex; } }
  .sts-topback{ display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:#ffffff;
    border:1px solid #eef0f6; border-radius:var(--radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0; font-size:14px;
    text-decoration:none; transition:all .15s; }
  .sts-topback:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  .sts-titlewrap{ flex:1; min-width:0; }
  .sts-title{ font-family:${FONT}; font-size:20px; font-weight:800; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .sts-subtitle{ font-size:11.5px; color:#9aa1b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-weight:600; }
  .sts-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .sts-date{ font-size:12px; color:#9aa1b3; display:none; font-weight:600; }
  @media (min-width:640px){ .sts-date{ display:block; } }
  .sts-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
  .sts-apibadge.live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .sts-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:sts-blink 2s infinite; }
  @keyframes sts-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .sts-notif{ width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6; border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:#6b7280; flex-shrink:0; }
  .sts-notifdot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid #f4f6fb; }
  .sts-avatar{ width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; color:#2f6fed; cursor:pointer; flex-shrink:0; }
  `;

  function ensureFontAwesome() {
    if (document.getElementById('sts-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'sts-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function injectCss() {
    if (document.getElementById('sts-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'sts-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── CONFIG — Demo Working Mode ──
  const CONFIG = {
    API_BASE: '',
    USE_DEMO: true,
    LOGIN_URL: '../login.html',
    DEMO_USER: { name: 'Administrator', initials: 'AD', role: 'admin', privilege: 'settings' },
  };

  function attach(opts) {
    ensureFontAwesome();
    injectCss();

    const sidebarTarget = document.querySelector(opts.sidebarTarget);
    const topbarTarget  = document.querySelector(opts.topbarTarget);
    const activeFile    = opts.activeFile || '';

    let user = opts.user || CONFIG.DEMO_USER;
    let initials = user.initials || (user.name || 'AD').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

    sidebarTarget.innerHTML = `
      <div id="sts-overlay"></div>
      <aside id="sts-sidebar">
        <div class="sts-head">
          <div class="sts-logo">S</div>
          <div class="sts-brand">
            <div class="name">Grace Settings</div>
            <div class="sub">Module Suite</div>
          </div>
          <button class="sts-collapse" id="sts-collapseBtn" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
        </div>
        <a class="sts-back" href="../index.html"><i class="fa-solid fa-arrow-left"></i> <span class="sts-backlabel">Back to Main Suite</span></a>
        <div class="sts-navlabel">Settings</div>
        <nav class="sts-nav" id="sts-nav">
          ${NAV.map(n => `
            <a class="sts-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}" data-nav-key="${n.key}">
              <span class="sts-navicon"><i class="${n.icon}"></i></span>
              <span class="sts-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="sts-navbadge" id="sts-badge-${n.badgeKey}"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="sts-footer">
          <button class="sts-themebtn" id="sts-themeBtn">
            <span id="sts-themeIcon"><i class="fa-solid fa-sun"></i></span>
            <span class="sts-themelabel" id="sts-themeLabel">Light Mode</span>
            <div class="sts-toggle-track" id="sts-toggleTrack"><div class="sts-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="sts-copyright">© 2026 Grace Hotel</div>
      </aside>`;

    topbarTarget.innerHTML = `
      <div id="sts-topbar">
        <button class="sts-hamburger" id="sts-hamburger"><i class="fa-solid fa-bars"></i></button>
        ${opts.backHref ? `<a class="sts-topback" href="${opts.backHref}" title="${opts.backLabel || 'Back'}"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
        <div class="sts-titlewrap">
          <div class="sts-title">${opts.pageTitle || 'Settings'}</div>
          ${opts.pageSubtitle ? `<div class="sts-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="sts-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="sts-date" id="sts-date"></div>
          <div class="sts-apibadge" id="sts-apiBadge"><span class="dot"></span><span id="sts-apiLabel">Demo</span></div>
          <div class="sts-notif"><i class="fa-regular fa-bell"></i><div class="sts-notifdot"></div></div>
          <div class="sts-avatar" id="sts-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('sts-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const sidebar     = document.getElementById('sts-sidebar');
    const overlay     = document.getElementById('sts-overlay');
    const collapseBtn = document.getElementById('sts-collapseBtn');
    const hamburger   = document.getElementById('sts-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('sts-collapsed', collapsed);
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
    const themeBtn    = document.getElementById('sts-themeBtn');
    const themeIcon   = document.getElementById('sts-themeIcon');
    const themeLabel  = document.getElementById('sts-themeLabel');
    const toggleTrack = document.getElementById('sts-toggleTrack');
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

    return {
      setApiMode(mode) {
        const badge = document.getElementById('sts-apiBadge');
        const label = document.getElementById('sts-apiLabel');
        if (!badge || !label) return;
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.sts-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.sts-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.sts-subtitle');
        if (subtitle != null && s) s.textContent = subtitle;
      },
      getUser() {
        return user;
      },
      getConfig() {
        return Object.assign({}, CONFIG);
      },
    };
  }

  global.SettingsShell = { attach: attach, CONFIG: CONFIG };

})(window);