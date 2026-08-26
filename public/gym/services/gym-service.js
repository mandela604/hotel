/**
 * services/gym-service.js — Shared data + business logic for Gym module
 * Production only — talks to the real backend (routes/gym.js).
 * Optional: services/permissions.js (window.Permissions)
 * Optional: BookingData (booking-service.js) — posts Room Charge payments
 *           to guest folio via addRoomCharge, and is the source of truth
 *           for in-house guests (see getInHouseGuests below).
 *
 * Load order:
 *   permissions.js (optional)
 *   services/gym-service.js
 *   page script
 */
(function (global) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     CONFIG
  ══════════════════════════════════════════════════════════════ */
  const CONFIG = {
    API_BASE: '/api/gym',
    BOOKING_API_BASE: '/api/booking',
    TOKEN_STORAGE_KEY: 'token',
  };

  /* ══════════════════════════════════════════════════════════════
     Shared helpers
  ══════════════════════════════════════════════════════════════ */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }

  function computeStatus(member) {
    if (!member.planId) return 'expired';
    if (member.status === 'frozen') return 'frozen';
    const days = daysUntil(member.expiry);
    if (days === null) return 'active';
    if (days < 0) return 'expired';
    if (days <= 7) return 'expiring';
    return 'active';
  }

  function fmtN(n) {
    return '₦' + Math.round(n || 0).toLocaleString('en-NG');
  }

  function fmtDate(s) {
    if (!s) return '—';
    return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  function initials(name) {
    return (name || '').split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /* ══════════════════════════════════════════════════════════════
     PRODUCTION MODE — real REST client against routes/gym.js
  ══════════════════════════════════════════════════════════════ */
  function getToken() {
    // httpOnly cookie is sent automatically — no localStorage token needed.
    return '';
  }

  function decodeJwtPayload(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  async function apiFetch(path, options) {
    options = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    // httpOnly cookie is sent automatically — no Authorization header needed.

    let res;
    try {
      res = await fetch(CONFIG.API_BASE + path, Object.assign({}, options, { headers }));
    } catch (networkErr) {
      throw new Error('Could not reach the server — check your connection.');
    }

    let body = null;
    try { body = await res.json(); } catch (e) { /* empty/non-JSON */ }

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
  function del(path) { return apiFetch(path, { method: 'DELETE' }); }

  // Production: all data loaded from backend on init
  async function prodLoadAll() {
    const [membersRes, plansRes, checkinsRes, guestsRes] = await Promise.all([
      get('/members'),
      get('/plans'),
      get('/checkins'),
      get('/guests'),
    ]);
    const members = (membersRes && membersRes.data) || [];
    const plans = (plansRes && plansRes.data) || [];
    const checkins = (checkinsRes && checkinsRes.data) || [];
    const guests = (guestsRes && guestsRes.data) || [];
    members.forEach(m => { if (!Array.isArray(m.payments)) m.payments = []; });
    return { members, plans, checkins, guests };
  }

  // Production: getInHouseGuests via booking API
  async function prodGetInHouseGuests() {
    const headers = { 'Content-Type': 'application/json' };

    let res;
    try {
      res = await fetch(CONFIG.BOOKING_API_BASE + '/data', { headers, credentials: 'include' });
    } catch (e) {
      throw new Error('Could not reach the booking server.');
    }
    let body = null;
    try { body = await res.json(); } catch (_) { /* empty */ }
    if (!res.ok) throw new Error((body && body.error) || 'Booking data unavailable');

    const bookings = (body && body.data && body.data.bookings) || [];
    return bookings
      .filter(b => b.status === 'checkedin' && b.guest)
      .map(b => ({ room: String(b.room || ''), name: b.guest || '', phone: b.phone || '', status: 'In-House' }));
  }

  // Production: postToGuestFolio via booking API directly
  async function prodPostToGuestFolio(opts) {
    if (!opts.roomNumber) throw new Error('Room number is required.');
    const headers = { 'Content-Type': 'application/json' };

    // Find the in-house guest for this room
    let bookings = [];
    try {
      const res = await fetch(CONFIG.BOOKING_API_BASE + '/data', { headers, credentials: 'include' });
      const body = await res.json();
      bookings = (body && body.data && body.data.bookings) || [];
    } catch (e) {
      throw new Error('Could not reach the booking server.');
    }
    const booking = bookings.find(b => b.room === opts.roomNumber && b.status === 'checkedin');
    if (!booking) throw new Error('No checked-in guest found in room ' + opts.roomNumber);

    // Find the guest profile to get the guestId
    const guestName = opts.guestName || booking.guest;
    let guestId = null;
    try {
      const gRes = await fetch(CONFIG.BOOKING_API_BASE + '/guests?search=' + encodeURIComponent(guestName), { headers, credentials: 'include' });
      const gBody = await gRes.json();
      const guests = (gBody && gBody.data) || [];
      const match = guests.find(g => g.name === guestName);
      if (match) guestId = match._id || match.guestId;
    } catch (_) { /* best effort */ }

    if (!guestId) throw new Error('Guest profile not found for room ' + opts.roomNumber);

    const desc = opts.desc || 'Gym charge';
    const chargeRes = await fetch(CONFIG.BOOKING_API_BASE + '/guests/' + encodeURIComponent(guestId) + '/charges', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        desc, amount: opts.amount, source: 'Gym', room: opts.roomNumber,
      }),
    });
    const chargeBody = await chargeRes.json().catch(() => null);
    if (!chargeRes.ok) throw new Error((chargeBody && chargeBody.error) || 'Failed to post room charge');
  }

  /* ══════════════════════════════════════════════════════════════
     Service class — production REST client
  ══════════════════════════════════════════════════════════════ */
  class GymService {
    constructor() {
      this.state = { members: [], plans: [], checkins: [], guests: [] };
      this._listeners = [];
      this._loaded = false;
      this.CONFIG = CONFIG;
    }

    async loadAll() {
      const data = await prodLoadAll();
      this.state.members = data.members;
      this.state.plans = data.plans;
      this.state.checkins = data.checkins;
      this.state.guests = data.guests;
      this._loaded = true;
      this._notify();
      return this.state;
    }

    onChange(cb) {
      if (typeof cb === 'function') {
        this._listeners.push(cb);
        if (this._loaded) cb(this.state);
      }
    }
    _notify() {
      const s = this.state;
      this._listeners.forEach(fn => fn(s));
    }

    // ── Getters ──
    getMembers() { return this.state.members; }
    getPlans() { return this.state.plans; }
    getCheckins() { return this.state.checkins; }
    getGuests() { return this.state.guests; }
    findMember(id) { return this.state.members.find(m => m.id === id); }
    findPlan(id) { return this.state.plans.find(p => p.id === id); }

    // ── Billing ──
    calcTotal(member) {
      if (!member) return 0;
      if (member.totalDue != null) return Number(member.totalDue) || 0;
      const plan = this.findPlan(member.planId);
      return plan ? (plan.price || 0) : 0;
    }
    calcPaid(member) {
      if (!member) return 0;
      if (Array.isArray(member.payments) && member.payments.length) {
        return member.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      }
      return Number(member.amountPaid) || 0;
    }
    calcBal(member) { return Math.max(0, this.calcTotal(member) - this.calcPaid(member)); }

    // ── KPIs ──
    getDashboardKPIs() {
      const members = this.state.members;
      const withStatus = members.map(m => ({ ...m, _s: computeStatus(m) }));
      const active = withStatus.filter(m => m._s === 'active').length;
      const expiring = withStatus.filter(m => m._s === 'expiring').length;
      const expired = withStatus.filter(m => m._s === 'expired').length;
      const frozen = withStatus.filter(m => m._s === 'frozen').length;
      const revenue = withStatus
        .filter(m => m._s === 'active' || m._s === 'expiring')
        .reduce((sum, m) => {
          const plan = this.findPlan(m.planId);
          return sum + (plan ? plan.price : 0);
        }, 0);
      return { active, expiring, expired, frozen, revenue, total: members.length };
    }

    // ── Member operations ──
    async saveMember(entry) {
      if (!entry || !entry.name || !entry.name.trim()) throw new Error('Name is required');
      const isNew = !entry.id;
      const payload = {
        name: entry.name.trim(), planId: entry.planId || null,
        room: entry.room || '', phone: entry.phone || '',
        joined: entry.joined || new Date().toISOString().split('T')[0],
        expiry: entry.expiry || '', notes: entry.notes || '',
        status: entry.status || 'active', totalDue: Number(entry.totalDue) || 0,
      };
      const res = isNew
        ? await post('/members', payload)
        : await put('/members/' + encodeURIComponent(entry.id), payload);
      const data = res.data;
      const idx = this.state.members.findIndex(m => m.id === data.id);
      if (idx > -1) this.state.members[idx] = data; else this.state.members.push(data);
      this._notify();
      return data;
    }

    async editMember(id, updates) {
      const res = await put('/members/' + encodeURIComponent(id), updates);
      const data = res.data;
      const idx = this.state.members.findIndex(m => m.id === data.id);
      if (idx > -1) this.state.members[idx] = data;
      this._notify();
      return data;
    }

    async deleteMember(id) {
      await del('/members/' + encodeURIComponent(id));
      this.state.members = this.state.members.filter(m => m.id !== id);
      this._notify();
    }

    async addMemberPayment(memberId, opts) {
      opts = opts || {};
      const amount = Number(opts.amount) || 0;
      if (amount <= 0) throw new Error('Enter a payment amount greater than zero.');
      const mode = opts.mode || 'Cash';
      const isRoomCharge = mode === 'Room Charge';
      if (isRoomCharge && !opts.roomNumber) {
        throw new Error('Select a room to charge this payment to.');
      }

      const payload = {
        amount, mode, by: opts.by || 'Gym Attendant',
        roomNumber: opts.roomNumber || null,
        guestName: opts.guestName || null,
        guestPhone: opts.guestPhone || null,
      };
      const res = await post('/members/' + encodeURIComponent(memberId) + '/payments', payload);
      const data = res.data;
      const idx = this.state.members.findIndex(m => m.id === data.id);
      if (idx > -1) this.state.members[idx] = data;
      this._notify();
      return data;
    }

    async renewMember(memberId, newExpiry) {
      if (!newExpiry) throw new Error('New expiry date is required');
      const res = await post('/members/' + encodeURIComponent(memberId) + '/renew', { newExpiry });
      const data = res.data;
      const idx = this.state.members.findIndex(m => m.id === data.id);
      if (idx > -1) this.state.members[idx] = data;
      this._notify();
      return data;
    }

    // ── Check-in ──
    async checkIn(memberId) {
      const res = await post('/checkins', { memberId });
      const checkin = res.data;
      try {
        const membersRes = await get('/members');
        const updatedMembers = (membersRes && membersRes.data) || [];
        this.state.members = updatedMembers;
      } catch (_) { /* non-fatal — the checkin still recorded */ }
      this.state.checkins.unshift(checkin);
      if (this.state.checkins.length > 200) this.state.checkins = this.state.checkins.slice(0, 200);
      this._notify();
      return checkin;
    }

    // ── Plans ──
    async addPlan(data) {
      const res = await post('/plans', data);
      const plan = res.data;
      this.state.plans.push(plan);
      this._notify();
      return plan;
    }

    async editPlan(id, updates) {
      const res = await put('/plans/' + encodeURIComponent(id), updates);
      const plan = res.data;
      const idx = this.state.plans.findIndex(p => p.id === plan.id);
      if (idx > -1) this.state.plans[idx] = plan;
      this._notify();
      return plan;
    }

    async deletePlan(id) {
      await del('/plans/' + encodeURIComponent(id));
      this.state.plans = this.state.plans.filter(p => p.id !== id);
      this._notify();
    }

    // ── Guests ──
    async addGuest(data) {
      const res = await post('/guests', data);
      const guest = res.data;
      this.state.guests.push(guest);
      this._notify();
      return guest;
    }

    async deleteGuest(id) {
      await del('/guests/' + encodeURIComponent(id));
      this.state.guests = this.state.guests.filter(g => g.id !== id);
      this._notify();
    }

    // ── In-house guests (Booking module) ──
    async getInHouseGuests() {
      return prodGetInHouseGuests();
    }

    async postToGuestFolio(opts) {
      return prodPostToGuestFolio(opts);
    }

    // ── Revenue report ──
    getRevenueReport(fromDate, toDate) {
      const members = this.state.members;
      const checkins = this.state.checkins;
      const plans = this.state.plans;
      const planMap = {};
      plans.forEach(p => { planMap[p.id] = p; });
      const NO_PLAN = { id: 'none', name: 'No Plan', price: 0, color: 'blue' };

      const filterDate = (dateStr) => {
        if (!dateStr) return false;
        if (fromDate && dateStr < fromDate) return false;
        if (toDate && dateStr > toDate) return false;
        return true;
      };

      const newMembers = members.filter(m => filterDate(m.joined));
      const checkinsInRange = checkins.filter(ci => {
        const d = ci.time ? ci.time.split('T')[0] : null;
        return filterDate(d);
      });
      const activeMembers = members.filter(m => {
        if (!m.planId) return false;
        if (m.status === 'frozen') return false;
        const days = daysUntil(m.expiry);
        return days !== null && days >= 0;
      }).length;

      // Revenue from payment ledger (member.payments[]), filtered by
      // payment date — not member join date. Legacy fallback for records
      // saved before installment tracking existed.
      const paymentsFlat = [];
      members.forEach(m => {
        const plan = planMap[m.planId] || NO_PLAN;
        const ledger = (Array.isArray(m.payments) && m.payments.length)
          ? m.payments
          : (Number(m.amountPaid) > 0
              ? [{ amount: m.amountPaid, mode: 'Cash', date: m.joined, by: '—', ts: null, roomNumber: null }]
              : []);
        ledger.forEach(p => {
          if (!filterDate(p.date)) return;
          paymentsFlat.push({ member: m, plan, payment: p });
        });
      });
      paymentsFlat.sort((a, b) => String(b.payment.date).localeCompare(String(a.payment.date)));

      const revenueByPlan = {};
      let totalRevenue = 0;
      paymentsFlat.forEach(({ plan, payment }) => {
        const key = plan.id;
        if (!revenueByPlan[key]) revenueByPlan[key] = { plan, count: 0, subtotal: 0 };
        revenueByPlan[key].count++;
        revenueByPlan[key].subtotal += Number(payment.amount) || 0;
        totalRevenue += Number(payment.amount) || 0;
      });

      return {
        period: { from: fromDate, to: toDate },
        totalRevenue,
        paymentsCount: paymentsFlat.length,
        newMembersCount: newMembers.length,
        checkinsCount: checkinsInRange.length,
        activeMembers,
        revenueByPlan: Object.values(revenueByPlan),
        payments: paymentsFlat,
        newMembers,
      };
    }
  }

  // ── Expose global ──
  const svc = new GymService();
  svc.computeStatus = computeStatus;
  svc.fmtN = fmtN;
  svc.fmtDate = fmtDate;
  svc.initials = initials;
  svc.daysUntil = daysUntil;
  global.GymService = svc;

})(window);
