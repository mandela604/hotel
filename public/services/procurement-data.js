// services/procurement-data.js

/* ═══════════════════════════════════════════════
   CONFIGURATION — change ONLY these lines
   for production readiness
═══════════════════════════════════════════════ */
const CONFIG = {
  API_BASE: '',
  API_KEY: '',
  MD_APPROVAL_THRESHOLD: 100000,
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
  },
};

const PR_KEY = 'hotel-procurement';
const SUPPLIER_KEY = 'hotel-suppliers';

/* ═══════════════════════════════════════════════
   INTERNAL HELPERS
═══════════════════════════════════════════════ */
async function loadLocal(key, fallback) {
  try {
    const r = await storage.get(key, true);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {}
  return fallback;
}

async function saveLocal(key, value) {
  try {
    await storage.set(key, JSON.stringify(value), true);
  } catch (e) {
    console.warn('[ProcurementData] Failed to save', key, e);
  }
}

function generateId() {
  return 'pr' + Date.now();
}

function generatePRNo() {
  const date = new Date();
  const year = date.getFullYear();
  const count = Math.floor(Math.random() * 1000);
  return `PR-${year}-${String(count).padStart(3, '0')}`;
}

/* ═══════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════ */

/**
 * Fetch all procurement data (PRs, suppliers, session) — API-first with localStorage fallback.
 */
export async function getProcurementData() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/procurement`, {
      headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.requisitions || !data.suppliers) {
      throw new Error('API response missing required fields');
    }
    
    return {
      requisitions: data.requisitions,
      suppliers: data.suppliers,
      session: data.session || { name: 'Procurement Officer', initials: 'PO', role: 'procurement_officer' },
    };
    
  } catch (err) {
    console.warn('[ProcurementData] API unavailable, using stored data:', err.message);
  }

  const requisitions = await loadLocal(PR_KEY, []);
  const suppliers = await loadLocal(SUPPLIER_KEY, []);
  
  return { requisitions, suppliers, session: { name: 'Procurement Officer', initials: 'PO', role: 'procurement_officer' } };
}

/**
 * Get all requisitions with optional filtering
 */
export async function getRequisitions(filters = {}) {
  const { requisitions } = await getProcurementData();
  let result = [...requisitions];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(p =>
      p.prNo.toLowerCase().includes(q) ||
      p.item.toLowerCase().includes(q) ||
      p.by.toLowerCase().includes(q) ||
      p.dept.toLowerCase().includes(q)
    );
  }

  if (filters.dept) {
    result = result.filter(p => p.dept === filters.dept);
  }

  if (filters.status) {
    result = result.filter(p => p.approvalStage === filters.status);
  }

  if (filters.dateFrom) {
    result = result.filter(p => p.date >= filters.dateFrom);
  }

  if (filters.dateTo) {
    result = result.filter(p => p.date <= filters.dateTo);
  }

  if (filters.sort) {
    switch (filters.sort) {
      case 'date_desc': result.sort((a, b) => b.date.localeCompare(a.date)); break;
      case 'date_asc': result.sort((a, b) => a.date.localeCompare(b.date)); break;
      case 'amount_desc': result.sort((a, b) => b.totalAmount - a.totalAmount); break;
      case 'amount_asc': result.sort((a, b) => a.totalAmount - b.totalAmount); break;
      default: result.sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  // Pagination
  if (filters.page && filters.pageSize) {
    const start = (filters.page - 1) * filters.pageSize;
    const total = result.length;
    const rows = result.slice(start, start + filters.pageSize);
    return {
      rows,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    };
  }

  return result;
}

/**
 * Get a single requisition by ID
 */
export async function getRequisition(id) {
  const { requisitions } = await getProcurementData();
  return requisitions.find(p => p.id === id) || null;
}

/**
 * Create a new requisition
 */
export async function createRequisition(data) {
  const { requisitions, suppliers } = await getProcurementData();
  
  const newPR = {
    id: generateId(),
    prNo: generatePRNo(),
    ...data,
    approvalStage: 'pending',
    needsMDApproval: data.totalAmount > CONFIG.MD_APPROVAL_THRESHOLD,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  requisitions.unshift(newPR);
  await saveLocal(PR_KEY, requisitions);

  try {
    await fetch(`${CONFIG.API_BASE}/api/requisitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
      },
      body: JSON.stringify(newPR)
    });
  } catch (err) {
    console.warn('[ProcurementData] API save failed:', err);
  }

  return newPR;
}

/**
 * Update a requisition
 */
export async function updateRequisition(id, updates) {
  const { requisitions } = await getProcurementData();
  const index = requisitions.findIndex(p => p.id === id);
  
  if (index === -1) {
    throw new Error('Requisition not found');
  }

  requisitions[index] = {
    ...requisitions[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveLocal(PR_KEY, requisitions);

  try {
    await fetch(`${CONFIG.API_BASE}/api/requisitions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
      },
      body: JSON.stringify(requisitions[index])
    });
  } catch (err) {
    console.warn('[ProcurementData] API update failed:', err);
  }

  return requisitions[index];
}

/**
 * Approve a requisition (moves through workflow)
 */
export async function approveRequisition(id, action = 'approve') {
  const { requisitions } = await getProcurementData();
  const pr = requisitions.find(p => p.id === id);
  
  if (!pr) {
    throw new Error('Requisition not found');
  }

  // Workflow: pending → accountant → gm → md → approved → fulfilled
  const workflow = {
    pending: 'accountant',
    accountant: 'gm',
    gm: pr.needsMDApproval ? 'md' : 'approved',
    md: 'approved',
    approved: 'fulfilled',
  };

  const nextStage = action === 'reject' ? 'rejected' : workflow[pr.approvalStage];
  
  if (action === 'approve' && !nextStage) {
    throw new Error('Invalid approval stage');
  }

  pr.approvalStage = nextStage;
  pr.updatedAt = new Date().toISOString();

  await saveLocal(PR_KEY, requisitions);

  try {
    await fetch(`${CONFIG.API_BASE}/api/requisitions/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
      },
      body: JSON.stringify({ action, nextStage })
    });
  } catch (err) {
    console.warn('[ProcurementData] API approval failed:', err);
  }

  return pr;
}

/**
 * Delete a requisition
 */
export async function deleteRequisition(id) {
  let { requisitions } = await getProcurementData();
  const pr = requisitions.find(p => p.id === id);
  
  if (!pr) {
    throw new Error('Requisition not found');
  }

  requisitions = requisitions.filter(p => p.id !== id);
  await saveLocal(PR_KEY, requisitions);

  try {
    await fetch(`${CONFIG.API_BASE}/api/requisitions/${id}`, {
      method: 'DELETE',
      headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
    });
  } catch (err) {
    console.warn('[ProcurementData] API delete failed:', err);
  }

  return true;
}

/**
 * Get all suppliers
 */
export async function getSuppliers(filters = {}) {
  const { suppliers } = await getProcurementData();
  let result = [...suppliers];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.contact.toLowerCase().includes(q)
    );
  }

  if (filters.category) {
    result = result.filter(s => s.cat === filters.category);
  }

  return result;
}

/* ═══════════════════════════════════════════════
   EXPOSE CONFIG FOR PAGES
═══════════════════════════════════════════════ */
export const PROCUREMENT_CONFIG = CONFIG;