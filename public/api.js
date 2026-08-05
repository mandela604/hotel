/**
 * Aurum Hotel — API Layer
 * ─────────────────────────────────────────────────────────────────────
 * Reads/writes through the unified DataStore (localStorage in demo,
 * REST API in production). All functions return the same shapes as
 * before — your existing pages don't need to change.
 *
 * To switch to production:
 *   1. Deploy a backend that implements GET/PUT/DELETE /data/:key
 *   2. Call DataStore.setMode('live', { baseUrl, token })
 *   3. That's it — every API function starts hitting the real backend.
 */

/* ─────────────────────── PUBLIC API FUNCTIONS ─────────────────────── */
const API = {
  getOverview: async () => {
    const kpi = await DataStore.get('ds_kpi') || {};
    const occupancy = await DataStore.get('ds_occupancy') || [];
    const activity = await DataStore.get(DataStore.ACTIVITY_KEY) || [];
    const rev = await DataStore.getTotalRevenue();
    return {
      stats: {
        bookings_today: kpi.bookings_today || 0,
        restaurant_sales: kpi.restaurant_sales || 0,
        pool_bar_sales: kpi.pool_bar_sales || 0,
        pending_procurement: kpi.pending_procurement || 0,
        occupancy_rate: kpi.occupancy_rate || 0,
        staff_on_duty: kpi.staff_on_duty || 0,
        total_revenue_today: rev.total || 0,
        outstanding_invoices: kpi.outstanding_invoices || 0
      },
      occupancy,
      activity,
      weekly_revenue: [
        { day:'Mon', rooms:820000, food:310000, pool:90000 },
        { day:'Tue', rooms:950000, food:420000, pool:130000 },
        { day:'Wed', rooms:780000, food:380000, pool:110000 },
        { day:'Thu', rooms:1100000, food:490000, pool:160000 },
        { day:'Fri', rooms:1350000, food:620000, pool:210000 },
        { day:'Sat', rooms:1580000, food:780000, pool:290000 },
        { day:'Sun', rooms:1200000, food:510000, pool:180000 },
      ]
    };
  },

  getBookings: async () => {
    const rooms = await DataStore.get('ds_bookings_rooms') || [];
    return { rooms };
  },

  getRestaurant: async () => {
    const menu = await DataStore.get('ds_restaurant_menu') || [];
    const tables = await DataStore.get('ds_restaurant_tables') || [];
    const sales = await DataStore.get('ds_restaurant_sales') || [];
    const todaySales = sales.filter(s => s.status !== 'voided').reduce((s, t) => s + (t.total || 0), 0);
    return {
      tables,
      menu,
      today_sales: todaySales,
      orders_count: sales.length,
      avg_order: sales.length ? Math.round(todaySales / sales.length) : 0
    };
  },

  getPoolBar: async () => {
    const menu = await DataStore.get('ds_poolbar_menu') || [];
    const transactions = await DataStore.get('ds_poolbar_transactions') || [];
    const sales = await DataStore.get('ds_poolbar_sales') || [];
    const todaySales = sales.filter(s => s.status !== 'voided').reduce((s, t) => s + (t.total || 0), 0);
    return { menu, transactions, today_sales: todaySales };
  },

  getStaff: async () => {
    return await DataStore.get('ds_staff') || [];
  },

  getProcurement: async () => {
    const prs = await DataStore.get('ds_procurement_prs') || [];
    return prs.map(p => ({
      id: p.prNo,
      item: p.item,
      qty: p.qty,
      unit_price: p.unitCost,
      total: p.totalAmount,
      dept: p.dept,
      status: p.status === 'fulfilled' ? 'received' : p.status === 'approved' ? 'approved' : p.status === 'rejected' ? 'rejected' : 'pending',
      date: p.date
    }));
  },

  getAccounting: async () => {
    const summary = await DataStore.get('ds_accounting_summary') || {};
    const ledger = await DataStore.get('ds_accounting_ledger') || [];
    return { summary, ledger };
  },

  /* ── Mutations ── */
  createBooking: async (data) => {
    const rooms = await DataStore.get('ds_bookings_rooms') || [];
    const newBooking = {
      id: 'R' + (100 + rooms.length + 1),
      type: data.type || 'Standard',
      guest: data.guest || 'New Guest',
      check_in: data.check_in || new Date().toISOString().split('T')[0],
      check_out: data.check_out || '',
      status: 'occupied',
      amount: data.amount || 0,
      nights: data.nights || 1
    };
    rooms.unshift(newBooking);
    await DataStore.set('ds_bookings_rooms', rooms);
    await DataStore.addActivity('Booking', `Room ${newBooking.id} booked — ${newBooking.guest} (${newBooking.nights} nights)`);
    return { success: true, id: newBooking.id };
  },

  updateBooking: async (id, d) => {
    const rooms = await DataStore.get('ds_bookings_rooms') || [];
    const idx = rooms.findIndex(r => r.id === id);
    if (idx !== -1) {
      rooms[idx] = { ...rooms[idx], ...d };
      await DataStore.set('ds_bookings_rooms', rooms);
    }
    return { success: true };
  },

  createOrder: async (data) => {
    const id = 'ORD-' + Date.now();
    const sale = {
      id,
      items: data.items || [],
      subtotal: data.subtotal || 0,
      discount: data.discount || 0,
      total: data.total || 0,
      method: data.method || 'Cash',
      staff: data.staff || '',
      table: data.table || '',
      date: new Date().toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }).replace(',', ''),
      status: 'completed'
    };
    await DataStore.addSale('restaurant', sale);
    return { success: true, id };
  },

  createProcurement: async (data) => {
    const prs = await DataStore.get('ds_procurement_prs') || [];
    const newPR = {
      id: 'pr' + Date.now(),
      prNo: 'PR-' + String(Math.floor(Math.random() * 900) + 100),
      item: data.item || '',
      cat: data.cat || 'General',
      dept: data.dept || '',
      by: data.by || 'Staff',
      date: new Date().toISOString().split('T')[0],
      needed: data.needed || '',
      qty: data.qty || 1,
      unit: data.unit || 'Units',
      unitCost: data.unit_price || 0,
      priority: data.priority || 'Normal',
      totalAmount: (data.qty || 1) * (data.unit_price || 0),
      status: 'pending',
      approvalStage: 'pending',
      supplier: '',
      poNo: '',
      notes: data.notes || '',
      history: [{ date: new Date().toISOString().split('T')[0], action: 'Request submitted', by: data.by || 'Staff', stage: 'pending' }]
    };
    prs.unshift(newPR);
    await DataStore.set('ds_procurement_prs', prs);
    await DataStore.addActivity('Procurement', `${newPR.prNo} — ${newPR.item} requested by ${newPR.dept}`);
    return { success: true, id: newPR.prNo };
  },

  approveProcurement: async (id) => {
    const prs = await DataStore.get('ds_procurement_prs') || [];
    const pr = prs.find(p => p.prNo === id);
    if (pr) {
      pr.status = 'approved';
      pr.approvalStage = 'approved';
      pr.history.push({ date: new Date().toISOString().split('T')[0], action: 'Approved', by: 'Manager', stage: 'approved' });
      await DataStore.set('ds_procurement_prs', prs);
    }
    return { success: true };
  },

  addStaff: async (data) => {
    const staff = await DataStore.get('ds_staff') || [];
    const newStaff = {
      id: 'S' + String(staff.length + 1).padStart(3, '0'),
      name: data.name || '',
      role: data.role || '',
      dept: data.dept || '',
      shift: data.shift || 'Morning',
      status: 'on_duty',
      salary: data.salary || 0
    };
    staff.push(newStaff);
    await DataStore.set('ds_staff', staff);
    return { success: true };
  },

  recordSale: async (data) => {
    const sale = {
      id: 'SALE-' + Date.now(),
      items: data.items || [],
      subtotal: data.subtotal || 0,
      discount: data.discount || 0,
      total: data.total || 0,
      method: data.method || 'Cash',
      staff: data.staff || '',
      date: new Date().toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }).replace(',', ''),
      status: 'completed'
    };
    await DataStore.addSale('restaurant', sale);
    return { success: true, id: sale.id };
  },
};

/* ─────────────────────── UTILS ─────────────────────── */
function formatNaira(n) {
  return '₦' + Number(n).toLocaleString('en-NG');
}

function formatDate(d) {
  if (!d || d === '—') return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

/* ── Get current logged-in user ── */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem('aurum_user');
    return raw ? JSON.parse(raw) : { name: 'Guest', initials: 'G', role: 'Staff' };
  } catch (e) {
    return { name: 'Guest', initials: 'G', role: 'Staff' };
  }
}

window.API          = API;
window.formatNaira  = formatNaira;
window.formatDate   = formatDate;
window.getCurrentUser = getCurrentUser;
