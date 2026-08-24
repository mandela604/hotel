/**
 * services/platform-settings-service.js — Shared platform-wide settings
 * Depends on: data/platform-settings-seed.js (window.PlatformSettingsSeed)
 * Optional: services/permissions.js (window.Permissions) — editing is
 * gated to admin/manager, same convention as AccountingData.
 *
 * Load order: platform-settings-seed.js, THEN this file, THEN any page
 * or other service that reads settings (e.g. accounting-service.js).
 *
 * Reads/writes ONE shared key ('platform-settings', shared:true) so
 * every module — Accounting, Kitchen, Restaurant, Pool Bar, Store —
 * sees the same payment methods / shift hour / department list instead
 * of each hardcoding its own copy. Falls back to localStorage when
 * window.storage isn't available (same fallback every other service
 * in this codebase uses).
 *
 * Usage from any other module:
 *   <script src="../data/platform-settings-seed.js"></script>
 *   <script src="../services/platform-settings-service.js"></script>
 *   <script>
 *     const settings = await PlatformSettings.getSettings();
 *     settings.paymentMethods // ['Cash','POS',...]
 *   </script>
 */
(function (global) {
  'use strict';

  const KEY = 'platform-settings';

  const storage = global.storage || {
    async get(key, shared) {
      const v = localStorage.getItem(key);
      return v == null ? null : { key, value: v, shared };
    },
    async set(key, value, shared) {
      localStorage.setItem(key, value);
      return { key, value, shared };
    },
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function seedDefaults() {
    const s = global.PlatformSettingsSeed;
    if (!s) {
      console.error('[PlatformSettings] Load data/platform-settings-seed.js first');
      return { paymentMethods: [], shiftStartHour: 9, departments: [] };
    }
    return clone(s.DEFAULT_SETTINGS);
  }

  async function loadShared() {
    try {
      const r = await storage.get(KEY, true);
      if (r && r.value) {
        const parsed = JSON.parse(r.value);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) { /* fall through */ }
    return null;
  }
  async function saveShared(value) {
    try { await storage.set(KEY, JSON.stringify(value), true); return true; }
    catch (e) { console.warn('[PlatformSettings] save failed:', e); return false; }
  }

  let _seeded = false;
  let _seedPromise = null;
  function ensureSeeded() {
    if (_seeded) return Promise.resolve();
    if (_seedPromise) return _seedPromise;
    _seedPromise = (async () => {
      const existing = await loadShared();
      if (!existing) {
        await saveShared(seedDefaults());
      }
      _seeded = true;
    })();
    return _seedPromise;
  }

  const state = { settings: null, ready: false };
  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state.settings, reason); } catch (e) { console.warn('[PlatformSettings] listener error', e); } }); }

  async function loadAll() {
    await ensureSeeded();
    state.settings = (await loadShared()) || seedDefaults();
    state.ready = true;
    emitChange('load');
    return clone(state.settings);
  }

  async function getSettings() {
    await ensureSeeded();
    if (!state.ready) await loadAll();
    return clone(state.settings);
  }

  /* ── permission check — same shape as AccountingData.requirePerm ── */
  function getSession() {
    try { return JSON.parse(localStorage.getItem('accounting-session')) || null; }
    catch (e) { return null; }
  }
  function canEditSettings(session) {
    const P = global.Permissions;
    if (!P) {
      // No Permissions module wired up — fall back to a role check so
      // this isn't wide open by accident.
      const s = session || getSession();
      return !!s && (s.role === 'admin' || s.role === 'manager');
    }
    return P.hasPermission(session || getSession(), 'canEdit', 'settings');
  }

  async function updateSettings(patch, session) {
    await ensureSeeded();
    if (!canEditSettings(session)) {
      const err = new Error("You don't have permission to change platform settings.");
      err.code = 'PERMISSION_DENIED';
      throw err;
    }
    const current = state.ready ? state.settings : await loadAll();
    const next = { ...current, ...patch };
    await saveShared(next);
    state.settings = next;
    emitChange('update');
    return clone(next);
  }

  /* ── convenience helpers for the common cases ── */
  async function addPaymentMethod(method, session) {
    const s = await getSettings();
    const name = (method || '').trim();
    if (!name) throw new Error('Payment method name is required');
    if (s.paymentMethods.some(m => m.toLowerCase() === name.toLowerCase())) {
      throw new Error(`"${name}" already exists`);
    }
    return updateSettings({ paymentMethods: [...s.paymentMethods, name] }, session);
  }
  async function removePaymentMethod(method, session) {
    const s = await getSettings();
    return updateSettings({ paymentMethods: s.paymentMethods.filter(m => m !== method) }, session);
  }
  async function setShiftStartHour(hour, session) {
    const h = Number(hour);
    if (Number.isNaN(h) || h < 0 || h > 23) throw new Error('shiftStartHour must be 0–23');
    return updateSettings({ shiftStartHour: h }, session);
  }
  async function addDepartment(dept, session) {
    const s = await getSettings();
    const name = (dept || '').trim();
    if (!name) throw new Error('Department name is required');
    if (s.departments.includes(name)) throw new Error(`"${name}" already exists`);
    return updateSettings({ departments: [...s.departments, name] }, session);
  }
  async function removeDepartment(dept, session) {
    const s = await getSettings();
    return updateSettings({ departments: s.departments.filter(d => d !== dept) }, session);
  }

  async function resetToDefaults(session) {
    return updateSettings(seedDefaults(), session);
  }

  global.PlatformSettings = {
    KEY,
    state,
    onChange,
    loadAll,
    getSettings,
    updateSettings,
    addPaymentMethod,
    removePaymentMethod,
    setShiftStartHour,
    addDepartment,
    removeDepartment,
    resetToDefaults,
    canEditSettings,
  };
})(window);