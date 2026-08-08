// services/procurement-data.js

/* ═══════════════════════════════════════════════
   CONFIGURATION — change ONLY these lines
   for production readiness
═══════════════════════════════════════════════ */
const CONFIG = {
  USE_DEMO: true,  // ← flip to false for production
  API_BASE: 'https://api.yourdomain.com',  // ← change to your API
  API_KEY: '',  // ← add if needed
  MD_APPROVAL_THRESHOLD: 100000,
  PAGE_SIZE: 10,
};

/* ═══════════════════════════════════════════════
   DEMO DATA
═══════════════════════════════════════════════ */

// DEMO PURCHASE REQUISITIONS
const DEMO_PR = [
  {
    id: 'pr1',
    prNo: 'PR-2026-001',
    item: 'Rice (Long Grain) 50kg',
    cat: 'Food & Beverage',
    dept: 'Kitchen',
    by: 'Chef Michael',
    date: '2026-07-15',
    qty: 10,
    unit: 'Bags',
    unitCost: 42000,
    totalAmount: 420000,
    priority: 'Urgent',
    approvalStage: 'pending',
    needsMDApproval: true,
    supplier: 'Golden Grains Ltd',
    notes: 'Weekend buffet stock',
    poNo: null,
    createdAt: '2026-07-15T08:30:00',
    updatedAt: '2026-07-15T08:30:00',
  },
  {
    id: 'pr2',
    prNo: 'PR-2026-002',
    item: 'Palm Oil 25L',
    cat: 'Food & Beverage',
    dept: 'Kitchen',
    by: 'Chef Michael',
    date: '2026-07-15',
    qty: 8,
    unit: 'Jerrycans',
    unitCost: 24000,
    totalAmount: 192000,
    priority: 'Normal',
    approvalStage: 'accountant',
    needsMDApproval: true,
    supplier: 'Best Oil Supplies',
    notes: '',
    poNo: null,
    createdAt: '2026-07-15T09:15:00',
    updatedAt: '2026-07-15T09:15:00',
  },
  {
    id: 'pr3',
    prNo: 'PR-2026-003',
    item: 'Chicken (Frozen) 20kg',
    cat: 'Food & Beverage',
    dept: 'Kitchen',
    by: 'Chef Michael',
    date: '2026-07-14',
    qty: 5,
    unit: 'Cartons',
    unitCost: 35000,
    totalAmount: 175000,
    priority: 'Normal',
    approvalStage: 'gm',
    needsMDApproval: true,
    supplier: 'Poultry Direct NG',
    notes: '',
    poNo: null,
    createdAt: '2026-07-14T10:00:00',
    updatedAt: '2026-07-14T10:00:00',
  },
  {
    id: 'pr4',
    prNo: 'PR-2026-004',
    item: 'Star Lager 24x500ml',
    cat: 'Beverages',
    dept: 'Bar',
    by: 'Bartender John',
    date: '2026-07-14',
    qty: 20,
    unit: 'Cartons',
    unitCost: 12000,
    totalAmount: 240000,
    priority: 'Urgent',
    approvalStage: 'md',
    needsMDApproval: true,
    supplier: 'Star Breweries',
    notes: 'Weekend stock',
    poNo: null,
    createdAt: '2026-07-14T11:20:00',
    updatedAt: '2026-07-14T11:20:00',
  },
  {
    id: 'pr5',
    prNo: 'PR-2026-005',
    item: 'Bleach 5L',
    cat: 'Cleaning Supplies',
    dept: 'Housekeeping',
    by: 'Housekeeper Maria',
    date: '2026-07-13',
    qty: 10,
    unit: 'Units',
    unitCost: 2100,
    totalAmount: 21000,
    priority: 'Normal',
    approvalStage: 'approved',
    needsMDApproval: false,
    supplier: 'CleanWorld NG',
    notes: '',
    poNo: 'PO-2026-005',
    createdAt: '2026-07-13T08:45:00',
    updatedAt: '2026-07-13T09:30:00',
  },
  {
    id: 'pr6',
    prNo: 'PR-2026-006',
    item: 'Pillow Cases (pair)',
    cat: 'Linen & Uniforms',
    dept: 'Housekeeping',
    by: 'Housekeeper Maria',
    date: '2026-07-13',
    qty: 20,
    unit: 'Pairs',
    unitCost: 4500,
    totalAmount: 90000,
    priority: 'Normal',
    approvalStage: 'fulfilled',
    needsMDApproval: false,
    supplier: 'Linens & More',
    notes: '',
    poNo: 'PO-2026-006',
    createdAt: '2026-07-13T09:00:00',
    updatedAt: '2026-07-13T10:15:00',
  },
  {
    id: 'pr7',
    prNo: 'PR-2026-007',
    item: 'Commercial Dishwasher',
    cat: 'Equipment',
    dept: 'Maintenance',
    by: 'Engineer David',
    date: '2026-07-12',
    qty: 1,
    unit: 'Unit',
    unitCost: 850000,
    totalAmount: 850000,
    priority: 'Urgent',
    approvalStage: 'rejected',
    needsMDApproval: true,
    supplier: 'Equip NG',
    notes: 'Budget not approved',
    poNo: null,
    createdAt: '2026-07-12T14:30:00',
    updatedAt: '2026-07-12T15:45:00',
  },
  {
    id: 'pr8',
    prNo: 'PR-2026-008',
    item: 'King Duvet Set',
    cat: 'Linen & Uniforms',
    dept: 'Housekeeping',
    by: 'Housekeeper Maria',
    date: '2026-07-11',
    qty: 8,
    unit: 'Sets',
    unitCost: 24000,
    totalAmount: 192000,
    priority: 'Urgent',
    approvalStage: 'approved',
    needsMDApproval: true,
    supplier: 'Linens & More',
    notes: 'VIP suite renewal',
    poNo: 'PO-2026-008',
    createdAt: '2026-07-11T08:00:00',
    updatedAt: '2026-07-11T09:20:00',
  },
  {
    id: 'pr9',
    prNo: 'PR-2026-009',
    item: 'Hennessy VS',
    cat: 'Beverages',
    dept: 'Bar',
    by: 'Bartender John',
    date: '2026-07-10',
    qty: 6,
    unit: 'Bottles',
    unitCost: 28000,
    totalAmount: 168000,
    priority: 'Normal',
    approvalStage: 'fulfilled',
    needsMDApproval: true,
    supplier: 'Premium Drinks Co',
    notes: '',
    poNo: 'PO-2026-009',
    createdAt: '2026-07-10T13:10:00',
    updatedAt: '2026-07-10T14:30:00',
  },
  {
    id: 'pr10',
    prNo: 'PR-2026-010',
    item: 'Guest Shampoo 250ml',
    cat: 'Toiletries & Amenities',
    dept: 'Housekeeping',
    by: 'Housekeeper Maria',
    date: '2026-07-10',
    qty: 50,
    unit: 'Pieces',
    unitCost: 480,
    totalAmount: 24000,
    priority: 'Normal',
    approvalStage: 'pending',
    needsMDApproval: false,
    supplier: 'Hotel Supplies NG',
    notes: '',
    poNo: null,
    createdAt: '2026-07-10T10:45:00',
    updatedAt: '2026-07-10T10:45:00',
  },
  {
    id: 'pr11',
    prNo: 'PR-2026-011',
    item: 'POS Terminal',
    cat: 'IT & Electronics',
    dept: 'Front Desk',
    by: 'Receptionist Grace',
    date: '2026-07-09',
    qty: 2,
    unit: 'Units',
    unitCost: 95000,
    totalAmount: 190000,
    priority: 'Normal',
    approvalStage: 'accountant',
    needsMDApproval: true,
    supplier: 'Tech Solutions NG',
    notes: '',
    poNo: null,
    createdAt: '2026-07-09T11:30:00',
    updatedAt: '2026-07-09T11:30:00',
  },
  {
    id: 'pr12',
    prNo: 'PR-2026-012',
    item: 'Ice Cream Tubs',
    cat: 'Food & Beverage',
    dept: 'Bar',
    by: 'Bartender John',
    date: '2026-07-08',
    qty: 10,
    unit: 'Tubs',
    unitCost: 2500,
    totalAmount: 25000,
    priority: 'Normal',
    approvalStage: 'fulfilled',
    needsMDApproval: false,
    supplier: 'Dairy Delight',
    notes: '',
    poNo: 'PO-2026-012',
    createdAt: '2026-07-08T09:20:00',
    updatedAt: '2026-07-08T10:15:00',
  },
  {
    id: 'pr13',
    prNo: 'PR-2026-013',
    item: 'Floor Cleaner 5L',
    cat: 'Cleaning Supplies',
    dept: 'Housekeeping',
    by: 'Housekeeper Maria',
    date: '2026-07-07',
    qty: 15,
    unit: 'Units',
    unitCost: 3200,
    totalAmount: 48000,
    priority: 'Normal',
    approvalStage: 'gm',
    needsMDApproval: false,
    supplier: 'CleanWorld NG',
    notes: '',
    poNo: null,
    createdAt: '2026-07-07T12:00:00',
    updatedAt: '2026-07-07T12:00:00',
  },
  {
    id: 'pr14',
    prNo: 'PR-2026-014',
    item: 'Bottled Water 1.5L',
    cat: 'Beverages',
    dept: 'Bar',
    by: 'Bartender John',
    date: '2026-07-07',
    qty: 30,
    unit: 'Cartons',
    unitCost: 3200,
    totalAmount: 96000,
    priority: 'Normal',
    approvalStage: 'approved',
    needsMDApproval: false,
    supplier: 'Pure Water Co',
    notes: '',
    poNo: 'PO-2026-014',
    createdAt: '2026-07-07T14:30:00',
    updatedAt: '2026-07-07T15:45:00',
  },
  {
    id: 'pr15',
    prNo: 'PR-2026-015',
    item: 'Industrial Detergent 10kg',
    cat: 'Cleaning Supplies',
    dept: 'Housekeeping',
    by: 'Housekeeper Maria',
    date: '2026-07-06',
    qty: 8,
    unit: 'Bags',
    unitCost: 8500,
    totalAmount: 68000,
    priority: 'Normal',
    approvalStage: 'fulfilled',
    needsMDApproval: false,
    supplier: 'CleanWorld NG',
    notes: '',
    poNo: 'PO-2026-015',
    createdAt: '2026-07-06T10:00:00',
    updatedAt: '2026-07-06T11:30:00',
  },
];

// DEMO SUPPLIERS
const DEMO_SUPPLIERS = [
  { id: 'sp1', name: 'Golden Grains Ltd', cat: 'Food & Beverage', contact: 'Mr. Olu Adeyemi', phone: '+234 803 111 2233', email: 'info@goldengrains.ng', rating: 4 },
  { id: 'sp2', name: 'Best Oil Supplies', cat: 'Food & Beverage', contact: 'Mrs. Ngozi Okafor', phone: '+234 806 222 4455', email: 'ngozi@bestoil.ng', rating: 3 },
  { id: 'sp3', name: 'Poultry Direct NG', cat: 'Food & Beverage', contact: 'Mr. Bello Ibrahim', phone: '+234 701 333 6677', email: 'hello@poultrydirect.ng', rating: 4 },
  { id: 'sp4', name: 'Star Breweries', cat: 'Beverages', contact: 'Dr. Eze Chukwuemeka', phone: '+234 802 444 8899', email: 'ceze@starbrew.ng', rating: 5 },
  { id: 'sp5', name: 'CleanWorld NG', cat: 'Cleaning Supplies', contact: 'Ms. Abubakar Fatima', phone: '+234 805 555 0011', email: 'fatima@cleanworld.ng', rating: 4 },
  { id: 'sp6', name: 'Linens & More', cat: 'Linen & Uniforms', contact: 'Mr. Johnson Segun', phone: '+234 708 666 2233', email: 'segun@linensmore.ng', rating: 4 },
  { id: 'sp7', name: 'Equip NG', cat: 'Equipment', contact: 'Prof. Williams Ada', phone: '+234 803 777 4455', email: 'ada@equip.ng', rating: 3 },
  { id: 'sp8', name: 'Premium Drinks Co', cat: 'Beverages', contact: 'Chief Dangote Emeka', phone: '+234 801 888 6677', email: 'emeka@premiumdrinks.ng', rating: 5 },
  { id: 'sp9', name: 'Hotel Supplies NG', cat: 'Toiletries & Amenities', contact: 'Mrs. Grace Johnson', phone: '+234 809 999 1122', email: 'grace@hotelsupplies.ng', rating: 3 },
  { id: 'sp10', name: 'Tech Solutions NG', cat: 'IT & Electronics', contact: 'Mr. David Eze', phone: '+234 807 777 8899', email: 'david@techsolutions.ng', rating: 4 },
  { id: 'sp11', name: 'Dairy Delight', cat: 'Food & Beverage', contact: 'Mrs. Sarah Okafor', phone: '+234 806 111 3344', email: 'sarah@dairydelight.ng', rating: 4 },
  { id: 'sp12', name: 'Pure Water Co', cat: 'Beverages', contact: 'Mr. Emeka Obi', phone: '+234 802 555 7788', email: 'emeka@purewater.ng', rating: 4 },
  { id: 'sp13', name: 'Office Supplies NG', cat: 'Office Supplies', contact: 'Ms. Funke Adeleke', phone: '+234 803 888 9900', email: 'funke@officesupplies.ng', rating: 3 },
  { id: 'sp14', name: 'Maintenance Pros', cat: 'Maintenance & Equipment', contact: 'Mr. Tunde Bakare', phone: '+234 805 222 3344', email: 'tunde@maintenancepros.ng', rating: 4 },
  { id: 'sp15', name: 'Premium Linens', cat: 'Linen & Uniforms', contact: 'Mrs. Adaobi Nwosu', phone: '+234 701 444 5566', email: 'adaobi@premiumlinens.ng', rating: 5 },
];

// DEMO SESSION
const DEMO_SESSION = {
  name: 'Procurement Officer',
  initials: 'PO',
  role: 'procurement_officer',
  permissions: ['view', 'create', 'edit', 'delete', 'approve'],
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
 * Fetch all procurement data (PRs, suppliers, session)
 * 
 * BEHAVIOR:
 * - Demo mode: Returns localStorage data or seeds with demo data
 * - Production mode: Tries API, throws error on failure
 */
export async function getProcurementData() {
  if (!CONFIG.USE_DEMO) {
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
        session: data.session || DEMO_SESSION,
      };
      
    } catch (err) {
      console.error('[ProcurementData] Production API error:', err.message);
      throw new Error(`Failed to load procurement data: ${err.message}. Please refresh or contact support.`);
    }
  }

  // Demo mode
  const requisitions = await loadLocal(PR_KEY, DEMO_PR);
  const suppliers = await loadLocal(SUPPLIER_KEY, DEMO_SUPPLIERS);
  
  return { requisitions, suppliers, session: DEMO_SESSION };
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

  if (!CONFIG.USE_DEMO) {
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

  if (!CONFIG.USE_DEMO) {
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

  if (!CONFIG.USE_DEMO) {
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

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/requisitions/${id}`, {
        method: 'DELETE',
        headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
      });
    } catch (err) {
      console.warn('[ProcurementData] API delete failed:', err);
    }
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

/**
 * Reset all procurement data to demo defaults
 */
export async function resetProcurementData() {
  await saveLocal(PR_KEY, DEMO_PR);
  await saveLocal(SUPPLIER_KEY, DEMO_SUPPLIERS);
  return true;
}

/* ═══════════════════════════════════════════════
   EXPOSE CONFIG FOR PAGES
═══════════════════════════════════════════════ */
export const PROCUREMENT_CONFIG = CONFIG;