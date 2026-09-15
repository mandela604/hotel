/**
 * Aurum Hotel — Utility Functions
 * ─────────────────────────────────────────────────────────
 * Demo API layer removed. Accounting module uses
 * accounting-service.js → real backend (/api/accounting/*).
 *
 * These utility functions remain available globally.
 */

function formatNaira(n) {
  return '\u20A6' + Number(n || 0).toLocaleString('en-NG');
}

function formatDate(d) {
  if (!d || d === '\u2014') return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('aurum_user');
    return raw ? JSON.parse(raw) : { name: 'Guest', initials: 'G', role: 'Staff' };
  } catch (e) {
    return { name: 'Guest', initials: 'G', role: 'Staff' };
  }
}

window.formatNaira    = formatNaira;
window.formatDate     = formatDate;
window.getCurrentUser = getCurrentUser;
