/**
 * aurum-shell.js — Aurum Hotel Reusable Sidebar + Topbar
 * 
 * Rebuilt to match booking-shell.js pattern exactly: fetches session
 * from API when USE_DEMO = false, falls back to demo user otherwise.
 * All pages get session via shell.getUser() for permission checks.
 */
(function () {
  'use strict';

  if (window.__aurumShell) return;
  window.__aurumShell = true;

  // ── CONFIG — live only, no demo fallback ──
  const CONFIG = {
    API_BASE: '',
    LOGIN_URL: 'login.html',
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
      return { name: data.name, initials: data.initials, role: data.role, privilege: data.privilege, department: data.department };
    } catch (err) {
      console.warn('[AurumShell] Session invalid, redirecting to login:', err.message);
      redirectToLogin();
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Default nav — every module now links to its own folder's dashboard
  // page: module/module-dashboard.html. Guest Profiles removed. Icons are
  // Font Awesome 6, matching the style used across all module shells.
  // ══════════════════════════════════════════════════════════════════════
  const DEFAULT_NAV = [
    { label: 'Overview',          href: 'index.html',                                icon: 'fa-solid fa-house' },
    { label: 'Front Desk',        href: 'booking/booking-rooms.html',                icon: 'fa-solid fa-bed' },
    { label: 'Kitchen',           href: 'kitchen/kitchen-dashboard.html',            icon: 'fa-solid fa-kitchen-set' },
    { label: 'Restaurant / Bar',  href: 'restaurant/restaurant-dashboard.html',      icon: 'fa-solid fa-utensils' },
    { label: 'Pool Bar',          href: 'poolbar/poolbar-dashboard.html',            icon: 'fa-solid fa-martini-glass-citrus' },
    { label: 'Gym',               href: 'gym/gym-dashboard.html',                    icon: 'fa-solid fa-dumbbell' },
    { label: 'Store',             href: 'store/store-dashboard.html',                icon: 'fa-solid fa-box' },
    { label: 'Staff Management',  href: 'staff/staff-management.html',               icon: 'fa-solid fa-users' },
    { label: 'Procurement',       href: 'procurement/procurement-dashboard.html',    icon: 'fa-solid fa-truck', badge: 3 },
    { label: 'Accounting',        href: 'accounting/accounting-dashboard.html',      icon: 'fa-solid fa-calculator' },
  ];

  // ══════════════════════════════════════════════════════════════════════
  // CSS — aur- prefixed, scoped, self-contained. Uses Font Awesome 6 icons.
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .aur-sidebar, .aur-topbar { font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; box-sizing:border-box; }
    .aur-sidebar *, .aur-topbar *, .aur-sidebar *::before, .aur-topbar *::before { box-sizing:border-box; }

    .aur-sidebar[data-theme="dark"]{
      --aur-bg:#081540; --aur-sidebar-bg:linear-gradient(180deg,#0a1848 0%,#0c1c58 100%); --aur-surface2:#0e2158; --aur-border:rgba(255,255,255,0.08);
      --aur-text:#ffffff; --aur-text2:#aab0d0; --aur-text3:#8891bd;
      --aur-gold:#2f6fed; --aur-gold-light:#5b8ff9; --aur-gold-dim:rgba(47,111,237,0.12); --aur-gold-border:rgba(47,111,237,0.25);
      --aur-shadow-lg:0 16px 48px rgba(0,0,0,0.6);
    }
    .aur-sidebar[data-theme="light"]{
      --aur-bg:#f4f6fb; --aur-sidebar-bg:#ffffff; --aur-surface2:#f4f6fb; --aur-border:#eef0f6;
      --aur-text:#1c2440; --aur-text2:#6b7280; --aur-text3:#9aa1b3;
      --aur-gold:#2f6fed; --aur-gold-light:#5b8ff9; --aur-gold-dim:rgba(47,111,237,0.12); --aur-gold-border:rgba(47,111,237,0.25);
      --aur-shadow-lg:0 8px 40px rgba(15,34,55,0.10);
    }
    .aur-topbar{
      --aur-bg:#f4f6fb; --aur-surface2:#f4f6fb; --aur-border:#eef0f6;
      --aur-text:#1c2440; --aur-text2:#6b7280; --aur-text3:#9aa1b3;
      --aur-gold:#2f6fed; --aur-gold-dim:rgba(47,111,237,0.12); --aur-gold-border:rgba(47,111,237,0.25);
    }

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
    .aur-logo-mark{ width:36px; height:36px; background:linear-gradient(135deg,var(--aur-gold),var(--aur-gold-light)); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; }
    .aur-logo-text{ margin-left:10px; flex:1; overflow:hidden; }
    .aur-logo-text .aur-name{ font-size:18px; font-weight:700; color:var(--aur-gold); white-space:nowrap; line-height:1.2; }
    .aur-logo-text .aur-sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--aur-text3); margin-top:1px; white-space:nowrap; }
    .aur-collapse-btn{ width:28px; height:28px; background:var(--aur-surface2); border:1px solid var(--aur-border); border-radius:8px; color:var(--aur-text3); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0; transition:all .2s; }
    .aur-collapse-btn:hover{ background:var(--aur-gold-dim); color:var(--aur-gold); border-color:var(--aur-gold-border); }

    .aur-sidebar.aur-collapsed .aur-logo-text,
    .aur-sidebar.aur-collapsed .aur-nav-text,
    .aur-sidebar.aur-collapsed .aur-nav-badge,
    .aur-sidebar.aur-collapsed .aur-theme-label,
    .aur-sidebar.aur-collapsed .aur-toggle-track,
    .aur-sidebar.aur-collapsed .aur-copyright { display:none; }
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
    .aur-icon{ font-size:14px; width:20px; text-align:center; flex-shrink:0; }
    .aur-nav-badge{ margin-left:auto; background:var(--aur-gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; }

    .aur-sb-footer{ padding:12px 10px; border-top:1px solid var(--aur-border); flex-shrink:0; }
    .aur-theme-btn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:10px; background:var(--aur-surface2); border:1px solid var(--aur-border); color:var(--aur-text2); font-size:13px; cursor:pointer; transition:all .2s; }
    .aur-theme-btn:hover{ background:var(--aur-border); color:var(--aur-text); }
    .aur-theme-label{ flex:1; text-align:left; }
    .aur-toggle-track{ width:34px; height:18px; background:var(--aur-border); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
    .aur-toggle-track.aur-on{ background:var(--aur-gold); }
    .aur-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
    .aur-toggle-track.aur-on .aur-toggle-thumb{ transform:translateX(16px); }
    .aur-copyright{ font-size:10.5px; color:var(--aur-text3); padding:0 16px 16px; flex-shrink:0; }

    .aur-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:199; backdrop-filter:blur(2px); }
    .aur-overlay.aur-show{ display:block; }

    .aur-topbar{ position:sticky; top:0; z-index:100; height:62px; background:var(--aur-bg); border-bottom:1px solid var(--aur-border); display:flex; align-items:center; padding:0 24px; gap:12px; color:var(--aur-text); }
    .aur-hamburger{ display:none; background:var(--aur-surface2); border:1px solid var(--aur-border); color:var(--aur-text); width:36px; height:36px; border-radius:10px; align-items:center; justify-content:center; font-size:15px; cursor:pointer; flex-shrink:0; }
    @media (max-width:768px){ .aur-hamburger{ display:flex; } }
    .aur-topbar-title{ font-size:20px; font-weight:800; color:var(--aur-text); flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .aur-topbar-right{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
    .aur-topbar-date{ font-size:12px; color:var(--aur-text3); display:none; font-weight:600; }
    @media (min-width:640px){ .aur-topbar-date{ display:block; } }
    .aur-notif-btn{ width:36px; height:36px; background:var(--aur-surface2); border:1px solid var(--aur-border); border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; position:relative; color:var(--aur-text2); }
    .aur-notif-dot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--aur-gold); border-radius:50%; border:1.5px solid var(--aur-bg); }
    .aur-avatar{ width:36px; height:36px; background:var(--aur-gold-dim); border:2px solid var(--aur-gold-border); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700; color:var(--aur-gold); cursor:pointer; background-size:cover; background-position:center; flex-shrink:0; }
    .aur-api-badge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:3px 8px; border-radius:20px; background:rgba(247,144,9,0.12); color:#f79009; border:1px solid rgba(247,144,9,.2); }
    .aur-api-badge.aur-live{ background:rgba(18,183,106,0.12); color:#12b76a; border-color:rgba(18,183,106,.3); }
    .aur-api-badge .aur-dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:aur-blink 2s infinite; }
    @keyframes aur-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }

    @media print{ .aur-sidebar, .aur-topbar, .aur-overlay{ display:none !important; } }
  `;

  let _stylesInjected = false;
  let _fontAwesomeInjected = false;

  function _injectFontAwesome() {
    if (_fontAwesomeInjected) return;
    if (document.getElementById('aur-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'aur-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
    _fontAwesomeInjected = true;
  }

  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'aur-shell-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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
    _injectFontAwesome();
    _injectStyles();

    const sidebarEl = options.sidebarTarget ? (typeof options.sidebarTarget === 'string' ? document.querySelector(options.sidebarTarget) : options.sidebarTarget) : null;
    const topbarEl  = options.topbarTarget  ? (typeof options.topbarTarget  === 'string' ? document.querySelector(options.topbarTarget)  : options.topbarTarget)  : null;
    if (!sidebarEl && !topbarEl) { console.warn('[AurumShell] No sidebarTarget or topbarTarget found.'); return null; }

    const instId = 'aur' + (++_instanceCounter);
    const navItems = options.navItems || DEFAULT_NAV;

    let activeFile = options.activeFile || _currentFile();
    let pageTitle  = options.pageTitle || (navItems.find(n => n.href === activeFile) || {}).label || 'Dashboard';
    let apiMode    = options.apiMode || 'Demo';
    let user       = Object.assign({ name: 'User', initials: 'US', role: 'staff', privilege: null, avatar: null }, options.user || {});
    let collapsed  = !!options.collapsedByDefault;
    let theme;
    try { theme = options.theme || localStorage.getItem('aurum-theme') || 'dark'; } catch (e) { theme = options.theme || 'dark'; }

    const overlay = _getOverlay();

    function navHtml() {
      return navItems.map(item => `
        <a class="aur-item${item.href === activeFile ? ' aur-active' : ''}" href="${_esc(item.href)}" data-aur-file="${_esc(item.href)}">
          <span class="aur-icon"><i class="${item.icon || 'fa-solid fa-circle'}"></i></span>
          <span class="aur-nav-text">${_esc(item.label)}</span>
          ${item.badge != null ? `<span class="aur-nav-badge">${_esc(item.badge)}</span>` : ''}
        </a>`).join('');
    }

    function renderSidebar() {
      if (!sidebarEl) return;
      sidebarEl.innerHTML = `
        <aside class="aur-sidebar${collapsed ? ' aur-collapsed' : ''}" id="${instId}-sb" data-theme="${theme}">
          <div class="aur-sb-head">
            <div class="aur-logo-mark">G</div>
            <div class="aur-logo-text">
              <div class="aur-name">Grace Hotel</div>
              <div class="aur-sub">Management Suite</div>
            </div>
            <button class="aur-collapse-btn" id="${instId}-collapse" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>
          </div>
          <nav class="aur-nav" id="${instId}-nav">${navHtml()}</nav>
          <div class="aur-sb-footer">
            <button class="aur-theme-btn" id="${instId}-theme">
              <span id="${instId}-themeIcon"><i class="fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i></span>
              <span class="aur-theme-label" id="${instId}-themeLabel">${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              <div class="aur-toggle-track${theme === 'light' ? ' aur-on' : ''}" id="${instId}-toggleTrack"><div class="aur-toggle-thumb"></div></div>
            </button>
          </div>
          <div class="aur-copyright">© 2026 Grace Hotel</div>
        </aside>`;
    }

    function renderTopbar() {
      if (!topbarEl) return;
      const avatarStyle = user.avatar ? ` style="background-image:url('${_esc(user.avatar)}')"` : '';
      const avatarText = user.avatar ? '' : _esc(user.initials || (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
      topbarEl.innerHTML = `
        <div class="aur-topbar" id="${instId}-tb">
          <button class="aur-hamburger" id="${instId}-hamburger"><i class="fa-solid fa-bars"></i></button>
          <div class="aur-topbar-title" id="${instId}-title">${_esc(pageTitle)}</div>
          <div class="aur-topbar-right">
            <div class="aur-topbar-date" id="${instId}-date"></div>
            <div class="aur-api-badge${apiMode === 'Live' ? ' aur-live' : ''}" id="${instId}-apiBadge"><span class="aur-dot"></span><span id="${instId}-apiText">${_esc(apiMode)}</span></div>
            <div class="aur-notif-btn" id="${instId}-notif"><i class="fa-regular fa-bell"></i><div class="aur-notif-dot"></div></div>
            <div class="aur-avatar" id="${instId}-avatar"${avatarStyle}>${avatarText}</div>
          </div>
        </div>`;
      const dateEl = document.getElementById(instId + '-date');
      if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function applyThemeAttr() {
      const sb = document.getElementById(instId + '-sb');
      if (sb) sb.setAttribute('data-theme', theme);
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
      if (btn) btn.innerHTML = collapsed ? '<i class="fa-solid fa-chevron-right"></i>' : '<i class="fa-solid fa-chevron-left"></i>';
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
      if (icon) icon.innerHTML = `<i class="fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`;
      if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
      if (track) track.classList.toggle('aur-on', theme === 'light');
      if (typeof options.onThemeChange === 'function') options.onThemeChange(theme);
      document.dispatchEvent(new CustomEvent('aurum:themechange', { detail: { theme } }));
    }

    renderSidebar();
    renderTopbar();
    applyThemeAttr();
    bindEvents();

    // ── Fetch real session and update avatar ──
    fetchSession().then(sessionUser => {
      if (sessionUser) {
        user = Object.assign({}, user, sessionUser);
        const avatar = document.getElementById(instId + '-avatar');
        if (avatar) {
          const initials = user.initials || (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
          avatar.textContent = user.avatar ? '' : initials;
          if (user.avatar) avatar.style.backgroundImage = `url('${user.avatar}')`;
          avatar.title = user.name || '';
        }
        const badge = document.getElementById(instId + '-apiBadge');
        const text = document.getElementById(instId + '-apiText');
        if (text) text.textContent = 'Live';
        if (badge) badge.classList.add('aur-live');
      }
    });

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
      getUser() { return user; },
      getConfig() { return { ...CONFIG }; },
      destroy() {
        if (sidebarEl) sidebarEl.innerHTML = '';
        if (topbarEl) topbarEl.innerHTML = '';
      },
    };
  }

  window.AurumShell = { attach, DEFAULT_NAV, CONFIG };

})();