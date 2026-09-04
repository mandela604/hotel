/**
 * services/booking-service.js — Booking API client (window.BookingData)
 * ─────────────────────────────────────────────────────────────────
 * Production only — no demo/localStorage path. Talks directly to
 * routes/bookingRoutes.js + controllers/bookingController.js. Every page
 * (dashboard, list, rooms, reports, guests) calls these methods and only
 * renders the result.
 *
 * AUTH
 * ────
 * All write endpoints require authentication via httpOnly cookie
 * (credentials:'include') — apiFetch() below sends it automatically.
 * requirePerm() is UI-only (hide/disable a button before the round trip);
 * the server's roleGuard checks remain the real authorization boundary —
 * a 401/403 response is still surfaced as a thrown Error either way.
 *
 * CHECK-IN / CHECK-OUT
 * ─────────────────────
 * These have dedicated endpoints (POST /bookings/:room/checkin and
 * /checkout) — not the generic room-status PATCH — because they carry
 * their own logic server-side (setting real checkin/checkout timestamps,
 * finalizing the stay, etc.). checkoutBooking() always lands the room on
 * 'cleaning' immediately after checkout completes; staff can change that
 * to Available/Maintenance/etc. afterward as a separate, explicit action
 * via setRoomStatus().
 *
 * CHARGE SETTLEMENT — INDEX vs ID
 * ────────────────────────────────
 * Callers still address a guest's charges by array index (the shape
 * every page already uses), but the backend addresses a charge by its
 * string `id` field (PATCH /guests/:id/charges/:chargeId/settle).
 * addChargePayment()/settleCharge() resolve index -> id with one
 * GET /guests/:id first, so no page needs to change.
 *
 * Script order: services/permissions.js (optional), then this file.
 */
(function (global) {
  'use strict';

  const STATUS_CONFIG = [
    { value: 'checkedin',   label: 'Occupied',    tone: 'completed', color: '#12b76a' },
    { value: 'checkout',    label: 'Check Out',   tone: 'voided',    color: '#f04438' },
    { value: 'cleaning',    label: 'Cleaning',    tone: 'open',      color: '#3b82f6' },
    { value: 'vacant',      label: 'Available',   tone: 'all',       color: '#6b7280' },
    { value: 'reserved',    label: 'Reserved',    tone: 'pending',   color: '#f79009' },
    { value: 'maintenance', label: 'Maintenance', tone: 'open',      color: '#2f6fed' },
    { value: 'cancelled',   label: 'Cancelled',   tone: 'voided',    color: '#ef4444' },
  ];

  const CONFIG = {
    API_BASE: '/api/booking',
    // Where the JWT issued at login is stored. Adjust here in ONE place if
    // this app's auth flow stores it somewhere else — no other function
    // in this file needs to change.
    TOKEN_STORAGE_KEY: 'token',
  };

  /* ══════════════════════════════════════════════════════════════
     Pure helpers — no persistence, safe to run client-side for
     instant UI math (the server computes the same values on write).
  ══════════════════════════════════════════════════════════════ */
  function nights(ci, co) {
    if (!ci || !co) return 0;
    const n = (new Date(co) - new Date(ci)) / 86400000;
    return n > 0 ? n : 0;
  }
  function calcTotal(b) {
    const n = nights(b.checkin, b.checkout) || 1;
    return ((b.rate || 0) - (b.discount || 0)) * n;
  }
  function calcPaid(b) {
    var raw = 0;
    if (Array.isArray(b.payments) && b.payments.length) {
      raw = b.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    } else {
      raw = Number(b.paid) || 0;
    }
    return Math.max(0, raw - (Number(b.refunded) || 0));
  }
  function calcBal(b) { return Math.max(0, calcTotal(b) - calcPaid(b)); }

  function perm() { return global.Permissions || null; }
  function requirePerm(session, action, module, entity) {
    const P = perm();
    if (!P) return true;
    if (action === 'canEdit')         return P.canEdit(session, module, entity);
    if (action === 'canDelete')       return P.canDelete(session, module, entity);
    if (action === 'canGiveDiscount') return P.canGiveDiscount(session, module);
    return P.hasPermission(session, action, module);
  }
  function deny(msg) {
    const err = new Error(msg || 'Permission denied');
    err.code = 'PERMISSION_DENIED';
    throw err;
  }

  /* ══════════════════════════════════════════════════════════════
     Auth / session
  ══════════════════════════════════════════════════════════════ */
  function getToken() {
    // httpOnly cookie is sent automatically — no localStorage token needed.
    return '';
  }

  var _sessionCache = null;
  var _sessionPromise = null;
  function getSession() { return _sessionCache; }
  function fetchSession() {
    if (_sessionPromise) return _sessionPromise;
    _sessionPromise = fetch(CONFIG.API_BASE + '/api/auth/session', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        var u = d && d.data ? d.data : d;
        if (u && u.role) {
          _sessionCache = { name: u.name, role: u.role, privilege: u.privilege || null, initials: u.initials || '' };
        }
        return _sessionCache;
      })
      .catch(function() { return null; });
    return _sessionPromise;
  }

  /* ══════════════════════════════════════════════════════════════
     REST client
  ══════════════════════════════════════════════════════════════ */
  async function apiFetch(path, options) {
    options = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    // httpOnly cookie is sent automatically — no Authorization header needed.

    let res;
    try {
      res = await fetch(CONFIG.API_BASE + path, Object.assign({}, options, { headers, credentials: 'include'  }));
    } catch (networkErr) {
      throw new Error('Could not reach the server — check your connection.');
    }

    let body = null;
    try { body = await res.json(); } catch (e) { /* empty/non-JSON body */ }

    if (!res.ok) {
      const err = new Error((body && body.error) || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      err.field = body && body.field;
      throw err;
    }
    return body;
  }
  function get(path) { return apiFetch(path, { method: 'GET' }); }
  function post(path, data) { return apiFetch(path, { method: 'POST', body: JSON.stringify(data || {}) }); }
  function put(path, data) { return apiFetch(path, { method: 'PUT', body: JSON.stringify(data || {}) }); }
  function patch(path, data) { return apiFetch(path, { method: 'PATCH', body: JSON.stringify(data || {}) }); }
  function del(path) { return apiFetch(path, { method: 'DELETE' }); }

  /* ══════════════════════════════════════════════════════════════
     Public API — window.BookingData
  ══════════════════════════════════════════════════════════════ */
  async function getBookingData() {
    await fetchSession();
    const res = await get('/data');
    // Backend's /data doesn't carry a session (that's what the JWT is
    // for) — attach the best-effort decoded one so pages reading
    // `data.session.name` keep working unchanged.
    return Object.assign({}, res.data, { session: getSession() });
  }

  async function getBooking(roomNum) {
    const res = await get('/bookings/' + encodeURIComponent(roomNum));
    return res.data;
  }

  async function saveBooking(entry) {
    // Decide create vs edit: a room is only a "new stay" if it's
    // currently vacant / guest-less.
    let existing = null;
    try { existing = await getBooking(entry.room); } catch (e) { existing = null; }
    const isNewStay = !existing || !existing.guest;

    if (isNewStay) {
      const res = await post('/bookings', Object.assign({ status: entry.status || 'reserved' }, entry));
      return res.data;
    }
    const res = await put('/bookings/' + encodeURIComponent(entry.room), entry);
    return res.data;
  }

  async function addBookingPayment(roomNum, payment) {
    const res = await post('/bookings/' + encodeURIComponent(roomNum) + '/payments', payment);
    return res.data;
  }

  async function deleteBooking(roomNum) {
    const res = await del('/bookings/' + encodeURIComponent(roomNum));
    return res.data;
  }

  async function setRoomStatus(roomNum, status, patchBody) {
    const res = await patch('/rooms/' + encodeURIComponent(roomNum) + '/status', Object.assign({ status }, patchBody || {}));
    return res.data;
  }

  async function checkinBooking(roomNum, data) {
    const res = await post('/bookings/' + encodeURIComponent(roomNum) + '/checkin', data || {});
    return res.data;
  }

  /**
   * Checks the booking out, then always moves the room straight to
   * 'cleaning' — never left sitting in whatever raw post-checkout state
   * the backend returns. Staff change it to Available/Maintenance/etc.
   * afterward as its own explicit action (setRoomStatus), not as part
   * of checkout.
   */
  async function checkoutBooking(roomNum) {
    const res = await post('/bookings/' + encodeURIComponent(roomNum) + '/checkout', {});
    await setRoomStatus(roomNum, 'cleaning');
    return res.data;
  }

  async function saveRoom(room) {
    const originalNum = room.originalNum || room.num;
    let exists = false;
    try {
      const list = await get('/rooms');
      exists = (list.data || []).some(function (r) { return r.num === originalNum; });
    } catch (e) { exists = false; }

    if (exists) {
      const res = await put('/rooms/' + encodeURIComponent(originalNum), room);
      return res.data;
    }
    const res = await post('/rooms', room);
    return res.data;
  }

  async function getGuest(idOrName) {
    const res = await get('/guests/' + encodeURIComponent(idOrName));
    return res.data;
  }

  async function saveGuest(patchBody) {
    const id = patchBody && (patchBody.id || patchBody.guestId);
    if (!id) throw new Error('saveGuest() requires patch.id (the guest id).');
    const res = await patch('/guests/' + encodeURIComponent(id), patchBody);
    return res.data;
  }

  async function addRoomCharge(guestId, charge) {
    const res = await post('/guests/' + encodeURIComponent(guestId) + '/charges', charge);
    return res.data;
  }

  // Resolves a charge's array index to its string id, then
  // settles through the real endpoint. See the header note on why this
  // extra lookup exists.
  async function resolveChargeId(guestId, chargeIndex) {
    const guest = await getGuest(guestId);
    if (!guest || !guest.charges || !guest.charges[chargeIndex]) throw new Error('Charge not found');
    return guest.charges[chargeIndex].id;
  }

  async function addChargePayment(guestId, chargeIndex, payment) {
    const chargeId = await resolveChargeId(guestId, chargeIndex);
    const res = await patch('/guests/' + encodeURIComponent(guestId) + '/charges/' + encodeURIComponent(chargeId) + '/settle', payment || {});
    return res.data;
  }

  async function settleCharge(guestId, chargeIndex) {
    const chargeId = await resolveChargeId(guestId, chargeIndex);
    const res = await patch('/guests/' + encodeURIComponent(guestId) + '/charges/' + encodeURIComponent(chargeId) + '/settle', {});
    return res.data;
  }

  async function settleAllCharges(guestId, mode) {
    const res = await post('/guests/' + encodeURIComponent(guestId) + '/charges/settle-all', { mode: mode || 'Cash' });
    return res.data;
  }

  global.BookingData = {
    CONFIG,
    getBookingData, getBooking,
    saveBooking, addBookingPayment, deleteBooking,
    setRoomStatus, checkinBooking, checkoutBooking,
    saveRoom,
    getGuest, saveGuest, addRoomCharge, addChargePayment, settleCharge, settleAllCharges,
    nights, calcTotal, calcPaid, calcBal,
    getSession,
    getStatusConfig: () => JSON.parse(JSON.stringify(STATUS_CONFIG)),
  };
})(window);