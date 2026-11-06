/* HotelLogout — the one sign-out implementation every module shell calls.
 *
 * Each shell used to carry its own copy of the logout click handler, which
 * meant a device left half-signed-in as soon as one copy drifted. This keeps
 * the whole sign-out in one file: end the session on the server, let the
 * server drop the cookie, and scrub everything this device learned about the
 * person who just signed out.
 */
;(function (global) {
  'use strict';
  if (global.HotelLogout) return;

  // Everything below is per-user state. It must never survive into the next
  // person's session on a shared tablet — the cached identity is what makes
  // a booking look like it was made by whoever the screen says it was.
  var PER_USER_KEYS = [
    'aurum_user',
    'accounting-session',
    'aurum_last_active',
    'aurum_session_expired'
  ];

  function purgeDeviceState() {
    for (var i = 0; i < PER_USER_KEYS.length; i++) {
      try { localStorage.removeItem(PER_USER_KEYS[i]); } catch (e) {}
    }
    try { sessionStorage.clear(); } catch (e) {}
  }

  /**
   * end(apiBase) — signs out for real, then returns to the login page.
   * Redirects even when the server cannot be reached: the login page
   * force-ends any session it finds still alive, so a flaky network cannot
   * leave the device signed in as the previous staff member.
   */
  function end(apiBase) {
    var url = String(apiBase || '/api').replace(/\/$/, '') + '/auth/logout';
    purgeDeviceState();

    var done = function () {
      global.location.replace('/login.html');
    };

    try {
      // keepalive lets the request outlive the page unload it triggers.
      fetch(url, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }).then(function () {}, function () {
        try {
          global.navigator.sendBeacon(url, new Blob(['{}'], { type: 'application/json' }));
        } catch (e) {}
      }).then(done);
    } catch (e) { done(); }

    // Never let a hung request strand someone on a signed-out-looking screen.
    setTimeout(done, 1500);
  }

  global.HotelLogout = { end: end, purgeDeviceState: purgeDeviceState };
})(window);
