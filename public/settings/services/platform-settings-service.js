/**
 * services/platform-settings-service.js — Shared platform-wide settings
 *
 * PRODUCTION VERSION: talks to the real backend (routes/settings.js →
 * controllers/settingsController.js → models/Config.js) over HTTP.
 * No demo/localStorage fallback.
 *
 * Load order: this file, THEN any page or other service that reads settings.
 *
 * Usage from any other module:
 *   const settings = await PlatformSettings.getSettings();
 *   settings.paymentMethods // ['Cash','POS',...]
 */
(function (global) {
  'use strict';

  const KEY = 'platform-settings';

  const CONFIG = {
    API_BASE: '/api/settings',
  };

  function getToken() {
    // httpOnly cookie is sent automatically — no localStorage token needed.
    return '';
  }

  async function apiFetch(path, options) {
    options = options || {};
    // httpOnly cookie is sent automatically — no Authorization header needed.
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});

    let res;
    try {
      res = await fetch(CONFIG.API_BASE + path, Object.assign({}, options, { headers }));
    } catch (networkErr) {
      const err = new Error('Network error contacting server: ' + networkErr.message);
      err.code = 'NETWORK_ERROR';
      throw err;
    }

    let body = null;
    try { body = await res.json(); } catch (e) { /* no/invalid JSON */ }

    if (!res.ok || (body && body.success === false)) {
      const msg = (body && body.error) || ('Request failed (' + res.status + ')');
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    return body;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function seedDefaults() {
    const s = global.PlatformSettingsSeed;
    if (!s) return { paymentMethods: ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'], shiftStartHour: 9, departments: ['Rooms', 'Restaurant', 'Pool Bar', 'Gym', 'Laundry', 'Events'] };
    return clone(s.DEFAULT_SETTINGS);
  }

  const state = { settings: null, ready: false };
  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emitChange(reason) { listeners.forEach(fn => { try { fn(state.settings, reason); } catch (e) { console.warn('[PlatformSettings] listener error', e); } }); }

  function normalize(cfg) {
    if (!cfg) return seedDefaults();
    return {
      paymentMethods: Array.isArray(cfg.paymentMethods) ? cfg.paymentMethods : seedDefaults().paymentMethods,
      shiftStartHour: typeof cfg.shiftStartHour === 'number' ? cfg.shiftStartHour : 9,
      departments: Array.isArray(cfg.departments) ? cfg.departments : seedDefaults().departments,
    };
  }

  async function loadAll() {
    try {
      const res = await apiFetch('?_=' + Date.now());
      state.settings = normalize(res.data);
    } catch (e) {
      console.warn('[PlatformSettings] API load failed, using defaults:', e.message);
      state.settings = seedDefaults();
    }
    state.ready = true;
    emitChange('load');
    return clone(state.settings);
  }

  async function getSettings() {
    if (!state.ready) await loadAll();
    return clone(state.settings);
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem('accounting-session') || 'null') || null; }
    catch (e) { return null; }
  }

  function canEditSettings(session) {
    const P = global.Permissions;
    if (!P) {
      const s = session || getSession();
      return !!s && (s.role === 'admin' || s.role === 'manager');
    }
    return P.hasPermission(session || getSession(), 'canEdit', 'settings');
  }

  async function updateSettings(patch, session) {
    if (!canEditSettings(session)) {
      const err = new Error("You don't have permission to change platform settings.");
      err.code = 'PERMISSION_DENIED';
      throw err;
    }
    const current = state.settings || seedDefaults();
    const next = { ...current, ...patch };
    const res = await apiFetch('', { method: 'PUT', body: JSON.stringify(next) });
    state.settings = normalize(res.data);
    emitChange('update');
    return clone(state.settings);
  }

  async function addPaymentMethod(method, session) {
    const s = await getSettings();
    const name = (method || '').trim();
    if (!name) throw new Error('Payment method name is required');
    if (s.paymentMethods.some(m => m.toLowerCase() === name.toLowerCase())) {
      throw new Error('"' + name + '" already exists');
    }
    return updateSettings({ paymentMethods: [...s.paymentMethods, name] }, session);
  }
  async function removePaymentMethod(method, session) {
    const s = await getSettings();
    return updateSettings({ paymentMethods: s.paymentMethods.filter(m => m !== method) }, session);
  }
  async function setShiftStartHour(hour, session) {
    const h = Number(hour);
    if (Number.isNaN(h) || h < 0 || h > 23) throw new Error('shiftStartHour must be 0\u201323');
    return updateSettings({ shiftStartHour: h }, session);
  }
  async function addDepartment(dept, session) {
    const s = await getSettings();
    const name = (dept || '').trim();
    if (!name) throw new Error('Department name is required');
    if (s.departments.includes(name)) throw new Error('"' + name + '" already exists');
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
    KEY, CONFIG, state,
    onChange, loadAll, getSettings,
    updateSettings,
    addPaymentMethod, removePaymentMethod,
    setShiftStartHour,
    addDepartment, removeDepartment,
    resetToDefaults, canEditSettings,
    getSession,
  };
})(window);
