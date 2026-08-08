// services/gym-data.js

/* ═══════════════════════════════════════════════
   CONFIGURATION — change ONLY these lines
   for production readiness
═══════════════════════════════════════════════ */
const CONFIG = {
  USE_DEMO: true,  // ← flip to false for production
  API_BASE: 'https://api.yourdomain.com',  // ← change to your API
  API_KEY: '',  // ← add if needed
  PAGE_SIZE: 10,
};

/* ═══════════════════════════════════════════════
   DEMO DATA
═══════════════════════════════════════════════ */

function isoAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function isoIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function isoAgoHours(hours) {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

// DEMO PLANS
const DEMO_PLANS = [
  { id: 'pl01', name: 'Basic', price: 15000, durationDays: 30, notes: 'Full gym floor access during opening hours. Locker included.', color: 'blue' },
  { id: 'pl02', name: 'Premium', price: 35000, durationDays: 30, notes: 'Everything in Basic, plus group classes, sauna access, and one personal-training consult per month.', color: 'gold' },
  { id: 'pl03', name: 'Day Pass', price: 5000, durationDays: 1, notes: 'Single-day access for hotel guests and walk-ins. No locker.', color: 'purple' },
  { id: 'pl04', name: 'Annual', price: 120000, durationDays: 365, notes: 'Full year unlimited access. Best value.', color: 'green' },
  { id: 'pl05', name: 'Student', price: 8000, durationDays: 30, notes: 'Discounted plan for students with valid ID.', color: 'amber' },
];

// DEMO MEMBERS
const DEMO_MEMBERS = [
  { id: 'gm01', name: 'Chidi Nwankwo', planId: 'pl02', room: 'Room 204', phone: '+234 801 234 5671', joined: isoAgo(120), expiry: isoIn(18), checkins: 34, lastCheckin: isoAgoHours(5), status: 'active', notes: '', amountPaid: 35000, totalDue: 35000 },
  { id: 'gm02', name: 'Fatima Bello', planId: 'pl01', room: 'Room 118', phone: '+234 802 345 6782', joined: isoAgo(60), expiry: isoIn(4), checkins: 12, lastCheckin: isoAgoHours(30), status: 'active', notes: '', amountPaid: 15000, totalDue: 15000 },
  { id: 'gm03', name: 'Segun Johnson', planId: 'pl03', room: 'Walk-in', phone: '+234 803 456 7893', joined: isoAgo(1), expiry: isoAgo(0), checkins: 1, lastCheckin: isoAgoHours(1), status: 'active', notes: '', amountPaid: 5000, totalDue: 5000 },
  { id: 'gm04', name: 'Ada Williams', planId: 'pl02', room: 'Room 204 (Suite)', phone: '+234 804 567 8904', joined: isoAgo(200), expiry: isoAgo(10), checkins: 88, lastCheckin: isoAgo(10), status: 'active', notes: 'VIP guest', amountPaid: 20000, totalDue: 35000 },
  { id: 'gm05', name: 'Ibrahim Musa', planId: 'pl01', room: 'Staff', phone: '+234 805 678 9015', joined: isoAgo(300), expiry: isoIn(90), checkins: 150, lastCheckin: isoAgo(45), status: 'frozen', notes: 'On medical leave', amountPaid: 15000, totalDue: 15000 },
  { id: 'gm06', name: 'Ngozi Okafor', planId: 'pl04', room: 'Room 301', phone: '+234 806 789 0126', joined: isoAgo(10), expiry: isoIn(50), checkins: 6, lastCheckin: isoAgoHours(20), status: 'active', notes: '', amountPaid: 60000, totalDue: 120000 },
  { id: 'gm07', name: 'Emeka Obi', planId: 'pl02', room: 'Room 105', phone: '+234 807 890 1234', joined: isoAgo(90), expiry: isoAgo(5), checkins: 45, lastCheckin: isoAgo(6), status: 'active', notes: 'Expired plan', amountPaid: 0, totalDue: 35000 },
];

// DEMO CHECKINS
const DEMO_CHECKINS = [
  { id: 'ci01', memberId: 'gm03', memberName: 'Segun Johnson', time: isoAgoHours(1) },
  { id: 'ci02', memberId: 'gm01', memberName: 'Chidi Nwankwo', time: isoAgoHours(5) },
  { id: 'ci03', memberId: 'gm06', memberName: 'Ngozi Okafor', time: isoAgoHours(20) },
  { id: 'ci04', memberId: 'gm02', memberName: 'Fatima Bello', time: isoAgoHours(30) },
  { id: 'ci05', memberId: 'gm01', memberName: 'Chidi Nwankwo', time: isoAgoHours(48) },
];

// DEMO GUESTS (for room charge feature)
const DEMO_GUESTS = [
  { id: 'g01', name: 'Mr. Adeyemi, Tunde', room: '101', phone: '+234 803 111 2233' },
  { id: 'g02', name: 'Mrs. Okafor, Ngozi', room: '102', phone: '+234 806 222 4455' },
  { id: 'g03', name: 'Mr. Bello, Ibrahim', room: '103', phone: '+234 701 333 6677' },
  { id: 'g04', name: 'Dr. Eze, Chukwuemeka', room: '201', phone: '+234 802 444 8899' },
  { id: 'g05', name: 'Ms. Abubakar, Fatima', room: '202', phone: '+234 805 555 0011' },
  { id: 'g06', name: 'Mr. Johnson, Segun', room: '203', phone: '+234 708 666 2233' },
  { id: 'g07', name: 'Prof. Williams, Ada', room: '204', phone: '+234 803 777 4455' },
];

// DEMO SESSION
const DEMO_SESSION = {
  name: 'Gym Attendant',
  initials: 'GA',
  role: 'gym_attendant',
};

/* ═══════════════════════════════════════════════
   STORAGE SHIM
═══════════════════════════════════════════════ */
const storage = window.storage || {
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

const KEY_MEMBERS = 'gym-members';
const KEY_PLANS = 'gym-plans';
const KEY_CHECKINS = 'gym-checkins';
const KEY_GUESTS = 'hotel-guests';

/* ═══════════════════════════════════════════════
   INTERNAL HELPERS
═══════════════════════════════════════════════ */
async function loadLocal(key, fallback) {
  try {
    const r = await storage.get(key, true);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return fallback;
}

async function saveLocal(key, value) {
  try {
    await storage.set(key, JSON.stringify(value), true);
  } catch (e) {
    console.warn('[GymData] Failed to save', key, e);
  }
}

function generateId(prefix) {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

function daysUntil(expiry) {
  if (!expiry) return null;
  const d = new Date(expiry + 'T00:00:00');
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

/* ═══════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════ */

/**
 * Fetch all gym data
 * 
 * BEHAVIOR:
 * - Demo mode: Returns localStorage data or seeds with demo data
 * - Production mode: Tries API, throws error on failure
 */
export async function getGymData() {
  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/gym`, {
        headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.members || !data.plans) {
        throw new Error('API response missing required fields');
      }
      
      return {
        members: data.members || [],
        plans: data.plans || [],
        checkins: data.checkins || [],
        guests: data.guests || [],
        session: data.session || DEMO_SESSION,
      };
      
    } catch (err) {
      console.error('[GymData] Production API error:', err.message);
      throw new Error(`Failed to load gym data: ${err.message}. Please refresh or contact support.`);
    }
  }

  // Demo mode
  const members = await loadLocal(KEY_MEMBERS, DEMO_MEMBERS);
  const plans = await loadLocal(KEY_PLANS, DEMO_PLANS);
  const checkins = await loadLocal(KEY_CHECKINS, DEMO_CHECKINS);
  const guests = await loadLocal(KEY_GUESTS, DEMO_GUESTS);
  
  return { members, plans, checkins, guests, session: DEMO_SESSION };
}

/**
 * Get members with optional filtering
 */
export async function getMembers(filters = {}) {
  const { members, plans } = await getGymData();
  let result = [...members];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(m => 
      m.name.toLowerCase().includes(q) || 
      (m.room || '').toLowerCase().includes(q) ||
      (m.phone || '').toLowerCase().includes(q)
    );
  }

  if (filters.planId) {
    result = result.filter(m => m.planId === filters.planId);
  }

  if (filters.status) {
    result = result.filter(m => computeStatus(m) === filters.status);
  }

  if (filters.sort) {
    switch (filters.sort) {
      case 'name_asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'expiry_asc': result.sort((a, b) => (a.expiry || '').localeCompare(b.expiry || '')); break;
      case 'joined_desc': result.sort((a, b) => (b.joined || '').localeCompare(a.joined || '')); break;
      default: result.sort((a, b) => (b.joined || '').localeCompare(a.joined || ''));
    }
  }

  if (filters.page && filters.pageSize) {
    const start = (filters.page - 1) * filters.pageSize;
    const total = result.length;
    const rows = result.slice(start, start + filters.pageSize);
    return { rows, total, page: filters.page, pageSize: filters.pageSize, totalPages: Math.max(1, Math.ceil(total / filters.pageSize)) };
  }

  return result;
}

/**
 * Get a single member by ID
 */
export async function getMember(id) {
  const { members } = await getGymData();
  return members.find(m => m.id === id) || null;
}

/**
 * Create a new member
 */
export async function createMember(data) {
  const { members, checkins } = await getGymData();
  
  const newMember = {
    id: generateId('gm'),
    ...data,
    checkins: 0,
    lastCheckin: null,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  members.push(newMember);
  await saveLocal(KEY_MEMBERS, members);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/gym/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify(newMember)
      });
    } catch (err) {
      console.warn('[GymData] API save failed:', err);
    }
  }

  return newMember;
}

/**
 * Update a member
 */
export async function updateMember(id, updates) {
  const { members } = await getGymData();
  const index = members.findIndex(m => m.id === id);
  
  if (index === -1) {
    throw new Error('Member not found');
  }

  members[index] = {
    ...members[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveLocal(KEY_MEMBERS, members);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/gym/members/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify(members[index])
      });
    } catch (err) {
      console.warn('[GymData] API update failed:', err);
    }
  }

  return members[index];
}

/**
 * Record a check-in for a member
 */
export async function recordCheckin(memberId) {
  const { members, checkins } = await getGymData();
  const member = members.find(m => m.id === memberId);
  
  if (!member) {
    throw new Error('Member not found');
  }

  const status = computeStatus(member);
  if (status === 'expired') {
    throw new Error('Cannot check in — membership has expired. Please renew first.');
  }
  if (status === 'frozen') {
    throw new Error('Cannot check in — membership is inactive.');
  }

  const now = new Date().toISOString();
  member.checkins = (member.checkins || 0) + 1;
  member.lastCheckin = now;

  const checkin = {
    id: generateId('ci'),
    memberId: member.id,
    memberName: member.name,
    time: now,
  };

  checkins.unshift(checkin);
  if (checkins.length > 100) checkins = checkins.slice(0, 100);

  await saveLocal(KEY_MEMBERS, members);
  await saveLocal(KEY_CHECKINS, checkins);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/gym/checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify({ memberId, checkin })
      });
    } catch (err) {
      console.warn('[GymData] API checkin failed:', err);
    }
  }

  return checkin;
}

/**
 * Get plans
 */
export async function getPlans(filters = {}) {
  const { plans } = await getGymData();
  let result = [...plans];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(q));
  }

  return result;
}

/**
 * Create a plan
 */
export async function createPlan(data) {
  const { plans } = await getGymData();
  
  const newPlan = {
    id: generateId('pl'),
    ...data,
    createdAt: new Date().toISOString(),
  };

  plans.push(newPlan);
  await saveLocal(KEY_PLANS, plans);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/gym/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify(newPlan)
      });
    } catch (err) {
      console.warn('[GymData] API plan save failed:', err);
    }
  }

  return newPlan;
}

/**
 * Update a plan
 */
export async function updatePlan(id, updates) {
  const { plans } = await getGymData();
  const index = plans.findIndex(p => p.id === id);
  
  if (index === -1) {
    throw new Error('Plan not found');
  }

  plans[index] = {
    ...plans[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveLocal(KEY_PLANS, plans);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/gym/plans/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify(plans[index])
      });
    } catch (err) {
      console.warn('[GymData] API plan update failed:', err);
    }
  }

  return plans[index];
}

/**
 * Delete a plan (only if not in use)
 */
export async function deletePlan(id) {
  const { plans, members } = await getGymData();
  const inUse = members.filter(m => m.planId === id).length;
  
  if (inUse > 0) {
    throw new Error(`Cannot delete plan — ${inUse} member(s) are still on this plan.`);
  }

  const updatedPlans = plans.filter(p => p.id !== id);
  await saveLocal(KEY_PLANS, updatedPlans);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/gym/plans/${id}`, {
        method: 'DELETE',
        headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
      });
    } catch (err) {
      console.warn('[GymData] API plan delete failed:', err);
    }
  }

  return true;
}

/**
 * Get checkins with optional filtering
 */
export async function getCheckins(filters = {}) {
  const { checkins } = await getGymData();
  let result = [...checkins];

  if (filters.memberId) {
    result = result.filter(c => c.memberId === filters.memberId);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(c => (c.memberName || '').toLowerCase().includes(q));
  }

  if (filters.dateFrom) {
    result = result.filter(c => c.time && c.time >= filters.dateFrom);
  }

  if (filters.dateTo) {
    result = result.filter(c => c.time && c.time <= filters.dateTo);
  }

  result.sort((a, b) => (b.time || '').localeCompare(a.time || ''));

  if (filters.page && filters.pageSize) {
    const start = (filters.page - 1) * filters.pageSize;
    const total = result.length;
    const rows = result.slice(start, start + filters.pageSize);
    return { rows, total, page: filters.page, pageSize: filters.pageSize, totalPages: Math.max(1, Math.ceil(total / filters.pageSize)) };
  }

  return result;
}

/**
 * Renew a member's membership
 */
export async function renewMember(id, newExpiry) {
  const { members } = await getGymData();
  const member = members.find(m => m.id === id);
  
  if (!member) {
    throw new Error('Member not found');
  }

  member.expiry = newExpiry;
  member.status = 'active';

  await saveLocal(KEY_MEMBERS, members);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/gym/members/${id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify({ expiry: newExpiry })
      });
    } catch (err) {
      console.warn('[GymData] API renew failed:', err);
    }
  }

  return member;
}

/**
 * Reset all gym data to demo defaults
 */
export async function resetGymData() {
  await saveLocal(KEY_MEMBERS, DEMO_MEMBERS);
  await saveLocal(KEY_PLANS, DEMO_PLANS);
  await saveLocal(KEY_CHECKINS, DEMO_CHECKINS);
  await saveLocal(KEY_GUESTS, DEMO_GUESTS);
  return true;
}

/* ═══════════════════════════════════════════════
   EXPOSE CONFIG FOR PAGES
═══════════════════════════════════════════════ */
export const GYM_CONFIG = CONFIG;