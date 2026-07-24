/**
 * Aurum Hotel — Shared UI Shell
 * Injects sidebar + topbar, handles theme/collapse/mobile.
 * Call: initShell({ page: 'overview' })
 */

const PAGES = [
  { id:'overview',    icon:'◈', label:'Overview',         href:'index.html',       badge:null },
  { id:'booking',     icon:'🛏', label:'Booking (Rooms)',  href:'booking.html',     badge:null },
  { id:'restaurant',  icon:'🍽', label:'Restaurant / Bar', href:'restaurant.html',  badge:null },
  { id:'pool_bar',    icon:'🏊', label:'Pool Bar',         href:'pool-bar.html',    badge:null },
  { id:'staff',       icon:'👥', label:'Staff Management', href:'staff.html',       badge:null },
  { id:'procurement', icon:'📦', label:'Procurement',      href:'procurement.html', badge:3 },
  { id:'accounting',  icon:'📊', label:'Accounting',       href:'accounting.html',  badge:null },
];

function initShell({ page }) {
  /* ── inject HTML ── */
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="overlay" id="overlay" onclick="closeSidebar()"></div>
    <aside class="sidebar" id="sidebar">
      <div class="logo-row">
        <div style="display:flex;align-items:center;gap:11px;">
          <div class="logo-icon">🏨</div>
          <div>
            <div class="hotel-name">Aurum Hotel</div>
            <div class="suite-label">Management Suite</div>
          </div>
        </div>
        <button class="collapse-btn" id="collapseBtn" onclick="toggleCollapse()">◀</button>
      </div>

      <div class="nav-scroll">
        <div class="s-section">Modules</div>
        <nav id="navLinks">
          ${PAGES.map(p => `
            <a class="nav-item${p.id === page ? ' active':''}" href="${p.href}">
              <span class="nav-ico">${p.icon}</span>
              <span class="s-label">${p.label}</span>
              ${p.badge ? `<span class="s-badge">${p.badge}</span>` : ''}
            </a>
          `).join('')}
        </nav>
      </div>

      <div class="sidebar-footer">
        <button class="theme-btn" id="themeBtn" onclick="toggleTheme()">
          <span id="themeIco">☀️</span>
          <span class="theme-label" id="themeLabel">Light Mode</span>
          <div class="t-track" id="tTrack"><div class="t-thumb"></div></div>
        </button>
      </div>
    </aside>
  `);

  /* topbar title */
  const current = PAGES.find(p => p.id === page);
  if (current) {
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = current.label;
  }

  /* date */
  const d = new Date();
  const dateEl = document.getElementById('topDate');
  if (dateEl) dateEl.textContent = d.toLocaleDateString('en-GB', {
    weekday:'short', day:'numeric', month:'long', year:'numeric'
  });

  /* restore theme */
  const savedTheme = localStorage.getItem('aurum_theme') || 'dark';
  applyTheme(savedTheme);

  /* restore collapse */
  const savedCollapse = localStorage.getItem('aurum_collapse') === '1';
  if (savedCollapse) _setCollapse(true);
}

/* ── Theme ── */
let _isDark = true;

function applyTheme(t) {
  _isDark = t === 'dark';
  document.documentElement.setAttribute('data-theme', t);
  const ico   = document.getElementById('themeIco');
  const label = document.getElementById('themeLabel');
  const track = document.getElementById('tTrack');
  if (ico)   ico.textContent   = _isDark ? '☀️' : '🌙';
  if (label) label.textContent = _isDark ? 'Light Mode' : 'Dark Mode';
  if (track) track.classList.toggle('on', !_isDark);
}

function toggleTheme() {
  const t = _isDark ? 'light' : 'dark';
  applyTheme(t);
  localStorage.setItem('aurum_theme', t);
}

/* ── Collapse ── */
let _isCollapsed = false;

function _setCollapse(v) {
  _isCollapsed = v;
  document.getElementById('sidebar')?.classList.toggle('collapsed', v);
  document.body.classList.toggle('s-collapsed', v);
  const btn = document.getElementById('collapseBtn');
  if (btn) btn.textContent = v ? '▶' : '◀';
}

function toggleCollapse() {
  _setCollapse(!_isCollapsed);
  localStorage.setItem('aurum_collapse', _isCollapsed ? '1' : '0');
}

/* ── Mobile ── */
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('overlay')?.classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('show');
}

/* ── Toast ── */
function showToast(msg, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ── Modal helpers ── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

window.toggleTheme   = toggleTheme;
window.toggleCollapse= toggleCollapse;
window.openSidebar   = openSidebar;
window.closeSidebar  = closeSidebar;
window.showToast     = showToast;
window.openModal     = openModal;
window.closeModal    = closeModal;