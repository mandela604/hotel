// services/restaurant-data.js

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

// DEMO INVENTORY
const DEMO_INVENTORY = [
  { meal: 'Egusi Soup', source: 'Kitchen', unit: 'Portions', qty: 15, min: 8, batch: 'PROD-00094', received: '17/07/26', price: 6000, desc: 'Spicy egusi with assorted meat' },
  { meal: 'Moi Moi', source: 'Kitchen', unit: 'Pieces', qty: 4, min: 8, batch: 'PROD-00090', received: '16/07/26', price: 2500, desc: 'Steamed bean pudding' },
  { meal: 'Jollof Rice', source: 'Kitchen', unit: 'Plates', qty: 0, min: 6, batch: 'PROD-00088', received: '16/07/26', price: 5500, desc: 'Party-style jollof rice' },
  { meal: 'Fried Rice', source: 'Kitchen', unit: 'Plates', qty: 18, min: 6, batch: 'PROD-00085', received: '16/07/26', price: 6000, desc: 'Vegetable fried rice' },
  { meal: 'Chapman', source: 'Store', unit: 'Bottles', qty: 24, min: 10, batch: 'REQ-00031', received: '17/07/26', price: 2500, desc: 'Classic Nigerian mocktail mix' },
  { meal: 'Heineken', source: 'Store', unit: 'Bottles', qty: 40, min: 15, batch: 'REQ-00031', received: '17/07/26', price: 1500, desc: '33cl chilled beer' },
  { meal: 'Mojito Cocktail', source: 'Store', unit: 'Bottles', qty: 0, min: 5, batch: 'REQ-00028', received: '14/07/26', price: 5500, desc: 'Rum, mint, lime, soda' },
];

// DEMO MENU
const DEMO_MENU = [
  { id: 'm01', name: 'Peppered Snail', category: 'Starters', type: 'food', price: 4500, avail: true },
  { id: 'm02', name: 'Grilled Chicken', category: 'Main Course', type: 'food', price: 8500, avail: true },
  { id: 'm11', name: 'Chapman', category: 'Soft Drinks', type: 'drink', price: 2500, avail: true },
  { id: 'm17', name: 'Mojito Cocktail', category: 'Cocktails', type: 'drink', price: 5500, avail: true },
];

// DEMO SALES
const DEMO_SALES = [
  { id: 'SALE-1043', items: [{ meal: 'Egusi Soup', qty: 2, price: 6000 }], subtotal: 12000, discount: 0, total: 12000, method: 'Cash', staff: 'Amaka O.', table: 'Table 4', notes: '', date: '17/07/26 11:05 AM', status: 'completed', source: 'quick' },
  { id: 'SALE-1042', items: [{ meal: 'Fried Rice', qty: 3, price: 6000 }, { meal: 'Chapman', qty: 2, price: 2500 }], subtotal: 23000, discount: 0, total: 23000, method: 'POS', staff: 'Tunde A.', table: 'Table 2', notes: '', date: '17/07/26 10:40 AM', status: 'completed', source: 'quick' },
  { id: 'SALE-1041', items: [{ meal: 'Moi Moi', qty: 1, price: 2500 }], subtotal: 2500, discount: 0, total: 2500, method: 'Transfer', staff: 'Amaka O.', table: 'Takeaway', notes: '', date: '17/07/26 09:52 AM', status: 'completed', source: 'quick' },
  { id: 'SALE-1040', items: [{ meal: 'Jollof Rice', qty: 4, price: 5500 }, { meal: 'Moi Moi', qty: 2, price: 2500 }], subtotal: 27000, discount: 10, total: 24300, method: 'Room Charge', staff: 'Tunde A.', table: 'Room 204', notes: '', date: '16/07/26 07:30 PM', status: 'completed', source: 'quick' },
  { id: 'SALE-1039', items: [{ meal: 'Egusi Soup', qty: 1, price: 6000 }], subtotal: 6000, discount: 0, total: 6000, method: 'Cash', staff: 'Amaka O.', table: 'Table 1', notes: 'Wrong order', date: '16/07/26 01:15 PM', status: 'voided', voidReason: 'Customer changed mind before it was served', voidDate: '16/07/26 01:20 PM', source: 'quick' },
];

// DEMO ORDERS (tabs)
const DEMO_ORDERS = [];

// DEMO TRANSFERS (pending)
const DEMO_TRANSFERS = [
  { no: 'KTN-00045', batchNo: 'BATCH-00031', source: 'Kitchen', from: 'Main Kitchen', restaurant: 'Main Restaurant', sentBy: 'Head Chef', items: [{ name: 'Fried Rice', qty: 30, unit: 'Plates' }, { name: 'Moi Moi', qty: 12, unit: 'Pieces' }], date: '17/07/26 10:30 AM', remarks: 'Lunch preparation' },
  { no: 'KTN-00044', batchNo: 'BATCH-00030', source: 'Kitchen', from: 'Main Kitchen', restaurant: 'Main Restaurant', sentBy: 'Head Chef', items: [{ name: 'Jollof Rice', qty: 20, unit: 'Plates' }], date: '17/07/26 09:15 AM', remarks: '' },
  { no: 'STX-00019', batchNo: '', source: 'Store', from: 'Central Store', restaurant: 'Main Restaurant', sentBy: 'Store Keeper', items: [{ name: 'Bottled Water', qty: 48, unit: 'Bottles' }, { name: 'Soft Drinks', qty: 24, unit: 'Bottles' }], date: '17/07/26 08:40 AM', remarks: 'Weekend stock top-up' },
];

// DEMO TRANSFER HISTORY
const DEMO_HISTORY = [
  { no: 'KTN-00040', batchNo: 'BATCH-00026', source: 'Kitchen', from: 'Main Kitchen', restaurant: 'Main Restaurant', sentBy: 'Head Chef', items: [{ name: 'Jollof Rice', qty: 25, unit: 'Plates' }], date: '14/07/26 09:10 AM', remarks: '', status: 'accepted', receivedBy: 'Ada, Front of House', actionRemarks: '', actionDate: '14/07/26 09:40 AM' },
  { no: 'KTN-00041', batchNo: 'BATCH-00027', source: 'Kitchen', from: 'Main Kitchen', restaurant: 'Main Restaurant', sentBy: 'Head Chef', items: [{ name: 'Egusi Soup', qty: 16, unit: 'Portions' }], date: '14/07/26 12:05 PM', remarks: '', status: 'accepted', receivedBy: 'Tunde, Waitstaff', actionRemarks: '', actionDate: '14/07/26 12:30 PM' },
  { no: 'KTN-00042', batchNo: 'BATCH-00028', source: 'Kitchen', from: 'Banquet Kitchen', restaurant: 'Main Restaurant', sentBy: 'Sous Chef', items: [{ name: 'Moi Moi', qty: 10, unit: 'Pieces' }], date: '15/07/26 08:50 AM', remarks: '', status: 'rejected', receivedBy: '', actionRemarks: 'Wrong batch — texture off, sent back.', actionDate: '15/07/26 09:05 AM' },
  { no: 'KTN-00043', batchNo: 'BATCH-00029', source: 'Kitchen', from: 'Main Kitchen', restaurant: 'Main Restaurant', sentBy: 'Head Chef', items: [{ name: 'Fried Rice', qty: 22, unit: 'Plates' }], date: '15/07/26 01:15 PM', remarks: '', status: 'accepted', receivedBy: 'Ada, Front of House', actionRemarks: '', actionDate: '15/07/26 01:45 PM' },
  { no: 'STX-00018', batchNo: '', source: 'Store', from: 'Central Store', restaurant: 'Main Restaurant', sentBy: 'Store Keeper', items: [{ name: 'Cutlery Sets', qty: 50, unit: 'Sets' }, { name: 'Table Linens', qty: 20, unit: 'Pieces' }], date: '13/07/26 03:20 PM', remarks: 'Monthly consumables restock', status: 'accepted', receivedBy: 'Tunde, Waitstaff', actionRemarks: '', actionDate: '13/07/26 03:50 PM' },
];

// DEMO MOVEMENTS
const DEMO_MOVEMENTS = [];

// DEMO SESSION
const DEMO_SESSION = {
  name: 'Restaurant Manager',
  initials: 'RM',
  role: 'restaurant_manager',
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

const KEY_INVENTORY = 'restaurant-inventory';
const KEY_MENU = 'restaurant-menu';
const KEY_SALES = 'restaurant-sales';
const KEY_ORDERS = 'restaurant-orders';
const KEY_TRANSFERS = 'restaurant-pending-transfers';
const KEY_HISTORY = 'restaurant-transfer-history';
const KEY_MOVEMENTS = 'restaurant-movements';

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
    console.warn('[RestaurantData] Failed to save', key, e);
  }
}

function generateId() {
  return 'sale' + Date.now();
}

/* ═══════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════ */

/**
 * Fetch all restaurant data
 * 
 * BEHAVIOR:
 * - Demo mode: Returns localStorage data or seeds with demo data
 * - Production mode: Tries API, throws error on failure
 */
export async function getRestaurantData() {
  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/restaurant`, {
        headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.inventory || !data.sales) {
        throw new Error('API response missing required fields');
      }
      
      return {
        inventory: data.inventory || [],
        menu: data.menu || [],
        sales: data.sales || [],
        orders: data.orders || [],
        transfers: data.transfers || [],
        history: data.history || [],
        movements: data.movements || [],
        session: data.session || DEMO_SESSION,
      };
      
    } catch (err) {
      console.error('[RestaurantData] Production API error:', err.message);
      throw new Error(`Failed to load restaurant data: ${err.message}. Please refresh or contact support.`);
    }
  }

  // Demo mode
  const inventory = await loadLocal(KEY_INVENTORY, DEMO_INVENTORY);
  const menu = await loadLocal(KEY_MENU, DEMO_MENU);
  const sales = await loadLocal(KEY_SALES, DEMO_SALES);
  const orders = await loadLocal(KEY_ORDERS, DEMO_ORDERS);
  const transfers = await loadLocal(KEY_TRANSFERS, DEMO_TRANSFERS);
  const history = await loadLocal(KEY_HISTORY, DEMO_HISTORY);
  const movements = await loadLocal(KEY_MOVEMENTS, DEMO_MOVEMENTS);
  
  return { inventory, menu, sales, orders, transfers, history, movements, session: DEMO_SESSION };
}

/**
 * Get inventory with optional filtering
 */
export async function getInventory(filters = {}) {
  const { inventory } = await getRestaurantData();
  let result = [...inventory];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(i => i.meal.toLowerCase().includes(q) || (i.batch || '').toLowerCase().includes(q));
  }

  if (filters.source) {
    result = result.filter(i => i.source === filters.source);
  }

  if (filters.status) {
    const statusMap = { ok: i => i.qty > i.min, low: i => i.qty > 0 && i.qty <= i.min, out: i => i.qty <= 0 };
    result = result.filter(i => statusMap[filters.status] ? statusMap[filters.status](i) : true);
  }

  if (filters.sort) {
    switch (filters.sort) {
      case 'name_asc': result.sort((a, b) => a.meal.localeCompare(b.meal)); break;
      case 'qty_asc': result.sort((a, b) => a.qty - b.qty); break;
      case 'qty_desc': result.sort((a, b) => b.qty - a.qty); break;
      default: result.sort((a, b) => a.meal.localeCompare(b.meal));
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
 * Get sales with filtering
 */
export async function getSales(filters = {}) {
  const { sales } = await getRestaurantData();
  let result = [...sales];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(s => s.id.toLowerCase().includes(q) || (s.staff || '').toLowerCase().includes(q) || (s.table || '').toLowerCase().includes(q));
  }

  if (filters.method) {
    result = result.filter(s => s.method === filters.method);
  }

  if (filters.status) {
    result = result.filter(s => s.status === filters.status);
  }

  if (filters.dateFrom) {
    result = result.filter(s => s.date && s.date >= filters.dateFrom);
  }

  if (filters.dateTo) {
    result = result.filter(s => s.date && s.date <= filters.dateTo);
  }

  if (filters.sort) {
    switch (filters.sort) {
      case 'date_desc': result.sort((a, b) => (b.date || '').localeCompare(a.date || '')); break;
      case 'date_asc': result.sort((a, b) => (a.date || '').localeCompare(b.date || '')); break;
      case 'total_desc': result.sort((a, b) => b.total - a.total); break;
      case 'total_asc': result.sort((a, b) => a.total - b.total); break;
      default: result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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
 * Create a sale
 */
export async function createSale(data) {
  const { sales, inventory, movements } = await getRestaurantData();
  
  const newSale = {
    id: generateId(),
    ...data,
    status: 'completed',
    source: data.source || 'quick',
    date: data.date || new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''),
  };

  // Deduct inventory
  if (data.items) {
    data.items.forEach(item => {
      const inv = inventory.find(i => i.meal === item.meal);
      if (inv) {
        inv.qty = Math.max(0, inv.qty - item.qty);
        movements.unshift({
          date: newSale.date,
          meal: item.meal,
          qtyIn: 0,
          qtyOut: item.qty,
          balance: inv.qty,
          reason: `Sale (${newSale.id})`
        });
      }
    });
  }

  sales.unshift(newSale);
  await saveLocal(KEY_SALES, sales);
  await saveLocal(KEY_INVENTORY, inventory);
  await saveLocal(KEY_MOVEMENTS, movements);

  return newSale;
}

/**
 * Void a sale (restore inventory)
 */
export async function voidSale(id, reason) {
  const { sales, inventory, movements } = await getRestaurantData();
  const sale = sales.find(s => s.id === id);
  
  if (!sale) {
    throw new Error('Sale not found');
  }

  const stamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

  // Restore inventory
  if (sale.items) {
    sale.items.forEach(item => {
      const inv = inventory.find(i => i.meal === item.meal);
      if (inv) {
        inv.qty += item.qty;
        movements.unshift({
          date: stamp,
          meal: item.meal,
          qtyIn: item.qty,
          qtyOut: 0,
          balance: inv.qty,
          reason: `Voided Sale (${sale.id})`
        });
      }
    });
  }

  sale.status = 'voided';
  sale.voidReason = reason;
  sale.voidDate = stamp;

  await saveLocal(KEY_SALES, sales);
  await saveLocal(KEY_INVENTORY, inventory);
  await saveLocal(KEY_MOVEMENTS, movements);

  return sale;
}

/**
 * Get pending transfers
 */
export async function getPendingTransfers() {
  const { transfers } = await getRestaurantData();
  return transfers;
}

/**
 * Accept a transfer (add to inventory)
 */
export async function acceptTransfer(no, receivedBy, remarks) {
  const { transfers, inventory, history, movements } = await getRestaurantData();
  const transfer = transfers.find(t => t.no === no);
  
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  const stamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

  // Add items to inventory
  if (transfer.items) {
    transfer.items.forEach(item => {
      const existing = inventory.find(i => i.meal === item.name);
      if (existing) {
        existing.qty += item.qty;
        existing.batch = transfer.batchNo || existing.batch;
        existing.received = stamp.split(' ')[0];
      } else {
        inventory.push({
          meal: item.name,
          qty: item.qty,
          unit: item.unit,
          batch: transfer.batchNo || '—',
          received: stamp.split(' ')[0],
          min: 6,
          source: transfer.source,
          price: 0,
          desc: ''
        });
      }
      const balance = inventory.find(i => i.meal === item.name).qty;
      movements.unshift({
        date: stamp,
        meal: item.name,
        qtyIn: item.qty,
        qtyOut: 0,
        balance,
        reason: `${transfer.source} Transfer (${transfer.no})`
      });
    });
  }

  // Move to history
  history.unshift({
    ...transfer,
    status: 'accepted',
    receivedBy,
    actionRemarks: remarks,
    actionDate: stamp
  });

  const updatedTransfers = transfers.filter(t => t.no !== no);

  await saveLocal(KEY_INVENTORY, inventory);
  await saveLocal(KEY_MOVEMENTS, movements);
  await saveLocal(KEY_HISTORY, history);
  await saveLocal(KEY_TRANSFERS, updatedTransfers);

  return { success: true };
}

/**
 * Reject a transfer
 */
export async function rejectTransfer(no, reason) {
  const { transfers, history } = await getRestaurantData();
  const transfer = transfers.find(t => t.no === no);
  
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  const stamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

  history.unshift({
    ...transfer,
    status: 'rejected',
    receivedBy: '',
    actionRemarks: reason,
    actionDate: stamp
  });

  const updatedTransfers = transfers.filter(t => t.no !== no);

  await saveLocal(KEY_HISTORY, history);
  await saveLocal(KEY_TRANSFERS, updatedTransfers);

  return { success: true };
}

/**
 * Reset all restaurant data to demo defaults
 */
export async function resetRestaurantData() {
  await saveLocal(KEY_INVENTORY, DEMO_INVENTORY);
  await saveLocal(KEY_MENU, DEMO_MENU);
  await saveLocal(KEY_SALES, DEMO_SALES);
  await saveLocal(KEY_ORDERS, DEMO_ORDERS);
  await saveLocal(KEY_TRANSFERS, DEMO_TRANSFERS);
  await saveLocal(KEY_HISTORY, DEMO_HISTORY);
  await saveLocal(KEY_MOVEMENTS, DEMO_MOVEMENTS);
  return true;
}

/* ═══════════════════════════════════════════════
   EXPOSE CONFIG FOR PAGES
═══════════════════════════════════════════════ */
export const RESTAURANT_CONFIG = CONFIG;