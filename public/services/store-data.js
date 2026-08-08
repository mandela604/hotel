// services/store-data.js

/* ═══════════════════════════════════════════════
   CONFIGURATION — change ONLY these lines
   for production readiness
═══════════════════════════════════════════════ */
const CONFIG = {
  USE_DEMO: true,  // ← flip to false for production
  API_BASE: 'https://api.yourdomain.com',  // ← change to your API
  API_KEY: '',  // ← add if needed
};

/* ═══════════════════════════════════════════════
   DEMO DATA
═══════════════════════════════════════════════ */

// DEMO STOCK
const DEMO_STOCK = [
  { id: 's01', name: 'Rice (Long Grain)', cat: 'Food', unit: 'kg', qty: 112, reorder: 40, cost: 1200 },
  { id: 's02', name: 'Palm Oil', cat: 'Food', unit: 'Ltr', qty: 6, reorder: 15, cost: 2400 },
  { id: 's03', name: 'Chicken (Frozen)', cat: 'Food', unit: 'kg', qty: 54, reorder: 20, cost: 3500 },
  { id: 's04', name: 'Tomatoes', cat: 'Food', unit: 'kg', qty: 30, reorder: 15, cost: 800 },
  { id: 's05', name: 'Onions', cat: 'Food', unit: 'kg', qty: 38, reorder: 15, cost: 700 },
  { id: 's06', name: 'Star Lager', cat: 'Beverages', unit: 'Bottles', qty: 8, reorder: 12, cost: 1200 },
  { id: 's07', name: 'Heineken', cat: 'Beverages', unit: 'Bottles', qty: 64, reorder: 24, cost: 1500 },
  { id: 's08', name: 'Hennessy VS', cat: 'Beverages', unit: 'Bottles', qty: 3, reorder: 5, cost: 28000 },
  { id: 's09', name: 'Bottled Water 1.5L', cat: 'Beverages', unit: 'Cartons', qty: 22, reorder: 10, cost: 3200 },
  { id: 's10', name: 'Ice Cream Tubs', cat: 'Beverages', unit: 'Pieces', qty: 0, reorder: 4, cost: 2500 },
  { id: 's11', name: 'Bleach 5L', cat: 'Cleaning Supplies', unit: 'Ltr', qty: 3, reorder: 10, cost: 2100 },
  { id: 's12', name: 'Floor Cleaner 5L', cat: 'Cleaning Supplies', unit: 'Ltr', qty: 18, reorder: 10, cost: 3200 },
  { id: 's13', name: 'Industrial Detergent 10kg', cat: 'Cleaning Supplies', unit: 'Bags', qty: 14, reorder: 10, cost: 8500 },
  { id: 's14', name: 'Glass Cleaner 1L', cat: 'Cleaning Supplies', unit: 'Ltr', qty: 26, reorder: 10, cost: 1500 },
  { id: 's15', name: 'King Duvet Set', cat: 'Linen & Amenities', unit: 'Pieces', qty: 12, reorder: 8, cost: 24000 },
  { id: 's16', name: 'Pillow Cases (pair)', cat: 'Linen & Amenities', unit: 'Pieces', qty: 0, reorder: 20, cost: 4500 },
  { id: 's17', name: 'Guest Shampoo 250ml', cat: 'Linen & Amenities', unit: 'Pieces', qty: 96, reorder: 50, cost: 480 },
  { id: 's18', name: 'Commercial Dishwasher', cat: 'Equipment', unit: 'Pieces', qty: 1, reorder: 1, cost: 850000 },
  { id: 's19', name: 'POS Terminal', cat: 'Equipment', unit: 'Pieces', qty: 4, reorder: 2, cost: 95000 },
  { id: 's20', name: 'Branded Envelopes', cat: 'Other', unit: 'Packs', qty: 9, reorder: 5, cost: 8000 },
];

// DEMO REQUISITIONS
const DEMO_REQUISITIONS = [
  {
    no: 'REQ-001',
    mode: 'store_issue',
    dept: 'Kitchen',
    by: 'Chef Michael',
    dateRaised: '2026-03-12',
    needed: '2026-03-14',
    status: 'Pending',
    priority: 'Urgent',
    items: [
      { name: 'Rice (Long Grain)', qty: 10, unit: 'kg', issuedQty: 0 },
      { name: 'Palm Oil', qty: 5, unit: 'Ltr', issuedQty: 0 },
      { name: 'Chicken (Frozen)', qty: 8, unit: 'kg', issuedQty: 0 },
    ],
    notes: 'For weekend buffet',
  },
  {
    no: 'REQ-002',
    mode: 'store_issue',
    dept: 'Bar',
    by: 'Bartender John',
    dateRaised: '2026-03-12',
    needed: '2026-03-13',
    status: 'Pending',
    priority: 'Normal',
    items: [
      { name: 'Star Lager', qty: 24, unit: 'Bottles', issuedQty: 0 },
      { name: 'Hennessy VS', qty: 2, unit: 'Bottles', issuedQty: 0 },
    ],
    notes: 'Stock for weekend',
  },
  {
    no: 'REQ-003',
    mode: 'store_issue',
    dept: 'Housekeeping',
    by: 'Housekeeper Maria',
    dateRaised: '2026-03-11',
    needed: '2026-03-12',
    status: 'Full',
    priority: 'Normal',
    items: [
      { name: 'Bleach 5L', qty: 2, unit: 'Ltr', issuedQty: 2 },
      { name: 'Floor Cleaner 5L', qty: 3, unit: 'Ltr', issuedQty: 3 },
    ],
    notes: '',
  },
  {
    no: 'REQ-004',
    mode: 'store_issue',
    dept: 'Front Desk',
    by: 'Receptionist Grace',
    dateRaised: '2026-03-10',
    needed: '2026-03-11',
    status: 'Partial',
    priority: 'Normal',
    items: [
      { name: 'Guest Shampoo 250ml', qty: 20, unit: 'Pieces', issuedQty: 20 },
      { name: 'Pillow Cases (pair)', qty: 10, unit: 'Pieces', issuedQty: 5 },
    ],
    notes: 'Partial due to stock shortage',
  },
  {
    no: 'REQ-005',
    mode: 'store_issue',
    dept: 'Maintenance',
    by: 'Engineer David',
    dateRaised: '2026-03-09',
    needed: '2026-03-10',
    status: 'Rejected',
    priority: 'Normal',
    items: [
      { name: 'Commercial Dishwasher', qty: 1, unit: 'Pieces', issuedQty: 0 },
    ],
    notes: 'Need budget approval',
  },
  {
    no: 'REQ-006',
    mode: 'store_issue',
    dept: 'Kitchen',
    by: 'Chef Michael',
    dateRaised: '2026-03-08',
    needed: '2026-03-10',
    status: 'Full',
    priority: 'Normal',
    items: [
      { name: 'Tomatoes', qty: 10, unit: 'kg', issuedQty: 10 },
      { name: 'Onions', qty: 8, unit: 'kg', issuedQty: 8 },
    ],
    notes: '',
  },
  {
    no: 'REQ-007',
    mode: 'purchase',
    dept: 'Store',
    by: 'Store Keeper',
    dateRaised: '2026-03-07',
    needed: '2026-03-15',
    status: 'Pending',
    priority: 'Normal',
    items: [
      { name: 'Ice Cream Tubs', qty: 10, unit: 'Pieces', issuedQty: 0 },
      { name: 'Pillow Cases (pair)', qty: 20, unit: 'Pieces', issuedQty: 0 },
    ],
    notes: 'Procurement for store restock',
  },
  {
    no: 'REQ-008',
    mode: 'store_issue',
    dept: 'Bar',
    by: 'Bartender John',
    dateRaised: '2026-03-06',
    needed: '2026-03-07',
    status: 'Full',
    priority: 'Normal',
    items: [
      { name: 'Heineken', qty: 12, unit: 'Bottles', issuedQty: 12 },
      { name: 'Bottled Water 1.5L', qty: 5, unit: 'Cartons', issuedQty: 5 },
    ],
    notes: '',
  },
  {
    no: 'REQ-009',
    mode: 'store_issue',
    dept: 'Housekeeping',
    by: 'Housekeeper Maria',
    dateRaised: '2026-03-05',
    needed: '2026-03-06',
    status: 'Full',
    priority: 'Urgent',
    items: [
      { name: 'King Duvet Set', qty: 4, unit: 'Pieces', issuedQty: 4 },
    ],
    notes: 'VIP guest request',
  },
  {
    no: 'REQ-010',
    mode: 'store_issue',
    dept: 'Kitchen',
    by: 'Chef Michael',
    dateRaised: '2026-03-04',
    needed: '2026-03-06',
    status: 'Full',
    priority: 'Normal',
    items: [
      { name: 'Palm Oil', qty: 10, unit: 'Ltr', issuedQty: 10 },
      { name: 'Rice (Long Grain)', qty: 20, unit: 'kg', issuedQty: 20 },
    ],
    notes: '',
  },
];

// DEMO SESSION
const DEMO_SESSION = {
  name: 'Store Manager',
  initials: 'SM',
  role: 'store_manager',
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

const STOCK_KEY = 'stock-items';
const REQ_INDEX_KEY = 'req-index';

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
    console.warn('[StoreData] Failed to save', key, e);
  }
}

/* ═══════════════════════════════════════════════
   PUBLIC API — the ONLY functions pages should call
═══════════════════════════════════════════════ */

/**
 * Fetch all store data (stock, requisitions, session)
 * 
 * BEHAVIOR:
 * - Demo mode (USE_DEMO = true): Always returns demo data from localStorage
 * - Production mode (USE_DEMO = false): 
 *   - Tries API first
 *   - If API fails → THROWS ERROR (no silent fallback to demo)
 */
export async function getStoreData() {
  // Production mode: API only, no fallback to demo
  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/store-data`, {
        headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response has expected structure
      if (!data.stock || !data.requisitions) {
        throw new Error('API response missing required fields: stock or requisitions');
      }
      
      return {
        stock: data.stock,
        requisitions: data.requisitions,
        session: data.session || DEMO_SESSION,
      };
      
    } catch (err) {
      console.error('[StoreData] Production API error:', err.message);
      throw new Error(`Failed to load store data: ${err.message}. Please refresh or contact support.`);
    }
  }

  // Demo mode: load from localStorage or seed
  const stock = await loadLocal(STOCK_KEY, DEMO_STOCK);
  const requisitions = await loadRequisitions();
  
  return { stock, requisitions, session: DEMO_SESSION };
}

/**
 * Save stock data
 * 
 * BEHAVIOR:
 * - Demo mode: Saves to localStorage only
 * - Production mode: Saves to API, throws error on failure
 */
export async function saveStock(stock) {
  // Always save locally
  await saveLocal(STOCK_KEY, stock);

  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify({ stock })
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      return { success: true };
      
    } catch (err) {
      console.error('[StoreData] Save stock failed:', err);
      throw new Error(`Failed to save stock: ${err.message}`);
    }
  }
  
  return { success: true };
}

/**
 * Save requisition
 */
export async function saveRequisition(req) {
  // Get current index
  let idx = [];
  try {
    const r = await storage.get(REQ_INDEX_KEY, true);
    idx = r ? JSON.parse(r.value) : [];
  } catch (e) {}
  
  // Add or update
  const existing = idx.indexOf(req.no);
  if (existing > -1) {
    idx[existing] = req.no;
  } else {
    idx.push(req.no);
  }
  
  await saveLocal(REQ_INDEX_KEY, idx);
  await saveLocal(`req:${req.no}`, req);

  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/requisitions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify({ requisition: req })
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      return { success: true };
      
    } catch (err) {
      console.error('[StoreData] Save requisition failed:', err);
      throw new Error(`Failed to save requisition: ${err.message}`);
    }
  }
  
  return { success: true };
}

/**
 * Load all requisitions
 */
export async function loadRequisitions() {
  let idx = [];
  try {
    const r = await storage.get(REQ_INDEX_KEY, true);
    idx = r ? JSON.parse(r.value) : [];
  } catch (e) {}
  
  const reqs = [];
  for (const no of idx) {
    try {
      const r = await storage.get(`req:${no}`, true);
      if (r) reqs.push(JSON.parse(r.value));
    } catch (e) {}
  }
  return reqs;
}

/**
 * Load a single requisition by number
 */
export async function loadRequisition(no) {
  try {
    const r = await storage.get(`req:${no}`, true);
    return r ? JSON.parse(r.value) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Delete a requisition
 */
export async function deleteRequisition(no) {
  let idx = [];
  try {
    const r = await storage.get(REQ_INDEX_KEY, true);
    idx = r ? JSON.parse(r.value) : [];
  } catch (e) {}
  
  idx = idx.filter(n => n !== no);
  await saveLocal(REQ_INDEX_KEY, idx);
  await storage.delete(`req:${no}`, true);

  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/requisitions/${no}`, {
        method: 'DELETE',
        headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      return { success: true };
      
    } catch (err) {
      console.error('[StoreData] Delete requisition failed:', err);
      throw new Error(`Failed to delete requisition: ${err.message}`);
    }
  }
  
  return { success: true };
}