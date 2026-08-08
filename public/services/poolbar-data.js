// services/poolbar-data.js

/* ═══════════════════════════════════════════════
   PUBLIC DATA API — the only file Pool Bar pages import from.

   This file contains business/CRUD logic only (what does "accept a
   requisition" or "void a sale" mean). It never persists data
   directly and never hardcodes demo records — those live in
   poolbar-storage.js and poolbar-demo-seed.js respectively. Every
   function below branches on CONFIG.USE_DEMO and either calls the
   real API (via apiFetch) or reads/writes local demo storage (via
   loadLocal/saveLocal) — nothing else changes when you go live.

   GOING LIVE: flip USE_DEMO in poolbar-config.js to false, then
   delete poolbar-demo-seed.js and the one import block below that
   pulls from it. Every poolbar-*.html page keeps working untouched.
═══════════════════════════════════════════════ */

import { CONFIG } from './poolbar-config.js';
import {
  DEMO_STOCK, DEMO_SALES, DEMO_ORDERS, DEMO_PENDING, DEMO_MOVEMENTS, DEMO_SESSION,
} from './poolbar-demo-seed.js';
import {
  apiFetch, loadLocal, saveLocal, generateId, nowStamp,
  KEY_STOCK, KEY_SALES, KEY_ORDERS, KEY_PENDING, KEY_MOVEMENTS,
} from './poolbar-storage.js';

/* ═══════════════════════════════════════════════
   INTERNAL HELPERS
═══════════════════════════════════════════════ */

/**
 * Generic search + filter + sort + paginate over an array, used by every
 * getX(filters) below so pagination/sorting logic exists in exactly one
 * place instead of being copy-pasted per entity.
 */
function queryList(list, opts = {}) {
  let result = [...list];

  if (opts.search && opts.search.query) {
    const q = opts.search.query.toLowerCase();
    const fields = opts.search.fields || [];
    result = result.filter(row =>
      fields.some(f => String(row[f] ?? '').toLowerCase().includes(q))
    );
  }

  (opts.filters || []).forEach(({ field, value }) => {
    if (value) result = result.filter(row => row[field] === value);
  });

  if (opts.sort && opts.sorters && opts.sorters[opts.sort]) {
    result = result.sort(opts.sorters[opts.sort]);
  }

  if (opts.page && opts.pageSize) {
    const start = (opts.page - 1) * opts.pageSize;
    const total = result.length;
    const rows = result.slice(start, start + opts.pageSize);
    return { rows, total, page: opts.page, pageSize: opts.pageSize, totalPages: Math.max(1, Math.ceil(total / opts.pageSize)) };
  }

  return result;
}

function applyStockStatusFilter(rows, status) {
  if (!status) return rows;
  const level = i => (i.qty <= 0 ? 'out' : i.qty <= i.min ? 'low' : 'ok');
  return rows.filter(i => level(i) === status);
}

/* ═══════════════════════════════════════════════
   PUBLIC API — READ
═══════════════════════════════════════════════ */

/**
 * Fetch all pool bar data (stock, sales, orders, pending requisitions,
 * movements, session).
 *
 * BEHAVIOR:
 * - Production (CONFIG.USE_DEMO = false): calls GET /api/poolbar.
 *   On any failure — network, non-2xx, malformed body — throws. Never
 *   silently falls back to demo data.
 * - Demo (CONFIG.USE_DEMO = true): reads localStorage, seeding it with
 *   the DEMO_* constants from poolbar-demo-seed.js on first run.
 */
export async function getPoolBarData() {
  if (!CONFIG.USE_DEMO) {
    const data = await apiFetch('GET', '/api/poolbar');
    if (!data || !data.stock || !data.sales) {
      throw new Error('Server response is missing required fields (stock, sales).');
    }
    return {
      stock: data.stock || [],
      sales: data.sales || [],
      orders: data.orders || [],
      pending: data.pending || [],
      movements: data.movements || [],
      session: data.session || null,
    };
  }

  const stock = await loadLocal(KEY_STOCK, DEMO_STOCK);
  const sales = await loadLocal(KEY_SALES, DEMO_SALES);
  const orders = await loadLocal(KEY_ORDERS, DEMO_ORDERS);
  const pending = await loadLocal(KEY_PENDING, DEMO_PENDING);
  const movements = await loadLocal(KEY_MOVEMENTS, DEMO_MOVEMENTS);
  return { stock, sales, orders, pending, movements, session: DEMO_SESSION };
}

export async function getStockFiltered(filters = {}) {
  const { stock } = await getPoolBarData();
  let rows = queryList(stock, {
    search: filters.search ? { query: filters.search, fields: ['name', 'batch'] } : null,
    filters: [{ field: 'category', value: filters.category }],
  });
  rows = applyStockStatusFilter(rows, filters.status);

  const sorters = {
    name_asc: (a, b) => a.name.localeCompare(b.name),
    qty_asc: (a, b) => a.qty - b.qty,
    qty_desc: (a, b) => b.qty - a.qty,
    received_desc: (a, b) => (b.received || '').localeCompare(a.received || ''),
  };
  if (filters.sort && sorters[filters.sort]) rows = rows.sort(sorters[filters.sort]);

  if (filters.page && filters.pageSize) {
    const start = (filters.page - 1) * filters.pageSize;
    const total = rows.length;
    return { rows: rows.slice(start, start + filters.pageSize), total, page: filters.page, pageSize: filters.pageSize, totalPages: Math.max(1, Math.ceil(total / filters.pageSize)) };
  }
  return rows;
}

export async function getSales(filters = {}) {
  const { sales } = await getPoolBarData();
  let rows = queryList(sales, {
    search: filters.search ? { query: filters.search, fields: ['id', 'staff', 'table'] } : null,
    filters: [
      { field: 'method', value: filters.method },
      { field: 'status', value: filters.status },
    ],
  });

  if (filters.dateFrom) rows = rows.filter(s => s.date && s.date >= filters.dateFrom);
  if (filters.dateTo) rows = rows.filter(s => s.date && s.date <= filters.dateTo);

  const sorters = {
    date_desc: (a, b) => (b.date || '').localeCompare(a.date || ''),
    date_asc: (a, b) => (a.date || '').localeCompare(b.date || ''),
    total_desc: (a, b) => b.total - a.total,
    total_asc: (a, b) => a.total - b.total,
  };
  const sortKey = filters.sort || 'date_desc';
  if (sorters[sortKey]) rows = rows.sort(sorters[sortKey]);

  if (filters.page && filters.pageSize) {
    const start = (filters.page - 1) * filters.pageSize;
    const total = rows.length;
    return { rows: rows.slice(start, start + filters.pageSize), total, page: filters.page, pageSize: filters.pageSize, totalPages: Math.max(1, Math.ceil(total / filters.pageSize)) };
  }
  return rows;
}

export async function getOrders(filters = {}) {
  const { orders } = await getPoolBarData();
  return queryList(orders, {
    filters: [{ field: 'status', value: filters.status }],
  });
}

export async function getPendingRequisitions() {
  const { pending } = await getPoolBarData();
  return pending;
}

/* ═══════════════════════════════════════════════
   PUBLIC API — REQUISITIONS
═══════════════════════════════════════════════ */

export async function acceptRequisition(no) {
  if (!CONFIG.USE_DEMO) {
    return apiFetch('POST', `/api/poolbar/requisitions/${encodeURIComponent(no)}/accept`);
  }
  const { pending, stock, movements } = await getPoolBarData();
  const req = pending.find(p => p.no === no);
  if (!req) throw new Error('Requisition not found');

  const stamp = nowStamp();
  let inv = stock.find(s => s.name.toLowerCase() === (req.item || '').toLowerCase());
  if (inv) {
    inv.qty = (inv.qty || 0) + (req.qty || 0);
    inv.batch = req.prodNo || inv.batch;
    inv.received = stamp.split(' ')[0];
  } else {
    inv = {
      name: req.item,
      category: 'Other',
      unit: req.unit || 'Bottles',
      qty: req.qty || 0,
      min: 0,
      batch: req.prodNo || '',
      received: stamp.split(' ')[0],
      price: 0,
      desc: '',
    };
    stock.push(inv);
  }

  movements.unshift({
    date: stamp,
    item: req.item,
    qtyIn: req.qty || 0,
    qtyOut: 0,
    balance: inv.qty,
    reason: `Accepted requisition (${req.no})`,
  });

  const next = pending.filter(p => p.no !== no);
  await saveLocal(KEY_PENDING, next);
  await saveLocal(KEY_STOCK, stock);
  await saveLocal(KEY_MOVEMENTS, movements);
  return { item: inv, pending: next };
}

export async function rejectRequisition(no, reason = '') {
  if (!CONFIG.USE_DEMO) {
    return apiFetch('POST', `/api/poolbar/requisitions/${encodeURIComponent(no)}/reject`, { reason });
  }
  const { pending } = await getPoolBarData();
  if (!pending.find(p => p.no === no)) throw new Error('Requisition not found');
  const next = pending.filter(p => p.no !== no);
  await saveLocal(KEY_PENDING, next);
  return { success: true, pending: next };
}

/* ═══════════════════════════════════════════════
   PUBLIC API — STOCK CRUD
═══════════════════════════════════════════════ */

export async function addStockItem(item) {
  if (!item.name || !item.name.trim()) throw new Error('Item name is required.');

  if (!CONFIG.USE_DEMO) {
    return apiFetch('POST', '/api/poolbar/stock', {
      name: item.name.trim(),
      category: item.category || 'Uncategorized',
      unit: item.unit || 'Pieces',
      min: item.min || 0,
      price: item.price || 0,
      desc: item.desc || '',
    });
  }

  const { stock } = await getPoolBarData();
  if (stock.some(i => i.name.toLowerCase() === item.name.trim().toLowerCase())) {
    throw new Error('That item is already tracked — edit it instead.');
  }

  const entry = {
    name: item.name.trim(),
    category: item.category || 'Uncategorized',
    unit: item.unit || 'Pieces',
    qty: 0, // new items always start at 0 — stock only enters via requisition/receiving
    min: item.min || 0,
    price: item.price || 0,
    batch: '—',
    received: '—',
    desc: item.desc || '',
  };
  stock.push(entry);
  await saveLocal(KEY_STOCK, stock);
  return entry;
}

export async function editStockItem(name, updates) {
  // qty/batch/received are procurement-controlled — never editable from here,
  // in either mode.
  const { qty, batch, received, ...safeUpdates } = updates;

  if (!CONFIG.USE_DEMO) {
    return apiFetch('PUT', `/api/poolbar/stock/${encodeURIComponent(name)}`, safeUpdates);
  }

  const { stock } = await getPoolBarData();
  const idx = stock.findIndex(i => i.name === name);
  if (idx === -1) throw new Error(`Stock item "${name}" not found.`);
  stock[idx] = { ...stock[idx], ...safeUpdates };
  await saveLocal(KEY_STOCK, stock);
  return stock[idx];
}

export async function deleteStockItem(name) {
  if (!CONFIG.USE_DEMO) {
    await apiFetch('DELETE', `/api/poolbar/stock/${encodeURIComponent(name)}`);
    return { name };
  }

  const { stock } = await getPoolBarData();
  const item = stock.find(i => i.name === name);
  if (!item) throw new Error(`Stock item "${name}" not found.`);
  const next = stock.filter(i => i.name !== name);
  await saveLocal(KEY_STOCK, next);
  return item;
}

/**
 * Adjust stock quantity up or down with a logged movement.
 * delta: positive to add, negative to deduct.
 */
export async function adjustStockQty(name, delta, reason, notes) {
  if (!CONFIG.USE_DEMO) {
    return apiFetch('POST', `/api/poolbar/stock/${encodeURIComponent(name)}/adjust`, { delta, reason, notes });
  }

  const { stock, movements } = await getPoolBarData();
  const item = stock.find(i => i.name === name);
  if (!item) throw new Error(`Stock item "${name}" not found.`);

  const nextQty = item.qty + delta;
  if (nextQty < 0) throw new Error(`Cannot deduct more than the ${item.qty} ${item.unit} on hand.`);
  item.qty = nextQty;

  movements.unshift({
    date: nowStamp(),
    item: item.name,
    qtyIn: delta > 0 ? delta : 0,
    qtyOut: delta < 0 ? -delta : 0,
    balance: item.qty,
    reason: notes ? `${reason} — ${notes}` : reason,
  });

  await saveLocal(KEY_STOCK, stock);
  await saveLocal(KEY_MOVEMENTS, movements);
  return item;
}

/* ═══════════════════════════════════════════════
   PUBLIC API — SALES
═══════════════════════════════════════════════ */

export async function createSale(data) {
  if (!CONFIG.USE_DEMO) {
    return apiFetch('POST', '/api/poolbar/sales', data);
  }

  const { sales, stock, movements } = await getPoolBarData();
  const newSale = {
    id: generateId(),
    ...data,
    status: 'completed',
    date: data.date || nowStamp(),
  };

  if (data.items) {
    data.items.forEach(item => {
      const inv = stock.find(i => i.name === item.name);
      if (inv) {
        inv.qty = Math.max(0, inv.qty - item.qty);
        movements.unshift({ date: newSale.date, item: item.name, qtyIn: 0, qtyOut: item.qty, balance: inv.qty, reason: `Sale (${newSale.id})` });
      }
    });
  }

  sales.unshift(newSale);
  await saveLocal(KEY_SALES, sales);
  await saveLocal(KEY_STOCK, stock);
  await saveLocal(KEY_MOVEMENTS, movements);
  return newSale;
}

export async function voidSale(id, reason, voidedBy) {
  if (!CONFIG.USE_DEMO) {
    return apiFetch('POST', `/api/poolbar/sales/${encodeURIComponent(id)}/void`, { reason, voidedBy });
  }

  const { sales, stock, movements } = await getPoolBarData();
  const sale = sales.find(s => s.id === id);
  if (!sale) throw new Error('Sale not found');

  const stamp = nowStamp();
  if (sale.items) {
    sale.items.forEach(item => {
      const inv = stock.find(i => i.name === item.name);
      if (inv) {
        inv.qty += item.qty;
        movements.unshift({ date: stamp, item: item.name, qtyIn: item.qty, qtyOut: 0, balance: inv.qty, reason: `Voided Sale (${sale.id})` });
      }
    });
  }

  sale.status = 'voided';
  sale.voidReason = reason;
  sale.voidDate = stamp;
  sale.voidedBy = voidedBy;

  await saveLocal(KEY_SALES, sales);
  await saveLocal(KEY_STOCK, stock);
  await saveLocal(KEY_MOVEMENTS, movements);
  return sale;
}

/* ═══════════════════════════════════════════════
   PUBLIC API — ORDERS
═══════════════════════════════════════════════ */

export async function createOrder(data) {
  if (!CONFIG.USE_DEMO) {
    return apiFetch('POST', '/api/poolbar/orders', data);
  }
  const { orders } = await getPoolBarData();
  const newOrder = { id: generateId(), ...data, status: 'open', date: data.date || nowStamp() };
  orders.unshift(newOrder);
  await saveLocal(KEY_ORDERS, orders);
  return newOrder;
}

export async function updateOrder(id, updates) {
  if (!CONFIG.USE_DEMO) {
    return apiFetch('PATCH', `/api/poolbar/orders/${encodeURIComponent(id)}`, updates);
  }
  const { orders } = await getPoolBarData();
  const order = orders.find(o => o.id === id);
  if (!order) throw new Error('Order not found');
  Object.assign(order, updates, { updatedAt: new Date().toISOString() });
  await saveLocal(KEY_ORDERS, orders);
  return order;
}

export async function payOrder(id, method) {
  if (!CONFIG.USE_DEMO) {
    return apiFetch('POST', `/api/poolbar/orders/${encodeURIComponent(id)}/pay`, { method });
  }

  const { orders, sales, stock, movements } = await getPoolBarData();
  const order = orders.find(o => o.id === id);
  if (!order) throw new Error('Order not found');

  const stamp = nowStamp();
  const sale = {
    id: generateId(), items: order.items, subtotal: order.subtotal, discount: order.discount,
    total: order.total, method, staff: order.staff, table: order.table, notes: order.notes,
    date: stamp, status: 'completed', source: 'tab'
  };

  if (order.items) {
    order.items.forEach(item => {
      const inv = stock.find(i => i.name === item.name);
      if (inv) {
        inv.qty = Math.max(0, inv.qty - item.qty);
        movements.unshift({ date: stamp, item: item.name, qtyIn: 0, qtyOut: item.qty, balance: inv.qty, reason: `Tab Payment (${order.id})` });
      }
    });
  }

  order.status = 'paid';
  order.payMethod = method;
  order.paidSaleId = sale.id;

  sales.unshift(sale);
  await saveLocal(KEY_SALES, sales);
  await saveLocal(KEY_STOCK, stock);
  await saveLocal(KEY_MOVEMENTS, movements);
  await saveLocal(KEY_ORDERS, orders);
  return { sale, order };
}

/* ═══════════════════════════════════════════════
   PUBLIC API — RESET / UTIL

   Demo-only by design: resetting to seed data isn't a real operation
   a production backend should expose here, so this throws instead of
   silently no-op'ing (or worse, wiping real data) if ever called with
   USE_DEMO = false.
═══════════════════════════════════════════════ */
export async function resetPoolBarData() {
  if (!CONFIG.USE_DEMO) {
    throw new Error('Reset is only available in demo mode.');
  }
  await saveLocal(KEY_STOCK, DEMO_STOCK);
  await saveLocal(KEY_SALES, DEMO_SALES);
  await saveLocal(KEY_ORDERS, DEMO_ORDERS);
  await saveLocal(KEY_PENDING, DEMO_PENDING);
  await saveLocal(KEY_MOVEMENTS, DEMO_MOVEMENTS);
  return true;
}

/* ═══════════════════════════════════════════════
   EXPOSE CONFIG FOR PAGES
   (re-exported here, unchanged, so existing
   `import { POOLBAR_CONFIG } from './poolbar-data.js'`
   calls in poolbar-*.html pages keep working untouched)
═══════════════════════════════════════════════ */
export const POOLBAR_CONFIG = CONFIG;