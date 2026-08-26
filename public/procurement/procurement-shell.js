/* ═══════════════════════════════════════════════════════════════
   ProcurementShell — sidebar + topbar for the standalone
   Procurement module. Mirrors RestaurantShell: same blue theme
   (#2f6fed), Segoe UI, collapsible sidebar, Grace Hotel branding.

   "Back to Main Suite" sits under the logo and points to
   "../index.html" — Procurement pages live one level down in
   procurement/, so the link climbs back out to the suite index.

   NAV: trimmed to Dashboard / Requisition History / PO History /
   Suppliers — New Requisition, Pending Approvals, and Reports were
   removed from the menu per request. Dashboard href fixed to match
   the actual file name (procurement-dashboard.html) — every page's
   sidebar is rendered from this same NAV array, so this one change
   fixes the "Dashboard" link on Requisition History, PO History, and
   Suppliers all at once.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const NAV = [
    { key: 'dashboard',           label: 'Dashboard',            href: 'procurement-dashboard.html', icon: '◈' },
    { key: 'requisition-history', label: 'Requisition History',  href: 'requisition-history.html',  icon: '▤' },
    { key: 'po-history',          label: 'PO History',           href: 'po-history.html',           icon: '▦' },
    { key: 'suppliers',           label: 'Suppliers',            href: 'suppliers.html',            icon: '◎' },
  ];

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
  #prc-sidebar{ position:fixed; top:0; left:0; height:100%; width:var(--sidebar-w); background:var(--sidebar-bg);
    border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200;
    transition:width var(--transition), transform var(--transition); overflow:hidden; flex-shrink:0;
    font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; }
  #prc-sidebar.collapsed{ width:var(--sidebar-col-w); }
  @media (max-width:768px){
    #prc-sidebar{ transform:translateX(-100%); width:var(--sidebar-w) !important; box-shadow:var(--shadow-lg); }
    #prc-sidebar.open{ transform:translateX(0); }
    #prc-sidebar.collapsed{ width:var(--sidebar-w) !important; }
  }
  .prc-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .prc-logo{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
  .prc-brand{ margin-left:10px; flex:1; overflow:hidden; }
  .prc-brand .name{ font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
  .prc-brand .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
  .prc-collapse{ width:26px; height:26px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text3);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; flex-shrink:0; transition:all .2s; }
  .prc-collapse:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  #prc-sidebar.collapsed .prc-brand,
  #prc-sidebar.collapsed .prc-navtext,
  #prc-sidebar.collapsed .prc-navbadge,
  #prc-sidebar.collapsed .prc-backlabel{ display:none; }
  #prc-sidebar.collapsed .prc-head{ justify-content:center; padding:20px 0 18px; flex-direction:column; gap:8px; }
  #prc-sidebar.collapsed .prc-navitem{ justify-content:center; padding:11px 0; gap:0; }
  #prc-sidebar.collapsed .prc-nav{ padding:8px; }
  #prc-sidebar.collapsed .prc-back{ justify-content:center; padding:10px 0; }

  .prc-back{ display:flex; align-items:center; gap:6px; padding:10px 16px; font-size:11.5px; color:var(--text3);
    text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
  .prc-back:hover{ color:var(--gold); }

  .prc-navlabel{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 16px 6px; }
  .prc-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
  .prc-nav::-webkit-scrollbar{ width:3px; }
  .prc-nav::-webkit-scrollbar-thumb{ background:var(--border2); border-radius:3px; }
  .prc-navitem{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:var(--radius-sm); color:var(--text2);
    font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
  .prc-navitem:hover{ background:var(--surface2); color:var(--text); }
  .prc-navitem.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:500; }
  .prc-navitem.active .prc-navicon{ color:var(--gold); }
  .prc-navicon{ font-size:16px; width:20px; text-align:center; flex-shrink:0; }
  .prc-navbadge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
  .prc-navbadge.show{ display:inline-block; }

  .prc-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
  .prc-themebtn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:var(--radius-sm);
    background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:13px; cursor:pointer; transition:all .2s; }
  .prc-themebtn:hover{ background:var(--surface3); color:var(--text); }
  .prc-themelabel{ flex:1; text-align:left; }
  .prc-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
  .prc-toggle-track.on{ background:var(--gold); }
  .prc-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
  .prc-toggle-track.on .prc-toggle-thumb{ transform:translateX(16px); }
  #prc-sidebar.collapsed .prc-themelabel,
  #prc-sidebar.collapsed .prc-toggle-track{ display:none; }
  #prc-sidebar.collapsed .prc-themebtn{ justify-content:center; padding:9px; }
  .prc-copyright{ font-size:10.5px; color:var(--text3); padding:0 16px 16px; flex-shrink:0; }
  #prc-sidebar.collapsed .prc-copyright{ display:none; }

  #prc-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
  #prc-overlay.show{ display:block; }

  body.prc-collapsed .main{ margin-left:var(--sidebar-col-w) !important; }
  @media (max-width:768px){ body .main{ margin-left:0 !important; } }

  #prc-topbar{
    position:sticky; top:0; z-index:100; height:var(--topbar-h);
    background:#f4f6fb; border-bottom:1px solid #eef0f6;
    display:flex; align-items:center; padding:0 24px; gap:12px;
    font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
    color:#1c2440;
  }
  @media (max-width:480px){ #prc-topbar{ padding:0 14px; } }
  .prc-hamburger{ display:none; background:#f4f6fb; border:1px solid #eef0f6; color:#1c2440; width:36px; height:36px;
    border-radius:var(--radius-sm); align-items:center; justify-content:center; font-size:16px; cursor:pointer; flex-shrink:0; }
  @media (max-width:768px){ .prc-hamburger{ display:flex; } }
  .prc-topback{ display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:#f4f6fb;
    border:1px solid #eef0f6; border-radius:var(--radius-sm); color:#1c2440; cursor:pointer; flex-shrink:0; font-size:16px;
    text-decoration:none; transition:all .15s; }
  .prc-topback:hover{ background:var(--gold-dim); color:var(--gold); border-color:var(--gold-border); }
  .prc-titlewrap{ flex:1; min-width:0; }
  .prc-title{ font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:20px; font-weight:700; color:#1c2440; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
  .prc-subtitle{ font-size:11.5px; color:#9aa1b3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
  .prc-topright{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .prc-date{ font-size:12px; color:#9aa1b3; display:none; }
  @media (min-width:640px){ .prc-date{ display:block; } }
  .prc-apibadge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase;
    padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
  .prc-apibadge.live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
  .prc-apibadge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:prc-blink 2s infinite; }
  @keyframes prc-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .prc-notif{ width:36px; height:36px; background:#f4f6fb; border:1px solid #eef0f6; border-radius:var(--radius-sm);
    display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; position:relative; color:#6b7280; flex-shrink:0; }
  .prc-notifdot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid #ffffff; }
  .prc-avatar{ width:36px; height:36px; background:rgba(47,111,237,0.12); border:2px solid rgba(47,111,237,0.25); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:600; color:#2f6fed; cursor:pointer; flex-shrink:0; }
  `;

  function injectCss() {
    if (document.getElementById('prc-shell-css')) return;
    const s = document.createElement('style');
    s.id = 'prc-shell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function attach(opts) {
    injectCss();

    const sidebarTarget = document.querySelector(opts.sidebarTarget);
    const topbarTarget  = document.querySelector(opts.topbarTarget);
    const activeFile    = opts.activeFile || '';
    const initials      = (opts.user && opts.user.initials) || 'PO';

    sidebarTarget.innerHTML = `
      <div id="prc-overlay"></div>
      <aside id="prc-sidebar">
        <div class="prc-head">
          <div class="prc-logo">P</div>
          <div class="prc-brand">
            <div class="name">Grace Hotel</div>
            <div class="sub">Procurement</div>
          </div>
          <button class="prc-collapse" id="prc-collapseBtn" title="Toggle sidebar">◀</button>
        </div>
        <a class="prc-back" href="${opts.backHref || '../index.html'}">← <span class="prc-backlabel">Back to Main Suite</span></a>
        <div class="prc-navlabel">Procurement</div>
        <nav class="prc-nav" id="prc-nav">
          ${NAV.map(n => `
            <a class="prc-navitem${n.href === activeFile ? ' active' : ''}" href="${n.href}" data-nav-key="${n.key}">
              <span class="prc-navicon">${n.icon}</span>
              <span class="prc-navtext">${n.label}</span>
              ${n.badgeKey ? `<span class="prc-navbadge" id="prc-badge-${n.badgeKey}"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="prc-footer">
          <button class="prc-themebtn" id="prc-themeBtn">
            <span id="prc-themeIcon">☀️</span>
            <span class="prc-themelabel" id="prc-themeLabel">Light Mode</span>
            <div class="prc-toggle-track" id="prc-toggleTrack"><div class="prc-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="prc-copyright">© 2026 Grace Hotel</div>
      </aside>`;

    topbarTarget.innerHTML = `
      <div id="prc-topbar">
        <button class="prc-hamburger" id="prc-hamburger">☰</button>
        ${opts.backHref && opts.showTopBack ? `<a class="prc-topback" href="${opts.backHref}" title="${opts.backLabel || 'Back'}">←</a>` : ''}
        <div class="prc-titlewrap">
          <div class="prc-title">${opts.pageTitle || 'Procurement'}</div>
          ${opts.pageSubtitle ? `<div class="prc-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="prc-topright">
          ${opts.topbarActionsHtml || ''}
          <div class="prc-date" id="prc-date"></div>
          <div class="prc-apibadge" id="prc-apiBadge"><span class="dot"></span><span id="prc-apiLabel">Live</span></div>
          <div class="prc-notif">🔔<div class="prc-notifdot"></div></div>
          <div class="prc-avatar" id="prc-avatar">${initials}</div>
        </div>
      </div>`;

    document.getElementById('prc-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const sidebar     = document.getElementById('prc-sidebar');
    const overlay     = document.getElementById('prc-overlay');
    const collapseBtn = document.getElementById('prc-collapseBtn');
    const hamburger   = document.getElementById('prc-hamburger');

    let collapsed = false;
    collapseBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      sidebar.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('prc-collapsed', collapsed);
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

    let isDark = false;
    const themeBtn    = document.getElementById('prc-themeBtn');
    const themeIcon   = document.getElementById('prc-themeIcon');
    const themeLabel  = document.getElementById('prc-themeLabel');
    const toggleTrack = document.getElementById('prc-toggleTrack');
    function applyTheme() {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeIcon.textContent  = isDark ? '☀️' : '🌙';
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
        const badge = document.getElementById('prc-apiBadge');
        const label = document.getElementById('prc-apiLabel');
        if (!badge || !label) return;
        label.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        // No nav item currently carries badgeKey:'pending' (Pending
        // Approvals was removed from NAV), so this is a safe no-op —
        // kept so pages that already call shell.setPendingBadge(...)
        // don't need to be touched.
        const el = document.getElementById('prc-badge-pending');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setNotifBadge(n) {
        const dot = document.querySelector('.prc-notifdot');
        if (dot) dot.style.display = n > 0 ? '' : 'none';
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.prc-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.prc-subtitle');
        if (subtitle != null && s) s.textContent = subtitle;
      },
    };
  }

  global.ProcurementShell = { attach };

})(window);