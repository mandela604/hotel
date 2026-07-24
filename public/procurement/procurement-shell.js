/**
 * Procurement Shell - Navigation and Layout
 * Updated to match Grace Hotel HMS approval flow
 *
 * "Back to Main Suite" sits right under the brand, above the nav — same
 * spot and wording as kitchen-shell.js / gym-shell.js / store-shell.js —
 * and points to "../index.html": Procurement pages live one level down
 * in their own procurement/ folder, so the link has to climb back out
 * to the real Hotel Suite index.html rather than a bare "index.html"
 * (which would resolve to a non-existent file inside procurement/
 * itself).
 *
 * Also now ships its own --gold/--surface/--border/etc. token set (dark
 * + light), the same way every other module shell does. Previously this
 * file relied entirely on the host page to define those variables —
 * if a page forgot, everything using var(--surface) etc. silently fell
 * back to nothing and the whole page rendered unstyled.
 */
const ProcurementShell = (function() {
  let activeFile = 'dashboard.html';
  let pageTitle = 'Dashboard';
  let pageSubtitle = 'Procurement overview';
  let apiMode = 'Demo';
  let user = { name: 'Procurement Officer', initials: 'PO' };
  let backHref = '../index.html';

  const PAGES = [
    { id: 'dashboard', label: 'Dashboard', icon: '◈', file: 'dashboard.html' },
    { id: 'new-requisition', label: 'New Requisition', icon: '📝', file: 'new-requisition.html' },
    { id: 'pending-approvals', label: 'Pending Approvals', icon: '✅', file: 'pending-approvals.html' },
    { id: 'requisition-history', label: 'Requisition History', icon: '📊', file: 'requisition-history.html' },
    { id: 'po-history', label: 'PO History', icon: '📋', file: 'po-history.html' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏭', file: 'suppliers.html' },
    { id: 'reports', label: 'Reports', icon: '📈', file: 'reports.html' },
  ];

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
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
      }
      [data-theme="light"]{
        --bg:#eef2f7; --surface:#ffffff; --surface2:#f4f7fb; --surface3:#e8edf5;
        --border:#dce4ef; --border2:#ccd6e5; --text:#0f2237; --text2:#4a6580; --text3:#8aa0b8;
        --shadow:0 4px 20px rgba(15,34,55,0.07); --shadow-lg:0 8px 40px rgba(15,34,55,0.10);
      }
      .prc-back-link{ display:flex; align-items:center; gap:6px; padding:10px 18px; font-size:11.5px; color:var(--text3); text-decoration:none; border-bottom:1px solid var(--border); transition:color .15s; flex-shrink:0; }
      .prc-back-link:hover{ color:var(--gold); }
    `;
    const style = document.createElement('style');
    style.id = 'procurement-shell-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function renderSidebar() {
    const slot = document.getElementById('sidebarSlot');
    if (!slot) return;

    slot.innerHTML = `
      <div id="prc-sidebar" style="width:250px;height:100vh;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;left:0;top:0;z-index:100;transition:transform .3s;">
        <div style="padding:20px 18px;border-bottom:1px solid var(--border);">
          <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:var(--gold);margin-bottom:4px;">AURUM</div>
          <div style="font-size:10px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;">Procurement Module</div>
        </div>
        <a class="prc-back-link" href="${backHref}">← Back to Main Suite</a>
        <nav style="flex:1;overflow-y:auto;padding:12px 0;">
          ${PAGES.map(p => `
            <a href="${p.file}" style="display:flex;align-items:center;gap:12px;padding:11px 18px;color:${p.file === activeFile ? 'var(--gold)' : 'var(--text2)'};text-decoration:none;font-size:13px;font-weight:${p.file === activeFile ? '600' : '500'};background:${p.file === activeFile ? 'var(--gold-dim)' : 'transparent'};border-left:3px solid ${p.file === activeFile ? 'var(--gold)' : 'transparent'};transition:all .15s;">
              <span style="font-size:16px;width:20px;text-align:center;">${p.icon}</span>
              <span>${p.label}</span>
            </a>
          `).join('')}
        </nav>
        <div style="padding:14px 18px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--gold-dim);color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${user.initials}</div>
            <div>
              <div style="color:var(--text);font-weight:500;font-size:12px;">${user.name}</div>
              <div style="font-size:10px;">${apiMode} Mode</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTopbar() {
    const slot = document.getElementById('topbarSlot');
    if (!slot) return;
    
    slot.innerHTML = `
      <div id="prc-topbar" style="height:60px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;flex-shrink:0;">
        <div>
          <div style="font-size:16px;font-weight:600;color:var(--text);font-family:'Cormorant Garamond',serif;">${pageTitle}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:1px;">${pageSubtitle}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:${apiMode==='Demo'?'var(--gold-dim)':'var(--green-bg)'};color:${apiMode==='Demo'?'var(--gold)':'var(--green)'};border-radius:20px;font-size:10.5px;font-weight:600;">
            <span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span>
            ${apiMode} Mode
          </span>
        </div>
      </div>
    `;
  }

  return {
    attach(options) {
      injectStyles();

      activeFile = options.activeFile || 'dashboard.html';
      pageTitle = options.pageTitle || 'Dashboard';
      pageSubtitle = options.pageSubtitle || '';
      apiMode = options.apiMode || 'Demo';
      user = options.user || { name: 'User', initials: 'U' };
      backHref = options.backHref || '../index.html';

      renderSidebar();
      renderTopbar();

      return this;
    }
  };
})();