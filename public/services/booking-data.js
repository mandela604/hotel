// services/booking-data.js

/* ═══════════════════════════════════════════════
   CONFIGURATION — change ONLY these two lines
   for production readiness
═══════════════════════════════════════════════ */
const CONFIG = {
  USE_DEMO: true,  // ← flip to false for production
  API_BASE: 'https://api.yourdomain.com',  // ← change to your API
  API_KEY: '',  // ← add if needed
};

/* ═══════════════════════════════════════════════
   DEMO DATA — same as all your pages
═══════════════════════════════════════════════ */
const DEMO_ROOMS = [
  {num:'101',type:'Standard',   rate:35000},{num:'102',type:'Standard',   rate:35000},
  {num:'103',type:'Standard',   rate:35000},{num:'104',type:'Standard',   rate:35000},
  {num:'105',type:'Standard',   rate:35000},{num:'106',type:'Standard',   rate:35000},
  {num:'201',type:'Deluxe',     rate:60000},{num:'202',type:'Deluxe',     rate:60000},
  {num:'203',type:'Deluxe',     rate:60000},{num:'204',type:'Deluxe',     rate:60000},
  {num:'301',type:'Suite',      rate:120000},{num:'302',type:'Suite',     rate:120000},
  {num:'303',type:'Suite',      rate:120000},
  {num:'401',type:'Conference', rate:200000},{num:'402',type:'Conference',rate:200000},
];

const DEMO_BOOKINGS = [
  {room:'101',type:'Standard',  guest:'Mr. Adeyemi, Tunde',    phone:'+234 803 111 2233',email:'adeyemi.t@gmail.com',   idType:'NIN',             idNum:'12345678901', checkin:'2026-03-10',checkout:'2026-03-14',rate:35000, discount:0,  paid:140000,payMethod:'Transfer',              payStatus:'Fully Paid',  recordedBy:'Emeka S.',  adults:1,children:0,status:'checkedin',  notes:''},
  {room:'102',type:'Standard',  guest:'Mrs. Okafor, Ngozi',    phone:'+234 806 222 4455',email:'ngozi.o@yahoo.com',      idType:'Passport',         idNum:'A12345678',   checkin:'2026-03-12',checkout:'2026-03-13',rate:35000, discount:0,  paid:35000, payMethod:'Cash',                   payStatus:'Fully Paid',  recordedBy:'Amaka O.',  adults:2,children:0,status:'checkout',   notes:''},
  {room:'103',type:'Standard',  guest:'Mr. Bello, Ibrahim',    phone:'+234 701 333 6677',email:'',                       idType:'NIN',             idNum:'98765432109', checkin:'2026-03-13',checkout:'2026-03-16',rate:35000, discount:10, paid:50000, payMethod:'POS',                    payStatus:'Deposit Paid',recordedBy:'Emeka S.',  adults:1,children:1,status:'reserved',   notes:'Extra pillow'},
  {room:'104',type:'Standard',  guest:'',phone:'',email:'',idType:'NIN',idNum:'',checkin:'',checkout:'',rate:35000, discount:0,paid:0,payMethod:'Cash',payStatus:'Pending',recordedBy:'',adults:1,children:0,status:'vacant',   notes:''},
  {room:'105',type:'Standard',  guest:'',phone:'',email:'',idType:'NIN',idNum:'',checkin:'',checkout:'',rate:35000, discount:0,paid:0,payMethod:'Cash',payStatus:'Pending',recordedBy:'',adults:1,children:0,status:'maintenance',notes:'Plumbing repair'},
  {room:'106',type:'Standard',  guest:'',phone:'',email:'',idType:'NIN',idNum:'',checkin:'',checkout:'',rate:35000, discount:0,paid:0,payMethod:'Cash',payStatus:'Pending',recordedBy:'',adults:1,children:0,status:'vacant',   notes:''},
  {room:'201',type:'Deluxe',    guest:'Dr. Eze, Chukwuemeka',  phone:'+234 802 444 8899',email:'ceze@hospital.ng',       idType:'Passport',         idNum:'B87654321',   checkin:'2026-03-11',checkout:'2026-03-15',rate:60000, discount:0,  paid:240000,payMethod:'Transfer',              payStatus:'Fully Paid',  recordedBy:'Amaka O.',  adults:2,children:0,status:'checkedin',  notes:''},
  {room:'202',type:'Deluxe',    guest:'Ms. Abubakar, Fatima',  phone:'+234 805 555 0011',email:'fatima.a@gmail.com',     idType:"Driver's Licence", idNum:'ABJ001234',   checkin:'2026-03-13',checkout:'2026-03-17',rate:60000, discount:5,  paid:100000,payMethod:'Split – Cash + Transfer',payStatus:'Deposit Paid',recordedBy:'Emeka S.',  adults:1,children:0,status:'reserved',   notes:'Honeymoon setup'},
  {room:'203',type:'Deluxe',    guest:'Mr. Johnson, Segun',    phone:'+234 708 666 2233',email:'',                       idType:'NIN',             idNum:'55566677788', checkin:'2026-03-09',checkout:'2026-03-13',rate:60000, discount:0,  paid:240000,payMethod:'POS',                    payStatus:'Fully Paid',  recordedBy:'Amaka O.',  adults:2,children:2,status:'checkout',   notes:''},
  {room:'204',type:'Deluxe',    guest:'Prof. Williams, Ada',   phone:'+234 803 777 4455',email:'ada.williams@uni.edu.ng',idType:'NIN',             idNum:'11122233344', checkin:'2026-03-12',checkout:'2026-03-18',rate:60000, discount:15, paid:200000,payMethod:'Transfer',              payStatus:'Deposit Paid',recordedBy:'Emeka S.',  adults:1,children:0,status:'checkedin',  notes:'Vegetarian meals'},
  {room:'301',type:'Suite',     guest:'Chief Dangote, Emeka',  phone:'+234 801 888 6677',email:'emeka.d@corp.ng',        idType:'Passport',         idNum:'C11223344',   checkin:'2026-03-10',checkout:'2026-03-15',rate:120000,discount:0,  paid:600000,payMethod:'Transfer',              payStatus:'Fully Paid',  recordedBy:'Amaka O.',  adults:2,children:0,status:'checkedin',  notes:''},
  {room:'302',type:'Suite',     guest:'',phone:'',email:'',idType:'NIN',idNum:'',checkin:'',checkout:'',rate:120000,discount:0,paid:0,payMethod:'Cash',payStatus:'Pending',recordedBy:'',adults:1,children:0,status:'vacant',   notes:''},
  {room:'303',type:'Suite',     guest:'',phone:'',email:'',idType:'NIN',idNum:'',checkin:'',checkout:'',rate:120000,discount:0,paid:0,payMethod:'Cash',payStatus:'Pending',recordedBy:'',adults:1,children:0,status:'maintenance',notes:'AC repair in progress'},
  {room:'401',type:'Conference',guest:'Zenith Bank Ltd.',       phone:'+234 700 999 8877',email:'events@zenithbank.com',  idType:"Voter's Card",     idNum:'ZB00001',     checkin:'2026-03-13',checkout:'2026-03-13',rate:200000,discount:0,  paid:200000,payMethod:'Transfer',              payStatus:'Fully Paid',  recordedBy:'Emeka S.',  adults:40,children:0,status:'checkedin',  notes:'Projector & PA system'},
  {room:'402',type:'Conference',guest:'',phone:'',email:'',idType:'NIN',idNum:'',checkin:'',checkout:'',rate:200000,discount:0,paid:0,payMethod:'Cash',payStatus:'Pending',recordedBy:'',adults:1,children:0,status:'vacant',   notes:''},
];

const DEMO_SESSION = { name: 'Booking Manager', initials: 'MG', role: 'manager' };

const DEMO_GUESTS = [
  { id:'g01', name:'Mr. Adeyemi, Tunde', phone:'+234 803 111 2233', email:'adeyemi.t@gmail.com', idType:'NIN', idNum:'12345678901', vip:false, notes:'',
    stays:[{room:'101',type:'Standard',checkin:'2026-03-10',checkout:'2026-03-14',total:140000,paid:140000,status:'checkedin'}],
    charges:[{ date:'2026-03-12', source:'Restaurant', desc:'1x Grilled Chicken, 1x Chapman', room:'101', amount:11000, by:'Tunde A.', status:'Pending' }]},
  { id:'g02', name:'Mrs. Okafor, Ngozi', phone:'+234 806 222 4455', email:'ngozi.o@yahoo.com', idType:'Passport', idNum:'A12345678', vip:false, notes:'',
    stays:[{room:'102',type:'Standard',checkin:'2026-03-12',checkout:'2026-03-13',total:35000,paid:35000,status:'checkout'}],
    charges:[] },
  { id:'g03', name:'Mr. Bello, Ibrahim', phone:'+234 701 333 6677', email:'', idType:'NIN', idNum:'98765432109', vip:false, notes:'Extra pillow requested.',
    stays:[{room:'103',type:'Standard',checkin:'2026-03-13',checkout:'2026-03-16',total:94500,paid:50000,status:'reserved'}],
    charges:[] },
  { id:'g04', name:'Dr. Eze, Chukwuemeka', phone:'+234 802 444 8899', email:'ceze@hospital.ng', idType:'Passport', idNum:'B87654321', vip:false, notes:'',
    stays:[{room:'201',type:'Deluxe',checkin:'2026-03-11',checkout:'2026-03-15',total:240000,paid:240000,status:'checkedin'}],
    charges:[
      { date:'2026-03-13', source:'Pool Bar', desc:'2x Hennessy VS, 2x Bottled Water', room:'201', amount:9000, by:'Amaka O.', status:'Pending' },
      { date:'2026-03-14', source:'Restaurant', desc:'1x Pounded Yam & Egusi', room:'201', amount:7000, by:'Tunde A.', status:'Settled' }]},
  { id:'g05', name:'Ms. Abubakar, Fatima', phone:'+234 805 555 0011', email:'fatima.a@gmail.com', idType:"Driver's Licence", idNum:'ABJ001234', vip:false, notes:'Honeymoon setup.',
    stays:[{room:'202',type:'Deluxe',checkin:'2026-03-13',checkout:'2026-03-17',total:228000,paid:100000,status:'reserved'}],
    charges:[{ date:'2026-03-13', source:'Pool Bar', desc:'2x Passion Fruit Daiquiri', room:'202', amount:12000, by:'Emeka S.', status:'Pending' }]},
  { id:'g06', name:'Mr. Johnson, Segun', phone:'+234 708 666 2233', email:'', idType:'NIN', idNum:'55566677788', vip:false, notes:'',
    stays:[{room:'203',type:'Deluxe',checkin:'2026-03-09',checkout:'2026-03-13',total:240000,paid:240000,status:'checkout'}],
    charges:[{ date:'2026-03-10', source:'Bar', desc:'3x Heineken (Bottle)', room:'203', amount:4500, by:'Emeka S.', status:'Settled' }]},
  { id:'g07', name:'Prof. Williams, Ada', phone:'+234 803 777 4455', email:'ada.williams@uni.edu.ng', idType:'NIN', idNum:'11122233344', vip:true, notes:'Vegetarian meals only. Prefers quiet rooms away from lift.',
    stays:[
      {room:'204',type:'Deluxe',checkin:'2026-03-12',checkout:'2026-03-18',total:306000,paid:200000,status:'checkedin'},
      {room:'112',type:'Standard',checkin:'2025-11-02',checkout:'2025-11-05',total:105000,paid:105000,status:'checkout'}],
    charges:[
      { date:'2026-03-13', source:'Restaurant', desc:'2x Jollof Rice & Chicken, 1x Chocolate Fondant', room:'204', amount:14725, by:'Amaka O.', status:'Pending' },
      { date:'2026-03-14', source:'Restaurant', desc:'1x Prawn Cocktail, 1x Espresso', room:'204', amount:8300, by:'Tunde A.', status:'Pending' },
      { date:'2026-03-15', source:'Pool Bar', desc:'2x Freshly Squeezed OJ', room:'204', amount:4000, by:'Emeka S.', status:'Settled' }]},
  { id:'g08', name:'Chief Dangote, Emeka', phone:'+234 801 888 6677', email:'emeka.d@corp.ng', idType:'Passport', idNum:'C11223344', vip:true, notes:'Long-standing VIP — always assign Suite 301. Complimentary fruit basket on arrival.',
    stays:[
      {room:'301',type:'Suite',checkin:'2026-03-10',checkout:'2026-03-15',total:600000,paid:600000,status:'checkedin'},
      {room:'301',type:'Suite',checkin:'2025-12-20',checkout:'2025-12-27',total:840000,paid:840000,status:'checkout'},
      {room:'301',type:'Suite',checkin:'2025-10-14',checkout:'2025-10-16',total:240000,paid:240000,status:'checkout'},
      {room:'302',type:'Suite',checkin:'2025-08-01',checkout:'2025-08-05',total:480000,paid:480000,status:'checkout'},
      {room:'301',type:'Suite',checkin:'2025-05-19',checkout:'2025-05-22',total:360000,paid:360000,status:'checkout'},
      {room:'301',type:'Suite',checkin:'2025-02-10',checkout:'2025-02-13',total:360000,paid:360000,status:'checkout'},
      {room:'301',type:'Suite',checkin:'2024-11-03',checkout:'2024-11-06',total:330000,paid:330000,status:'checkout'}],
    charges:[
      { date:'2026-03-13', source:'Bar', desc:"1x Moët & Chandon, 2x Martell VSOP (Shot)", room:'301', amount:64000, by:'Emeka S.', status:'Pending' },
      { date:'2026-03-14', source:'Pool Bar', desc:'1x Moët & Chandon, 2x Pina Colada', room:'301', amount:60300, by:'Amaka O.', status:'Pending' },
      { date:'2026-03-14', source:'Restaurant', desc:'1x Chef Special (Daily), 1x Asun (Goat Meat)', room:'301', amount:14500, by:'Tunde A.', status:'Pending' },
      { date:'2025-12-22', source:'Bar', desc:'2x Hennessy VS (Shot)', room:'301', amount:8000, by:'Emeka S.', status:'Settled' }]},
];

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

const KEY_ROOMS = 'booking-rooms';
const KEY_BOOKINGS = 'booking-bookings';

/* ═══════════════════════════════════════════════
   PUBLIC API — the ONLY functions pages should call
═══════════════════════════════════════════════ */

/**
 * Fetch all booking data (rooms, bookings, session)
 * 
 * BEHAVIOR:
 * - Demo mode (USE_DEMO = true): Always returns demo data from localStorage
 * - Production mode (USE_DEMO = false): 
 *   - Tries API first
 *   - If API fails → THROWS ERROR (no silent fallback to demo)
 *   - Page must handle the error and show user-friendly message
 */
export async function getBookingData() {
  // Production mode: API only, no fallback to demo
  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/booking-data`, {
        headers: CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response has expected structure
      if (!data.rooms || !data.bookings) {
        throw new Error('API response missing required fields: rooms or bookings');
      }
      
      return {
        rooms: data.rooms,
        bookings: data.bookings,
        session: data.session || DEMO_SESSION,
        guests: data.guests || []
      };
      
    } catch (err) {
      // In production: throw error, don't fallback to demo
      console.error('[BookingData] Production API error:', err.message);
      throw new Error(`Failed to load booking data: ${err.message}. Please refresh or contact support.`);
    }
  }

  // Demo mode: load from localStorage or seed
  const rooms = await loadLocal(KEY_ROOMS, DEMO_ROOMS);
  const bookings = await loadLocal(KEY_BOOKINGS, DEMO_BOOKINGS);
  const guests = await loadLocal('booking-guests', DEMO_GUESTS);
  
  return { rooms, bookings, session: DEMO_SESSION, guests };
}

/**
 * Save booking data (rooms, bookings, guests)
 * 
 * BEHAVIOR:
 * - Demo mode: Saves to localStorage only
 * - Production mode: Saves to API, throws error on failure
 */
export async function saveBookingData(rooms, bookings, guests) {
  // Always save locally for demo/offline
  await saveLocal(KEY_ROOMS, rooms);
  await saveLocal(KEY_BOOKINGS, bookings);
  if (guests) await saveLocal('booking-guests', guests);

  // Production mode: save to API
  if (!CONFIG.USE_DEMO) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/booking-data`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(CONFIG.API_KEY ? { 'Authorization': `Bearer ${CONFIG.API_KEY}` } : {})
        },
        body: JSON.stringify({ rooms, bookings, guests })
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      return { success: true };
      
    } catch (err) {
      console.error('[BookingData] Save failed:', err);
      throw new Error(`Failed to save: ${err.message}`);
    }
  }
  
  return { success: true };
}

/**
 * Get a single guest by ID
 */
export async function getGuestById(id) {
  try {
    const { guests } = await getBookingData();
    return guests.find(g => g.id === id) || null;
  } catch (err) {
    throw new Error(`Failed to fetch guest: ${err.message}`);
  }
}

/**
 * Get guests with optional filtering
 */
export async function getGuests(filter = {}) {
  try {
    const { guests } = await getBookingData();
    let result = [...guests];
    if (filter.vip) result = result.filter(g => g.vip === true);
    if (filter.returning) result = result.filter(g => g.stays.length > 1);
    if (filter.inhouse) result = result.filter(g => g.stays.some(s => s.status === 'checkedin'));
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch guests: ${err.message}`);
  }
}

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
    console.warn('[BookingData] Failed to save', key, e);
  }
}