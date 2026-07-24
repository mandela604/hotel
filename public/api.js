/**
 * Aurum Hotel — API Layer
 * Base URL: swap API_BASE to your production endpoint.
 * All functions fall back to DEMO_DATA when the request fails or IS_DEMO = true.
 */

const API_BASE = 'https://api.aurumhotel.com/v1';   // ← replace with real URL
const IS_DEMO  = true;                                // ← set false in production

/* ─────────────────────── DEMO DATA ─────────────────────── */
const DEMO = {

  overview: {
    stats: {
      bookings_today: 12,
      restaurant_sales: 1200000,
      pool_bar_sales: 500000,
      pending_procurement: 3,
      occupancy_rate: 76,
      staff_on_duty: 18,
      total_revenue_today: 4850000,
      outstanding_invoices: 2
    },
    occupancy: [
      { type: 'Standard Rooms',    occupied: 18, total: 24 },
      { type: 'Deluxe Rooms',      occupied: 10, total: 12 },
      { type: 'Suites',            occupied: 4,  total: 6  },
      { type: 'Conference Rooms',  occupied: 2,  total: 4  },
    ],
    activity: [
      { color:'green', text:'Room 204 — Check-in (Mr. Adeyemi)',          time:'9:14 AM' },
      { color:'gold',  text:'Procurement request #PR-041 submitted',       time:'8:52 AM' },
      { color:'blue',  text:'Restaurant — Table 7 order: ₦84,000',        time:'8:30 AM' },
      { color:'red',   text:'Room 109 — Check-out (Ms. Okafor)',           time:'8:05 AM' },
      { color:'blue',  text:'Pool Bar — ₦220,000 recorded by Emeka',      time:'7:48 AM' },
      { color:'green', text:'Room 312 — Check-in (Dr. Bello)',             time:'7:20 AM' },
      { color:'gold',  text:'Staff shift started — Kitchen Team',          time:'7:00 AM' },
    ],
    weekly_revenue: [
      { day:'Mon', rooms:820000,  food:310000,  pool:90000  },
      { day:'Tue', rooms:950000,  food:420000,  pool:130000 },
      { day:'Wed', rooms:780000,  food:380000,  pool:110000 },
      { day:'Thu', rooms:1100000, food:490000,  pool:160000 },
      { day:'Fri', rooms:1350000, food:620000,  pool:210000 },
      { day:'Sat', rooms:1580000, food:780000,  pool:290000 },
      { day:'Sun', rooms:1200000, food:510000,  pool:180000 },
    ]
  },

  bookings: {
    rooms: [
      { id:'R101', type:'Standard', guest:'Aisha Musa',     check_in:'2025-05-20', check_out:'2025-05-23', status:'occupied',   amount:135000, nights:3 },
      { id:'R102', type:'Standard', guest:'Biodun Obi',     check_in:'2025-05-21', check_out:'2025-05-22', status:'occupied',   amount:45000,  nights:1 },
      { id:'R103', type:'Standard', guest:'—',              check_in:'—',          check_out:'—',          status:'available',  amount:0,      nights:0 },
      { id:'R201', type:'Deluxe',   guest:'Chidi Eze',      check_in:'2025-05-19', check_out:'2025-05-24', status:'occupied',   amount:375000, nights:5 },
      { id:'R202', type:'Deluxe',   guest:'Ngozi Adeleke',  check_in:'2025-05-22', check_out:'2025-05-25', status:'occupied',   amount:225000, nights:3 },
      { id:'R203', type:'Deluxe',   guest:'—',              check_in:'—',          check_out:'—',          status:'available',  amount:0,      nights:0 },
      { id:'R301', type:'Suite',    guest:'Emeka Okafor',   check_in:'2025-05-18', check_out:'2025-05-26', status:'occupied',   amount:960000, nights:8 },
      { id:'R302', type:'Suite',    guest:'Fatima Bello',   check_in:'2025-05-22', check_out:'2025-05-24', status:'occupied',   amount:240000, nights:2 },
      { id:'R303', type:'Suite',    guest:'—',              check_in:'—',          check_out:'—',          status:'maintenance',amount:0,      nights:0 },
      { id:'C001', type:'Conference',guest:'TechCorp Ltd',  check_in:'2025-05-22', check_out:'2025-05-22', status:'occupied',   amount:180000, nights:1 },
      { id:'C002', type:'Conference',guest:'—',             check_in:'—',          check_out:'—',          status:'available',  amount:0,      nights:0 },
    ]
  },

  restaurant: {
    tables: [
      { id:1, seats:2, status:'available' },
      { id:2, seats:4, status:'occupied',  waiter:'Tunde',  order_total:67500  },
      { id:3, seats:4, status:'available' },
      { id:4, seats:6, status:'occupied',  waiter:'Sade',   order_total:124000 },
      { id:5, seats:2, status:'reserved',  guest:'Mr. Dike' },
      { id:6, seats:8, status:'occupied',  waiter:'Ayo',    order_total:210000 },
      { id:7, seats:4, status:'available' },
      { id:8, seats:6, status:'reserved',  guest:'Bello Family' },
    ],
    menu: [
      { id:'M01', name:'Jollof Rice & Chicken',  price:8500,  category:'Main' },
      { id:'M02', name:'Peppered Snail',          price:14000, category:'Starter' },
      { id:'M03', name:'Grilled Tilapia',         price:18500, category:'Main' },
      { id:'M04', name:'Suya Platter',            price:12000, category:'Starter' },
      { id:'M05', name:'Egusi Soup & Eba',        price:7500,  category:'Main' },
      { id:'M06', name:'Chapman',                 price:3500,  category:'Drink' },
      { id:'M07', name:'Fresh Juice',             price:2500,  category:'Drink' },
      { id:'M08', name:'Red Velvet Cake',         price:5500,  category:'Dessert' },
    ],
    today_sales: 1200000,
    orders_count: 34,
    avg_order: 35294
  },

  pool_bar: {
    menu: [
      { id:'PB01', name:'Tropical Punch',    price:4500,  category:'Mocktail' },
      { id:'PB02', name:'Frozen Margarita',  price:7500,  category:'Cocktail' },
      { id:'PB03', name:'Heineken',          price:3500,  category:'Beer' },
      { id:'PB04', name:'Grilled Corn',      price:2500,  category:'Snack' },
      { id:'PB05', name:'Coconut Water',     price:2000,  category:'Drink' },
      { id:'PB06', name:'Club Sandwich',     price:6500,  category:'Snack' },
      { id:'PB07', name:'Nkemdirim Special', price:8000,  category:'Cocktail' },
    ],
    transactions: [
      { time:'9:05 AM', items:'Frozen Margarita x2, Grilled Corn', amount:18500, cashier:'Emeka' },
      { time:'8:50 AM', items:'Heineken x4, Club Sandwich',        amount:40000, cashier:'Emeka' },
      { time:'8:30 AM', items:'Tropical Punch x3',                 amount:13500, cashier:'Emeka' },
      { time:'8:10 AM', items:'Nkemdirim Special x2',              amount:16000, cashier:'Emeka' },
      { time:'7:55 AM', items:'Coconut Water x5',                  amount:10000, cashier:'Emeka' },
    ],
    today_sales: 500000
  },

  staff: [
    { id:'S001', name:'Tunde Adebayo',  role:'Waiter',         dept:'Restaurant', shift:'Morning', status:'on_duty',  salary:85000  },
    { id:'S002', name:'Sade Okonkwo',   role:'Waitress',       dept:'Restaurant', shift:'Morning', status:'on_duty',  salary:85000  },
    { id:'S003', name:'Emeka Chukwu',   role:'Barman',         dept:'Pool Bar',   shift:'Morning', status:'on_duty',  salary:90000  },
    { id:'S004', name:'Ayo Babatunde',  role:'Waiter',         dept:'Restaurant', shift:'Evening', status:'off_duty', salary:85000  },
    { id:'S005', name:'Ngozi Obi',      role:'Receptionist',   dept:'Front Desk', shift:'Morning', status:'on_duty',  salary:95000  },
    { id:'S006', name:'Chika Eze',      role:'Receptionist',   dept:'Front Desk', shift:'Evening', status:'off_duty', salary:95000  },
    { id:'S007', name:'Bello Musa',     role:'Chef',           dept:'Kitchen',    shift:'Morning', status:'on_duty',  salary:150000 },
    { id:'S008', name:'Fatima Aliyu',   role:'Sous Chef',      dept:'Kitchen',    shift:'Morning', status:'on_duty',  salary:120000 },
    { id:'S009', name:'James Okafor',   role:'Security',       dept:'Security',   shift:'Night',   status:'on_duty',  salary:75000  },
    { id:'S010', name:'Ada Nwosu',      role:'Housekeeper',    dept:'Rooms',      shift:'Morning', status:'on_duty',  salary:70000  },
    { id:'S011', name:'Uche Dibia',     role:'Maintenance',    dept:'Facilities', shift:'Morning', status:'on_duty',  salary:80000  },
    { id:'S012', name:'Blessing Ike',   role:'Manager',        dept:'Management', shift:'Morning', status:'on_duty',  salary:250000 },
  ],

  procurement: [
    { id:'PR-039', item:'Laundry Detergent (50kg)',    qty:5,  unit_price:18500, total:92500,   dept:'Housekeeping', status:'approved', date:'2025-05-20' },
    { id:'PR-040', item:'Fresh Produce — Vegetables',  qty:1,  unit_price:75000, total:75000,   dept:'Kitchen',      status:'approved', date:'2025-05-21' },
    { id:'PR-041', item:'Premium Whisky (6 bottles)',  qty:6,  unit_price:45000, total:270000,  dept:'Bar',          status:'pending',  date:'2025-05-22' },
    { id:'PR-042', item:'Pool Chlorine Tablets',       qty:10, unit_price:8500,  total:85000,   dept:'Facilities',   status:'pending',  date:'2025-05-22' },
    { id:'PR-043', item:'Bed Linen Set x20',           qty:20, unit_price:12000, total:240000,  dept:'Housekeeping', status:'pending',  date:'2025-05-22' },
    { id:'PR-038', item:'Coffee Beans (10kg)',         qty:3,  unit_price:22000, total:66000,   dept:'Kitchen',      status:'received', date:'2025-05-19' },
    { id:'PR-037', item:'Cocktail Glassware Set',      qty:2,  unit_price:38500, total:77000,   dept:'Bar',          status:'received', date:'2025-05-18' },
  ],

  accounting: {
    summary: {
      total_revenue:  4850000,
      total_expenses: 1920000,
      net_profit:     2930000,
      accounts_receivable: 385000,
      accounts_payable:    695000
    },
    ledger: [
      { date:'2025-05-22', ref:'INV-2201', description:'Room Booking — R201 (Chidi Eze)',    type:'income',  amount:375000  },
      { date:'2025-05-22', ref:'INV-2202', description:'Restaurant Sales — Lunch Service',   type:'income',  amount:284000  },
      { date:'2025-05-22', ref:'INV-2203', description:'Pool Bar Sales',                     type:'income',  amount:122000  },
      { date:'2025-05-22', ref:'EXP-0441', description:'Staff Salaries — Partial Advance',   type:'expense', amount:480000  },
      { date:'2025-05-22', ref:'EXP-0442', description:'PR-040 — Fresh Produce',             type:'expense', amount:75000   },
      { date:'2025-05-21', ref:'INV-2198', description:'Room Booking — R301 (Emeka Okafor)', type:'income',  amount:960000  },
      { date:'2025-05-21', ref:'INV-2199', description:'Conference Room C001 — TechCorp',    type:'income',  amount:180000  },
      { date:'2025-05-21', ref:'EXP-0440', description:'Electricity & Utilities',            type:'expense', amount:320000  },
      { date:'2025-05-21', ref:'EXP-0439', description:'PR-039 — Laundry Supplies',          type:'expense', amount:92500   },
      { date:'2025-05-20', ref:'INV-2195', description:'Restaurant Sales — Dinner',          type:'income',  amount:510000  },
    ]
  }
};

/* ─────────────────────── API FETCH WRAPPER ─────────────────────── */
async function apiFetch(endpoint, options = {}) {
  if (IS_DEMO) return null; // skip real call in demo mode
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      ...options
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('API call failed, using demo data:', e.message);
    return null;
  }
}

function getToken() {
  return localStorage.getItem('aurum_token') || '';
}

/* ─────────────────────── PUBLIC API FUNCTIONS ─────────────────────── */
const API = {
  getOverview:    async () => (await apiFetch('/overview'))     ?? DEMO.overview,
  getBookings:    async () => (await apiFetch('/bookings'))     ?? DEMO.bookings,
  getRestaurant:  async () => (await apiFetch('/restaurant'))   ?? DEMO.restaurant,
  getPoolBar:     async () => (await apiFetch('/pool-bar'))     ?? DEMO.pool_bar,
  getStaff:       async () => (await apiFetch('/staff'))        ?? DEMO.staff,
  getProcurement: async () => (await apiFetch('/procurement'))  ?? DEMO.procurement,
  getAccounting:  async () => (await apiFetch('/accounting'))   ?? DEMO.accounting,

  createBooking:     async (data) => (await apiFetch('/bookings',    { method:'POST', body:JSON.stringify(data) }))    ?? { success:true, id:'NEW-'+Date.now() },
  updateBooking:     async (id,d) => (await apiFetch(`/bookings/${id}`,{ method:'PUT',  body:JSON.stringify(d) }))     ?? { success:true },
  createOrder:       async (data) => (await apiFetch('/restaurant/orders',{ method:'POST', body:JSON.stringify(data)})) ?? { success:true, id:'ORD-'+Date.now() },
  createProcurement: async (data) => (await apiFetch('/procurement', { method:'POST', body:JSON.stringify(data) }))   ?? { success:true, id:'PR-'+Date.now() },
  approveProcurement:async (id)   => (await apiFetch(`/procurement/${id}/approve`,{ method:'POST' }))                 ?? { success:true },
  addStaff:          async (data) => (await apiFetch('/staff',        { method:'POST', body:JSON.stringify(data) }))   ?? { success:true },
  recordSale:        async (data) => (await apiFetch('/accounting/sales',{ method:'POST', body:JSON.stringify(data)})) ?? { success:true },
};

/* ─────────────────────── UTILS ─────────────────────── */
function formatNaira(n) {
  return '₦' + Number(n).toLocaleString('en-NG');
}

function formatDate(d) {
  if (!d || d === '—') return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

window.API        = API;
window.DEMO       = DEMO;
window.formatNaira = formatNaira;
window.formatDate  = formatDate;