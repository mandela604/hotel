/**
 * Aurum Hotel — Unified DataStore
 * ─────────────────────────────────────────────────────────────────────
 * Single shared persistence layer for the entire hotel management suite.
 *
 * In DEMO mode (default): reads/writes localStorage so all modules
 * share the same live data — every department sees each other's
 * changes in real time, exactly like a real backend.
 *
 * In LIVE mode: swaps to REST API calls via a simple fetch wrapper.
 * Switch with:  DataStore.setMode('live', { baseUrl, token })
 *
 * ── USAGE ──────────────────────────────────────────────────────────
 *   // On every page, before any module code runs:
 *   <script src="component/data-store.js"></script>
 *   <script>DataStore.init();</script>
 *
 *   // Then anywhere:
 *   const bookings = await DataStore.get('bookings');
 *   const rooms = bookings.rooms;
 *   await DataStore.set('bookings', { ...bookings, rooms: updated });
 *
 *   // Or use the convenience wrappers:
 *   await DataStore.addSale('restaurant', sale);
 *   await DataStore.addActivity('Booking', 'Room 402 checked in');
 *
 * ── DATA SEEDING ───────────────────────────────────────────────────
 * On first init (or version bump), the DataStore seeds itself with
 * comprehensive demo data across ALL departments — the same data
 * previously scattered across api.js DEMO, procurement-api.js,
 * grace-request-form.js, grace-store-approval.js, etc.
 * This guarantees the front end always has something to render
 * even if the user has never interacted with the system before.
 * ─────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  if (window.DataStore) return;

  const STORAGE_VERSION = 'aurum-ds-v1';
  const VERSION_KEY = 'aurum-datastore-version';

  /* ── Mode flags ── */
  let _mode = 'demo'; // 'demo' | 'live'
  let _config = { baseUrl: '', token: '', apiKey: '' };

  /* ── In-memory cache ── */
  const _cache = {};

  /* ── Activity log (stored under a special key) ── */
  const ACTIVITY_KEY = 'ds_activity';

  /* ═══════════════════════════════════════════════════════════════════
     API adapter — swap this when you go live
     ═══════════════════════════════════════════════════════════════════ */
  async function _apiGet(key) {
    if (_mode === 'demo') return null;
    try {
      const res = await fetch(`${_config.baseUrl}/data/${key}`, {
        headers: { Authorization: `Bearer ${_config.token}` }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[DataStore] API GET failed for', key, e);
      return null;
    }
  }

  async function _apiSet(key, value) {
    if (_mode !== 'live') return { key, stored: false };
    try {
      await fetch(`${_config.baseUrl}/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_config.token}` },
        body: JSON.stringify(value)
      });
      return { key, stored: true };
    } catch (e) {
      console.warn('[DataStore] API SET failed for', key, e);
      return { key, stored: false };
    }
  }

  async function _apiDelete(key) {
    if (_mode !== 'live') return { key, deleted: false };
    try {
      await fetch(`${_config.baseUrl}/data/${key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${_config.token}` }
      });
      return { key, deleted: true };
    } catch (e) {
      return { key, deleted: false };
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     Core Storage API
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Get a value by key. Reads from cache first, then localStorage, then API.
   * Returns null if not found.
   */
  async function get(key) {
    // Check cache
    if (_cache[key] !== undefined) return _cache[key];

    // Check localStorage
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const val = JSON.parse(raw);
        _cache[key] = val;
        return val;
      }
    } catch (e) { /* ignore */ }

    // Fall back to API (demo mode returns null here)
    const apiVal = await _apiGet(key);
    if (apiVal) {
      _cache[key] = apiVal;
      return apiVal;
    }

    return null;
  }

  /**
   * Set a value by key. Writes to cache, localStorage, and optionally API.
   */
  async function set(key, value) {
    _cache[key] = value;

    // Always write to localStorage (even in live mode, as fallback)
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[DataStore] localStorage write failed for', key, e);
    }

    // Optionally write to API in live mode
    if (_mode === 'live') {
      await _apiSet(key, value);
    }

    return { key, stored: true };
  }

  /**
   * Delete a key.
   */
  async function del(key) {
    delete _cache[key];
    try {
      localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
    if (_mode === 'live') await _apiDelete(key);
    return { key, deleted: true };
  }

  /**
   * List all keys with a given prefix.
   */
  async function list(prefix) {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!prefix || (k && k.startsWith(prefix))) {
          keys.push(k);
        }
      }
    } catch (e) { /* ignore */ }
    return keys;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Demo Data — comprehensive seed for every module
     ═══════════════════════════════════════════════════════════════════ */

  function _today() { return new Date().toISOString().split('T')[0]; }
  function _daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
  function _daysAhead(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; }
  function _fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }

  function _buildSeedData() {
    return {
      /* ── Overview / Dashboard ── */
      'ds_kpi': {
        bookings_today: 12,
        restaurant_sales: 1200000,
        pool_bar_sales: 500000,
        pending_procurement: 3,
        occupancy_rate: 76,
        staff_on_duty: 18,
        total_revenue_today: 4850000,
        outstanding_invoices: 2
      },
      'ds_occupancy': [
        { type: 'Standard Rooms', occupied: 18, total: 24 },
        { type: 'Deluxe Rooms', occupied: 10, total: 12 },
        { type: 'Suites', occupied: 4, total: 6 },
        { type: 'Conference Rooms', occupied: 2, total: 4 },
      ],

      /* ── Bookings ── */
      'ds_bookings_rooms': [
        { id:'R101', type:'Standard', guest:'Aisha Musa', check_in:_daysAgo(3), check_out:_daysAhead(1), status:'occupied', amount:135000, nights:3 },
        { id:'R102', type:'Standard', guest:'Biodun Obi', check_in:_daysAgo(1), check_out:_today(), status:'occupied', amount:45000, nights:1 },
        { id:'R103', type:'Standard', guest:'—', check_in:'—', check_out:'—', status:'available', amount:0, nights:0 },
        { id:'R201', type:'Deluxe', guest:'Chidi Eze', check_in:_daysAgo(5), check_out:_daysAhead(2), status:'occupied', amount:375000, nights:5 },
        { id:'R202', type:'Deluxe', guest:'Ngozi Adeleke', check_in:_daysAgo(2), check_out:_daysAhead(1), status:'occupied', amount:225000, nights:3 },
        { id:'R203', type:'Deluxe', guest:'—', check_in:'—', check_out:'—', status:'available', amount:0, nights:0 },
        { id:'R301', type:'Suite', guest:'Emeka Okafor', check_in:_daysAgo(6), check_out:_daysAhead(2), status:'occupied', amount:960000, nights:8 },
        { id:'R302', type:'Suite', guest:'Fatima Bello', check_in:_daysAgo(2), check_out:_today(), status:'occupied', amount:240000, nights:2 },
        { id:'R303', type:'Suite', guest:'—', check_in:'—', check_out:'—', status:'maintenance', amount:0, nights:0 },
        { id:'C001', type:'Conference', guest:'TechCorp Ltd', check_in:_today(), check_out:_today(), status:'occupied', amount:180000, nights:1 },
        { id:'C002', type:'Conference', guest:'—', check_in:'—', check_out:'—', status:'available', amount:0, nights:0 },
      ],

      /* ── Restaurant ── */
      'ds_restaurant_menu': [
        { id:'M01', name:'Jollof Rice & Chicken', price:8500, category:'Main' },
        { id:'M02', name:'Peppered Snail', price:14000, category:'Starter' },
        { id:'M03', name:'Grilled Tilapia', price:18500, category:'Main' },
        { id:'M04', name:'Suya Platter', price:12000, category:'Starter' },
        { id:'M05', name:'Egusi Soup & Eba', price:7500, category:'Main' },
        { id:'M06', name:'Chapman', price:3500, category:'Drink' },
        { id:'M07', name:'Fresh Juice', price:2500, category:'Drink' },
        { id:'M08', name:'Red Velvet Cake', price:5500, category:'Dessert' },
        { id:'M09', name:'Fried Rice & Chicken', price:9000, category:'Main' },
        { id:'M10', name:'Pepper Soup', price:6500, category:'Starter' },
      ],
      'ds_restaurant_tables': [
        { id:1, seats:2, status:'available' },
        { id:2, seats:4, status:'occupied', waiter:'Tunde', order_total:67500 },
        { id:3, seats:4, status:'available' },
        { id:4, seats:6, status:'occupied', waiter:'Sade', order_total:124000 },
        { id:5, seats:2, status:'reserved', guest:'Mr. Dike' },
        { id:6, seats:8, status:'occupied', waiter:'Ayo', order_total:210000 },
        { id:7, seats:4, status:'available' },
        { id:8, seats:6, status:'reserved', guest:'Bello Family' },
      ],
      'ds_restaurant_sales': [
        { id:'SALE-1041', items:[{name:'Jollof Rice & Chicken',qty:2,price:8500},{name:'Chapman',qty:2,price:3500}], subtotal:24000, discount:0, total:24000, method:'Cash', staff:'Tunde', table:'Table 2', date:_daysAgo(1)+' 12:30', status:'completed' },
        { id:'SALE-1042', items:[{name:'Grilled Tilapia',qty:1,price:18500},{name:'Fresh Juice',qty:1,price:2500}], subtotal:21000, discount:0, total:21000, method:'Card', staff:'Sade', table:'Table 4', date:_daysAgo(1)+' 13:15', status:'completed' },
        { id:'SALE-1043', items:[{name:'Suya Platter',qty:1,price:12000}], subtotal:12000, discount:0, total:12000, method:'Cash', staff:'Tunde', table:'Table 2', date:_today()+' 09:30', status:'completed' },
        { id:'SALE-1044', items:[{name:'Egusi Soup & Eba',qty:2,price:7500},{name:'Red Velvet Cake',qty:1,price:5500}], subtotal:20500, discount:0, total:20500, method:'Room Charge', staff:'Ayo', table:'Table 6', date:_today()+' 10:00', status:'completed' },
        { id:'SALE-1040', items:[{name:'Jollof Rice & Chicken',qty:1,price:8500},{name:'Chapman',qty:1,price:3500}], subtotal:12000, discount:0, total:12000, method:'Cash', staff:'Tunde', table:'Table 2', date:_daysAgo(2)+' 11:00', status:'voided', voidReason:'Wrong order — customer requested Grilled Tilapia instead', voidedBy:'Amaka O.', voidedByRole:'Manager', voidDate:_daysAgo(2)+' 11:30' },
      ],

      /* ── Pool Bar ── */
      'ds_poolbar_menu': [
        { id:'PB01', name:'Tropical Punch', price:4500, category:'Mocktail' },
        { id:'PB02', name:'Frozen Margarita', price:7500, category:'Cocktail' },
        { id:'PB03', name:'Heineken', price:3500, category:'Beer' },
        { id:'PB04', name:'Grilled Corn', price:2500, category:'Snack' },
        { id:'PB05', name:'Coconut Water', price:2000, category:'Drink' },
        { id:'PB06', name:'Club Sandwich', price:6500, category:'Snack' },
        { id:'PB07', name:'Nkemdirim Special', price:8000, category:'Cocktail' },
      ],
      'ds_poolbar_transactions': [
        { time:'9:05 AM', items:'Frozen Margarita x2, Grilled Corn', amount:18500, cashier:'Emeka' },
        { time:'8:50 AM', items:'Heineken x4, Club Sandwich', amount:40000, cashier:'Emeka' },
        { time:'8:30 AM', items:'Tropical Punch x3', amount:13500, cashier:'Emeka' },
        { time:'8:10 AM', items:'Nkemdirim Special x2', amount:16000, cashier:'Emeka' },
        { time:'7:55 AM', items:'Coconut Water x5', amount:10000, cashier:'Emeka' },
      ],
      'ds_poolbar_sales': [
        { id:'PBS-1021', items:[{name:'Heineken',qty:3,price:3500}], subtotal:10500, discount:0, total:10500, method:'Cash', staff:'Emeka', date:_today()+' 09:05', status:'completed' },
        { id:'PBS-1022', items:[{name:'Frozen Margarita',qty:2,price:7500},{name:'Grilled Corn',qty:1,price:2500}], subtotal:17500, discount:0, total:17500, method:'Room Charge', staff:'Emeka', date:_today()+' 10:30', status:'completed' },
      ],

      /* ── Kitchen ── */
      'ds_kitchen_production': [
        { id:'PROD-00096', items:'30 plates Fried Rice', qty:30, unit:'plates', dept:'Restaurant', chef:'Bello Musa', date:_daysAgo(1), status:'completed', time:'08:30' },
        { id:'PROD-00097', items:'15 plates Jollof Rice', qty:15, unit:'plates', dept:'Restaurant', chef:'Fatima Aliyu', date:_today(), status:'in_progress', time:'07:45' },
        { id:'PROD-00098', items:'50 pcs Chicken (Grilled)', qty:50, unit:'pieces', dept:'Restaurant', chef:'Bello Musa', date:_today(), status:'planned', time:'11:00' },
      ],
      'ds_kitchen_inventory': [
        { name:'Rice (Long Grain)', unit:'kg', qty:45, reorder:20 },
        { name:'Palm Oil', unit:'Ltr', qty:8, reorder:10 },
        { name:'Chicken (Frozen)', unit:'kg', qty:25, reorder:15 },
        { name:'Tomatoes', unit:'kg', qty:12, reorder:10 },
        { name:'Onions', unit:'kg', qty:18, reorder:10 },
        { name:'Vegetable Oil', unit:'Ltr', qty:6, reorder:5 },
        { name:'Salt', unit:'kg', qty:4, reorder:3 },
        { name:'Sugar', unit:'kg', qty:3, reorder:5 },
        { name:'Flour', unit:'kg', qty:8, reorder:10 },
        { name:'Eggs', unit:'crates', qty:2, reorder:3 },
      ],
      'ds_kitchen_transfers': [
        { id:'TRF-001', from:'Main Kitchen', to:'Restaurant', items:'Rice (Long Grain) 10kg, Chicken 5kg', date:_daysAgo(1), by:'Bello Musa', status:'completed' },
        { id:'TRF-002', from:'Main Kitchen', to:'Pool Bar', items:'Vegetable Oil 2L, Salt 1kg', date:_today(), by:'Fatima Aliyu', status:'pending' },
      ],

      /* ── Gym ── */
      'ds_gym_members': [
        { id:'GM001', name:'Adebayo Ogunlesi', plan:'Annual', start:_daysAgo(60), end:_daysAhead(305), status:'active', visits:34 },
        { id:'GM002', name:'Chioma Nwosu', plan:'Monthly', start:_daysAgo(15), end:_daysAhead(15), status:'active', visits:8 },
        { id:'GM003', name:'Femi Adeyemi', plan:'Quarterly', start:_daysAgo(45), end:_daysAhead(45), status:'active', visits:22 },
        { id:'GM004', name:'Zainab Abdullah', plan:'Monthly', start:_daysAgo(5), end:_daysAhead(25), status:'active', visits:3 },
        { id:'GM005', name:'Oluwatobi Balogun', plan:'Annual', start:_daysAgo(120), end:_daysAhead(245), status:'expired', visits:12 },
      ],
      'ds_gym_plans': [
        { name:'Monthly', price:15000, duration:'30 days' },
        { name:'Quarterly', price:35000, duration:'90 days' },
        { name:'Annual', price:100000, duration:'365 days' },
      ],
      'ds_gym_checkins': [
        { member:'Adebayo Ogunlesi', date:_today(), time:'06:30 AM' },
        { member:'Chioma Nwosu', date:_today(), time:'07:15 AM' },
        { member:'Femi Adeyemi', date:_today(), time:'08:00 AM' },
      ],

      /* ── Staff ── */
      'ds_staff': [
        { id:'S001', name:'Tunde Adebayo', role:'Waiter', dept:'Restaurant', shift:'Morning', status:'on_duty', salary:85000 },
        { id:'S002', name:'Sade Okonkwo', role:'Waitress', dept:'Restaurant', shift:'Morning', status:'on_duty', salary:85000 },
        { id:'S003', name:'Emeka Chukwu', role:'Barman', dept:'Pool Bar', shift:'Morning', status:'on_duty', salary:90000 },
        { id:'S004', name:'Ayo Babatunde', role:'Waiter', dept:'Restaurant', shift:'Evening', status:'off_duty', salary:85000 },
        { id:'S005', name:'Ngozi Obi', role:'Receptionist', dept:'Front Desk', shift:'Morning', status:'on_duty', salary:95000 },
        { id:'S006', name:'Chika Eze', role:'Receptionist', dept:'Front Desk', shift:'Evening', status:'off_duty', salary:95000 },
        { id:'S007', name:'Bello Musa', role:'Chef', dept:'Kitchen', shift:'Morning', status:'on_duty', salary:150000 },
        { id:'S008', name:'Fatima Aliyu', role:'Sous Chef', dept:'Kitchen', shift:'Morning', status:'on_duty', salary:120000 },
        { id:'S009', name:'James Okafor', role:'Security', dept:'Security', shift:'Night', status:'on_duty', salary:75000 },
        { id:'S010', name:'Ada Nwosu', role:'Housekeeper', dept:'Rooms', shift:'Morning', status:'on_duty', salary:70000 },
        { id:'S011', name:'Uche Dibia', role:'Maintenance', dept:'Facilities', shift:'Morning', status:'on_duty', salary:80000 },
        { id:'S012', name:'Blessing Ike', role:'Manager', dept:'Management', shift:'Morning', status:'on_duty', salary:250000 },
        { id:'S013', name:'Kabiru Aliyu', role:'Store Keeper', dept:'Store', shift:'Morning', status:'on_duty', salary:95000 },
        { id:'S014', name:'Ngozi Eze', role:'Bartender', dept:'Restaurant', shift:'Evening', status:'off_duty', salary:85000 },
        { id:'S015', name:'Chinedu Obi', role:'Chef', dept:'Kitchen', shift:'Evening', status:'off_duty', salary:120000 },
      ],

      /* ── Procurement (compatible with procurement-api.js format) ── */
      'ds_procurement_prs': [
        { id:'pr01', prNo:'PR-041', item:'Toiletries (100 units)', cat:'Toiletries & Amenities', dept:'Housekeeping', by:'Kabiru Aliyu', date:_daysAgo(1), needed:_daysAhead(4), qty:100, unit:'Units', unitCost:480, priority:'Normal', totalAmount:48000, status:'pending', approvalStage:'pending', supplier:'', poNo:'', notes:'Guest bathroom amenities running low.', history:[{date:_daysAgo(1), action:'Request submitted', by:'Kabiru Aliyu', stage:'pending'}] },
        { id:'pr02', prNo:'PR-039', item:'Wine Restocking (Assorted)', cat:'Food & Beverage', dept:'Restaurant / Bar', by:'Ngozi Eze', date:_daysAgo(3), needed:_daysAhead(2), qty:24, unit:'Bottles', unitCost:5000, priority:'Urgent', totalAmount:120000, status:'accountant', approvalStage:'accountant', supplier:'', poNo:'', notes:'Weekend event requires premium wine.', history:[{date:_daysAgo(3), action:'Request submitted', by:'Ngozi Eze', stage:'pending'},{date:_daysAgo(2), action:'Accountant review', by:'Accountant', stage:'accountant'}] },
        { id:'pr03', prNo:'PR-038', item:'Cleaning Supplies (Bulk)', cat:'Cleaning Supplies', dept:'Housekeeping', by:'Kabiru Aliyu', date:_daysAgo(5), needed:_daysAgo(1), qty:1, unit:'Lot', unitCost:22000, priority:'Normal', totalAmount:22000, status:'gm', approvalStage:'gm', supplier:'', poNo:'', notes:'', history:[{date:_daysAgo(5), action:'Request submitted', by:'Kabiru Aliyu', stage:'pending'},{date:_daysAgo(4), action:'Accountant approved', by:'Accountant', stage:'accountant'}] },
        { id:'pr04', prNo:'PR-037', item:'Guest Room Linen Set', cat:'Linen & Uniforms', dept:'Housekeeping', by:'Kabiru Aliyu', date:_daysAgo(9), needed:_daysAgo(3), qty:40, unit:'Sets', unitCost:24000, priority:'Normal', totalAmount:960000, status:'approved', approvalStage:'approved', supplier:'Prestige Linen & Textiles', poNo:'PO-1014', notes:'', history:[{date:_daysAgo(9), action:'Request submitted', by:'Kabiru Aliyu', stage:'pending'},{date:_daysAgo(8), action:'Accountant approved', by:'Accountant', stage:'accountant'},{date:_daysAgo(6), action:'GM approved', by:'General Manager', stage:'gm'},{date:_daysAgo(3), action:'MD approved', by:'Managing Director', stage:'md'}] },
        { id:'pr05', prNo:'PR-036', item:'POS Terminal Replacement', cat:'IT & Electronics', dept:'Front Desk', by:'Adewale Okafor', date:_daysAgo(12), needed:_daysAgo(5), qty:1, unit:'Unit', unitCost:95000, priority:'Urgent', totalAmount:95000, status:'rejected', approvalStage:'rejected', supplier:'', poNo:'', notes:'Current terminal freezing intermittently.', history:[{date:_daysAgo(12), action:'Request submitted', by:'Adewale Okafor', stage:'pending'},{date:_daysAgo(10), action:'Rejected', by:'General Manager', stage:'rejected'}] },
        { id:'pr06', prNo:'PR-035', item:'Kitchen Gas Cylinders (Refill)', cat:'Maintenance & Equipment', dept:'Kitchen', by:'Chinedu Obi', date:_daysAgo(2), needed:_daysAhead(1), qty:6, unit:'Cylinders', unitCost:18000, priority:'Urgent', totalAmount:108000, status:'pending', approvalStage:'pending', supplier:'', poNo:'', notes:'Running low, needed before the weekend banquet.', history:[{date:_daysAgo(2), action:'Request submitted', by:'Chinedu Obi', stage:'pending'}] },
        { id:'pr07', prNo:'PR-034', item:'Pool Chemicals (Chlorine, pH)', cat:'Maintenance & Equipment', dept:'Pool Bar', by:'Bola Nwosu', date:_daysAgo(15), needed:_daysAgo(10), qty:1, unit:'Lot', unitCost:35000, priority:'Normal', totalAmount:35000, status:'fulfilled', approvalStage:'fulfilled', supplier:'SparkleClean Supplies', poNo:'PO-1009', notes:'', history:[{date:_daysAgo(15), action:'Request submitted', by:'Bola Nwosu', stage:'pending'},{date:_daysAgo(13), action:'Accountant approved', by:'Accountant', stage:'accountant'},{date:_daysAgo(10), action:'GM approved', by:'General Manager', stage:'gm'},{date:_daysAgo(10), action:'Fulfilled', by:'Procurement Officer', stage:'fulfilled'}] },
        { id:'pr08', prNo:'PR-033', item:'Office Stationery Restock', cat:'Office Supplies', dept:'Accounting', by:'Amaka Chukwu', date:_daysAgo(6), needed:_daysAgo(2), qty:1, unit:'Lot', unitCost:15000, priority:'Normal', totalAmount:15000, status:'accountant', approvalStage:'accountant', supplier:'', poNo:'', notes:'', history:[{date:_daysAgo(6), action:'Request submitted', by:'Amaka Chukwu', stage:'pending'},{date:_daysAgo(4), action:'Accountant review', by:'Accountant', stage:'accountant'}] },
      ],
      'ds_procurement_suppliers': [
        { id:'sp01', name:'Lagos Fresh Produce Ltd', cat:'Food & Beverage', contact:'Chidi Umeh', phone:'+234 803 555 1010', email:'sales@lagosfresh.ng', rating:5 },
        { id:'sp02', name:'PureLine Toiletries Co.', cat:'Toiletries & Amenities', contact:'Ada Nwankwo', phone:'+234 806 444 2020', email:'orders@pureline.ng', rating:4 },
        { id:'sp03', name:'SparkleClean Supplies', cat:'Cleaning Supplies', contact:'Tunde Bakare', phone:'+234 701 222 3030', email:'info@sparkleclean.ng', rating:4 },
        { id:'sp04', name:'Prestige Linen & Textiles', cat:'Linen & Uniforms', contact:'Funke Adeyinka', phone:'+234 802 666 4040', email:'sales@prestigelinen.ng', rating:5 },
        { id:'sp05', name:'TechPoint Electronics', cat:'IT & Electronics', contact:'Emeka Obasi', phone:'+234 809 333 5050', email:'b2b@techpoint.ng', rating:3 },
      ],

      /* ── Accounting ── */
      'ds_accounting_summary': {
        total_revenue: 4850000,
        total_expenses: 1920000,
        net_profit: 2930000,
        accounts_receivable: 385000,
        accounts_payable: 695000
      },
      'ds_accounting_ledger': [
        { date:_daysAgo(1), ref:'INV-2201', description:'Room Booking — R201 (Chidi Eze)', type:'income', amount:375000 },
        { date:_daysAgo(1), ref:'INV-2202', description:'Restaurant Sales — Lunch Service', type:'income', amount:284000 },
        { date:_daysAgo(1), ref:'INV-2203', description:'Pool Bar Sales', type:'income', amount:122000 },
        { date:_daysAgo(1), ref:'EXP-0441', description:'Staff Salaries — Partial Advance', type:'expense', amount:480000 },
        { date:_daysAgo(1), ref:'EXP-0442', description:'PR-040 — Fresh Produce', type:'expense', amount:75000 },
        { date:_daysAgo(2), ref:'INV-2198', description:'Room Booking — R301 (Emeka Okafor)', type:'income', amount:960000 },
        { date:_daysAgo(2), ref:'INV-2199', description:'Conference Room C001 — TechCorp', type:'income', amount:180000 },
        { date:_daysAgo(2), ref:'EXP-0440', description:'Electricity & Utilities', type:'expense', amount:320000 },
        { date:_daysAgo(2), ref:'EXP-0439', description:'PR-039 — Laundry Supplies', type:'expense', amount:92500 },
        { date:_daysAgo(3), ref:'INV-2195', description:'Restaurant Sales — Dinner', type:'income', amount:510000 },
      ],
      'ds_accounting_room_tx': [
        { amount:145000 }, { amount:98000 }, { amount:76000 }, { amount:132000 }, { amount:64000 }, { amount:120000 }, { amount:210000 },
      ],

      /* ── Activity Feed (shared across all modules) ── */
      [ACTIVITY_KEY]: [
        { dept:'Booking', color:'gold', text:'Room 402 checked in — Barr. Musa (3 nights)', time:'8 min ago', href:'booking/booking-dashboard.html' },
        { dept:'Kitchen', color:'purple', text:'PROD-00096 — 30 plates Fried Rice sent to Restaurant', time:'22 min ago', href:'kitchen/kitchen-dashboard.html' },
        { dept:'Procurement', color:'cyan', text:'PR-041 moved to pending — Toiletries restock', time:'40 min ago', href:'procurement/procurement-dashboard.html' },
        { dept:'Restaurant', color:'blue', text:'SALE-1043 — ₦12,000 settled by Cash, Table 2', time:'1 hr ago', href:'restaurant/restaurant-dashboard.html' },
        { dept:'Pool Bar', color:'green', text:'PBS-1021 — 3x Heineken sold, ₦10,500', time:'1 hr ago', href:'poolbar/poolbar-dashboard.html' },
        { dept:'Guests', color:'gold', text:'Chief Dangote (VIP) charged ₦64,000 to Room 301 — Bar', time:'2 hr ago', href:'booking/guests.html' },
        { dept:'Accounting', color:'amber', text:'Shift reconciled — Tunde Adeyemi', time:'3 hr ago', href:'accounting/accounting-dashboard.html' },
        { dept:'Staff', color:'blue', text:'Ngozi Eze clocked in for Front Office shift', time:'4 hr ago', href:'staff.html' },
        { dept:'Gym', color:'purple', text:'Adebayo Ogunlesi checked in for morning workout', time:'5 hr ago', href:'gym/gym-dashboard.html' },
        { dept:'Store', color:'amber', text:'KREQ-2025-00045 — Kitchen requisition awaiting approval', time:'6 hr ago', href:'store/store-dashboard.html' },
      ],

      /* ── Configuration ── */
      'ds_config': {
        hotel_name: 'Aurum Hotel',
        currency: '₦',
        currency_code: 'NGN',
        locale: 'en-NG',
        date_format: 'dd MMM yyyy',
        time_format: 'HH:mm',
        md_approval_threshold: 100000,
      },

      /* ── Store catalog (shared with grace-request-form.js) ── */
      'ds_store_catalog': [
        { name:'Rice (Long Grain)', unit:'kg', stock:35, reorder:20 },
        { name:'Palm Oil', unit:'Ltr', stock:8, reorder:10 },
        { name:'Chicken (Frozen)', unit:'kg', stock:20, reorder:15 },
        { name:'Tomatoes', unit:'kg', stock:15, reorder:10 },
        { name:'Onions', unit:'kg', stock:20, reorder:10 },
        { name:'Star Lager', unit:'Bottles', stock:240, reorder:48 },
        { name:'Heineken', unit:'Bottles', stock:180, reorder:36 },
        { name:'Hennessy VS', unit:'Bottles', stock:6, reorder:12 },
        { name:'Bottled Water 1.5L', unit:'Cartons', stock:60, reorder:24 },
        { name:'Ice Cream Tubs', unit:'Pieces', stock:12, reorder:24 },
        { name:'Bleach 5L', unit:'Ltr', stock:18, reorder:6 },
        { name:'Floor Cleaner 5L', unit:'Ltr', stock:9, reorder:6 },
        { name:'Industrial Detergent 10kg', unit:'Bags', stock:5, reorder:3 },
        { name:'Glass Cleaner 1L', unit:'Ltr', stock:14, reorder:6 },
        { name:'King Duvet Set', unit:'Pieces', stock:22, reorder:10 },
        { name:'Pillow Cases (pair)', unit:'Pieces', stock:40, reorder:20 },
        { name:'Guest Shampoo 250ml', unit:'Pieces', stock:300, reorder:100 },
        { name:'Commercial Dishwasher', unit:'Pieces', stock:1, reorder:1 },
        { name:'POS Terminal', unit:'Pieces', stock:2, reorder:1 },
        { name:'Branded Envelopes', unit:'Packs', stock:8, reorder:5 },
      ],
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     Init — seed data on first run or version bump
     ═══════════════════════════════════════════════════════════════════ */
  async function init(forceReseed) {
    // Demo seeding disabled — pages render real data (or empty defaults).
    if (forceReseed) {
      console.log('[DataStore] Seeding demo data (version:', STORAGE_VERSION, ')');
      const seed = _buildSeedData();
      for (const [key, value] of Object.entries(seed)) {
        await set(key, value);
      }
      try { localStorage.setItem(VERSION_KEY, STORAGE_VERSION); } catch (e) {}
    }

    // One-time wipe of legacy demo keys left by the old seeder, so any
    // previously-seeded demo numbers disappear immediately.
    try {
      const cleanupKey = 'ds_demo_cleaned_v2';
      if (localStorage.getItem(cleanupKey) !== '1') {
        const demoKeys = Object.keys(_buildSeedData());
        for (const k of demoKeys) { await del(k); }
        await del(ACTIVITY_KEY);
        localStorage.setItem(cleanupKey, '1');
      }
    } catch (e) { /* ignore */ }
  }

  /* ═══════════════════════════════════════════════════════════════════
     Convenience wrappers
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Add an entry to the activity feed.
   */
  async function addActivity(dept, text, color, href) {
    const acts = await get(ACTIVITY_KEY) || [];
    const colors = { booking:'gold', kitchen:'purple', procurement:'cyan', restaurant:'blue', poolbar:'green', accounting:'amber', staff:'blue', gym:'purple', store:'amber', guests:'gold' };
    acts.unshift({
      dept,
      color: color || colors[dept.toLowerCase()] || 'gold',
      text,
      time: 'Just now',
      href: href || '#',
    });
    // Keep max 50 entries
    if (acts.length > 50) acts.length = 50;
    await set(ACTIVITY_KEY, acts);
    return acts;
  }

  /**
   * Add a sale to a department's sales ledger.
   */
  async function addSale(department, sale) {
    const key = `ds_${department}_sales`;
    const sales = await get(key) || [];
    sales.unshift(sale);
    await set(key, sales);

    // Also add to accounting ledger if it's revenue-generating
    if (sale.status !== 'voided') {
      const ledger = await get('ds_accounting_ledger') || [];
      ledger.unshift({
        date: _today(),
        ref: sale.id,
        description: `${department.charAt(0).toUpperCase() + department.slice(1)} Sale — ${sale.id}`,
        type: 'income',
        amount: sale.total || 0
      });
      await set('ds_accounting_ledger', ledger);
    }

    await addActivity(
      department === 'restaurant' ? 'Restaurant' : department === 'poolbar' ? 'Pool Bar' : department,
      `${sale.id} — ${_fmtN(sale.total)} settled by ${sale.method || 'Cash'}`,
      null,
      `${department}/dashboard.html`
    );
    return sales;
  }

  /**
   * Get today's revenue for a department.
   */
  async function getTodayRevenue(department) {
    const key = `ds_${department}_sales`;
    const sales = await get(key) || [];
    const today = _today();
    return sales
      .filter(s => s.status !== 'voided' && s.date && s.date.startsWith(today))
      .reduce((sum, s) => sum + (s.total || s.amount || 0), 0);
  }

  /**
   * Get total revenue across all departments.
   */
  async function getTotalRevenue() {
    const roomTx = await get('ds_accounting_room_tx') || [];
    const restSales = await get('ds_restaurant_sales') || [];
    const poolSales = await get('ds_poolbar_sales') || [];
    const roomRev = roomTx.reduce((s, t) => s + (t.amount || 0), 0);
    const restRev = restSales.filter(s => s.status !== 'voided').reduce((s, t) => s + (t.total || 0), 0);
    const poolRev = poolSales.reduce((s, t) => s + (t.total || t.amount || 0), 0);
    return { roomRev, restRev, poolRev, total: roomRev + restRev + poolRev };
  }

  /* ═══════════════════════════════════════════════════════════════════
     Mode switching
     ═══════════════════════════════════════════════════════════════════ */
  function setMode(mode, config) {
    _mode = mode === 'live' ? 'live' : 'demo';
    if (config) {
      _config.baseUrl = config.baseUrl || '';
      _config.token = config.token || '';
      _config.apiKey = config.apiKey || '';
    }
    console.log('[DataStore] Mode set to', _mode);
  }

  function getMode() { return _mode; }

  /* ═══════════════════════════════════════════════════════════════════
     Backward compatibility with existing storage patterns
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Get data in the shape expected by the old `storage` adapter
   * (used by grace-request-form.js and grace-store-approval.js).
   * Returns { key, value, shared } or null.
   */
  async function getLegacy(key) {
    const v = await get(key);
    return v == null ? null : { key, value: JSON.stringify(v), shared: true };
  }

  /**
   * Set data compatible with the old `storage` adapter.
   */
  async function setLegacy(key, value, shared) {
    await set(key, typeof value === 'string' ? JSON.parse(value) : value);
    return { key, value, shared: shared !== false };
  }

  /**
   * Delete data compatible with the old `storage` adapter.
   */
  async function deleteLegacy(key, shared) {
    await del(key);
    return { key, deleted: true, shared: shared !== false };
  }

  /**
   * List keys compatible with the old `storage` adapter.
   */
  async function listLegacy(prefix, shared) {
    const keys = await list(prefix);
    return { keys, prefix, shared: shared !== false };
  }

  /* ═══════════════════════════════════════════════════════════════════
     Expose
     ═══════════════════════════════════════════════════════════════════ */
  window.DataStore = {
    // Core API
    get,
    set,
    del,
    list,

    // Init & mode
    init,
    setMode,
    getMode,

    // Convenience
    addActivity,
    addSale,
    getTodayRevenue,
    getTotalRevenue,

    // Legacy adapter (for grace-request-form, grace-store-approval, etc.)
    getLegacy,
    setLegacy,
    deleteLegacy,
    listLegacy,

    // Constants
    VERSION: STORAGE_VERSION,
    ACTIVITY_KEY,
  };

})();