//booking-shell.js
const BookingShell = (function () {

  const NAV_ITEMS = [
    { key: 'rooms',    label: 'Front Desk',        href: 'booking-rooms.html',   icon: '🛏' },
    { key: 'guests',   label: 'Guests',            href: 'guests.html',          icon: '👤' },
    { key: 'bookings', label: 'All Bookings',      href: 'booking-list.html',    icon: '📋' },
    { key: 'reports',  label: 'Reports & Revenue', href: 'booking-reports.html', icon: '📊' },
  ];

  let stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
      :root{
        --gold:#2f6fed; --gold-light:#5b8ff9; --gold-dim:rgba(47,111,237,0.12); --gold-border:rgba(47,111,237,0.25);
        --green:#12b76a; --green-bg:rgba(18,183,106,0.12);
        --red:#f04438; --red-bg:rgba(240,68,56,0.12);
        --amber:#f79009; --amber-bg:rgba(247,144,9,0.12);
        --blue:#2f6fed; --blue-bg:rgba(47,111,237,0.12);
        --purple:#8b5cf6; --purple-bg:rgba(139,92,246,0.12);
      }
      [data-theme="dark"]{
        --bg:#081540; --surface:#0a1848; --surface2:#0e2158; --surface3:#122868;
        --border:rgba(255,255,255,0.08); --border2:rgba(255,255,255,0.14); --text:#ffffff; --text2:#aab0d0; --text3:#8891bd;
        --shadow:0 8px 32px rgba(0,0,0,0.5); --shadow-lg:0 16px 48px rgba(0,0,0,0.6);
        --sidebar-bg:linear-gradient(180deg,#0a1848 0%,#0c1c58 100%); --input-bg:#0a1848; --modal-bg:#0a1848;
      }
      [data-theme="light"]{
        --bg:#f4f6fb; --surface:#ffffff; --surface2:#f4f6fb; --surface3:#eef0f6;
        --border:#eef0f6; --border2:#dfe3ec; --text:#1c2440; --text2:#6b7280; --text3:#9aa1b3;
        --shadow:0 4px 20px rgba(15,34,55,0.07); --shadow-lg:0 8px 40px rgba(15,34,55,0.10);
        --sidebar-bg:#ffffff; --input-bg:#f4f6fb; --modal-bg:#ffffff;
      }

      #booking-sidebar{ position:fixed; top:0; left:0; height:100%; width:256px; background:var(--sidebar-bg); border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200; overflow:hidden; flex-shrink:0; transition:transform .3s cubic-bezier(.4,0,.2,1); }
      @media (max-width:768px){ #booking-sidebar{ transform:translateX(-100%); box-shadow:var(--shadow-lg); } #booking-sidebar.open{ transform:translateX(0); } }
      .booking-sb-head{ display:flex; align-items:center; gap:10px; padding:22px 18px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
      .booking-logo-mark{ width:36px; height:36px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-radius:10px; display:flex; align-items:center; justify-content:center; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:16px; font-weight:700; color:#fff; flex-shrink:0; text-decoration:none; }
      .booking-logo-text{ margin-left:10px; flex:1; overflow:hidden; }
      .booking-logo-text .name{ font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:18px; font-weight:700; color:var(--gold); white-space:nowrap; line-height:1.2; }
      .booking-logo-text .sub{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); margin-top:1px; white-space:nowrap; }
      .booking-back-link{ display:flex; align-items:center; gap:6px; padding:10px 18px; font-size:11.5px; color:var(--text3); text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
      .booking-back-link:hover{ color:var(--gold); }
      .booking-sb-section{ font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:var(--text3); padding:18px 18px 6px; flex-shrink:0; }
      .booking-sb-nav{ flex:1; overflow-y:auto; padding:4px 10px; }
      .booking-nav-item{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; color:var(--text2); font-size:13.5px; cursor:pointer; text-decoration:none; border:1px solid transparent; margin-bottom:2px; transition:all .2s; white-space:nowrap; }
      .booking-nav-item:hover{ background:var(--surface2); color:var(--text); }
      .booking-nav-item.active{ background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold-light); font-weight:500; }
      .booking-nav-item.active .booking-nav-icon{ color:var(--gold); }
      .booking-nav-icon{ font-size:16px; width:20px; text-align:center; flex-shrink:0; }
      .booking-nav-badge{ margin-left:auto; background:var(--gold); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; display:none; }
      .booking-nav-badge.show{ display:inline-block; }
      .booking-sb-footer{ padding:12px 10px; border-top:1px solid var(--border); flex-shrink:0; }
      .booking-theme-btn{ display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:10px; background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:13px; cursor:pointer; transition:all .2s; }
      .booking-theme-btn:hover{ background:var(--surface3); color:var(--text); }
      .booking-theme-label{ flex:1; text-align:left; }
      .booking-toggle-track{ width:34px; height:18px; background:var(--border2); border-radius:20px; position:relative; flex-shrink:0; transition:background .3s; }
      .booking-toggle-track.on{ background:var(--gold); }
      .booking-toggle-thumb{ position:absolute; top:2px; left:2px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .3s; }
      .booking-toggle-track.on .booking-toggle-thumb{ transform:translateX(16px); }
      .booking-copyright{ font-size:10.5px; color:var(--text3); padding:0 18px 16px; flex-shrink:0; }

      #booking-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:199; backdrop-filter:blur(2px); }
      #booking-overlay.show{ display:block; }

      #booking-topbar{ position:sticky; top:0; z-index:100; height:62px; background:var(--bg); border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 24px; gap:12px; flex-shrink:0; }
      @media (max-width:480px){ #booking-topbar{ padding:0 14px; } }
      .booking-hamburger{ display:none; background:var(--surface2); border:1px solid var(--border); color:var(--text); width:36px; height:36px; border-radius:10px; align-items:center; justify-content:center; font-size:16px; cursor:pointer; flex-shrink:0; }
      @media (max-width:768px){ .booking-hamburger{ display:flex; } }
      .booking-topbar-titlewrap{ flex:1; min-width:0; }
      .booking-topbar-title{ font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:20px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .booking-topbar-subtitle{ font-size:11.5px; color:var(--text3); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .booking-topbar-right{ display:flex; align-items:center; gap:10px; flex-shrink:0; }
      .booking-topbar-date{ font-size:12px; color:var(--text3); display:none; }
      @media (min-width:640px){ .booking-topbar-date{ display:block; } }
      .booking-api-badge{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; padding:3px 8px; border-radius:20px; background:var(--amber-bg); color:var(--amber); border:1px solid rgba(247,144,9,.2); white-space:nowrap; }
      .booking-api-badge.live{ background:var(--green-bg); color:var(--green); border-color:rgba(18,183,106,.3); }
      .booking-api-badge .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; animation:bookingBlink 2s infinite; }
      @keyframes bookingBlink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }
      .booking-notif-btn{ width:36px; height:36px; background:var(--surface2); border:1px solid var(--border); border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; position:relative; color:var(--text2); flex-shrink:0; }
      .booking-notif-dot{ position:absolute; top:6px; right:6px; width:7px; height:7px; background:var(--gold); border-radius:50%; border:1.5px solid var(--bg); }
      .booking-avatar{ width:36px; height:36px; background:var(--gold-dim); border:2px solid var(--gold-border); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:600; color:var(--gold); cursor:pointer; flex-shrink:0; }
    `;
    const style = document.createElement('style');
    style.id = 'booking-shell-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function initials(name) {
    if (!name) return 'B';
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  function navHtml(activeFile) {
    return NAV_ITEMS.map(item => `
      <a class="booking-nav-item${item.href === activeFile ? ' active' : ''}" href="${item.href}" data-nav-key="${item.key}">
        <span class="booking-nav-icon">${item.icon}</span>
        <span class="nav-text">${item.label}</span>
        <span class="booking-nav-badge" id="booking-nav-badge-${item.key}"></span>
      </a>`).join('');
  }

  function attach(opts) {
    injectStyles();

    const sidebarEl = document.querySelector(opts.sidebarTarget);
    const topbarEl = document.querySelector(opts.topbarTarget);
    const user = opts.user || { name: 'Front Desk Staff' };
    const userInitials = user.initials || initials(user.name);
    const activeFile = opts.activeFile || '';

    sidebarEl.innerHTML = `
      <aside id="booking-sidebar">
        <div class="booking-sb-head">
          <a class="booking-logo-mark" href="../index.html" title="Back to Aurum Hotel">A</a>
          <div class="booking-logo-text">
            <div class="name">Aurum Hotel</div>
            <div class="sub">Front Desk</div>
          </div>
        </div>
        <a class="booking-back-link" href="../index.html">← Back to Main Suite</a>
        <div class="booking-sb-section">Front Desk</div>
        <nav class="booking-sb-nav">${navHtml(activeFile)}</nav>
        <div class="booking-sb-footer">
          <button class="booking-theme-btn" id="bookingThemeBtn">
            <span id="bookingThemeIcon">☀️</span>
            <span class="booking-theme-label" id="bookingThemeLabel">Light Mode</span>
            <div class="booking-toggle-track" id="bookingToggleTrack"><div class="booking-toggle-thumb"></div></div>
          </button>
        </div>
        <div class="booking-copyright">© 2026 Aurum Hotel</div>
      </aside>
    `;

    if (!document.getElementById('booking-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'booking-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeMobileSidebar);
    }

    topbarEl.innerHTML = `
      <div id="booking-topbar">
        <button class="booking-hamburger" id="bookingHamburger">☰</button>
        <div class="booking-topbar-titlewrap">
          <div class="booking-topbar-title">${opts.pageTitle || 'Front Desk (Rooms)'}</div>
          ${opts.pageSubtitle ? `<div class="booking-topbar-subtitle">${opts.pageSubtitle}</div>` : ''}
        </div>
        <div class="booking-topbar-right">
          <div class="booking-topbar-date" id="bookingTopDate"></div>
          <div class="booking-api-badge" id="bookingApiBadge"><span class="dot"></span><span id="bookingApiBadgeText">${opts.apiMode || 'Demo'}</span></div>
          <div class="booking-notif-btn" title="Notifications">🔔<div class="booking-notif-dot"></div></div>
          <div class="booking-avatar" title="${user.name || ''}">${userInitials}</div>
        </div>
      </div>
    `;

    const dateEl = document.getElementById('bookingTopDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const hamburger = document.getElementById('bookingHamburger');
    if (hamburger) hamburger.addEventListener('click', openMobileSidebar);

    let isDark = false;
    const themeBtn = document.getElementById('bookingThemeBtn');
    function applyTheme() {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.getElementById('bookingThemeIcon').textContent = isDark ? '☀️' : '🌙';
      document.getElementById('bookingThemeLabel').textContent = isDark ? 'Light Mode' : 'Dark Mode';
      document.getElementById('bookingToggleTrack').classList.toggle('on', !isDark);
    }
    themeBtn.addEventListener('click', () => {
      isDark = !isDark;
      applyTheme();
      try { localStorage.setItem('aurum-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    });
    try {
      const saved = localStorage.getItem('aurum-theme');
      if (saved === 'dark') { isDark = true; }
    } catch (e) {}
    applyTheme();

    function openMobileSidebar() {
      document.getElementById('booking-sidebar').classList.add('open');
      document.getElementById('booking-overlay').classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function closeMobileSidebar() {
      const sb = document.getElementById('booking-sidebar');
      const ov = document.getElementById('booking-overlay');
      if (sb) sb.classList.remove('open');
      if (ov) ov.classList.remove('show');
      document.body.style.overflow = '';
    }

    return {
      setApiMode(mode) {
        const badge = document.getElementById('bookingApiBadge');
        const text = document.getElementById('bookingApiBadgeText');
        if (!badge || !text) return;
        text.textContent = mode;
        badge.classList.toggle('live', mode === 'Live');
      },
      setPendingBadge(n) {
        const el = document.getElementById('booking-nav-badge-bookings');
        if (!el) return;
        if (n > 0) { el.textContent = n; el.classList.add('show'); }
        else el.classList.remove('show');
      },
      setTitle(title, subtitle) {
        const t = document.querySelector('.booking-topbar-title');
        if (t) t.textContent = title;
        const s = document.querySelector('.booking-topbar-subtitle');
        if (subtitle != null && s) s.textContent = subtitle;
      },
    };
  }

  return { attach };
})();