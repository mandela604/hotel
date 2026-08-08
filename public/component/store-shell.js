/**
 * store-shell.js — Grace Hotel HMS Store Module Sidebar + Topbar
 * 
 * Rebuilt to match booking-shell.js pattern exactly: fetches session
 * from API when USE_DEMO = false, falls back to demo user otherwise.
 * All pages get session via shell.getUser() for permission checks.
 */
(function (global) {
  'use strict';

  const NAV = [
    { key: 'dashboard',    label: 'Dashboard',    href: 'store-dashboard.html',   icon: 'fa-solid fa-gauge-high' },
    { key: 'stock',        label: 'Stock',        href: 'stock.html',             icon: 'fa-solid fa-box' },
    { key: 'requisitions', label: 'Requisitions', href: 'all-requisitions.html',  icon: 'fa-solid fa-clipboard-list', badgeKey: 'pending' },
  ];

  const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif";

  const CSS = `
  :root{
    --gs-gold:#2f6fed; --gs-gold-light:#5b8ff9;
    --gs-gold-dim:rgba(47,111,237,0.12); --gs-gold-border:rgba(47,111,237,0.25);
    --gs-green:#12b76a; --gs-green-bg:rgba(18,183,106,0.12);
    --gs-red:#f04438;   --gs-red-bg:rgba(240,68,56,0.12);
    --gs-amber:#f79009; --gs-amber-bg:rgba(247,144,9,0.12);
    --gs-sidebar-w:256px; --gs-sidebar-col-w:68px; --gs-topbar-h:62px;
    --gs-radius-sm:10px; --gs-transition:.3s cubic-bezier(.4,0,.2,1);
  }
  [data-theme="dark"]{
    --gs-bg:#081540; --gs-surface:#0a1848; --gs-surface2:#0e2158; --gs-surface3:#122868;
    --gs-border:rgba(255,255,255,0.08); --gs-border2:rgba(255,255,255,0.14);
    --gs-text:#ffffff; --gs-text2:#aab0d0; --gs-text3:#8891bd;
    --gs-sidebar-bg:linear-gradient(180deg,#0a1848 0%,#0c1c58 100%);
    --gs-shadow:0 8px 32px rgba(0,0,0,0.5); --gs-shadow-lg:0 16px 48px rgba(0,0,0,0.6);
  }
  [data-theme="light"]{
    --gs-bg:#f4f6fb; --gs-surface:#ffffff; --gs-surface2:#f4f6fb; --gs-surface3:#eef0f6;
    --gs-border:#eef0f6; --gs-border2:#dfe3ec;
    --gs-text:#1c2440; --gs-text2:#6b7280; --gs-text3:#9aa1b3;
    --gs-sidebar-bg:#ffffff;
    --gs-shadow:0 4px 20px rgba(15,34,55,0.07); --gs-shadow-lg:0 8px 40px rgba(15,34,55,0.10);
  }

  #gs-sidebar{
    position:fixed; top:0; left:0; height:100%; width:var(--gs-sidebar-w);
    background:var(--gs-sidebar-bg); border-right:1px solid var(--gs-border);
    display:flex; flex-direction:column; z-index:200;
    transition:width var(--gs-transition), transform var(--gs-transition);
    overflow:hidden; flex-shrink:0;
    font-family:${FONT};
  }
  #gs-sidebar.gs-collapsed{ width:var(--gs-sidebar-col-w); }
  @media (max-width:768px){
    #gs-sidebar{ transform:translateX(-100%); width:var(--gs-sidebar-w) !important; box-shadow:var(--gs-shadow-lg); }
    #gs-sidebar.gs-open{ transform:translateX(0); }
    #gs-sidebar.gs-collapsed{ width:var(--gs-sidebar-w) !important; }
  }

  .gs-head{
    display:flex; align-items:center; justify-content:space-between;
    padding:22px 16px 20px; border-bottom:1px solid var(--gs-border); flex-shrink:0;
  }
  .gs-logo{
    width:36px; height:36px; background:linear-gradient(135deg,var(--gs-gold),var(--gs-gold-light));
    border-radius:10px; display:flex; align-items:center; justify-content:center;
    font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none;
    font-family:${FONT};
  }
  .gs-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .gs-brand .gs-name{ font-size:18px; font-weight:700; color:var(--gs-gold); white-space:nowrap; line-height:1.2; }
  .gs-brand .gs-sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--gs-text3); margin-top:1px; white-space:nowrap; }
  .gs-collapse{
    width:26px; height:26px; background:var(--gs-surface2); border:1px solid var(--gs-border);
    border-radius:8px; color:var(--gs-text3); display:flex; align-items:center; justify-content:center;
    cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s;
  }
  .gs-collapse:hover{ background:var(--gs-gold-dim); color:var(--gs-gold); border-color:var(--gs-gold-border); }

  #gs-sidebar.gs-collapsed .gs-brand,
  #gs-sidebar.gs-collapsed .gs-navtext,
  #gs-sidebar.gs-collapsed .gs-navbadge,
  #gs-sidebar.gs-collapsed .gs-backlabel{ display:none; }
  #gs-sidebar.gs-collapsed .gs-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #gs-sidebar.gs-collapsed .gs-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #gs-sidebar.gs-collapsed .gs-nav{ padding:8px; }
  #gs-sidebar.gs-collapsed .gs-back{ justify-content:center; padding:10px 0; }
  #gs-sidebar.gs-collapsed .gs-themelabel,
  #gs-sidebar.gs-collapsed .gs-toggle-track{ display:none; }
  #gs-sidebar.gs-collapsed .gs-themebtn{ justify-content:center; padding:9px; }
  #gs-sidebar.gs-collapsed .gs-copyright{ display:none; }

  .gs-back{
    display:flex; align-items:center; gap:8px; padding:10px 16px;
    font-size:11.5px; color:var(--gs-text3); text-decoration:none;
    border-bottom:1px solid var(--gs-border); transition:color .15s; flex-shrink:0;
  }
  .gs-back:hover{ color:var(--gs-gold); }
  .gs-back i{ font-size:11px; width:14px; text-align:center; }

  .gs-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--gs-text3); padding:18px 16px 6px; flex-shrink:0; }
  .gs-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .gs-nav::-webkit-scrollbar{ width:3px; }
  .gs-nav::-webkit-scrollbar-thumb{ background:var(--gs-border2); border-radius:3px; }
  .gs-navitem{
    display:flex; align-items:center; gap:12px; padding:10px 12px;
    border-radius:var(--gs-radius-sm); color:var(--gs-text2); font-size:13.5px;
    cursor:pointer; text-decoration:none; border:1px solid transparent;
    margin-bottom:2px; transition:all .2s; white-space:nowrap;
  }
  .gs-navitem:hover{ background:var(--gs-surface2); color:var(--gs-text); }
  .gs-navitem.gs-active{
    background:var(--gs-gold-dim); border-color:var(--gs-gold-border);
    color:var(--gs-gold-light); font-weight:600;
  }
  .gs-navitem.gs-active .gs-navicon{ color:var(--gs-gold); }
  .gs-navicon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
  .gs-navbadge{
    margin-left:auto; background:var(--gs-gold); color:#fff;
    font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none;
  }
  .gs-navbadge.gs-show{ display:inline-block; }

  .gs-footer{ padding:12px 10px; border-top:1px solid var(--gs-border); flex-shrink:0; }
  .gs-themebtn{
    display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px;
    border-radius:var(--gs-radius-sm); background:var(--gs-surface2); border:1px solid var(--gs-border);
    color:var(--gs-text2); font-family:${FONT}; font-size:13px; cursor:pointer; transition:all .2s;
  }
  .gs-themebtn:hover{ background:var(--gs-surface3); color:var(--gs-text); }
  .gs-themelabel{ flex:1; text-align:left; }
  .gs-toggle-track{
    width:34px; height:18px; background:var(--gs-border2); border-radius:20px;
    position:relative; flex-shrink:0; transition:background .3s;
  }
  .gs-toggle-track.gs-on{ background:var(--gs-gold); }
  .gs-toggle-thumb{
    position:absolute; top:2px; left:2px; width:14px; height:14px;
    background:#fff; border-radius:50%; transition:transform .3s;
  }
  .gs-toggle-track.gs-on .gs-toggle-thumb{ transform:translateX(16px); }
  .gs-copyright{ font-size:10.5px; color:var(--gs-text3); padding:0 16px 16px; flex-shrink:0; }

  #gs-overlay{
    display:none; position:fixed; inset:0;
    background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px);
  }
  #gs-overlay.gs-show{ display:block; }

  body.gs-collapsed .main{ margin-left:var(--gs-sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #gs-topbar{
    position:sticky; top:0; z-index:100; height:var(--gs-topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:${FONT};
    color:#1c2440;
  }
  @media (max-width:480px){ #gs-topbar{ padding:0 14px; } }

  .gs-hamburger{
    display:none; background:#ffffff; border:1px solid #eef0f6; color:#1c2440;
    width:36px; height:36px; border-radius:var(--gs-radius-sm);
    align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0;
  }
  @media (max-width:768px){ .gs-hamburger{ display:flex; } }

  .gs-topback{
    display:flex; align-items:center; justify-content:center;
    width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6;
    border-radius:var(--gs-radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0;
    font-size:14px; text-decoration:none; transition:all .15s;
  }
  .gs-topback:hover{ background:var(--gs-gold-dim); color:var(--gs-gold); border-color:var(--gs-gold-border); }

  .gs-titlewrap{ flex:1; min-width:0; }
  .gs-title{
    font-size:20px; font-weight:800; color:#1c2440;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;
  }
  .gs-subtitle{
    font-size:11.5px; color:#9aa1b3;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-weight:600;
  }

  .gs-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .gs-topbar-date{ font-size:12px; color:#9aa1b3; display:none; font-weight:600; }
  @media (min-width:640px){ .gs-topbar-date{ display:block; } }

  .gs-apibadge{
    display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700;
    letter-spacing:1px; text-transform:uppercase; padding:3px 8px; border-radius:20px;
    background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap;
  }
  .gs-apibadge.gs-live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .gs-apibadge .gs-dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:gs-blink 2s infinite; }
  @keyframes gs-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }

  .gs-topbar-actions{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

  .gs-notif{
    width:36px; height:36px; background:#ffffff; border:1px solid #eef0f6;
    border-radius:var(--gs-radius-sm); display:flex; align-items:center; justify-content:center;
    cursor:pointer; font-size:14px; position:relative; color:#6b7280; flex-shrink:0;
  }
  .gs-notifdot{
    position:absolute; top:6px; right:6px; width:7px; height:7px;
    background:var(--gs-gold); border-radius:50%; border:1.5px solid #f4f6fb;
  }
  .gs-avatar{
    width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25);
    border-radius:50%; display:flex; align-items:center; justify-content:center;
    font-size:12.5px; font-weight:700; color:#2f6fed; cursor:pointer; flex-shrink:0;
  }

  @media print{
    #gs-sidebar, #gs-topbar, #gs-overlay{ display:none !important; }
  }
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

  // ── CONFIG — the only place to change Demo↔Live ──
  const CONFIG = {
    API_BASE: '',
    USE_DEMO: true,
    DEMO_USER: { name: 'Store Manager', initials: 'SM', role: 'staff', privilege: 'store_keeper' },
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
        console.warn('[GraceStoreShell] Session fetch failed, using demo user:', err.message);
      }
    }
    return CONFIG.DEMO_USER;
  }

  function attach(opts) {
    opts = opts || {};
    ensureFontAwesome();
    injectCss();

    const sidebarTarget = document.querySelector(opts.sidebarTarget);
    const topbarTarget  = document.querySelector(opts.topbarTarget);
    if (!sidebarTarget && !topbarTarget) {
      console.warn('[GraceStoreShell] No sidebarTarget or topbarTarget found.');
      return null;
    }

    const activeFile = opts.activeFile || '';
    const backHref   = opts.backHref || null;
    const backLabel  = opts.backLabel || 'Back';
    const topbarActionsHtml = opts.topbarActionsHtml || '';

    // Start with passed user or demo default
    let user = opts.user || CONFIG.DEMO_USER;
    let initials = user.initials || (user.name || 'SM').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

    /* ── Sidebar HTML ── */
    if (sidebarTarget) {
      sidebarTarget.innerHTML = `
        <div id="gs-overlay"></div>
        <aside id="gs-sidebar">
          <div class="gs-head">
            <div class="gs-logo">S</div>
            <div class="gs-brand">
              <div class="gs-name">Grace Store</div>
              <div class="gs-sub">Module Suite</div>
            </div>
            <button class="gs-collapse" id="gs-collapseBtn" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
          </div>
          <a class="gs-back" href="../index.html"><i class="fa-solid fa-arrow-left"></i> <span class="gs-backlabel">Back to Main Suite</span></a>
          <div class="gs-navlabel">Store</div>
          <nav class="gs-nav" id="gs-nav">
            ${NAV.map(n => `
              <a class="gs-navitem${n.href === activeFile ? ' gs-active' : ''}" href="${n.href}" data-gs-key="${n.key}">
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
    }

    /* ── Topbar HTML ── */
    if (topbarTarget) {
      topbarTarget.innerHTML = `
        <div id="gs-topbar">
          <button class="gs-hamburger" id="gs-hamburger"><i class="fa-solid fa-bars"></i></button>
          ${backHref ? `<a class="gs-topback" href="${backHref}" title="${backLabel}"><i class="fa-solid fa-arrow-left"></i></a>` : ''}
          <div class="gs-titlewrap">
            <div class="gs-title" id="gs-pageTitle">${opts.pageTitle || 'Store'}</div>
            ${opts.pageSubtitle ? `<div class="gs-subtitle" id="gs-pageSubtitle">${opts.pageSubtitle}</div>` : ''}
          </div>
          <div class="gs-topright">
            ${topbarActionsHtml ? `<div class="gs-topbar-actions">${topbarActionsHtml}</div>` : ''}
            <div class="gs-topbar-date" id="gs-date"></div>
            <div class="gs-apibadge" id="gs-apiBadge">
              <span class="gs-dot"></span>
              <span id="gs-apiLabel">${CONFIG.USE_DEMO ? 'Demo' : 'Live'}</span>
            </div>
            <div class="gs-notif"><i class="fa-regular fa-bell"></i><div class="gs-notifdot" id="gs-notifdot"></div></div>
            <div class="gs-avatar" id="gs-avatar">${initials}</div>
          </div>
        </div>`;

      const dateEl = document.getElementById('gs-date');
      if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }

    /* ── Wire up collapse ── */
    const sidebar     = document.getElementById('gs-sidebar');
    const overlay     = document.getElementById('gs-overlay');
    const collapseBtn = document.getElementById('gs-collapseBtn');
    const hamburger   = document.getElementById('gs-hamburger');

    let collapsed = false;

    if (collapseBtn && sidebar) {
      collapseBtn.addEventListener('click', () => {
        collapsed = !collapsed;
        sidebar.classList.toggle('gs-collapsed', collapsed);
        document.body.classList.toggle('gs-collapsed', collapsed);
        collapseBtn.innerHTML = collapsed
          ? '<i class="fa-solid fa-chevron-right"></i>'
          : '<i class="fa-solid fa-chevron-left"></i>';
      });
    }

    if (hamburger && sidebar && overlay) {
      hamburger.addEventListener('click', () => {
        sidebar.classList.add('gs-open');
        overlay.classList.add('gs-show');
        document.body.style.overflow = 'hidden';
      });
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('gs-open');
        overlay.classList.remove('gs-show');
        document.body.style.overflow = '';
      });
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
          sidebar.classList.remove('gs-open');
          overlay.classList.remove('gs-show');
          document.body.style.overflow = '';
        }
      });
    }

    /* ── Theme toggle ── */
    const themeBtn    = document.getElementById('gs-themeBtn');
    const themeIcon   = document.getElementById('gs-themeIcon');
    const themeLabel  = document.getElementById('gs-themeLabel');
    const toggleTrack = document.getElementById('gs-toggleTrack');

    let isDark = false;

    function applyTheme() {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeIcon.innerHTML = isDark
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
      themeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      if (toggleTrack) toggleTrack.classList.toggle('gs-on', !isDark);
      try { localStorage.setItem('aurum-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => { isDark = !isDark; applyTheme(); });
    }

    try {
      const saved = localStorage.getItem('aurum-theme');
      if (saved === 'dark') isDark = true;
    } catch (e) {}
    applyTheme();

    /* ── Public API ── */
    const handle = {
      setApiMode(mode) {
        const badge = document.getElementById('gs-apiBadge');
        const label = document.getElementById('gs-apiLabel');
        if (label) label.textContent = mode;
        if (badge) badge.classList.toggle('gs-live', mode === 'Live');
      },

      setPendingBadge(n) {
        const el = document.getElementById('gs-badge-pending');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('gs-show'); }
        else el.classList.remove('gs-show');
      },

      setNotifBadge(n) {
        const dot = document.getElementById('gs-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },

      setTitle(title, subtitle) {
        const t = document.getElementById('gs-pageTitle');
        if (t) t.textContent = title;
        if (subtitle != null) {
          let s = document.getElementById('gs-pageSubtitle');
          if (!s) {
            s = document.createElement('div');
            s.id = 'gs-pageSubtitle';
            s.className = 'gs-subtitle';
            const tw = document.querySelector('.gs-titlewrap');
            if (tw) tw.appendChild(s);
          }
          s.textContent = subtitle;
        }
      },

      setActive(file) {
        document.querySelectorAll('.gs-navitem').forEach(a => {
          a.classList.toggle('gs-active', a.getAttribute('href') === file);
        });
      },

      setTopbarActions(html) {
        let wrap = document.querySelector('.gs-topbar-actions');
        if (!wrap) {
          wrap = document.createElement('div');
          wrap.className = 'gs-topbar-actions';
          const tr = document.getElementById('gs-topbar');
          if (tr) tr.querySelector('.gs-topright').prepend(wrap);
        }
        wrap.innerHTML = html || '';
      },

      getTheme() { return isDark ? 'dark' : 'light'; },
      toggleTheme() { isDark = !isDark; applyTheme(); },
      getUser() { return user; },
      getConfig() { return { ...CONFIG }; },
    };

    // Fetch session and update avatar + user
    fetchSession().then(sessionUser => {
      if (sessionUser) {
        user = sessionUser;
        initials = user.initials || (user.name || 'SM').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
        const avatar = document.getElementById('gs-avatar');
        if (avatar) {
          avatar.textContent = initials;
          avatar.title = user.name || '';
        }
        handle.setApiMode(CONFIG.USE_DEMO ? 'Demo' : 'Live');
      }
    });

    return handle;
  }

  global.GraceStoreShell = { attach, NAV, CONFIG };

})(window);