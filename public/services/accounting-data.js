/* ═══════════════════════════════════════════════════════════════
   AccountingData — shared data/config layer for the Accounting
   module. Pulled into its own file so every Accounting page —
   Dashboard, Shift Reconciliation, Revenue Breakdown, Transactions,
   Reports — reads from ONE place.

   Load this BEFORE the page script:
     <script src="../services/accounting-data.js"></script>

   Exposes window.AccountingData:
     configure(opts)
     getRoomTransactions() / getRestaurantSales() / getPoolBarSales() / getShifts()
     createShift(shift) / updateShift(key,patch) / deleteShift(key)
     buildTransactions(room, rest, pool)
     computeShiftTotals(transactions, shiftKey)
     queryTransactions(list, opts)
     shiftKeyFor(date) / shiftRangeLabel(key) / fmtTime(date) / fmtHourLabel(h)
     parseTxDate(str) / fmtN(amount)
     toast(msg, type)
     CFG
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const CFG = {
    API_BASE: '',
    API_KEY: '',
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
    apiFetch(method, path, body).catch(() => {});
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

  /* ── 5. READS — Live-first (with retry/timeout), shared-storage fallback. ── */
  async function readCollection(apiPath, storageKey) {
    const r = await apiFetch('GET', apiPath, null, { retries: 1 });
    if (r.ok && Array.isArray(r.data)) return r.data;
    console.warn(`[AccountingData] API fetch failed for ${apiPath}, using stored data:`, r.error);
    const rows = await loadShared(storageKey, []);
    return rows;
  }
  const getRoomTransactions = () => readCollection('/api/accounting/room-tx', 'accounting-room-tx');
  const getRestaurantSales  = () => readCollection('/api/restaurant/sales',   'restaurant-sales');
  const getPoolBarSales     = () => readCollection('/api/poolbar/sales',      'poolbar-sales');
  const getShifts           = () => readCollection('/api/accounting/shifts', 'accounting-shifts');

  /* ── 6. WRITES — CRUD for shifts. ── */
  async function createShift(shift) {
    const shifts = await loadShared('accounting-shifts', []);
    shifts.unshift(shift);
    await saveShared('accounting-shifts', shifts);
    apiSave('POST', '/api/accounting/shifts', shift);
    return shifts;
  }
  async function updateShift(key, patch) {
    const shifts = await loadShared('accounting-shifts', []);
    const s = shifts.find(x => x.key === key);
    if (s) Object.assign(s, patch);
    await saveShared('accounting-shifts', shifts);
    apiSave('PATCH', `/api/accounting/shifts/${key}`, patch);
    return shifts;
  }
  async function deleteShift(key) {
    let shifts = await loadShared('accounting-shifts', []);
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