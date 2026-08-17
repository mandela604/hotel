/* ═══════════════════════════════════════════════════════════════
   GymService — central state and operations for the Gym module.
   Uses the same storage abstraction as RestaurantService.
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
    async addMember(data) {
      const { name, planId, room, phone, joined, expiry, notes, status } = data;
      if (!name) throw new Error('Name is required');
      if (!planId) throw new Error('Plan is required');

      const member = {
        id: genId('gm'),
        name,
        planId,
        room: room || '',
        phone: phone || '',
        joined: joined || new Date().toISOString().split('T')[0],
        expiry: expiry || '',
        notes: notes || '',
        checkins: 0,
        lastCheckin: null,
        status: status || 'active',
        amountPaid: data.amountPaid || 0,
        totalDue: data.totalDue || 0,
      };
      this.state.members.push(member);
      await this._saveKey(KEYS.MEMBERS, this.state.members);
      this._notify();
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

    // ── Guest operations ──
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

    // ── Revenue report (for gym-revenue.html) ──
    getRevenueReport(fromDate, toDate) {
      const members = this.state.members;
      const checkins = this.state.checkins;
      const plans = this.state.plans;
      const planMap = {};
      plans.forEach(p => planMap[p.id] = p);

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

      const revenueByPlan = {};
      let totalRevenue = 0;
      newMembers.forEach(m => {
        const plan = planMap[m.planId] || { id: 'none', name: 'No Plan', price: 0 };
        const key = plan.id;
        if (!revenueByPlan[key]) {
          revenueByPlan[key] = { plan, count: 0, subtotal: 0 };
        }
        revenueByPlan[key].count++;
        revenueByPlan[key].subtotal += plan.price || 0;
        totalRevenue += plan.price || 0;
      });

      const activeMembers = members.filter(m => {
        if (!m.planId) return false;
        if (m.status === 'frozen') return false;
        const days = daysUntil(m.expiry);
        return days !== null && days >= 0;
      }).length;

      return {
        period: { from: fromDate, to: toDate },
        totalRevenue,
        newMembersCount: newMembers.length,
        checkinsCount: checkinsInRange.length,
        activeMembers,
        revenueByPlan: Object.values(revenueByPlan),
        newMembers,
      };
    }

    // ── Private helpers ──
    async _saveKey(key, data) {
      await this._storage.set(key, JSON.stringify(data), true);
    }
  }

  // ── Expose global ──
  global.GymService = new GymService();

})(window);