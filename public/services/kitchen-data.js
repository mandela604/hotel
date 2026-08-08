// services/kitchen-data.js

/* ═══════════════════════════════════════════════
   CONFIGURATION — this is THE single switch for the whole
   Kitchen module. Flip USE_DEMO to false and fill in API_BASE
   (+ API_KEY if needed) to go live — every page syncs
   KitchenShell.CONFIG from KITCHEN_CONFIG on load, so the shell's
   session fetch and this data layer always agree.
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

// DEMO STOCK (raw ingredients)
const DEMO_STOCK = [
  { name: 'Rice', cat: 'Grains', unit: 'kg', qty: 112, min: 30, cost: 1200, batch: 'STK-00512', received: '17/07/26' },
  { name: 'Oil', cat: 'Oils & Fats', unit: 'Ltr', qty: 18, min: 10, cost: 2200, batch: 'STK-00508', received: '16/07/26' },
  { name: 'Curry', cat: 'Spices & Seasoning', unit: 'kg', qty: 4, min: 3, cost: 3500, batch: 'STK-00501', received: '14/07/26' },
  { name: 'Green Peas', cat: 'Vegetables', unit: 'kg', qty: 9, min: 5, cost: 1800, batch: 'STK-00514', received: '17/07/26' },
  { name: 'Chicken', cat: 'Proteins', unit: 'kg', qty: 38, min: 15, cost: 3200, batch: 'STK-00516', received: '17/07/26' },
  { name: 'Seasoning', cat: 'Spices & Seasoning', unit: 'kg', qty: 6, min: 2, cost: 2800, batch: 'STK-00503', received: '15/07/26' },
  { name: 'Tomato', cat: 'Vegetables', unit: 'kg', qty: 22, min: 10, cost: 900, batch: 'STK-00515', received: '17/07/26' },
  { name: 'Pepper', cat: 'Vegetables', unit: 'kg', qty: 5, min: 4, cost: 1600, batch: 'STK-00509', received: '16/07/26' },
  { name: 'Egusi', cat: 'Grains', unit: 'kg', qty: 14, min: 6, cost: 4200, batch: 'STK-00505', received: '15/07/26' },
  { name: 'Palm Oil', cat: 'Oils & Fats', unit: 'Ltr', qty: 3, min: 5, cost: 2400, batch: 'STK-00499', received: '12/07/26' },
  { name: 'Spinach', cat: 'Vegetables', unit: 'kg', qty: 8, min: 4, cost: 700, batch: 'STK-00513', received: '17/07/26' },
  { name: 'Scent Leaf', cat: 'Vegetables', unit: 'kg', qty: 2, min: 2, cost: 500, batch: 'STK-00500', received: '13/07/26' },
  { name: 'Beans Flour', cat: 'Grains', unit: 'kg', qty: 12, min: 6, cost: 2600, batch: 'STK-00504', received: '15/07/26' },
  { name: 'Egg', cat: 'Dairy & Eggs', unit: 'pcs', qty: 60, min: 24, cost: 80, batch: 'STK-00517', received: '17/07/26' },
];

// DEMO PRODUCTIONS
const DEMO_PRODUCTIONS = [
  {
    no: 'PROD-00096',
    batchNo: 'BATCH-00050',
    type: 'rts',
    status: 'sent',
    time: '10:30 AM',
    by: 'Head Chef',
    remarks: 'Lunch preparation',
    destination: 'Main Restaurant / POS',
    linkedOrder: '',
    transferNo: 'KTN-00045',
    meals: [{ name: 'Fried Rice', qty: 30, unit: 'Plates' }],
    ingredients: [
      { name: 'Rice', qty: 3.00, unit: 'kg' },
      { name: 'Oil', qty: 0.30, unit: 'Ltr' },
      { name: 'Curry', qty: 0.60, unit: 'kg' },
      { name: 'Green Peas', qty: 0.45, unit: 'kg' },
      { name: 'Chicken', qty: 1.50, unit: 'kg' },
      { name: 'Seasoning', qty: 0.09, unit: 'kg' }
    ]
  },
  {
    no: 'PROD-00095',
    batchNo: 'BATCH-00049',
    type: 'rts',
    status: 'accepted',
    time: '10:15 AM',
    by: 'Head Chef',
    remarks: '',
    destination: 'Main Restaurant / POS',
    linkedOrder: '',
    transferNo: 'KTN-00044',
    meals: [{ name: 'Jollof Rice', qty: 20, unit: 'Plates' }],
    ingredients: [
      { name: 'Rice', qty: 2.00, unit: 'kg' },
      { name: 'Oil', qty: 0.24, unit: 'Ltr' },
      { name: 'Tomato', qty: 0.60, unit: 'kg' },
      { name: 'Pepper', qty: 0.30, unit: 'kg' },
      { name: 'Chicken', qty: 1.00, unit: 'kg' },
      { name: 'Seasoning', qty: 0.06, unit: 'kg' }
    ]
  },
  {
    no: 'PROD-00094',
    batchNo: 'BATCH-00048',
    type: 'rts',
    status: 'accepted',
    time: '10:00 AM',
    by: 'Sous Chef',
    remarks: '',
    destination: 'Pool Bar',
    linkedOrder: '',
    transferNo: 'KTN-00043',
    meals: [{ name: 'Egusi Soup', qty: 15, unit: 'Portions' }],
    ingredients: [
      { name: 'Egusi', qty: 0.90, unit: 'kg' },
      { name: 'Palm Oil', qty: 0.30, unit: 'Ltr' },
      { name: 'Spinach', qty: 0.60, unit: 'kg' },
      { name: 'Chicken', qty: 0.60, unit: 'kg' },
      { name: 'Seasoning', qty: 0.045, unit: 'kg' }
    ]
  },
  {
    no: 'PROD-00093',
    batchNo: 'BATCH-00047',
    type: 'coo',
    status: 'completed',
    time: '09:45 AM',
    by: 'Head Chef',
    remarks: '',
    destination: '',
    linkedOrder: 'ORD-1053',
    transferNo: '',
    meals: [{ name: 'Pepper Soup', qty: 2, unit: 'Portions' }],
    ingredients: [
      { name: 'Chicken', qty: 0.16, unit: 'kg' },
      { name: 'Pepper', qty: 0.04, unit: 'kg' },
      { name: 'Seasoning', qty: 0.008, unit: 'kg' },
      { name: 'Scent Leaf', qty: 0.02, unit: 'kg' }
    ]
  },
  {
    no: 'PROD-00092',
    batchNo: 'BATCH-00046',
    type: 'rts',
    status: 'rejected',
    time: '09:30 AM',
    by: 'Sous Chef',
    remarks: '',
    destination: 'Room Service',
    linkedOrder: '',
    transferNo: 'KTN-00042',
    meals: [{ name: 'Moi Moi', qty: 25, unit: 'Pieces' }],
    ingredients: [
      { name: 'Beans Flour', qty: 2.00, unit: 'kg' },
      { name: 'Oil', qty: 0.25, unit: 'Ltr' },
      { name: 'Egg', qty: 1.25, unit: 'pcs' },
      { name: 'Seasoning', qty: 0.05, unit: 'kg' }
    ]
  },
];

// DEMO TRANSFERS
const DEMO_TRANSFERS = [
  { transferNo: 'KTN-00045', meal: 'Fried Rice', quantity: 30, unit: 'Plates', dateSent: '17/07/26 10:30 AM', status: 'sent' },
  { transferNo: 'KTN-00044', meal: 'Jollof Rice', quantity: 20, unit: 'Plates', dateSent: '17/07/26 09:15 AM', status: 'accepted' },
  { transferNo: 'KTN-00043', meal: 'Egusi Soup', quantity: 15, unit: 'Portions', dateSent: '16/07/26 08:40 PM', status: 'accepted' },
];

// DEMO MOVEMENTS
const DEMO_MOVEMENTS = [];

// DEMO SESSION — role/privilege must match the scheme in services/permissions.js
// (roles: admin | manager | staff; kitchen-module privilege: chef) so the same
// hasPermission() calls behave identically in demo and live mode.
const DEMO_SESSION = {
  name: 'Head Chef',
  initials: 'HC',
  role: 'staff',
  privilege: 'chef',
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

const KEY_STOCK = 'kitchen-stock';
const KEY_PRODUCTIONS = 'kitchen-productions';
const KEY_TRANSFERS = 'kitchen-transfers';
const KEY_MOVEMENTS = 'kitchen-movements';

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
    console.warn('[KitchenData] Failed to save', key, e);
  }
}

function generateId() {
  return 'prod' + Date.now();
}

function generatePRNo() {
  const date = new Date();
  const year = date.getFullYear();
  const count = Math.floor(Math.random() * 1000);
  return `PROD-${year}-${String(count).padStart(3, '0')}`;
}

/* ═══════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════ */

/**
 * Fetch all kitchen data
 * 
 * BEHAVIOR:
 * - Demo mode: Returns localStorage data or seeds with demo data
 * - Production mode: Tries API, throws error on failure
 */
export async function getKitchenData() {
  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/kitchen`, {
        headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.stock || !data.productions) {
        throw new Error('API response missing required fields');
      }
      
      return {
        stock: data.stock || [],
        productions: data.productions || [],
        transfers: data.transfers || [],
        movements: data.movements || [],
        session: data.session || DEMO_SESSION,
      };
      
    } catch (err) {
      console.error('[KitchenData] Production API error:', err.message);
      throw new Error(`Failed to load kitchen data: ${err.message}. Please refresh or contact support.`);
    }
  }

  // Demo mode
  const stock = await loadLocal(KEY_STOCK, DEMO_STOCK);
  const productions = await loadLocal(KEY_PRODUCTIONS, DEMO_PRODUCTIONS);
  const transfers = await loadLocal(KEY_TRANSFERS, DEMO_TRANSFERS);
  const movements = await loadLocal(KEY_MOVEMENTS, DEMO_MOVEMENTS);
  
  return { stock, productions, transfers, movements, session: DEMO_SESSION };
}

/**
 * Get stock with optional filtering
 */
export async function getStock(filters = {}) {
  const { stock } = await getKitchenData();
  let result = [...stock];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(i => i.name.toLowerCase().includes(q) || (i.batch || '').toLowerCase().includes(q));
  }

  if (filters.category) {
    result = result.filter(i => i.cat === filters.category);
  }

  if (filters.status) {
    const statusMap = { ok: i => i.qty > i.min, low: i => i.qty > 0 && i.qty <= i.min, out: i => i.qty <= 0 };
    result = result.filter(i => statusMap[filters.status] ? statusMap[filters.status](i) : true);
  }

  if (filters.sort) {
    switch (filters.sort) {
      case 'name_asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'qty_asc': result.sort((a, b) => a.qty - b.qty); break;
      case 'qty_desc': result.sort((a, b) => b.qty - a.qty); break;
      default: result.sort((a, b) => a.name.localeCompare(b.name));
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
 * Get productions with optional filtering
 */
export async function getProductions(filters = {}) {
  const { productions } = await getKitchenData();
  let result = [...productions];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(p => p.no.toLowerCase().includes(q) || (p.meals || []).some(m => (m.name || '').toLowerCase().includes(q)));
  }

  if (filters.status) {
    result = result.filter(p => p.status === filters.status);
  }

  if (filters.type) {
    result = result.filter(p => p.type === filters.type);
  }

  if (filters.sort) {
    switch (filters.sort) {
      case 'date_desc': result.sort((a, b) => (b.time || '').localeCompare(a.time || '')); break;
      case 'date_asc': result.sort((a, b) => (a.time || '').localeCompare(b.time || '')); break;
      default: result.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
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
 * Create a production
 */
export async function createProduction(data) {
  const { productions, stock, movements } = await getKitchenData();
  
  const newProduction = {
    no: generatePRNo(),
    batchNo: data.batchNo || `BATCH-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    ...data,
    status: data.status || 'draft',
    time: data.time || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    by: data.by || 'Head Chef',
  };

  // Deduct ingredients from stock
  if (data.ingredients && data.ingredients.length > 0) {
    data.ingredients.forEach(ing => {
      const stockItem = stock.find(s => s.name === ing.name);
      if (stockItem) {
        stockItem.qty = Math.max(0, stockItem.qty - ing.qty);
        movements.unshift({
          date: new Date().toISOString().split('T')[0],
          time: newProduction.time,
          type: 'Production Usage',
          ref: newProduction.no,
          text: `${ing.name} -${ing.qty} ${ing.unit} for ${newProduction.no}`
        });
      }
    });
  }

  productions.unshift(newProduction);
  await saveLocal(KEY_PRODUCTIONS, productions);
  await saveLocal(KEY_STOCK, stock);
  await saveLocal(KEY_MOVEMENTS, movements);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/kitchen/productions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify(newProduction)
      });
    } catch (err) {
      console.warn('[KitchenData] API save failed:', err);
    }
  }

  return newProduction;
}

/**
 * Update a production
 */
export async function updateProduction(no, updates) {
  const { productions } = await getKitchenData();
  const index = productions.findIndex(p => p.no === no);
  
  if (index === -1) {
    throw new Error('Production not found');
  }

  productions[index] = {
    ...productions[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveLocal(KEY_PRODUCTIONS, productions);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/kitchen/productions/${no}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify(productions[index])
      });
    } catch (err) {
      console.warn('[KitchenData] API update failed:', err);
    }
  }

  return productions[index];
}

/**
 * Get transfers
 */
export async function getTransfers(filters = {}) {
  const { transfers } = await getKitchenData();
  let result = [...transfers];

  if (filters.status) {
    result = result.filter(t => t.status === filters.status);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t => t.transferNo.toLowerCase().includes(q) || (t.meal || '').toLowerCase().includes(q));
  }

  return result;
}

/**
 * Create a transfer
 */
export async function createTransfer(data) {
  const { transfers } = await getKitchenData();
  
  const newTransfer = {
    transferNo: `KTN-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    ...data,
    status: 'sent',
    dateSent: data.dateSent || new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''),
  };

  transfers.unshift(newTransfer);
  await saveLocal(KEY_TRANSFERS, transfers);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/kitchen/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify(newTransfer)
      });
    } catch (err) {
      console.warn('[KitchenData] API transfer save failed:', err);
    }
  }

  return newTransfer;
}

/**
 * Update transfer status
 */
export async function updateTransfer(transferNo, status) {
  const { transfers } = await getKitchenData();
  const index = transfers.findIndex(t => t.transferNo === transferNo);
  
  if (index === -1) {
    throw new Error('Transfer not found');
  }

  transfers[index].status = status;
  await saveLocal(KEY_TRANSFERS, transfers);

  if (!CONFIG.USE_DEMO) {
    try {
      await fetch(`${CONFIG.API_BASE}/api/kitchen/transfers/${transferNo}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify({ status })
      });
    } catch (err) {
      console.warn('[KitchenData] API transfer update failed:', err);
    }
  }

  return transfers[index];
}

/**
 * Reset all kitchen data to demo defaults
 */
export async function resetKitchenData() {
  await saveLocal(KEY_STOCK, DEMO_STOCK);
  await saveLocal(KEY_PRODUCTIONS, DEMO_PRODUCTIONS);
  await saveLocal(KEY_TRANSFERS, DEMO_TRANSFERS);
  await saveLocal(KEY_MOVEMENTS, DEMO_MOVEMENTS);
  return true;
}

/* ═══════════════════════════════════════════════
   EXPOSE CONFIG FOR PAGES
═══════════════════════════════════════════════ */
export const KITCHEN_CONFIG = CONFIG;