// services/gym-data.js

/* ═══════════════════════════════════════════════
   CONFIGURATION — change ONLY these lines
   for production readiness
═══════════════════════════════════════════════ */
const CONFIG = {
  API_BASE: '',
  API_KEY: '',
  PAGE_SIZE: 10,
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
 * Fetch all gym data — API-first with localStorage fallback.
 */
export async function getGymData() {
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
      session: data.session || { name: 'Gym Attendant', initials: 'GA', role: 'gym_attendant' },
    };
    
  } catch (err) {
    console.warn('[GymData] API unavailable, using stored data:', err.message);
  }

  const members = await loadLocal(KEY_MEMBERS, []);
  const plans = await loadLocal(KEY_PLANS, []);
  const checkins = await loadLocal(KEY_CHECKINS, []);
  const guests = await loadLocal(KEY_GUESTS, []);
  
  return { members, plans, checkins, guests, session: { name: 'Gym Attendant', initials: 'GA', role: 'gym_attendant' } };
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

  try {
    await fetch(`${CONFIG.API_BASE}/api/gym/plans/${id}`, {
      method: 'DELETE',
      headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
    });
  } catch (err) {
    console.warn('[GymData] API plan delete failed:', err);
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

  return member;
}

/* ═══════════════════════════════════════════════
   EXPOSE CONFIG FOR PAGES
═══════════════════════════════════════════════ */
export const GYM_CONFIG = CONFIG;