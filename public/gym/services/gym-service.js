/* ═══════════════════════════════════════════════════════════════
   GymService — central state and operations for the Gym module.
   Uses the same storage abstraction as RestaurantService.

   WHAT'S NEW IN THIS VERSION
   ───────────────────────────
   FIX: getRevenueReport() was computing revenue from member.joined
   (new sign-ups) and plan.price, completely ignoring the payment
   ledger (member.payments[]) that addMemberPayment() writes. That
   meant any revenue from renewals, installments, or Room Charge
   payments on an existing member was invisible — the report only
   ever "saw" a member's very first sign-up day. Fixed to sum
   member.payments[] filtered by the payment's own date, with a
   one-time fallback (amountPaid @ joined date) for any member saved
   before installment tracking existed, so old records don't just
   vanish from the report. "New Members" / "Active Members" /
   "Check-ins" stats are unchanged — those are legitimately about
   sign-up/activity dates, not money.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  // ── Storage keys ──
  const KEYS = {
    MEMBERS:  'gym-members',
    PLANS:    'gym-plans',
    CHECKINS: 'gym-checkins',
    GUESTS:   'hotel-guests',
  };

  // ── Storage abstraction (fallback to localStorage) ──
  function getStorage() {
    if (window.storage) return window.storage;
    return {
      async get(key, shared) {
        const v = localStorage.getItem(key);
        return v == null ? null : { key, value: v, shared };
      },
      async set(key, value, shared) {
        localStorage.setItem(key, value);
        return { key, value, shared };
      },
      async delete(key, shared) {
        localStorage.removeItem(key);
        return { key, deleted: true, shared };
      },
      async list(prefix, shared) {
        const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
        return { keys, prefix, shared };
      }
    };
  }

  // ── Helpers ──
  function genId(prefix) {
    return prefix + Date.now() + Math.floor(Math.random() * 10000);
  }

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
      day: '2-digit', month: 'short', year: 'numeric'
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

  // Captured synchronously while this file executes as a plain
  // <script src> tag — used to resolve where booking-demo-seed.js and
  // booking-service.js live relative to THIS file, not relative to
  // whatever page happens to load it. Same trick RestaurantService and
  // PoolBarService use.
  const OWN_SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  function resolveRelative(rel) {
    if (!OWN_SCRIPT_SRC) return rel;
    try { return new URL(rel, OWN_SCRIPT_SRC).href; } catch (e) { return rel; }
  }
  function loadScriptTag(url) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = url;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load script: ' + url)); };
      document.head.appendChild(s);
    });
  }

  // ── Service class ──
  class GymService {
    constructor() {
      this.state = {
        members: [],
        plans: [],
        checkins: [],
        guests: [],
      };
      this._listeners = [];
      this._loaded = false;
      this.KEYS = KEYS;
      this._storage = getStorage();
      this._bookingDataPromise = null;
    }

    // ── Load / Seed ──
    async loadAll(seedData) {
      const storage = this._storage;
      const load = async (key) => {
        const r = await storage.get(key, true);
        if (r && r.value) {
          try {
            const parsed = JSON.parse(r.value);
            if (Array.isArray(parsed)) return parsed;
          } catch (_) { /* ignore */ }
        }
        return null;
      };

      let members = await load(KEYS.MEMBERS);
      let plans = await load(KEYS.PLANS);
      let checkins = await load(KEYS.CHECKINS);
      let guests = await load(KEYS.GUESTS);

      // If any key is empty and seedData provided, fill from seed
      if (seedData) {
        if (!members || members.length === 0) members = seedData.members || [];
        if (!plans || plans.length === 0) plans = seedData.plans || [];
        if (!checkins || checkins.length === 0) checkins = seedData.checkins || [];
        if (!guests || guests.length === 0) guests = seedData.guests || [];

        // Save seeded data
        await Promise.all([
          storage.set(KEYS.MEMBERS, JSON.stringify(members), true),
          storage.set(KEYS.PLANS, JSON.stringify(plans), true),
          storage.set(KEYS.CHECKINS, JSON.stringify(checkins), true),
          storage.set(KEYS.GUESTS, JSON.stringify(guests), true),
        ]);
      }

      // Backfill `payments` on any member saved before installment
      // support existed, so calcPaid()/renderPayments() never choke on
      // a missing array.
      (members || []).forEach(m => { if (!Array.isArray(m.payments)) m.payments = []; });

      this.state.members = members || [];
      this.state.plans = plans || [];
      this.state.checkins = checkins || [];
      this.state.guests = guests || [];
      this._loaded = true;
      this._notify();
      return this.state;
    }

    // ── Listeners ──
    onChange(callback) {
      if (typeof callback === 'function') {
        this._listeners.push(callback);
        if (this._loaded) callback(this.state);
      }
    }

    _notify() {
      const s = this.state;
      this._listeners.forEach(fn => fn(s));
    }

    // ── Core getters ──
    getMembers() { return this.state.members; }
    getPlans() { return this.state.plans; }
    getCheckins() { return this.state.checkins; }
    getGuests() { return this.state.guests; }

    findMember(id) {
      return this.state.members.find(m => m.id === id);
    }

    findPlan(id) {
      return this.state.plans.find(p => p.id === id);
    }

    // ── Billing (mirrors BookingData.calcTotal/calcPaid/calcBal) ───
    /** Total owed for this membership: an explicit totalDue wins, else the plan's price, else 0. */
    calcTotal(member) {
      if (!member) return 0;
      if (member.totalDue != null) return Number(member.totalDue) || 0;
      const plan = this.findPlan(member.planId);
      return plan ? (plan.price || 0) : 0;
    }
    /** Sum of every recorded installment; falls back to legacy amountPaid for records saved before payments[] existed. */
    calcPaid(member) {
      if (!member) return 0;
      if (Array.isArray(member.payments) && member.payments.length) {
        return member.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      }
      return Number(member.amountPaid) || 0;
    }
    calcBal(member) {
      return Math.max(0, this.calcTotal(member) - this.calcPaid(member));
    }

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
    /**
     * Create OR update a member record — the single save path
     * GymMemberModal uses for both "New Member" and "Edit Member".
     * Preserves checkins/lastCheckin/payments/status when editing an
     * existing member unless the caller explicitly overrides them.
     */
    async saveMember(entry) {
      if (!entry || !entry.name || !entry.name.trim()) throw new Error('Name is required');
      const idx = entry.id ? this.state.members.findIndex(m => m.id === entry.id) : -1;

      if (idx === -1) {
        const member = Object.assign({
          id: entry.id || genId('gm'),
          checkins: 0,
          lastCheckin: null,
          payments: [],
          status: 'active',
          amountPaid: 0,
        }, entry);
        if (!Array.isArray(member.payments)) member.payments = [];
        this.state.members.push(member);
        await this._saveKey(KEYS.MEMBERS, this.state.members);
        this._notify();
        return member;
      }

      const existing = this.state.members[idx];
      const updated = Object.assign({}, existing, entry, {
        // Never let a save from the form wipe payment history or
        // check-in counters — those only ever change via their own
        // dedicated methods (addMemberPayment / checkIn).
        payments: existing.payments || [],
        checkins: existing.checkins || 0,
        lastCheckin: existing.lastCheckin || null,
      });
      this.state.members[idx] = updated;
      await this._saveKey(KEYS.MEMBERS, this.state.members);
      this._notify();
      return updated;
    }

    /**
     * Record one installment payment against a member — same shape as
     * BookingData's payment ledger: { amount, mode, date, by, ts }.
     * If mode is 'Room Charge', posts the amount to the guest's folio
     * via postToGuestFolio() (non-fatal to the payment itself if the
     * folio post fails — the payment is still recorded, but the caller
     * gets the error back so the UI can say so).
     */
    async addMemberPayment(memberId, opts) {
      opts = opts || {};
      const member = this.findMember(memberId);
      if (!member) throw new Error('Member not found');
      const amount = Number(opts.amount) || 0;
      if (amount <= 0) throw new Error('Enter a payment amount greater than zero.');
      const mode = opts.mode || 'Cash';
      const isRoomCharge = mode === 'Room Charge';
      if (isRoomCharge && !opts.roomNumber) {
        throw new Error('Select a room to charge this payment to.');
      }

      if (!Array.isArray(member.payments)) member.payments = [];
      const payment = {
        amount,
        mode,
        date: new Date().toISOString().split('T')[0],
        by: opts.by || 'Gym Attendant',
        ts: Date.now(),
        roomNumber: isRoomCharge ? opts.roomNumber : null,
      };
      member.payments.push(payment);
      member.amountPaid = this.calcPaid(member); // keep legacy field in sync for any older readers
      await this._saveKey(KEYS.MEMBERS, this.state.members);

      let folioError = null;
      if (isRoomCharge) {
        const plan = this.findPlan(member.planId);
        try {
          await this.postToGuestFolio({
            roomNumber: opts.roomNumber,
            guestName: opts.guestName,
            amount,
            desc: (plan ? plan.name : 'Gym membership') + ' — ' + member.name,
            by: opts.by || 'Gym Attendant',
          });
        } catch (e) {
          folioError = e;
          console.warn('[GymService] room charge folio post failed:', e && e.message ? e.message : e);
        }
      }

      this._notify();
      if (folioError) {
        // Payment IS recorded — surface the folio failure separately so
        // the modal can tell the user without pretending the payment
        // itself didn't go through.
        const err = new Error('Payment recorded, but the room charge failed: ' + folioError.message);
        err.paymentRecorded = true;
        err.member = member;
        throw err;
      }
      return member;
    }

    async editMember(id, updates) {
      const idx = this.state.members.findIndex(m => m.id === id);
      if (idx === -1) throw new Error('Member not found');
      const member = this.state.members[idx];
      const allowed = ['name', 'planId', 'room', 'phone', 'joined', 'expiry', 'notes', 'status', 'amountPaid', 'totalDue'];
      for (const key of allowed) {
        if (updates[key] !== undefined) member[key] = updates[key];
      }
      await this._saveKey(KEYS.MEMBERS, this.state.members);
      this._notify();
      return member;
    }

    async deleteMember(id) {
      const idx = this.state.members.findIndex(m => m.id === id);
      if (idx === -1) throw new Error('Member not found');
      this.state.members.splice(idx, 1);
      await this._saveKey(KEYS.MEMBERS, this.state.members);
      this._notify();
    }

    // ── Check-in ──
    async checkIn(memberId) {
      const member = this.findMember(memberId);
      if (!member) throw new Error('Member not found');
      const status = computeStatus(member);
      if (status === 'expired') throw new Error('Cannot check in – membership expired.');
      if (status === 'frozen') throw new Error('Cannot check in – membership frozen.');

      const now = new Date().toISOString();
      member.checkins = (member.checkins || 0) + 1;
      member.lastCheckin = now;
      const checkin = {
        id: genId('ci'),
        memberId: member.id,
        memberName: member.name,
        time: now,
      };
      this.state.checkins.unshift(checkin);
      // Keep check-in history manageable
      if (this.state.checkins.length > 100) {
        this.state.checkins = this.state.checkins.slice(0, 100);
      }
      await Promise.all([
        this._saveKey(KEYS.MEMBERS, this.state.members),
        this._saveKey(KEYS.CHECKINS, this.state.checkins),
      ]);
      this._notify();
      return checkin;
    }

    // ── Renew ──
    async renewMember(memberId, newExpiry) {
      const member = this.findMember(memberId);
      if (!member) throw new Error('Member not found');
      if (!newExpiry) throw new Error('New expiry date is required');
      member.expiry = newExpiry;
      member.status = 'active';
      await this._saveKey(KEYS.MEMBERS, this.state.members);
      this._notify();
      return member;
    }

    // ── Plan operations ──
    async addPlan(data) {
      const { name, price, durationDays, notes, color } = data;
      if (!name) throw new Error('Plan name required');
      const plan = {
        id: genId('pl'),
        name,
        price: price || 0,
        durationDays: durationDays || 30,
        notes: notes || '',
        color: color || 'blue',
      };
      this.state.plans.push(plan);
      await this._saveKey(KEYS.PLANS, this.state.plans);
      this._notify();
      return plan;
    }

    async editPlan(id, updates) {
      const idx = this.state.plans.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Plan not found');
      const plan = this.state.plans[idx];
      const allowed = ['name', 'price', 'durationDays', 'notes', 'color'];
      for (const key of allowed) {
        if (updates[key] !== undefined) plan[key] = updates[key];
      }
      await this._saveKey(KEYS.PLANS, this.state.plans);
      this._notify();
      return plan;
    }

    async deletePlan(id) {
      const idx = this.state.plans.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Plan not found');
      // Check if any member uses this plan
      const inUse = this.state.members.some(m => m.planId === id);
      if (inUse) throw new Error('Cannot delete – members are still on this plan.');
      this.state.plans.splice(idx, 1);
      await this._saveKey(KEYS.PLANS, this.state.plans);
      this._notify();
    }

    // ── Guest operations (local hotel-guests demo list — distinct from
    // getInHouseGuests() below, which is the real in-house booking feed) ──
    async addGuest(data) {
      const guest = {
        id: genId('g'),
        name: data.name,
        room: data.room,
        phone: data.phone || '',
      };
      this.state.guests.push(guest);
      await this._saveKey(KEYS.GUESTS, this.state.guests);
      this._notify();
      return guest;
    }

    async deleteGuest(id) {
      const idx = this.state.guests.findIndex(g => g.id === id);
      if (idx === -1) throw new Error('Guest not found');
      this.state.guests.splice(idx, 1);
      await this._saveKey(KEYS.GUESTS, this.state.guests);
      this._notify();
    }

    // ── In-house guests + Room Charge folio — same contract as
    // RestaurantService/PoolBarService. Never falls back to fake data;
    // throws so the caller (gym-member-modal.js) decides how to show
    // the failure. Lazy-loads the Booking module exactly once. ──
    ensureBookingData() {
      if (global.BookingData && typeof global.BookingData.getBookingData === 'function') {
        return Promise.resolve(global.BookingData);
      }
      if (this._bookingDataPromise) return this._bookingDataPromise;
      this._bookingDataPromise = (async () => {
        if (!global.BookingDemoSeed) {
          await loadScriptTag(resolveRelative('../booking/data/booking-demo-seed.js'));
        }
        if (!global.BookingData) {
          await loadScriptTag(resolveRelative('../booking/services/booking-service.js'));
        }
        if (!global.BookingData || typeof global.BookingData.getBookingData !== 'function') {
          throw new Error('BookingData failed to initialize after dynamic load.');
        }
        return global.BookingData;
      })();
      return this._bookingDataPromise;
    }

    async getInHouseGuests() {
      let bookingData;
      try {
        bookingData = await this.ensureBookingData();
      } catch (e) {
        const err = new Error('BookingData could not be loaded automatically: ' + e.message);
        err.code = 'BOOKING_DATA_UNAVAILABLE';
        throw err;
      }
      const data = await bookingData.getBookingData();
      const bookings = (data && data.bookings) || [];
      return bookings
        .filter(b => b.status === 'checkedin' && b.guest)
        .map(b => ({ room: String(b.room || ''), name: b.guest || '', phone: b.phone || '', status: 'In-House' }));
    }

    async postToGuestFolio(opts) {
      opts = opts || {};
      if (!opts.roomNumber) throw new Error('Room number is required to post a room charge.');
      const bookingData = await this.ensureBookingData();
      const data = await bookingData.getBookingData();
      const booking = (data.bookings || []).find(b => b.room === opts.roomNumber && b.status === 'checkedin');
      if (!booking) {
        throw new Error('No checked-in guest found in room ' + opts.roomNumber + ' — cannot post a room charge.');
      }
      if (typeof bookingData.addRoomCharge !== 'function') {
        throw new Error('BookingData.addRoomCharge is unavailable.');
      }
      await bookingData.addRoomCharge(opts.guestName || booking.guest, {
        source: 'Gym',
        desc: opts.desc || 'Gym charge',
        room: opts.roomNumber,
        amount: opts.amount,
        by: opts.by || 'Gym Attendant',
      });
    }

    // ── Revenue report (for gym-revenue.html) ──
    //
    // FIXED: revenue now comes from the payment ledger (member.payments[]),
    // filtered by each payment's own `date`, not from plan.price attached
    // to a member's `joined` date. A member who signed up outside the
    // selected range but paid (renewed, part-paid, or was room-charged)
    // *inside* it now correctly shows up. Members saved before installment
    // tracking existed (payments: [] but a legacy amountPaid > 0) get a
    // single synthesized payment dated at `joined` so old records aren't
    // silently dropped from historical reports.
    getRevenueReport(fromDate, toDate) {
      const members = this.state.members;
      const checkins = this.state.checkins;
      const plans = this.state.plans;
      const planMap = {};
      plans.forEach(p => planMap[p.id] = p);
      const NO_PLAN = { id: 'none', name: 'No Plan', price: 0, color: 'blue' };

      const filterDate = (dateStr) => {
        if (!dateStr) return false;
        if (fromDate && dateStr < fromDate) return false;
        if (toDate && dateStr > toDate) return false;
        return true;
      };

      // ── Activity stats (unchanged — these are about sign-up/visit dates) ──
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

      // ── Money: flatten every member's payment ledger, filter by the
      // payment's own date (not the member's joined date) ──
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
        if (!revenueByPlan[key]) {
          revenueByPlan[key] = { plan, count: 0, subtotal: 0 };
        }
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

    // ── Private helpers ──
    async _saveKey(key, data) {
      await this._storage.set(key, JSON.stringify(data), true);
    }
  }

  // ── Expose global ──
  const svc = new GymService();

  // Expose pure helpers on the instance so pages can call them
  // instead of redefining them (same pattern as PoolBarService).
  svc.computeStatus = computeStatus;
  svc.fmtN = fmtN;
  svc.fmtDate = fmtDate;
  svc.initials = initials;
  svc.daysUntil = daysUntil;

  global.GymService = svc;

})(window);