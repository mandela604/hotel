/**
 * store-shell.js — Grace Hotel HMS Reusable Store-Module Sidebar + Topbar
 * ─────────────────────────────────────────────────────────────────────
 * Built the same way as aurum-shell.js: drop one
 *   <script src="store-shell.js"></script>
 * near the top of <body>, then call attach() once you have target
 * elements for the sidebar and/or topbar. It is fully self-contained
 * (own scoped CSS variables + fonts + dark/light theme, "gss-" prefixed
 * classes) so it does not depend on any styles already defined on the
 * host page, and every nav link is a real <a href="..."> — no SPA
 * routing, works with ctrl/cmd click, middle-click, "open in new tab",
 * no-JS fallback.
 *
 * This is the ONE place that defines the Store module's nav (Dashboard,
 * Store, Stock, Requisition). Change it here and every page that calls
 * attach() picks it up — that's the whole point of pulling this out of
 * dashboard.html / stock.html / all-requisitions.html / store-approval.html
 * / new-request.html, which previously each hardcoded their own copy.
 *
 * "Back to Main Suite" sits right under the brand, above the nav — same
 * spot and wording as kitchen-shell.js / gym-shell.js — and points to
 * "../index.html": Store pages live one level down in their own store/
 * folder, so the link has to climb back out to the real Hotel Suite
 * index.html rather than a bare "index.html" (which would resolve to a
 * non-existent file inside store/ itself).
 *
 * ── USAGE ──────────────────────────────────────────────────────────────
 *   <div class="overlay-anchor"></div>  <!-- not required, shell makes its own overlay -->
 *   <div class="app">
 *     <div id="sidebarSlot"></div>
 *     <div class="main" id="mainWrap">
 *       <div id="topbarSlot"></div>
 *       <div class="content">...page content...</div>
 *     </div>
 *   </div>
 *   <script src="store-shell.js"></script>
 *   <script>
 *     const shell = GraceStoreShell.attach({
 *       sidebarTarget:  '#sidebarSlot',
 *       topbarTarget:   '#topbarSlot',
 *       activeFile:     'dashboard.html',        // omit to auto-detect from location.pathname
 *       pageTitle:      'Store Dashboard',
 *       pageSubtitle:   'Central Store operations overview',
 *       apiMode:        'Demo',                  // 'Demo' | 'Live'
 *       pendingBadge:   3,                       // number shown on the Requisition nav item
 *       topbarActionsHtml: '<button class="btn-primary" onclick="openBookingModal()">＋ New Requisition</button>',
 *       onNavigate:     (href) => { ... },       // optional, fires just before navigation
 *       onThemeChange:  (theme) => { ... },      // optional, fires on toggle ('dark'|'light')
 *     });
 *
 *     shell.setActive('stock.html');
 *     shell.setTitle('Stock', 'Central Store inventory');
 *     shell.setApiMode('Live');
 *     shell.setPendingBadge(5);
 *     shell.toggleTheme();
 *     shell.destroy();
 *
 * ── LAYOUT REQUIREMENT ─────────────────────────────────────────────────
 * The component renders the sidebar and topbar only — your page still
 * owns everything else (the .app flex wrapper, .main column, .content
 * scroll area). This matches how the Store pages were already built
 * (a plain flex row, NOT a fixed sidebar + margin-left offset like the
 * Booking module's aurum-shell.js), so your page CSS just needs:
 *
 *   .app  { display:flex; height:100vh; overflow:hidden; }
 *   .main { flex:1; display:flex; flex-direction:column; min-width:0; height:100%; overflow:hidden; }
 *   .content { flex:1; overflow-y:auto; overflow-x:hidden; }
 *
 * The sidebar sizes itself (220px desktop / off-canvas drawer on mobile)
 * and the topbar is a normal flex child at the top of .main — no special
 * margin math required.
 *
 * Once a page adopts this component, delete that page's own hardcoded
 * .sidebar / .nav-item / .brand / .topbar markup and CSS — they're
 * fully replaced by what this script renders into sidebarTarget /
 * topbarTarget.
 *
 * ── DEFAULT NAV ────────────────────────────────────────────────────────
 *   Dashboard (dashboard.html), Store (store-approval.html),
 *   Stock (stock.html), Requisition (all-requisitions.html, badge)
 *
 * Override wholesale via options.navItems — array of
 *   { label, href, icon, badge? }
 */

(function () {
  'use strict';

  if (window.__graceStoreShell) return;
  window.__graceStoreShell = true;

  // ══════════════════════════════════════════════════════════════════════
  // Default nav — the single source of truth for the Store module
  // ══════════════════════════════════════════════════════════════════════
  const DEFAULT_NAV = [
    { label: 'Dashboard',   href: 'dashboard.html',         icon: '⌂' },
    { label: 'Store',       href: 'store-approval.html',    icon: '🏬' },
    { label: 'Stock',       href: 'stock.html',             icon: '📦' },
    { label: 'Requisition', href: 'all-requisitions.html',  icon: '📋', badge: 0 },
  ];

  // ══════════════════════════════════════════════════════════════════════
  // CSS — gss- prefixed, scoped, self-contained (both themes baked in)
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .gss-sidebar, .gss-topbar { font-family:'Outfit',sans-serif; box-sizing:border-box; }
    .gss-sidebar *, .gss-topbar *, .gss-sidebar *::before, .gss-topbar *::before { box-sizing:border-box; }

    .gss-sidebar[data-theme="dark"], .gss-topbar[data-theme="dark"]{
      --gss-bg:#080f18; --gss-navy:#0a1520; --gss-white:#111e2b; --gss-surface2:#162435; --gss-border:#1e3045;
      --gss-text:#e8f0f8; --gss-text2:#a8bece; --gss-text3:#6a8a9e;
      --gss-gold:#c9a84c; --gss-gold-light:#e8c96a; --gss-gold-dim:rgba(201,168,76,0.12); --gss-gold-border:rgba(201,168,76,0.25);
      --gss-amber:#fbbf24; --gss-amber-bg:rgba(251,191,36,0.12);
      --gss-green:#4ade80; --gss-green-bg:rgba(74,222,128,0.12);
      --gss-shadow-lg:0 16px 48px rgba(0,0,0,0.6);
    }
    .gss-sidebar[data-theme="light"], .gss-topbar[data-theme="light"]{
      --gss-bg:#eef2f7; --gss-navy:#ffffff; --gss-white:#ffffff; --gss-surface2:#f4f7fb; --gss-border:#dce4ef;
      --gss-text:#0f2237; --gss-text2:#4a6580; --gss-text3:#8aa0b8;
      --gss-gold:#c9a84c; --gss-gold-light:#e8c96a; --gss-gold-dim:rgba(201,168,76,0.12); --gss-gold-border:rgba(201,168,76,0.25);
      --gss-amber:#d97706; --gss-amber-bg:rgba(217,119,6,0.12);
      --gss-green:#16a34a; --gss-green-bg:rgba(22,163,74,0.12);
      --gss-shadow-lg:0 8px 40px rgba(15,34,55,0.10);
    }

    /* ── Sidebar (plain flex child on desktop, off-canvas drawer on mobile — matches the original Store pages) ── */
    .gss-sidebar{
      width:220px; background:var(--gss-navy); color:var(--gss-text2);
      display:flex; flex-direction:column; flex-shrink:0;
      border-right:1px solid var(--gss-border); height:100%; overflow:hidden; z-index:200;
      transition: transform .3s cubic-bezier(.4,0,.2,1), background .25s;
    }
    @media (max-width:860px){
      .gss-sidebar{ position:fixed; top:0; left:0; width:230px; transform:translateX(-100%); box-shadow:var(--gss-shadow-lg); }
      .gss-sidebar.gss-open{ transform:translateX(0); }
    }

    .gss-brand{ display:flex; align-items:center; gap:10px; padding:20px 18px; border-bottom:1px solid var(--gss-border); flex-shrink:0; }
    .gss-brand-icon{ width:28px; height:28px; background:linear-gradient(135deg,var(--gss-gold),var(--gss-gold-light)); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
    .gss-brand-name{ font-family:'Cormorant Garamond',serif; font-weight:700; font-size:15px; color:var(--gss-gold); letter-spacing:.3px; }

    .gss-back-link{ display:flex; align-items:center; gap:6px; padding:10px 18px; font-size:11.5px; color:var(--gss-text3); text-decoration:none; border-bottom:1px solid var(--gss-border); transition:color .15s; flex-shrink:0; }
    .gss-back-link:hover{ color:var(--gss-gold); }

    .gss-nav-section-label{ font-size:10px; color:var(--gss-text3); letter-spacing:2px; text-transform:uppercase; padding:16px 18px 6px; flex-shrink:0; }
    .gss-nav{ flex:1; overflow:hidden; padding-bottom:10px; min-height:0; }
    .gss-item{ display:flex; align-items:center; gap:10px; padding:11px 18px; font-size:13.5px; color:var(--gss-text2); cursor:pointer; text-decoration:none; }
    .gss-item:hover{ background:var(--gss-surface2); color:var(--gss-text); }
    .gss-item.gss-active{ background:var(--gss-gold-dim); color:var(--gss-gold-light); font-weight:600; border-left:2px solid var(--gss-gold); }
    .gss-icon{ width:16px; text-align:center; opacity:.9; font-size:13px; flex-shrink:0; }
    .gss-nav-badge{ margin-left:auto; background:var(--gss-gold); color:#0a1520; font-size:10px; font-weight:700; padding:1px 7px; border-radius:20px; }
    .gss-nav-badge.gss-hide{ display:none; }

    .gss-store-box{ margin:12px; padding:12px; background:var(--gss-surface2); border:1px solid var(--gss-border); border-radius:8px; flex-shrink:0; }
    .gss-store-label{ font-size:10px; color:var(--gss-text3); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px; }
    .gss-store-name{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--gss-text); font-weight:600; }

    .gss-theme-btn{ display:flex; align-items:center; gap:10px; width:calc(100% - 24px); margin:0 12px 12px; padding:9px 12px; border-radius:8px; background:var(--gss-surface2); border:1px solid var(--gss-border); color:var(--gss-text2); font-family:'Outfit',sans-serif; font-size:12.5px; cursor:pointer; }
    .gss-theme-btn:hover{ color:var(--gss-text); }
    .gss-theme-label{ flex:1; text-align:left; }
    .gss-toggle-track{ width:32px; height:17px; background:var(--gss-border); border-radius:20px; position:relative; flex-shrink:0; transition:background .25s; }
    .gss-toggle-track.gss-on{ background:var(--gss-gold); }
    .gss-toggle-thumb{ position:absolute; top:2px; left:2px; width:13px; height:13px; background:#fff; border-radius:50%; transition:transform .25s; }
    .gss-toggle-track.gss-on .gss-toggle-thumb{ transform:translateX(15px); }

    .gss-copyright{ font-size:11px; color:var(--gss-text3); padding:0 18px 16px; flex-shrink:0; }

    /* ── Overlay (mobile drawer backdrop) ── */
    .gss-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:199; }
    .gss-overlay.gss-show{ display:block; }

    /* ── Topbar ── */
    .gss-topbar{ display:flex; align-items:center; justify-content:space-between; padding:14px 24px; background:var(--gss-bg); border-bottom:1px solid var(--gss-border); flex-shrink:0; gap:12px; flex-wrap:wrap; }
    @media (max-width:640px){ .gss-topbar{ padding:12px 14px; } }
    .gss-topbar-left{ display:flex; align-items:center; gap:14px; min-width:0; }
    .gss-hamburger{ display:none; font-size:16px; color:var(--gss-text2); cursor:pointer; background:var(--gss-white); border:1px solid var(--gss-border); width:34px; height:34px; border-radius:8px; align-items:center; justify-content:center; flex-shrink:0; }
    @media (max-width:860px){ .gss-hamburger{ display:flex; } }
    .gss-title-wrap{ min-width:0; }
    .gss-page-title{ font-family:'Cormorant Garamond',serif; font-size:19px; font-weight:700; color:var(--gss-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gss-page-subtitle{ font-size:11.5px; color:var(--gss-text3); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    @media (max-width:480px){ .gss-page-subtitle, .gss-topbar-date{ display:none; } }
    .gss-topbar-right{ display:flex; align-items:center; gap:10px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }
    .gss-topbar-date{ font-size:11.5px; color:var(--gss-text3); white-space:nowrap; }
    .gss-api-badge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; padding:3px 8px; border-radius:20px; background:var(--gss-amber-bg); color:var(--gss-amber); border:1px solid var(--gss-amber-bg); white-space:nowrap; }
    .gss-api-badge.gss-live{ background:var(--gss-green-bg); color:var(--gss-green); border-color:var(--gss-green-bg); }
    .gss-api-badge .gss-dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:gss-blink 2s infinite; }
    @keyframes gss-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
    .gss-topbar-actions{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

    @media print{ .gss-sidebar, .gss-topbar, .gss-overlay{ display:none !important; } }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'gss-shell-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _injectFonts() {
    if (document.getElementById('gss-shell-fonts')) return;
    const link = document.createElement('link');
    link.id = 'gss-shell-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _currentFile() { const p = location.pathname.split('/').pop(); return p || 'dashboard.html'; }

  let _instanceCounter = 0;
  let _overlayEl = null;

  function _getOverlay() {
    if (_overlayEl) return _overlayEl;
    _overlayEl = document.createElement('div');
    _overlayEl.className = 'gss-overlay';
    _overlayEl.id = 'gss-shell-overlay';
    document.body.appendChild(_overlayEl);
    return _overlayEl;
  }

  function attach(options) {
    options = options || {};
    _injectFonts();
    _injectStyles();

    const sidebarEl = options.sidebarTarget ? (typeof options.sidebarTarget === 'string' ? document.querySelector(options.sidebarTarget) : options.sidebarTarget) : null;
    const topbarEl  = options.topbarTarget  ? (typeof options.topbarTarget  === 'string' ? document.querySelector(options.topbarTarget)  : options.topbarTarget)  : null;
    if (!sidebarEl && !topbarEl) { console.warn('[GraceStoreShell] No sidebarTarget or topbarTarget found.'); return null; }

    const instId = 'gss' + (++_instanceCounter);
    const navItems = options.navItems || DEFAULT_NAV;

    let activeFile    = options.activeFile || _currentFile();
    let pageTitle      = options.pageTitle || (navItems.find(n => n.href === activeFile) || {}).label || 'Store';
    let pageSubtitle   = options.pageSubtitle || '';
    let apiMode        = options.apiMode || 'Demo';
    let pendingBadge   = options.pendingBadge != null ? options.pendingBadge : null;
    let brandName      = options.brandName || 'GRACE HOTEL HMS';
    let brandIcon      = options.brandIcon || '🏛️';
    let storeName      = options.storeName || 'Central Store';
    let storeIcon      = options.storeIcon || '🏬';
    let backHref       = options.backHref || '../index.html';
    let topbarActionsHtml = options.topbarActionsHtml || '';
    let theme;
    try { theme = options.theme || localStorage.getItem('gh-store-theme') || 'dark'; } catch (e) { theme = options.theme || 'dark'; }

    const overlay = _getOverlay();

    function navHtml() {
      return navItems.map(item => {
        let badgeVal = item.badge;
        if (item.href === 'all-requisitions.html' && pendingBadge != null) badgeVal = pendingBadge;
        const showBadge = badgeVal != null;
        return `
        <a class="gss-item${item.href === activeFile ? ' gss-active' : ''}" href="${_esc(item.href)}" data-gss-file="${_esc(item.href)}">
          <span class="gss-icon">${item.icon || '•'}</span>
          <span class="gss-nav-text">${_esc(item.label)}</span>
          <span class="gss-nav-badge${showBadge ? '' : ' gss-hide'}" data-gss-badge="${_esc(item.href)}">${showBadge ? _esc(badgeVal) : ''}</span>
        </a>`;
      }).join('');
    }

    function renderSidebar() {
      if (!sidebarEl) return;
      sidebarEl.innerHTML = `
        <aside class="gss-sidebar" id="${instId}-sb" data-theme="${theme}">
          <div class="gss-brand">
            <div class="gss-brand-icon">${brandIcon}</div>
            <div class="gss-brand-name">${_esc(brandName)}</div>
          </div>
          <a class="gss-back-link" href="${_esc(backHref)}">← Back to Main Suite</a>
          <div class="gss-nav-section-label">STORE MODULE</div>
          <nav class="gss-nav" id="${instId}-nav">${navHtml()}</nav>
          <div class="gss-store-box">
            <div class="gss-store-label">STORE</div>
            <div class="gss-store-name">${storeIcon} ${_esc(storeName)}</div>
          </div>
          <button class="gss-theme-btn" id="${instId}-theme">
            <span id="${instId}-themeIcon">${theme === 'dark' ? '☀️' : '🌙'}</span>
            <span class="gss-theme-label" id="${instId}-themeLabel">${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            <div class="gss-toggle-track${theme === 'light' ? ' gss-on' : ''}" id="${instId}-toggleTrack"><div class="gss-toggle-thumb"></div></div>
          </button>
          <div class="gss-copyright">© 2025 Grace Hotel HMS</div>
        </aside>`;
    }

    function renderTopbar() {
      if (!topbarEl) return;
      topbarEl.innerHTML = `
        <div class="gss-topbar" id="${instId}-tb" data-theme="${theme}">
          <div class="gss-topbar-left">
            <span class="gss-hamburger" id="${instId}-hamburger">☰</span>
            <div class="gss-title-wrap">
              <div class="gss-page-title" id="${instId}-title">${_esc(pageTitle)}</div>
              <div class="gss-page-subtitle" id="${instId}-subtitle">${_esc(pageSubtitle)}</div>
            </div>
          </div>
          <div class="gss-topbar-right">
            <span class="gss-topbar-date" id="${instId}-date"></span>
            <div class="gss-api-badge${apiMode === 'Live' ? ' gss-live' : ''}" id="${instId}-apiBadge"><span class="gss-dot"></span><span id="${instId}-apiText">${_esc(apiMode)}</span></div>
            <div class="gss-topbar-actions" id="${instId}-actions">${topbarActionsHtml}</div>
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
    }

    function bindEvents() {
      const navEl = document.getElementById(instId + '-nav');
      if (navEl && typeof options.onNavigate === 'function') {
        navEl.querySelectorAll('.gss-item').forEach(a => a.addEventListener('click', () => options.onNavigate(a.dataset.gssFile)));
      }
      const themeBtn = document.getElementById(instId + '-theme');
      if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

      const hamburger = document.getElementById(instId + '-hamburger');
      if (hamburger) hamburger.addEventListener('click', openSidebar);

      overlay.addEventListener('click', closeSidebar);
      window.addEventListener('resize', () => { if (window.innerWidth > 860) closeSidebar(); });
    }

    function openSidebar() {
      const sb = document.getElementById(instId + '-sb');
      if (sb) sb.classList.add('gss-open');
      overlay.classList.add('gss-show');
      document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
      const sb = document.getElementById(instId + '-sb');
      if (sb) sb.classList.remove('gss-open');
      overlay.classList.remove('gss-show');
      document.body.style.overflow = '';
    }

    function toggleTheme() { setTheme(theme === 'dark' ? 'light' : 'dark'); }
    function setTheme(t) {
      theme = t === 'light' ? 'light' : 'dark';
      try { localStorage.setItem('gh-store-theme', theme); } catch (e) {}
      applyThemeAttr();
      const icon = document.getElementById(instId + '-themeIcon');
      const label = document.getElementById(instId + '-themeLabel');
      const track = document.getElementById(instId + '-toggleTrack');
      if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
      if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
      if (track) track.classList.toggle('gss-on', theme === 'light');
      if (typeof options.onThemeChange === 'function') options.onThemeChange(theme);
      document.dispatchEvent(new CustomEvent('gracestore:themechange', { detail: { theme } }));
    }

    renderSidebar();
    renderTopbar();
    bindEvents();

    return {
      setActive(file) {
        activeFile = file;
        const navEl = document.getElementById(instId + '-nav');
        navEl?.querySelectorAll('.gss-item').forEach(a => a.classList.toggle('gss-active', a.dataset.gssFile === file));
      },
      setTitle(title, subtitle) {
        pageTitle = title;
        if (subtitle != null) pageSubtitle = subtitle;
        const t = document.getElementById(instId + '-title');
        const s = document.getElementById(instId + '-subtitle');
        if (t) t.textContent = pageTitle;
        if (s) s.textContent = pageSubtitle;
      },
      setApiMode(mode) {
        apiMode = mode;
        const badge = document.getElementById(instId + '-apiBadge');
        const text  = document.getElementById(instId + '-apiText');
        if (text) text.textContent = mode;
        if (badge) badge.classList.toggle('gss-live', mode === 'Live');
      },
      setPendingBadge(n) {
        pendingBadge = n;
        const el = document.querySelector(`[data-gss-badge="all-requisitions.html"]`);
        if (el) { el.textContent = n; el.classList.toggle('gss-hide', n == null); }
      },
      setStoreName(name) {
        storeName = name;
        const el = sidebarEl ? sidebarEl.querySelector('.gss-store-name') : null;
        if (el) el.innerHTML = `${storeIcon} ${_esc(storeName)}`;
      },
      setTopbarActions(html) {
        topbarActionsHtml = html || '';
        const el = document.getElementById(instId + '-actions');
        if (el) el.innerHTML = topbarActionsHtml;
      },
      toggleTheme,
      setTheme,
      getTheme() { return theme; },
      openSidebar,
      closeSidebar,
      destroy() {
        if (sidebarEl) sidebarEl.innerHTML = '';
        if (topbarEl) topbarEl.innerHTML = '';
      },
    };
  }

  window.GraceStoreShell = { attach, DEFAULT_NAV };

})();