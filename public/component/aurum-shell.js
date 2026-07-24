/**
 * aurum-shell.js — Aurum Hotel Reusable Sidebar + Topbar
 * ─────────────────────────────────────────────────────────────────────
 * Built the same way as shiloh-sidebar.js: drop one
 *   <script src="component/aurum-shell.js"></script>
 * near the top of <body>, then call attach() once you have target
 * elements for the sidebar and/or topbar. It is fully self-contained
 * (own scoped CSS variables + fonts + dark/light theme) so it does not
 * depend on any styles already defined on the host page, and every nav
 * link is a real <a href="..."> — no SPA routing, works with ctrl/cmd
 * click, middle-click, "open in new tab", no-JS fallback.
 *
 * It renders the gold/navy Aurum theme (logo, nav with badges, collapse
 * toggle, theme switch) plus the topbar (title, live date, API mode
 * badge, notifications, avatar) and wires up the mobile hamburger /
 * off-canvas drawer automatically.
 *
 * ── USAGE ──────────────────────────────────────────────────────────────
 *   <body>
 *     <div id="sidebarSlot"></div>
 *     <div class="main" id="mainWrap">
 *       <div id="topbarSlot"></div>
 *       <div class="content">...page content...</div>
 *     </div>
 *   </body>
 *   <script src="component/aurum-shell.js"></script>
 *   <script>
 *     const shell = AurumShell.attach({
 *       sidebarTarget: '#sidebarSlot',
 *       topbarTarget:  '#topbarSlot',
 *       activeFile:    'accounting/accounting-dashboard.html', // full relative path
 *       pageTitle:     'Accounting',
 *       apiMode:       'Demo',              // 'Demo' | 'Live'
 *       user:          { name: 'Mary Grace', initials: 'MG', avatar: null },
 *       onLogout:      () => { ... },       // optional
 *       onNotifClick:  () => { ... },       // optional
 *       onNavigate:    (href) => { ... },   // optional, fires just before navigation
 *       onThemeChange: (theme) => { ... },  // optional, fires on toggle ('dark'|'light')
 *     });
 *
 *     shell.setActive('kitchen/kitchen-dashboard.html');
 *     shell.setTitle('Kitchen');
 *     shell.setApiMode('Live');
 *     shell.setUser({ name: 'Front Desk', initials: 'FD' });
 *     shell.toggleTheme();
 *     shell.destroy();
 *
 * ── LAYOUT REQUIREMENT ─────────────────────────────────────────────────
 * The component renders the sidebar and topbar only — your page still
 * owns the main content column. Give your wrapper this CSS (same values
 * the sidebar uses internally) so content sits correctly next to it and
 * responds to the collapse toggle:
 *
 *   .main { margin-left: 256px; min-height: 100vh; transition: margin-left .3s; }
 *   body.aur-sb-collapsed .main { margin-left: 68px; }
 *   @media (max-width: 768px) { .main { margin-left: 0 !important; } }
 *
 * ── DEFAULT NAV — every module folder, same pattern ───────────────────
 *   Overview            → index.html
 *   Booking (Rooms)      → booking/booking-dashboard.html
 *   Kitchen               → kitchen/kitchen-dashboard.html
 *   Restaurant / Bar       → restaurant/restaurant-dashboard.html
 *   Pool Bar                → poolbar/poolbar-dashboard.html
 *   Gym                      → gym/gym-dashboard.html
 *   Store                     → store/store-dashboard.html
 *   Staff Management            → staff.html   (not yet moved into its own folder)
 *   Procurement                  → procurement/procurement-dashboard.html
 *   Accounting                    → accounting/accounting-dashboard.html
 *
 * Guest Profiles has been REMOVED from the nav per request — if it needs
 * to come back later, re-add an item pointing at its own module folder
 * the same way (e.g. guests/guests-dashboard.html).
 *
 * Each module folder is expected to hold its own internal pages
 * (e.g. accounting/accounting-breakdown.html, accounting-reconciliation.html,
 * accounting-reports.html, accounting-transactions.html) driven by that
 * module's own dedicated shell — this file (aurum-shell.js) is only
 * attached on the top-level entry point of each module plus any
 * still-root-level pages (index.html, staff.html), and always links OUT
 * to "module/module-dashboard.html" as the front door for that module.
 *
 * Override wholesale via options.navItems — array of
 *   { label, href, icon, badge? }
 * `icon` is any short string (emoji works great, matches the original
 * design) — pass your own set to swap icons.
 */

(function () {
  'use strict';

  if (window.__aurumShell) return;
  window.__aurumShell = true;

  // ══════════════════════════════════════════════════════════════════════
  // Default nav — every module now links to its own folder's dashboard
  // page: module/module-dashboard.html. Guest Profiles removed.
  // ══════════════════════════════════════════════════════════════════════
  const DEFAULT_NAV = [
    { label: 'Overview',          href: 'index.html',                                icon: '◈' },
    { label: 'Booking (Rooms)',   href: 'booking/booking-dashboard.html',            icon: '🛏' },
    { label: 'Kitchen',           href: 'kitchen/kitchen-dashboard.html',            icon: '👨‍🍳' },
    { label: 'Restaurant / Bar',  href: 'restaurant/restaurant-dashboard.html',      icon: '🍽' },
    { label: 'Pool Bar',          href: 'poolbar/poolbar-dashboard.html',            icon: '🏊' },
    { label: 'Gym',               href: 'gym/gym-dashboard.html',                    icon: '💪' },
    { label: 'Store',             href: 'store/store-dashboard.html',                icon: '🏬' },
    { label: 'Staff Management',  href: 'staff.html',                                icon: '👥' },
    { label: 'Procurement',       href: 'procurement/procurement-dashboard.html',    icon: '📦', badge: 3 },
    { label: 'Accounting',        href: 'accounting/accounting-dashboard.html',      icon: '📊' },
  ];

  // ══════════════════════════════════════════════════════════════════════
  // CSS — aur- prefixed, scoped, self-contained (both themes baked in)
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .aur-sidebar, .aur-topbar { font-family:'Outfit',sans-serif; box-sizing:border-box; }
    .aur-sidebar *, .aur-topbar *, .aur-sidebar *::before, .aur-topbar *::before { box-sizing:border-box; }

    .aur-sidebar[data-theme="dark"]{
      --aur-bg:#080f18; --aur-sidebar-bg:#0a1520; --aur-surface2:#162435; --aur-border:#1e3045;
      --aur-text:#e8f0f8; --aur-text2:#a8bece; --aur-text3:#6a8a9e;
      --aur-gold:#c9a84c; --aur-gold-light:#e8c96a; --aur-gold-dim:rgba(201,168,76,0.12); --aur-gold-border:rgba(201,168,76,0.25);
      --aur-shadow-lg:0 16px 48px rgba(0,0,0,0.6);
    }
    .aur-sidebar[data-theme="light"]{
      --aur-bg:#eef2f7; --aur-sidebar-bg:#ffffff; --aur-surface2:#f4f7fb; --aur-border:#dce4ef;
      --aur-text:#0f2237; --aur-text2:#4a6580; --aur-text3:#8aa0b8;
      --aur-gold:#c9a84c; --aur-gold-light:#e8c96a; --aur-gold-dim:rgba(201,168,76,0.12); --aur-gold-border:rgba(201,168,76,0.25);
      --aur-shadow-lg:0 8px 40px rgba(15,34,55,0.10);
    }
    .aur-topbar[data-theme="dark"]{
      --aur-bg:#080f18; --aur-surface2:#162435; --aur-border:#1e3045;
      --aur-text:#e8f0f8; --aur-text2:#a8bece; --aur-text3:#6a8a9e;
      --aur-gold:#c9a84c; --aur-gold-dim:rgba(201,168,76,0.12); --aur-gold-border:rgba(201,168,76,0.25);
    }
    .aur-topbar[data-theme="light"]{
      --aur-bg:#eef2f7; --aur-surface2:#f4f7fb; --aur-border:#dce4ef;
      --aur-text:#0f2237; --aur-text2:#4a6580; --aur-text3:#8aa0b8;
      --aur-gold:#c9a84c; --aur-gold-dim:rgba(201,168,76,0.12); --aur-gold-border:rgba(201,168,76,0.25);
    }

    /* ── Sidebar ── */
    .aur-sidebar{
      position:fixed; top:0; left:0; height:100%; width:256px;
      background:var(--aur-sidebar-bg); border-right:1px solid var(--aur-border);
      display:flex; flex-direction:column; z-index:200; overflow:hidden; flex-shrink:0;
      transition:width .3s cubic-bezier(.4,0,.2,1), transform .3s cubic-bezier(.4,0,.2,1);
    }
    .aur-sidebar.aur-collapsed{ width:68px; }
    @media (max-width:768px){
      .aur-sidebar{ transform:translateX(-100%); width:256px !important; box-shadow:var(--aur-shadow-lg); }
      .aur-sidebar.aur-open{ transform:translateX(0); }
      .aur-sidebar.aur-collapsed{ width:256px !important; }
    }

    .aur-sb-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 18px 20px; border-bottom:1px solid var(--aur-border); flex-shrink:0; }
    .aur-logo-mark{ width:36px; height:36px; background:linear-gradient(135deg,var(--aur-gold),var(--aur-gold-light)); border-radius:10px; display:flex; align-items:center; justify-content:center; font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:700; color:#000; flex-shrink:0; }
    .aur-logo-text{ margin-left:10px; flex:1; overflow:hidden; }
    .aur-logo-text .aur-name{ font-family:'Cormorant Garamond',serif; font-size:18px; font-weight:700; color:var(--aur-gold); white-space:nowrap; line-height:1.2; }
    .aur-logo-text .aur-sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--aur-text3); margin-top:1px; white-space:nowrap; }
    .aur-collapse-btn{ width:28px; height:28px; background:var(--aur-surface2); border:1px solid var(--aur-border); border-radius:8px; color:var(--aur-text3); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
    .aur-collapse-btn:hover{ background:var(--aur-gold-dim); color:var(--aur-gold); border-color:var(--aur-gold-border); }

    .aur-sidebar.aur-collapsed .aur-logo-text,
    .aur-sidebar.aur-collapsed .aur-nav-text,
    .aur-sidebar.aur-collapsed .aur-nav-badge,
    .aur-sidebar.aur-collapsed .aur-theme-label,
    .aur-sidebar.aur-collapsed .aur-toggle-track { display:none; }
    .aur-sidebar.aur-collapsed .aur-sb-head{ justify-content:center; padding:22px 0 20px; flex-direction:column; gap:10px; }
    .aur-sidebar.aur-collapsed .aur-item{ justify-content:center; padding:12px 0; gap:0; }
    .aur-sidebar.aur-collapsed .aur-nav{ padding:8px 8px; }
    .aur-sidebar.aur-collapsed .aur-sb-footer{ padding:12px 8px; }
    .aur-sidebar.aur-collapsed .aur-theme-btn{ justify-content:center; padding:10px; }

    .aur-nav{ flex:1; overflow-y:auto; padding:8px 10px; }
    .aur-nav::-webkit-scrollbar{ width:3px; }
    .aur-nav::-webkit-scrollbar-thumb{ background:var(--aur-border); border-radius:3px; }
    .aur-item{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; color:var(--aur-text2); font-size:13.5px; font-weight:400; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
    .aur-item:hover{ background:var(--aur-surface2); color:var(--aur-text); }
    .aur-item.aur-active{ background:var(--aur-gold-dim); border-color:var(--aur-gold-border); color:var(--aur-gold-light); font-weight:500; }
    .aur-item.aur-active .aur-icon{ color:var(--aur-gold); }
    .aur-icon{ font-size:16px; width:20px; text-align:center; flex-shrink:0; }
    .aur-nav-badge{ margin-left:auto; background:var(--aur-gold); color:#000; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; }

    .aur-sb-footer{ padding:12px 10px; border-top:1px solid var(--aur-border); flex-shrink:0; }
    .aur-theme-btn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:10px; background:var(--aur-surface2); border:1px solid var(--aur-border); color:var(--aur-text2); font-family:'Outfit',sans-serif; font-size:13px; cursor:pointer; transition:all .2s; }
    .aur-theme-btn:hover{ background:var(--aur-border); color:var(--aur-text); }
    .aur-theme-label{ flex:1; text-align:left; }
    .aur-toggle-track{ width:34px; height:18px; background:var(--aur-border); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
    .aur-toggle-track.aur-on{ background:var(--aur-gold); }
    .aur-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
    .aur-toggle-track.aur-on .aur-toggle-thumb{ transform:translateX(16px); }

    /* ── Overlay (mobile drawer backdrop) ── */
    .aur-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
    .aur-overlay.aur-show{ display:block; }

    /* ── Topbar ── */
    .aur-topbar{ position:sticky; top:0; z-index:100; height:62px; background:var(--aur-bg); border-bottom:1px solid var(--aur-border); display:flex; align-items:center; padding:0 24px; gap:12px; }
    .aur-hamburger{ display:none; background:var(--aur-surface2); border:1px solid var(--aur-border); color:var(--aur-text); width:36px; height:36px; border-radius:10px; align-items:center; justify-content:center; font-size:16px; cursor:pointer; flex-shrink:0; }
    @media (max-width:768px){ .aur-hamburger{ display:flex; } }
    .aur-topbar-title{ font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:700; color:var(--aur-text); flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .aur-topbar-right{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
    .aur-topbar-date{ font-size:12px; color:var(--aur-text3); display:none; }
    @media (min-width:640px){ .aur-topbar-date{ display:block; } }
    .aur-notif-btn{ width:36px; height:36px; background:var(--aur-surface2); border:1px solid var(--aur-border); border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; position:relative; color:var(--aur-text2); }
    .aur-notif-dot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--aur-gold); border-radius:50%; border:1.5px solid var(--aur-bg); }
    .aur-avatar{ width:36px; height:36px; background:var(--aur-gold-dim); border:2px solid var(--aur-gold-border); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:var(--aur-gold); cursor:pointer; background-size:cover; background-position:center; flex-shrink:0; }
    .aur-api-badge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; padding:3px 8px; border-radius:20px; background:rgba(251,191,36,0.12); color:#fbbf24; border:1px solid rgba(251,191,36,0.2); }
    .aur-api-badge.aur-live{ background:rgba(74,222,128,0.12); color:#4ade80; border-color:rgba(74,222,128,0.2); }
    .aur-api-badge .aur-dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:aur-blink 2s infinite; }
    @keyframes aur-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }

    @media print{ .aur-sidebar, .aur-topbar, .aur-overlay{ display:none !important; } }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'aur-shell-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _injectFonts() {
    if (document.getElementById('aur-shell-fonts')) return;
    const link = document.createElement('link');
    link.id = 'aur-shell-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Best-effort auto-detect for pages that don't pass activeFile explicitly.
  // Since every module now lives in its own folder (module/module-dashboard.html),
  // this reconstructs "folder/file.html" from the current location so it can
  // still match a DEFAULT_NAV href — but pages inside a module folder should
  // pass activeFile explicitly rather than relying on this.
  function _currentFile() {
    const parts = location.pathname.split('/').filter(Boolean);
    const file = parts.pop() || 'index.html';
    const folder = parts.pop();
    return folder ? `${folder}/${file}` : file;
  }

  let _instanceCounter = 0;
  let _overlayEl = null;

  function _getOverlay() {
    if (_overlayEl) return _overlayEl;
    _overlayEl = document.createElement('div');
    _overlayEl.className = 'aur-overlay';
    _overlayEl.id = 'aur-shell-overlay';
    document.body.appendChild(_overlayEl);
    return _overlayEl;
  }

  function attach(options) {
    options = options || {};
    _injectFonts();
    _injectStyles();

    const sidebarEl = options.sidebarTarget ? (typeof options.sidebarTarget === 'string' ? document.querySelector(options.sidebarTarget) : options.sidebarTarget) : null;
    const topbarEl  = options.topbarTarget  ? (typeof options.topbarTarget  === 'string' ? document.querySelector(options.topbarTarget)  : options.topbarTarget)  : null;
    if (!sidebarEl && !topbarEl) { console.warn('[AurumShell] No sidebarTarget or topbarTarget found.'); return null; }

    const instId = 'aur' + (++_instanceCounter);
    const navItems = options.navItems || DEFAULT_NAV;

    // activeFile now matches against the item's full href (e.g.
    // 'restaurant/restaurant-dashboard.html'), not just the bare filename,
    // since Restaurant and Pool Bar moved into their own folders. Pages
    // should pass activeFile explicitly (e.g. activeFile: 'kitchen.html')
    // rather than relying on auto-detection when nested paths are involved.
    let activeFile = options.activeFile || _currentFile();
    let pageTitle  = options.pageTitle || (navItems.find(n => n.href === activeFile) || {}).label || 'Dashboard';
    let apiMode    = options.apiMode || 'Demo';
    let user       = Object.assign({ name: 'User', initials: '', avatar: null }, options.user || {});
    let collapsed  = !!options.collapsedByDefault;
    let theme;
    try { theme = options.theme || localStorage.getItem('aurum-theme') || 'dark'; } catch (e) { theme = options.theme || 'dark'; }

    const overlay = _getOverlay();

    function navHtml() {
      return navItems.map(item => `
        <a class="aur-item${item.href === activeFile ? ' aur-active' : ''}" href="${_esc(item.href)}" data-aur-file="${_esc(item.href)}">
          <span class="aur-icon">${item.icon || '•'}</span>
          <span class="aur-nav-text">${_esc(item.label)}</span>
          ${item.badge != null ? `<span class="aur-nav-badge">${_esc(item.badge)}</span>` : ''}
        </a>`).join('');
    }

    function renderSidebar() {
      if (!sidebarEl) return;
      sidebarEl.innerHTML = `
        <aside class="aur-sidebar${collapsed ? ' aur-collapsed' : ''}" id="${instId}-sb" data-theme="${theme}">
          <div class="aur-sb-head">
            <div class="aur-logo-mark">A</div>
            <div class="aur-logo-text">
              <div class="aur-name">Aurum Hotel</div>
              <div class="aur-sub">Management Suite</div>
            </div>
            <button class="aur-collapse-btn" id="${instId}-collapse" title="Toggle sidebar">◀</button>
          </div>
          <nav class="aur-nav" id="${instId}-nav">${navHtml()}</nav>
          <div class="aur-sb-footer">
            <button class="aur-theme-btn" id="${instId}-theme">
              <span id="${instId}-themeIcon">${theme === 'dark' ? '☀️' : '🌙'}</span>
              <span class="aur-theme-label" id="${instId}-themeLabel">${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              <div class="aur-toggle-track${theme === 'light' ? ' aur-on' : ''}" id="${instId}-toggleTrack"><div class="aur-toggle-thumb"></div></div>
            </button>
          </div>
        </aside>`;
    }

    function renderTopbar() {
      if (!topbarEl) return;
      const avatarStyle = user.avatar ? ` style="background-image:url('${_esc(user.avatar)}')"` : '';
      const avatarText = user.avatar ? '' : _esc(user.initials || (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
      topbarEl.innerHTML = `
        <div class="aur-topbar" id="${instId}-tb" data-theme="${theme}">
          <button class="aur-hamburger" id="${instId}-hamburger">☰</button>
          <div class="aur-topbar-title" id="${instId}-title">${_esc(pageTitle)}</div>
          <div class="aur-topbar-right">
            <div class="aur-topbar-date" id="${instId}-date"></div>
            <div class="aur-api-badge${apiMode === 'Live' ? ' aur-live' : ''}" id="${instId}-apiBadge"><span class="aur-dot"></span><span id="${instId}-apiText">${_esc(apiMode)}</span></div>
            <div class="aur-notif-btn" id="${instId}-notif">🔔<div class="aur-notif-dot"></div></div>
            <div class="aur-avatar" id="${instId}-avatar"${avatarStyle}>${avatarText}</div>
          </div>
        </div>`;
      const dateEl = document.getElementById(instId + '-date');
      if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function applyThemeAttr() {
      const sb = document.getElementById(instId + '-sb');
      const tb = document.getElementById(instId + '-tb');
      if (sb) sb.setAttribute('data-theme', theme);
      if (tb) tb.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }

    function bindEvents() {
      const navEl = document.getElementById(instId + '-nav');
      if (navEl && typeof options.onNavigate === 'function') {
        navEl.querySelectorAll('.aur-item').forEach(a => a.addEventListener('click', () => options.onNavigate(a.dataset.aurFile)));
      }
      const collapseBtn = document.getElementById(instId + '-collapse');
      if (collapseBtn) collapseBtn.addEventListener('click', toggleCollapse);

      const themeBtn = document.getElementById(instId + '-theme');
      if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

      const hamburger = document.getElementById(instId + '-hamburger');
      if (hamburger) hamburger.addEventListener('click', openSidebar);

      overlay.addEventListener('click', closeSidebar);

      const notif = document.getElementById(instId + '-notif');
      if (notif && typeof options.onNotifClick === 'function') notif.addEventListener('click', options.onNotifClick);

      const avatar = document.getElementById(instId + '-avatar');
      if (avatar && typeof options.onUserClick === 'function') avatar.addEventListener('click', options.onUserClick);
    }

    function toggleCollapse() {
      collapsed = !collapsed;
      const sb = document.getElementById(instId + '-sb');
      if (sb) sb.classList.toggle('aur-collapsed', collapsed);
      document.body.classList.toggle('aur-sb-collapsed', collapsed);
      const btn = document.getElementById(instId + '-collapse');
      if (btn) btn.textContent = collapsed ? '▶' : '◀';
    }

    function openSidebar() {
      const sb = document.getElementById(instId + '-sb');
      if (sb) sb.classList.add('aur-open');
      overlay.classList.add('aur-show');
      document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
      const sb = document.getElementById(instId + '-sb');
      if (sb) sb.classList.remove('aur-open');
      overlay.classList.remove('aur-show');
      document.body.style.overflow = '';
    }

    function toggleTheme() { setTheme(theme === 'dark' ? 'light' : 'dark'); }
    function setTheme(t) {
      theme = t === 'light' ? 'light' : 'dark';
      try { localStorage.setItem('aurum-theme', theme); } catch (e) {}
      applyThemeAttr();
      const icon = document.getElementById(instId + '-themeIcon');
      const label = document.getElementById(instId + '-themeLabel');
      const track = document.getElementById(instId + '-toggleTrack');
      if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
      if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
      if (track) track.classList.toggle('aur-on', theme === 'light');
      if (typeof options.onThemeChange === 'function') options.onThemeChange(theme);
      document.dispatchEvent(new CustomEvent('aurum:themechange', { detail: { theme } }));
    }

    renderSidebar();
    renderTopbar();
    applyThemeAttr();
    bindEvents();

    return {
      setActive(file) {
        activeFile = file;
        const navEl = document.getElementById(instId + '-nav');
        navEl?.querySelectorAll('.aur-item').forEach(a => a.classList.toggle('aur-active', a.dataset.aurFile === file));
      },
      setTitle(title) { pageTitle = title; const t = document.getElementById(instId + '-title'); if (t) t.textContent = title; },
      setApiMode(mode) {
        apiMode = mode;
        const badge = document.getElementById(instId + '-apiBadge');
        const text  = document.getElementById(instId + '-apiText');
        if (text) text.textContent = mode;
        if (badge) badge.classList.toggle('aur-live', mode === 'Live');
      },
      setUser(u) { user = Object.assign({}, user, u || {}); renderTopbar(); bindEvents(); },
      toggleTheme,
      setTheme,
      getTheme() { return theme; },
      openSidebar,
      closeSidebar,
      toggleCollapse,
      isCollapsed() { return collapsed; },
      destroy() {
        if (sidebarEl) sidebarEl.innerHTML = '';
        if (topbarEl) topbarEl.innerHTML = '';
      },
    };
  }

  window.AurumShell = { attach, DEFAULT_NAV };

})();