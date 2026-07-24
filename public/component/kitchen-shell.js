/* ═══════════════════════════════════════════════════════════════
   KitchenShell — module-scoped sidebar + topbar for the Kitchen
   module, mirroring the interface used by poolbar-shell.js /
   restaurant-shell.js / store-shell.js across the rest of the app.

   Usage (identical pattern to PoolBarShell):
     const shell = KitchenShell.attach({
       sidebarTarget: '#sidebarSlot',
       topbarTarget:  '#topbarSlot',
       activeFile:    'kitchen-dashboard.html',
       pageTitle:     'Dashboard',
       pageSubtitle:  'Kitchen operations overview',
       apiMode:       'Demo',
       user:          { name: 'Head Chef', initials: 'HC' },
     });
     shell.setApiMode('Live');
     shell.setPendingBadge(3);        // badge on "Transfers"
     shell.setInventoryBadge(2);      // badge on "Inventory" (low stock count)

   Place this file at /component/kitchen-shell.js — Kitchen pages
   live in their own /kitchen/ folder and reference it the same way
   Pool Bar pages reference ../component/poolbar-shell.js.
═══════════════════════════════════════════════════════════════ */
const KitchenShell = (function () {

  const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard',          href: 'kitchen-dashboard.html',         icon: '◈' },
    { key: 'new',       label: 'New Production',     href: 'kitchen-production.html',        icon: '＋' },
    { key: 'history',   label: 'Production History', href: 'kitchen-production-history.html',icon: '📋' },
    { key: 'transfers', label: 'Transfers',          href: 'kitchen-transfers.html',          icon: '🚚', badgeKey: 'transfers' },
    { key: 'inventory', label: 'Inventory',          href: 'kitchen-inventory.html',          icon: '📦', badgeKey: 'inventory' },
  ];

  let stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
      /* ── Theme token defaults — re-affirmed here in case a page forgets
         to declare them itself (see kitchen-dashboard.html for why this
         matters: first-paint background must never fall back to white). */
      :root{
        --gold:#c9a84c; --gold-light:#e8c96a; --gold-dim:rgba(201,168,76,0.12); --gold-border:rgba(201,168,76,0.25);
        --green:#4ade80; --green-bg:rgba(74,222,128,0.12);
        --red:#f87171; --red-bg:rgba(248,113,113,0.12);
        --amber:#fbbf24; --amber-bg:rgba(251,191,36,0.12);
        --blue:#60a5fa; --blue-bg:rgba(96,165,250,0.12);
      }
      [data-theme="dark"]{
        --bg:#080f18; --surface:#111e2b; --surface2:#162435; --surface3:#1c2e40;
        --border:#1e3045; --border2:#243850; --text:#e8f0f8; --text2:#a8bece; --text3:#6a8a9e;
        --shadow:0 8px 32px rgba(0,0,0,0.5); --shadow-lg:0 16px 48px rgba(0,0,0,0.6);
        --sidebar-bg:#0a1520;
      }
      [data-theme="light"]{
        --bg:#eef2f7; --surface:#ffffff; --surface2:#f4f7fb; --surface3:#e8edf5;
        --border:#dce4ef; --border2:#ccd6e5; --text:#0f2237; --text2:#4a6580; --text3:#8aa0b8;
        --shadow:0 4px 20px rgba(15,34,55,0.07); --shadow-lg:0 8px 40px rgba(15,34,55,0.10);
        --sidebar-bg:#ffffff;
      }

      #kit-sidebar{ position:fixed; top:0; left:0; height:100%; width:250px; background:var(--sidebar-bg); border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200; overflow:hidden; flex-shrink:0; transition:transform .3s cubic-bezier(.4,0,.2,1); }
      @media (max-width:768px){ #kit-sidebar{ transform:translateX(-100%); box-shadow:var(--shadow-lg); } #kit-sidebar.open{ transform:translateX(0); } }
      .kit-sb-head{ display:flex; align-items:center; gap:10px; padding:20px 18px; border-bottom:1px solid var(--border); flex-shrink:0; }
      .kit-logo-mark{ width:34px; height:34px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:9px; display:flex; align-items:center; justify-content:center; font-family:'Cormorant Garamond',serif; font-size:18px; font-weight:700; color:#000; flex-shrink:0; text-decoration:none; }
      .kit-logo-text{ flex:1; min-width:0; }
      .kit-logo-text .name{ font-family:'Cormorant Garamond',serif; font-size:16.5px; font-weight:700; color:var(--gold); line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .kit-logo-text .sub{ font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
      .kit-back-link{ display:flex; align-items:center; gap:6px; padding:10px 18px; font-size:11.5px; color:var(--text3); text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
      .kit-back-link:hover{ color:var(--gold); }
      .kit-sb-section{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:16px 18px 6px; flex-shrink:0; }
      .kit-sb-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
      .kit-nav-item{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; color:var(--text2); font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
      .kit-nav-item:hover{ background:var(--surface2); color:var(--text); }
      .kit-nav-item.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:500; }
      .kit-nav-item.active .kit-nav-icon{ color:var(--gold); }
      .kit-nav-icon{ font-size:15px; width:18px; text-align:center; flex-shrink:0; }
      .kit-nav-badge{ margin-left:auto; background:var(--gold); color:#000; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; }
      .kit-sb-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
      .kit-theme-btn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:10px; background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:'Outfit',sans-serif; font-size:13px; cursor:pointer; transition:all .2s; }
      .kit-theme-btn:hover{ background:var(--surface3); color:var(--text); }
      .kit-theme-label{ flex:1; text-align:left; }
      .kit-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
      .kit-toggle-track.on{ background:var(--gold); }
      .kit-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
      .kit-toggle-track.on .kit-toggle-thumb{ transform:translateX(16px); }

      #kit-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:199; backdrop-filter:blur(2px); }
      #kit-overlay.show{ display:block; }

      #kit-topbar{ position:sticky; top:0; z-index:100; height:62px; background:var(--bg); border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 24px; gap:12px; flex-shrink:0; }
      @media (max-width:480px){ #kit-topbar{ padding:0 14px; } }
      .kit-hamburger{ display:none; background:var(--surface2); border:1px solid var(--border); color:var(--text); width:36px; height:36px; border-radius:10px; align-items:center; justify-content:center; font-size:16px; cursor:pointer; flex-shrink:0; }
      @media (max-width:768px){ .kit-hamburger{ display:flex; } }
      .kit-topbar-titlewrap{ flex:1; min-width:0; }
      .kit-topbar-title{ font-family:'Cormorant Garamond',serif; font-size:19px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
      .kit-topbar-sub{ font-size:11px; color:var(--text3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .kit-topbar-right{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
      .kit-topbar-date{ font-size:12px; color:var(--text3); display:none; }
      @media (min-width:640px){ .kit-topbar-date{ display:block; } }
      .kit-api-badge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; padding:3px 8px; border-radius:20px; background:rgba(251,191,36,.12); color:#fbbf24; border:1px solid rgba(251,191,36,.2); white-space:nowrap; }
      .kit-api-badge.live{ background:var(--green-bg); color:var(--green); border-color:rgba(74,222,128,.3); }
      .kit-api-badge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:kitBlink 2s infinite; }
      @keyframes kitBlink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
      .kit-notif-btn{ width:36px; height:36px; background:var(--surface2); border:1px solid var(--border); border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; position:relative; color:var(--text2); flex-shrink:0; }
      .kit-notif-dot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid var(--bg); }
      .kit-avatar{ width:36px; height:36px; background:var(--gold-dim); border:2px solid var(--gold-border); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:600; color:var(--gold); cursor:pointer; flex-shrink:0; }
    `;
    const style = document.createElement('style');
    style.id = 'kitchen-shell-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function initials(name) {
    if (!name) return 'K';
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  function attach(opts) {
    injectStyles();

    const sidebarEl = document.querySelector(opts.sidebarTarget);
    const topbarEl = document.querySelector(opts.topbarTarget);
    const user = opts.user || { name: 'Kitchen Staff' };
    const userInitials = user.initials || initials(user.name);

    // ── Sidebar ──
    sidebarEl.innerHTML = `
      <aside id="kit-sidebar">
        <div class="kit-sb-head">
          <a class="kit-logo-mark" href="../index.html" title="Back to Aurum Hotel">A</a>
          <div class="kit-logo-text">
            <div class="name">Aurum Hotel</div>
            <div class="sub">Kitchen Module</div>
          </div>
        </div>
        <a class="kit-back-link" href="../index.html">← Back to Main Suite</a>
        <div class="kit-sb-section">Kitchen</div>
        <nav class="kit-sb-nav">
          ${NAV_ITEMS.map(item => `
            <a class="kit-nav-item${item.href === opts.activeFile ? ' active' : ''}" href="${item.href}">
              <span class="kit-nav-icon">${item.icon}</span>
              <span>${item.label}</span>
              ${item.badgeKey ? `<span class="kit-nav-badge" id="kitBadge_${item.badgeKey}" style="display:none;"></span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="kit-sb-footer">
          <button class="kit-theme-btn" id="kitThemeBtn">
            <span id="kitThemeIcon">☀️</span>
            <span class="kit-theme-label" id="kitThemeLabel">Light Mode</span>
            <div class="kit-toggle-track" id="kitToggleTrack"><div class="kit-toggle-thumb"></div></div>
          </button>
        </div>
      </aside>
    `;

    // ── Overlay for mobile ──
    if (!document.getElementById('kit-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'kit-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeMobileSidebar);
    }

    // ── Topbar ──
    topbarEl.innerHTML = `
      <div id="kit-topbar">
        <button class="kit-hamburger" id="kitHamburger">☰</button>
        <div class="kit-topbar-titlewrap">
          <div class="kit-topbar-title">${opts.pageTitle || 'Kitchen'}</div>
          ${opts.pageSubtitle ? `<div class="kit-topbar-sub">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="kit-topbar-right">
          <div class="kit-topbar-date" id="kitTopDate"></div>
          <div class="kit-api-badge" id="kitApiBadge"><span class="dot"></span><span id="kitApiBadgeText">${opts.apiMode || 'Demo'}</span></div>
          <div class="kit-notif-btn" title="Notifications">🔔<div class="kit-notif-dot"></div></div>
          <div class="kit-avatar" title="${user.name || ''}">${userInitials}</div>
        </div>
      </div>
    `;

    // Date
    const dateEl = document.getElementById('kitTopDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Mobile hamburger
    const hamburger = document.getElementById('kitHamburger');
    if (hamburger) hamburger.addEventListener('click', openMobileSidebar);

    // Theme toggle
    let isDark = true;
    const themeBtn = document.getElementById('kitThemeBtn');
    function applyTheme() {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.getElementById('kitThemeIcon').textContent = isDark ? '☀️' : '🌙';
      document.getElementById('kitThemeLabel').textContent = isDark ? 'Light Mode' : 'Dark Mode';
      document.getElementById('kitToggleTrack').classList.toggle('on', !isDark);
    }
    themeBtn.addEventListener('click', () => {
      isDark = !isDark;
      applyTheme();
      try { localStorage.setItem('aurum-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    });
    try {
      const saved = localStorage.getItem('aurum-theme');
      if (saved === 'light') { isDark = true; }
    } catch (e) {}
    applyTheme();

    function openMobileSidebar() {
      document.getElementById('kit-sidebar').classList.add('open');
      document.getElementById('kit-overlay').classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function closeMobileSidebar() {
      const sb = document.getElementById('kit-sidebar');
      const ov = document.getElementById('kit-overlay');
      if (sb) sb.classList.remove('open');
      if (ov) ov.classList.remove('show');
      document.body.style.overflow = '';
    }

    // ── Public API ──
    return {
      setApiMode(mode) {
        const badge = document.getElementById('kitApiBadge');
        const text = document.getElementById('kitApiBadgeText');
        if (!badge || !text) return;
        text.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        const el = document.getElementById('kitBadge_transfers');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.style.display = ''; }
        else el.style.display = 'none';
      },
      setInventoryBadge(n) {
        const el = document.getElementById('kitBadge_inventory');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.style.display = ''; }
        else el.style.display = 'none';
      },
    };
  }

  return { attach };
})();