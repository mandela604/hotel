/* Idle auto-logout for shared devices.
 *
 * The hotel-wide window comes from Settings -> Session Timeout
 * (`sessionTimeoutMinutes` in the Config document, exposed by
 * GET /api/auth/session). 0 disables the feature.
 *
 * Activity is shared across every tab through localStorage, so working in
 * one tab keeps the others alive, and closing a tab cannot log a busy user
 * out. When the window runs out the guard ends the session for real
 * (server-side revoke), clears the cached identity and returns to login.
 */
;(function (global) {
  'use strict';
  if (global.SessionGuard) return;

  var SCRIPT = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  })();
  var ROOT = (SCRIPT && SCRIPT.src)
    ? SCRIPT.src.replace(/\/services\/session-guard\.js(\?.*)?$/, '')
    : '';
  var LOGIN_URL = ROOT + '/login.html';
  var ACTIVITY_KEY = 'aurum_last_active';
  var EXPIRE_KEY = 'aurum_session_expired';
  var POLL_MS = 5000;

  var timeoutSec = 0;
  var lastLocalWrite = 0;
  var started = false;
  var ended = false;
  var ticker = null;
  var overlay = null;
  var expiringAt = 0;

  function now() { return Date.now(); }

  function readShared() {
    var v = 0;
    try { v = parseInt(localStorage.getItem(ACTIVITY_KEY), 10); } catch (e) {}
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  function touch() {
    if (!started || ended) return;
    try { if (localStorage.getItem(EXPIRE_KEY)) return; } catch (e) {}
    var t = now();
    if (t - lastLocalWrite < 2000) return;
    lastLocalWrite = t;
    try { localStorage.setItem(ACTIVITY_KEY, String(t)); } catch (e) {}
    hideOverlay();
  }

  function onActivity() { touch(); }

  var EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel', 'click', 'focus'];

  function bindActivity() {
    EVENTS.forEach(function (name) {
      global.addEventListener(name, onActivity, { passive: true, capture: true });
    });
  }

  function unbindActivity() {
    EVENTS.forEach(function (name) {
      try { global.removeEventListener(name, onActivity, true); } catch (e) {}
    });
  }

  function fmt(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    return m > 0 ? m + ' min ' + (s < 10 ? '0' + s : s) + ' s' : s + ' s';
  }

  function showOverlay(remainingSec) {
    if (overlay) {
      var label = overlay.querySelector('[data-sg-countdown]');
      if (label) label.textContent = fmt(remainingSec);
      return;
    }
    overlay = document.createElement('div');
    overlay.setAttribute('data-session-guard', '1');
    overlay.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'inset:0',
      'background:rgba(8,10,16,.66)', 'display:flex',
      'align-items:center', 'justify-content:center',
      'font-family:Inter,system-ui,-apple-system,sans-serif'
    ].join(';');
    overlay.innerHTML =
      '<div style="background:#151a24;border:1px solid #2b3446;border-radius:14px;' +
      'padding:26px 28px;max-width:380px;text-align:center;color:#e7ecf5;' +
      'box-shadow:0 24px 70px rgba(0,0,0,.55)">' +
        '<div style="font-size:15px;font-weight:700;margin-bottom:8px">Still there?</div>' +
        '<div style="font-size:13px;line-height:1.6;color:#9aa6ba">' +
          'You will be signed out in ' +
          '<strong style="color:#e7ecf5" data-sg-countdown>--</strong> ' +
          'because nobody has used this device.' +
        '</div>' +
        '<button type="button" data-sg-stay style="margin-top:18px;padding:10px 20px;' +
        'border:0;border-radius:9px;background:#2f6fed;color:#fff;font-size:13px;' +
        'font-weight:600;cursor:pointer">Stay signed in</button>' +
      '</div>';
    overlay.querySelector('[data-sg-stay]').addEventListener('click', function () {
      lastLocalWrite = 0;
      touch();
      hideOverlay();
    });
    document.body.appendChild(overlay);
    expiringAt = now();
    var label = overlay.querySelector('[data-sg-countdown]');
    if (label) label.textContent = fmt(remainingSec);
  }

  function hideOverlay() {
    if (!overlay) return;
    try { overlay.parentNode.removeChild(overlay); } catch (e) {}
    overlay = null;
    expiringAt = 0;
  }

  function expire() {
    if (ended) return;
    ended = true;
    stopTicker();
    unbindActivity();
    hideOverlay();
    try { localStorage.removeItem(ACTIVITY_KEY); } catch (e) {}
    // Tell the other open tabs to go too, instead of each one waiting for
    // its own timer (one of them could otherwise record fresh activity).
    try { localStorage.setItem(EXPIRE_KEY, String(now())); } catch (e) {}
    try { localStorage.removeItem('aurum_user'); } catch (e) {}
    try { localStorage.removeItem('accounting-session'); } catch (e) {}
    var done = function () {
      location.replace(LOGIN_URL + '?expired=1');
    };
    try {
      fetch(ROOT + '/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }).then(done, done);
      setTimeout(done, 1500);
    } catch (e) { done(); }
  }

  function check() {
    if (!started || ended) return;
    try { if (localStorage.getItem(EXPIRE_KEY)) { expire(); return; } } catch (e) {}
    if (timeoutSec <= 0) return;
    var last = Math.max(readShared(), lastLocalWrite);
    if (!last) {
      lastLocalWrite = now();
      try { localStorage.setItem(ACTIVITY_KEY, String(lastLocalWrite)); } catch (e) {}
      return;
    }
    var idle = (now() - last) / 1000;
    var remaining = timeoutSec - idle;
    if (remaining <= 0) { expire(); return; }
    var warnAt = Math.min(120, Math.max(15, Math.round(timeoutSec * 0.15)));
    if (remaining <= warnAt) showOverlay(remaining);
    else hideOverlay();
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(check, POLL_MS);
  }

  function stopTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  }

  function start(minutes) {
    if (started) return;
    var mins = Number(minutes);
    timeoutSec = (Number.isFinite(mins) && mins >= 0) ? mins * 60 : 0;
    if (timeoutSec <= 0) return;
    started = true;
    lastLocalWrite = now();
    try { localStorage.removeItem(EXPIRE_KEY); } catch (e) {}
    try { localStorage.setItem(ACTIVITY_KEY, String(lastLocalWrite)); } catch (e) {}
    bindActivity();
    startTicker();
  }

  function init() {
    if (started) return;
    try {
      fetch(ROOT + '/api/auth/session', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (!res.ok) return null;
        return res.json();
      }).then(function (payload) {
        if (!payload || !payload.success || !payload.user) return;
        var mins = payload.sessionTimeoutMinutes;
        start(typeof mins === 'number' ? mins : 60);
      }).catch(function () {});
    } catch (e) {}
  }

  global.SessionGuard = {
    start: start,
    touch: touch,
    stop: function () { ended = true; stopTicker(); unbindActivity(); hideOverlay(); },
    remaining: function () {
      if (!started || timeoutSec <= 0) return null;
      return Math.max(0, timeoutSec - (now() - Math.max(readShared(), lastLocalWrite)) / 1000);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
