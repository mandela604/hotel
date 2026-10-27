/* Boston Print Station — same-PC handshake (BroadcastChannel).
   POS tabs periodically ask "who is alive?"; the print-station page
   answers. POS payments then skip the local print dialog when the
   station confirmed itself alive, so a shared PC prints exactly once.
   Also carries manual print requests from order pages to the station:
   { type:'manualPrint', receiptType:'captain'|'bill'|'receipt',
     dept:'Pool Bar'|'Restaurant', data:{...} }
   Same-origin / same-browser only — other devices keep printing locally. */
(function (global) {
  'use strict';

  var CH = 'boston-print-station';
  var lastHello = 0;
  var isStation = false;
  var bc = null;
  try { bc = ('BroadcastChannel' in global) ? new BroadcastChannel(CH) : null; } catch (e) { bc = null; }

  function post(msg) { try { if (bc) bc.postMessage(msg); } catch (e) {} }
  function ask() { post({ type: 'who' }); }
  function hello() { post({ type: 'hello' }); }

  if (bc) {
    bc.onmessage = function (e) {
      var m = e.data || {};
      if (m.type === 'hello') { if (!isStation) lastHello = Date.now(); }
      else if (m.type === 'who') { if (isStation) hello(); }
      else if (m.type === 'bye') { lastHello = 0; }
      else if (m.type === 'manualPrint' && isStation) {
        try { if (typeof global.__onManualPrint === 'function') global.__onManualPrint(m); } catch (err) {}
      }
    };
    ask();
    global.setInterval(ask, 10000);
    global.addEventListener('focus', ask);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
  }

  global.StationWatch = {
    isAlive: function () { return !!bc && (Date.now() - lastHello) < 30000; },
    print: function (msg) { post(Object.assign({ type: 'manualPrint' }, msg)); },
    startAsStation: function () {
      if (!bc || isStation) return;
      isStation = true;
      hello();
      global.setInterval(hello, 2000);
      global.addEventListener('pagehide', function () { post({ type: 'bye' }); });
      global.addEventListener('beforeunload', function () { post({ type: 'bye' }); });
    }
  };
})(window);
