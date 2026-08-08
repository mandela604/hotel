/* ═══════════════════════════════════════════════════════════════
   AccountingData — shared data/config layer for the Accounting
   module. Pulled into its own file (matching the pattern of
   component/grace-request-form.js, sales-detail.js, void-sale.js)
   so every Accounting page — Dashboard, Shift Reconciliation,
   Revenue Breakdown, Transactions, Reports — reads from ONE place
   instead of each page re-declaring its own config/seeds/shift math.

   Load this BEFORE the page script:
     <script src="../services/accounting-data.js"></script>
     <script> AccountingData.configure({ USE_DEMO: true }); ... </script>

   Exposes window.AccountingData:
     configure(opts)                          — the one Demo↔Live switch
     getRoomTransactions() / getRestaurantSales() / getPoolBarSales() / getShifts()
                                                — Live-first, Demo/shared-storage
                                                  fallback, auto-seeds on first load
     createShift(shift) / updateShift(key,patch) / deleteShift(key)
                                                — CRUD, writes through to shared
                                                  storage + (in Live mode) the API
     buildTransactions(room, rest, pool)       — merges the 3 feeds into one shape
     computeShiftTotals(transactions, shiftKey)— gross / net / per-department split
     queryTransactions(list, opts)             — search + filter + sort + paginate
     shiftKeyFor(date) / shiftRangeLabel(key) / fmtTime(date) / fmtHourLabel(h)
     parseTxDate(str) / fmtN(amount)
     toast(msg, type)                          — same visual contract every page
                                                  already defines a .toast block for
     CFG                                        — read-only view of current config
═══════════════════════════════════════════════════════════════ */
(function (global) {

  /* ── 1. CONFIG — the one switch every page shares ── */
  const CFG = {
    API_BASE: '',
    API_KEY: '',
    USE_DEMO: true,
    SHIFT_START_HOUR: 9,
  };
  function configure(opts) { Object.assign(CFG, opts || {}); }

  /* ── 2. STORAGE — the shared "demo database" + localStorage fallback,
     same adapter shape used across every Grace Hotel module. ── */
  const storage = global.storage || {
    async get(key, shared) { const v = localStorage.getItem(key); return v == null ? null : { key, value: v, shared }; },
    async set(key, value, shared) { localStorage.setItem(key, value); return { key, value, shared }; },
    async delete(key, shared) { localStorage.removeItem(key); return { key, deleted: true, shared }; },
    async list(prefix, shared) { const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)); return { keys, prefix, shared }; },
  };
  async function loadShared(key, fallback) {
    try {
      const r = await storage.get(key, true);
      if (r && r.value) { const parsed = JSON.parse(r.value); if (Array.isArray(parsed)) return parsed; }
    } catch (e) {}
    return fallback;
  }
  async function saveShared(key, value) {
    try { await storage.set(key, JSON.stringify(value), true); } catch (e) { console.warn('[AccountingData] sync failed:', key, e); }
  }

  /* ── 3. NETWORK — centralized fetch with timeout + retry. Every call
     returns a consistent {ok, data, error} shape (incl. 401/403) instead
     of pages each writing their own try/catch around fetch(). ── */
  async function apiFetch(method, path, body, { retries = 1, timeoutMs = 6000 } = {}) {
    if (!CFG.API_BASE) return { ok: false, data: null, error: 'No API_BASE configured' };
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const opts = { method, headers: { 'Content-Type': 'application/json' }, signal: controller.signal };
        if (CFG.API_KEY) opts.headers['Authorization'] = `Bearer ${CFG.API_KEY}`;
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(CFG.API_BASE + path, opts);
        clearTimeout(timer);
        if (res.status === 401) return { ok: false, data: null, error: 'unauthorized' };
        if (res.status === 403) return { ok: false, data: null, error: 'forbidden' };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok: true, data: await res.json(), error: null };
      } catch (e) {
        clearTimeout(timer);
        if (attempt === retries) return { ok: false, data: null, error: e.message || 'network error' };
      }
    }
  }
  function apiSave(method, path, body) {
    if (!CFG.USE_DEMO) apiFetch(method, path, body).catch(() => {});
  }

  /* ── 4. SHIFT-DAY LOGIC — a shift runs 9AM → 9AM the next day, so a
     1am sale still belongs to the shift that started the afternoon
     before. Shared by every page that needs "the current shift". ── */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function shiftKeyFor(dt) {
    const d = new Date(dt);
    if (d.getHours() < CFG.SHIFT_START_HOUR) d.setDate(d.getDate() - 1);
    return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  function fmtTime(d) { return d ? d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'; }
  function fmtHourLabel(h) { const suffix = h >= 12 ? 'PM' : 'AM'; const hh = h % 12 === 0 ? 12 : h % 12; return `${hh}:00 ${suffix}`; }
  function shiftRangeLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    const start = new Date(y, m - 1, d, CFG.SHIFT_START_HOUR, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const opt = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('en-GB', opt)}, ${fmtTime(start)} → ${end.toLocaleDateString('en-GB', opt)}, ${fmtTime(end)}`;
  }
  function parseTxDate(str) {
    if (!str) return null;
    const [datePart, timePart, ampm] = str.split(' ');
    const [d, m, y] = datePart.split('/').map(n => parseInt(n, 10));
    let hh = 0, mm = 0;
    if (timePart) { const [h, mi] = timePart.split(':').map(n => parseInt(n, 10)); hh = h; mm = mi || 0; }
    if (ampm) { const u = ampm.toUpperCase(); if (u === 'PM' && hh < 12) hh += 12; if (u === 'AM' && hh === 12) hh = 0; }
    const fullYear = y < 100 ? 2000 + y : y;
    return new Date(fullYear, m - 1, d, hh, mm);
  }
  function fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }

  /* ── 5. DEMO SEEDS — single source of truth. Every page reads the
     same records via loadShared(), so Dashboard/Transactions/Reports
     never drift out of sync with each other. ── */
  const DEMO_ROOM_TX = [
    { id:'RM-2044', desc:'Room 312 — Checkout (Dr. Balogun)', amount:145000, method:'Room Charge', staff:'Adewale O.', date:'17/07/26 08:40 AM' },
    { id:'RM-2043', desc:'Room 204 — Check-in (Mr. Adeyemi)', amount:98000,  method:'POS',         staff:'Adewale O.', date:'17/07/26 09:14 AM' },
    { id:'RM-2042', desc:'Room 109 — Checkout (Ms. Okafor)',  amount:76000,  method:'Cash',         staff:'Ngozi Eze',  date:'17/07/26 08:05 AM' },
    { id:'RM-2041', desc:'Room 402 — Check-in (Barr. Musa)',  amount:132000, method:'Transfer',     staff:'Adewale O.', date:'16/07/26 11:20 PM' },
    { id:'RM-2040', desc:'Room 108 — Checkout (Mrs. Bello)',  amount:64000,  method:'Cash',         staff:'Kabiru Aliyu',date:'16/07/26 08:52 AM' },
  ];
  const DEMO_RESTAURANT_SALES = [
    { id:'SALE-1043', items:[{meal:'Egusi Soup',qty:2,price:6000}], subtotal:12000, discount:0, total:12000, method:'Cash', staff:'Amaka O.', table:'Table 4', date:'17/07/26 11:05 AM', status:'completed' },
    { id:'SALE-1042', items:[{meal:'Fried Rice',qty:3,price:6000}], subtotal:18000, discount:0, total:18000, method:'POS', staff:'Tunde A.', table:'Table 2', date:'17/07/26 10:40 AM', status:'completed' },
    { id:'SALE-1041', items:[{meal:'Moi Moi',qty:1,price:2500}], subtotal:2500, discount:0, total:2500, method:'Transfer', staff:'Amaka O.', table:'Takeaway', date:'17/07/26 09:52 AM', status:'completed' },
    { id:'SALE-1038', items:[{meal:'Suya Platter',qty:2,price:5500}], subtotal:11000, discount:0, total:11000, method:'Cash', staff:'Tunde A.', table:'Table 6', date:'17/07/26 12:20 AM', status:'completed' },
  ];
  const DEMO_POOLBAR_SALES = [
    { id:'PBS-1021', item:'Heineken', qty:3, subtotal:4500,  discount:0, total:4500,  method:'Cash', staff:'Bola Nwosu', time:'17/07/26 11:15 AM' },
    { id:'PBS-1020', item:'Mojito',   qty:2, subtotal:12000, discount:8, total:11040, method:'POS',  staff:'Bola Nwosu', time:'17/07/26 10:50 AM' },
    { id:'PBS-1018', item:'Heineken', qty:6, subtotal:9000,  discount:0, total:9000,  method:'Cash', staff:'Emeka U.',   time:'17/07/26 01:05 AM' },
  ];
  const DEMO_SHIFTS = [
    { key:'2026-07-17', staff:'Amaka Okonkwo (Front Office Cashier)', openingFloat:50000, actualCash:null, status:'open' },
    { key:'2026-07-16', staff:'Tunde Adeyemi (Front Office Cashier)', openingFloat:50000, actualCash:399500, status:'reconciled', notes:'' },
    { key:'2026-07-15', staff:'Amaka Okonkwo (Front Office Cashier)', openingFloat:50000, actualCash:255000, status:'reconciled', notes:'Short by ₦5,000 — under investigation.' },
  ];

  /* ── 6. READS — Live-first (with retry/timeout), Demo/shared-storage
     fallback, auto-seeded into shared storage the first time a page
     asks for it, so the "demo database" always has something to show. ── */
  async function readCollection(apiPath, storageKey, demoSeed) {
    if (!CFG.USE_DEMO) {
      const r = await apiFetch('GET', apiPath, null, { retries: 1 });
      if (r.ok && Array.isArray(r.data)) return r.data;
      console.warn(`[AccountingData] Live fetch failed for ${apiPath}, falling back:`, r.error);
    }
    const rows = await loadShared(storageKey, demoSeed);
    await saveShared(storageKey, rows);
    return rows;
  }
  const getRoomTransactions = () => readCollection('/api/accounting/room-tx', 'accounting-room-tx', DEMO_ROOM_TX);
  const getRestaurantSales  = () => readCollection('/api/restaurant/sales',   'restaurant-sales',    DEMO_RESTAURANT_SALES);
  const getPoolBarSales     = () => readCollection('/api/poolbar/sales',      'poolbar-sales',       DEMO_POOLBAR_SALES);
  const getShifts           = () => readCollection('/api/accounting/shifts', 'accounting-shifts',   DEMO_SHIFTS);

  /* ── 7. WRITES — CRUD for shifts (the Reconciliation page's job;
     defined here so it isn't reinvented per-page). ── */
  async function createShift(shift) {
    const shifts = await loadShared('accounting-shifts', DEMO_SHIFTS);
    shifts.unshift(shift);
    await saveShared('accounting-shifts', shifts);
    apiSave('POST', '/api/accounting/shifts', shift);
    return shifts;
  }
  async function updateShift(key, patch) {
    const shifts = await loadShared('accounting-shifts', DEMO_SHIFTS);
    const s = shifts.find(x => x.key === key);
    if (s) Object.assign(s, patch);
    await saveShared('accounting-shifts', shifts);
    apiSave('PATCH', `/api/accounting/shifts/${key}`, patch);
    return shifts;
  }
  async function deleteShift(key) {
    let shifts = await loadShared('accounting-shifts', DEMO_SHIFTS);
    shifts = shifts.filter(x => x.key !== key);
    await saveShared('accounting-shifts', shifts);
    apiSave('DELETE', `/api/accounting/shifts/${key}`);
    return shifts;
  }

  /* ── 8. UNIFIED TRANSACTIONS — Rooms + Restaurant + Pool Bar merged
     into one shape. Each transaction carries its own discount amount
     (0 for Rooms — no discount concept there yet) so gross and net can
     both be derived from the same list without a second data pass. ── */
  function buildTransactions(roomTx, restSales, poolSales) {
    const out = [];
    roomTx.forEach(r => out.push({
      id: r.id, dept: 'Rooms', desc: r.desc, amount: r.amount, discount: 0,
      method: r.method, staff: r.staff, date: parseTxDate(r.date),
    }));
    restSales.filter(s => s.status !== 'voided').forEach(s => {
      const desc = (s.items || []).map(i => `${i.meal} ×${i.qty}`).join(', ') || 'Restaurant sale';
      const discountAmt = (s.subtotal || s.total) * (s.discount || 0) / 100;
      out.push({ id: s.id, dept: 'Restaurant', desc, amount: s.total, discount: discountAmt, method: s.method, staff: s.staff, date: parseTxDate(s.date) });
    });
    poolSales.forEach(s => {
      const discountAmt = (s.subtotal || s.total) * (s.discount || 0) / 100;
      out.push({ id: s.id, dept: 'Pool Bar', desc: `${s.item} ×${s.qty}`, amount: s.total, discount: discountAmt, method: s.method, staff: s.staff, date: parseTxDate(s.time) });
    });
    return out.filter(t => t.date).sort((a, b) => b.date - a.date);
  }

  /* Gross = money taken at the till. Net = gross minus discounts/comps
     given during the same shift — the figure that should actually hit
     the books once concessions are backed out. */
  function computeShiftTotals(transactions, shiftKey) {
    const rows = transactions.filter(t => shiftKeyFor(t.date) === shiftKey);
    const gross = rows.reduce((s, t) => s + t.amount, 0);
    const discounts = rows.reduce((s, t) => s + (t.discount || 0), 0);
    const net = gross - discounts;
    const byDept = (d) => rows.filter(t => t.dept === d).reduce((s, t) => s + t.amount, 0);
    return {
      rows, gross, net, discounts,
      rooms: byDept('Rooms'), restaurant: byDept('Restaurant'), poolbar: byDept('Pool Bar'),
      count: rows.length,
    };
  }

  /* ── 9. QUERY UTILITY — search + filter + sort + paginate, generic
     enough that the Transactions/Reports pages can reuse it as-is
     instead of each hand-rolling their own filter pipeline. ── */
  function queryTransactions(list, opts = {}) {
    const { search = '', dept = '', method = '', dateFrom = null, dateTo = null,
            sortKey = 'date', sortDir = 'desc', page = 1, pageSize = 10 } = opts;
    const q = search.toLowerCase();
    let rows = list.filter(t => {
      const mq = !q || t.id.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || (t.staff || '').toLowerCase().includes(q);
      const mDept = !dept || t.dept === dept;
      const mMethod = !method || t.method === method;
      let mDate = true;
      if (dateFrom && (!t.date || t.date < dateFrom)) mDate = false;
      if (dateTo && (!t.date || t.date > dateTo)) mDate = false;
      return mq && mDept && mMethod && mDate;
    });
    rows = rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date - b.date;
      else if (sortKey === 'amount') cmp = a.amount - b.amount;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);
    return { rows: pageRows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /* ── 10. TOAST — same visual contract every accounting page already
     defines a `.toast` / `.toast.success/.error/.info` CSS block for. ── */
  function toast(msg, type = 'success') {
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3400);
  }

  global.AccountingData = {
    configure,
    getRoomTransactions, getRestaurantSales, getPoolBarSales, getShifts,
    createShift, updateShift, deleteShift,
    buildTransactions, computeShiftTotals, queryTransactions,
    shiftKeyFor, shiftRangeLabel, fmtTime, fmtHourLabel, parseTxDate, fmtN,
    toast,
    get CFG() { return { ...CFG }; },
  };

})(window);