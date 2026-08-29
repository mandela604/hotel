/**
 * room-grid.js — Aurum/Aurumhotel Reusable Room Grid Component (for booking apps)
 * ─────────────────────────────────────────────────────────────────────────
 * Drop one <script src="room-grid.js"></script> in any page. It is fully
 * self-contained (own CSS, own modals) and does NOT know about your
 * backend — it keeps its own in-memory room list (mutating the objects
 * you pass in) and calls your hooks so the host page can persist changes.
 *
 *   const rg = AurumhotelRoomGrid.attach('#roomGridPlaceholder', {
 *     title: 'Rooms',
 *     rooms: SEED_ROOMS,              // see shape below
 *     pageSize: 16,                   // rooms per page
 *     showAddRoom: true,              // false = hide the "＋ Add Room" button/modal
 *     currency: '₦',                  // prefix used by the built-in formatter
 *
 *     onBook:         (room) => { ... open your own booking form ... },
 *     onEditBooking:  (room) => { ... open your own booking form pre-filled ... },
 *     onStatusChange: (room, oldStatus, newStatus, note) => { ... your API call ... },
 *     onAddRoom:      (room) => { ... your API call ... },
 *     onDeleteRoom:   (room) => { ... your API call ... },
 *     onCardClick:    (room) => { ... override the default click behaviour ... },
 *   });
 *
 *   rg.setRooms(newList);      // replace all rooms, re-render
 *   rg.addRoom({...});         // programmatically add a room (skips the modal)
 *   rg.updateRoom(num, patch); // shallow-merge a patch into one room, re-render
 *   rg.removeRoom(num);        // remove a room entirely
 *   rg.setFilter('available'); // programmatically apply a status filter
 *   rg.getRooms();             // read current in-memory state
 *   rg.destroy();              // remove and clean up
 *
 * Room shape (any field but `num` can be omitted):
 *   {
 *     num,                      // unique room number/id — REQUIRED
 *     type,                     // e.g. 'Standard' | 'Deluxe' | 'Suite' | 'Conference' — freeform
 *     rate,                     // nightly rate, a plain number
 *     status,                   // one of options.statuses[].id — defaults to 'available'
 *     guest,                    // occupant/reservation name, shown on the card when present
 *     checkin, checkout,        // ISO date strings, shown under the guest name
 *     notes,                    // freeform note — surfaced on 'maintenance' cards
 *   }
 *
 * ── STATUSES ARE CONFIGURABLE ─────────────────────────────────────────────
 * The default status set mirrors a hotel room board (available / checked-in /
 * reserved / check-out / maintenance) but you can pass your own via
 * `options.statuses` (id, label, color) and your own legal transitions via
 * `options.statusTransitions` (a map of status id -> array of {v,l} targets).
 * Anything not covered by your config falls back to the built-in defaults.
 *
 * ── QUICK ACTIONS PER STATUS ───────────────────────────────────────────────
 * available   → "Book" (fires onBook) + a gear icon (opens the status modal)
 * checkedin   → "Check-out" (opens the status modal, pre-selected)
 * reserved    → "Status" (opens the modal) + "Edit" (fires onEditBooking)
 * checkout /
 * maintenance → "Status" (opens the modal)
 * Clicking the card body itself (not a quick-action button) calls
 * `options.onCardClick(room)` if supplied; otherwise it fires `onBook` for
 * available rooms or `onEditBooking` for rooms that have a guest.
 *
 * ── FILTER BAR + PAGINATION ────────────────────────────────────────────────
 * The filter bar has an "All" chip plus one chip per configured status, a
 * type <select> (auto-populated from the rooms you pass in unless you supply
 * `options.types`), and an optional "＋ Add Room" button. The grid paginates
 * itself at `options.pageSize` (default 16) and resets to page 1 whenever a
 * filter changes.
 *
 * ── ADD ROOM / STATUS-CHANGE MODALS ────────────────────────────────────────
 * Both modals are built into this component (own overlay, own form) so the
 * host page doesn't need to build them. Saving the Add Room modal pushes a
 * new room into the in-memory list and calls `onAddRoom`; saving the Status
 * modal mutates `room.status` (and `room.notes` if a note was entered) and
 * calls `onStatusChange`. Neither modal touches guest/booking fields — that
 * remains the host page's job via `onBook` / `onEditBooking`.
 */

(function () {
  'use strict';

  if (window.__aurumhotelRoomGrid) return;
  window.__aurumhotelRoomGrid = true;

  // ══════════════════════════════════════════════════════════════════════
  // CSS  (drg- prefixed, self-contained — dark, gold-accent theme by default)
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .drg-wrap{font-family:'DM Sans',system-ui,sans-serif;color:#e0e0e0;}
    .drg-filters{display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap;align-items:center;}
    .drg-fbtn{background:#111318;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:5px 13px;font-size:11.5px;font-weight:500;color:#a1a1aa;cursor:pointer;transition:.18s;font-family:inherit;display:inline-flex;align-items:center;gap:5px;user-select:none;}
    .drg-fbtn:hover,.drg-fbtn.on{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.3);color:#e8c96a;}
    .drg-fdot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .drg-fright{margin-left:auto;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    @media (max-width:600px){.drg-fright{margin-left:0;width:100%}}
    .drg-sel{background:#111318;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 10px;color:#e0e0e0;font-family:inherit;font-size:12.5px;cursor:pointer;outline:none;transition:border-color .2s}
    .drg-sel:focus{border-color:rgba(201,168,76,.4)}
    .drg-btn-primary{background:#c9a84c;color:#0a1520;border:none;border-radius:10px;padding:9px 16px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:.18s;white-space:nowrap}
    .drg-btn-primary:hover{background:#e8c96a;transform:translateY(-1px)}
    .drg-btn-outline{background:none;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 14px;font-family:inherit;font-size:12.5px;font-weight:500;color:#a1a1aa;cursor:pointer;transition:.18s;white-space:nowrap}
    .drg-btn-outline:hover{border-color:rgba(201,168,76,.35);color:#c9a84c}

    .drg-panel{background:#111e2b;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)}
    .drg-panel-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 14px;gap:8px;flex-wrap:wrap}
    .drg-panel-title{font-size:13px;font-weight:600;color:#e0e0e0}
    .drg-panel-count{font-size:11.5px;color:#6a8a9e}

    .drg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px;padding:0 16px 16px}
    @media (max-width:480px){.drg-grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}}

    .drg-card{background:#162435;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:13px;cursor:pointer;transition:.18s;position:relative;overflow:hidden}
    .drg-card:hover{transform:translateY(-2px);border-color:rgba(201,168,76,.3);box-shadow:0 6px 20px rgba(201,168,76,.1)}
    .drg-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--drg-accent,#4ade80)}
    .drg-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:700;color:#e8f0f8;margin-bottom:1px}
    .drg-type{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#6a8a9e;margin-bottom:7px}
    .drg-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
    .drg-chip::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}
    .drg-guest{font-size:11.5px;font-weight:500;color:#e8f0f8;margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .drg-dates{font-size:10px;color:#6a8a9e;margin-top:1px}
    .drg-note{font-size:9.5px;color:#fb923c;margin-top:3px}
    .drg-rate{font-size:10.5px;color:#6a8a9e;margin-top:5px}
    .drg-acts{display:flex;gap:4px;margin-top:8px}
    .drg-act{flex:1;background:none;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:3px 0;font-size:10px;font-weight:500;color:#a8bece;cursor:pointer;transition:.15s;font-family:inherit;text-align:center}
    .drg-act:hover{border-color:rgba(201,168,76,.35);color:#c9a84c}
    .drg-act.danger:hover{border-color:rgba(248,113,113,.4);color:#f87171}

    .drg-pagin{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid rgba(255,255,255,.06);font-size:12px;color:#6a8a9e;flex-wrap:wrap;gap:8px}
    .drg-pagebtns{display:flex;gap:3px;flex-wrap:wrap}
    .drg-pagebtn{min-width:28px;height:28px;border-radius:7px;border:1px solid rgba(255,255,255,.08);background:none;color:#6a8a9e;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;transition:.15s;font-family:inherit;padding:0 7px}
    .drg-pagebtn:hover{border-color:rgba(201,168,76,.35);color:#c9a84c}
    .drg-pagebtn.on{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.3);color:#c9a84c;font-weight:600}
    .drg-pagebtn:disabled{opacity:.3;cursor:default;pointer-events:none}

    .drg-empty{grid-column:1/-1;text-align:center;padding:28px 14px;color:#6a8a9e}
    .drg-empty i{font-size:26px;margin-bottom:8px;display:block;color:#243850}

    /* Modals (Add Room / Status change) */
    .drg-modal-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(5px);z-index:2500;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto}
    .drg-modal-ov.show{display:flex}
    .drg-modal{background:#0a1520;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:22px;width:min(420px,94vw);box-shadow:0 30px 80px rgba(0,0,0,.6);margin:auto;font-family:'DM Sans',system-ui,sans-serif;color:#e0e0e0}
    .drg-modal-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
    .drg-modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:19px;font-weight:700;color:#e8f0f8}
    .drg-modal-close{background:none;border:none;color:#6a8a9e;font-size:17px;cursor:pointer;padding:4px;line-height:1}
    .drg-modal-close:hover{color:#e0e0e0}
    .drg-fgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
    .drg-fgroup{display:flex;flex-direction:column;gap:5px}
    .drg-fgroup.span2{grid-column:span 2}
    .drg-flabel{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#6a8a9e;font-weight:500}
    .drg-finput,.drg-fselect{background:#0d1a27;border:1px solid #1e3045;border-radius:9px;padding:9px 11px;color:#e0e0e0;font-family:inherit;font-size:13px;outline:none;transition:border-color .2s;width:100%}
    .drg-finput:focus,.drg-fselect:focus{border-color:rgba(201,168,76,.4)}
    .drg-modal-sub{font-size:13px;color:#a8bece;margin-bottom:14px;line-height:1.5}
    .drg-modal-ftr{display:flex;gap:10px;justify-content:flex-end;margin-top:4px;padding-top:14px;border-top:1px solid #1e3045;flex-wrap:wrap}
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'drg-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Defaults
  // ══════════════════════════════════════════════════════════════════════
  const DEFAULT_STATUSES = [
    { id: 'available',   label: 'Available',   color: '#4ade80' },
    { id: 'checkedin',   label: 'Occupied',    color: '#c9a84c' },
    { id: 'reserved',    label: 'Reserved',    color: '#60a5fa' },
    { id: 'checkout',    label: 'Check-out',   color: '#f87171' },
    { id: 'maintenance', label: 'Maintenance', color: '#fb923c' },
  ];
  const DEFAULT_TRANSITIONS = {
    available:   [{ v: 'maintenance', l: 'Put Under Maintenance' }],
    checkedin:   [{ v: 'checkout', l: 'Check-out Guest' }],
    reserved:    [{ v: 'checkedin', l: 'Check In' }, { v: 'available', l: 'Cancel / Make Available' }, { v: 'maintenance', l: 'Put Under Maintenance' }],
    checkout:    [{ v: 'available', l: 'Mark Available' }, { v: 'maintenance', l: 'Put Under Maintenance' }],
    maintenance: [{ v: 'available', l: 'Mark Available' }],
  };

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _fmtDate(d) { if (!d) return '—'; const dt = new Date(d + (d.includes && d.includes('T') ? '' : 'T00:00:00')); if (isNaN(dt)) return '—'; return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('drgToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'drgToast';
      el.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(14px);background:#111;border:1px solid rgba(255,255,255,.08);color:#e0e0e0;padding:8px 18px;border-radius:24px;font-size:12px;font-weight:600;z-index:2600;opacity:0;transition:.26s;pointer-events:none;white-space:nowrap;font-family:\'DM Sans\',sans-serif';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(14px)'; }, 2400);
  }

  let _instanceCounter = 0;

  function attach(target, options) {
    options = options || {};
    _injectStyles();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[AurumhotelRoomGrid] Target not found:', target); return null; }

    const instId = 'drg' + (++_instanceCounter);
    const STATUSES    = options.statuses || DEFAULT_STATUSES;
    const TRANSITIONS = options.statusTransitions || DEFAULT_TRANSITIONS;
    const PAGE_SIZE    = options.pageSize || 16;
    const CURRENCY     = options.currency != null ? options.currency : '₦';
    const showAddRoom  = options.showAddRoom !== false;

    const STAT_BY_ID = {};
    STATUSES.forEach(s => (STAT_BY_ID[s.id] = s));
    function statusLabel(id) { return (STAT_BY_ID[id] && STAT_BY_ID[id].label) || id || 'Unknown'; }
    function statusColor(id) { return (STAT_BY_ID[id] && STAT_BY_ID[id].color) || '#9ca3af'; }
    function fmtMoney(n) { return CURRENCY + Math.round(+n || 0).toLocaleString('en-US'); }

    let rooms = (options.rooms || []).map(_normalize);
    let filterStatus = 'all';
    let filterType   = '';
    let page = 1;
    let statusRoomNum = null; // room currently open in the status modal

    function _normalize(r) {
      return Object.assign({ num: '', type: '', rate: 0, status: 'available', guest: '', checkin: '', checkout: '', notes: '' }, r || {});
    }
    function deriveTypes() {
      if (options.types && options.types.length) return options.types;
      const set = new Set();
      rooms.forEach(r => { if (r.type) set.add(r.type); });
      return Array.from(set);
    }

    // ── Shell ──
    container.innerHTML = `
      <div class="drg-wrap" id="${instId}">
        <div class="drg-filters" id="${instId}-filters"></div>
        <div class="drg-panel">
          <div class="drg-panel-head">
            <div class="drg-panel-title" id="${instId}-title">${_esc(options.title || 'Rooms')}</div>
            <div class="drg-panel-count" id="${instId}-count">—</div>
          </div>
          <div class="drg-grid" id="${instId}-grid"></div>
          <div class="drg-pagin">
            <span id="${instId}-paginlabel">—</span>
            <div class="drg-pagebtns" id="${instId}-pagebtns"></div>
          </div>
        </div>
      </div>`;

    const root       = container.querySelector('#' + instId);
    const filtersEl  = root.querySelector('#' + instId + '-filters');
    const titleEl    = root.querySelector('#' + instId + '-title');
    const countEl    = root.querySelector('#' + instId + '-count');
    const gridEl     = root.querySelector('#' + instId + '-grid');
    const paginLbl   = root.querySelector('#' + instId + '-paginlabel');
    const pageBtnsEl = root.querySelector('#' + instId + '-pagebtns');

    // ── Modals (appended to <body> so they are truly full-overlay) ──
    const modalWrap = document.createElement('div');
    modalWrap.innerHTML = `
      <div class="drg-modal-ov" id="${instId}-addov">
        <div class="drg-modal">
          <div class="drg-modal-hdr">
            <div class="drg-modal-title">Add New Room</div>
            <button class="drg-modal-close" id="${instId}-addclose">✕</button>
          </div>
          <div class="drg-fgrid">
            <div class="drg-fgroup"><label class="drg-flabel">Room Number</label><input class="drg-finput" id="${instId}-arnum" placeholder="e.g. 205"></div>
            <div class="drg-fgroup"><label class="drg-flabel">Room Type</label><input class="drg-finput" id="${instId}-artype" placeholder="e.g. Standard"></div>
            <div class="drg-fgroup"><label class="drg-flabel">Rate / Night</label><input class="drg-finput" type="number" id="${instId}-arrate" placeholder="0"></div>
            <div class="drg-fgroup"><label class="drg-flabel">Initial Status</label>
              <select class="drg-fselect" id="${instId}-arstatus"></select>
            </div>
            <div class="drg-fgroup span2"><label class="drg-flabel">Notes (optional)</label><input class="drg-finput" id="${instId}-arnotes" placeholder="Recently renovated, sea view…"></div>
          </div>
          <div class="drg-modal-ftr">
            <button class="drg-btn-outline" id="${instId}-addcancel">Cancel</button>
            <button class="drg-btn-primary" id="${instId}-addsave">＋ Add Room</button>
          </div>
        </div>
      </div>
      <div class="drg-modal-ov" id="${instId}-statov">
        <div class="drg-modal">
          <div class="drg-modal-hdr">
            <div class="drg-modal-title">Update Room Status</div>
            <button class="drg-modal-close" id="${instId}-statclose">✕</button>
          </div>
          <div class="drg-modal-sub">
            Room <strong id="${instId}-statnum"></strong> · <span id="${instId}-stattype" style="color:#c9a84c"></span> · Current: <span id="${instId}-statcur" style="font-weight:600"></span>
          </div>
          <div class="drg-fgroup" style="margin-bottom:12px">
            <label class="drg-flabel">New Status</label>
            <select class="drg-fselect" id="${instId}-statnew"></select>
          </div>
          <div class="drg-fgroup">
            <label class="drg-flabel">Reason / Note</label>
            <input class="drg-finput" id="${instId}-statnote" placeholder="e.g. AC repair, deep cleaning…">
          </div>
          <div class="drg-modal-ftr">
            <button class="drg-btn-outline" id="${instId}-statcancel">Cancel</button>
            <button class="drg-btn-primary" id="${instId}-statsave">✓ Update</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalWrap);
    const addOv   = document.getElementById(instId + '-addov');
    const statOv  = document.getElementById(instId + '-statov');

    function closeModal(ov) { ov.classList.remove('show'); }
    function openModal(ov)  { ov.classList.add('show'); }
    [addOv, statOv].forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov); }));

    // ── Add Room modal ──
    function openAddRoomModal() {
      document.getElementById(instId + '-arnum').value   = '';
      document.getElementById(instId + '-artype').value  = '';
      document.getElementById(instId + '-arrate').value  = '';
      document.getElementById(instId + '-arnotes').value = '';
      const sel = document.getElementById(instId + '-arstatus');
      sel.innerHTML = STATUSES.map(s => `<option value="${s.id}">${_esc(s.label)}</option>`).join('');
      openModal(addOv);
    }
    document.getElementById(instId + '-addclose').addEventListener('click', () => closeModal(addOv));
    document.getElementById(instId + '-addcancel').addEventListener('click', () => closeModal(addOv));
    document.getElementById(instId + '-addsave').addEventListener('click', () => {
      const num   = document.getElementById(instId + '-arnum').value.trim();
      const type  = document.getElementById(instId + '-artype').value.trim();
      const rate  = parseFloat(document.getElementById(instId + '-arrate').value) || 0;
      const status= document.getElementById(instId + '-arstatus').value;
      const notes = document.getElementById(instId + '-arnotes').value.trim();
      if (!num) { _toast('Please enter a room number.'); return; }
      if (rooms.find(r => r.num === num)) { _toast(`Room ${num} already exists.`); return; }
      const room = _normalize({ num, type, rate, status, notes });
      rooms.push(room);
      closeModal(addOv);
      render();
      if (typeof options.onAddRoom === 'function') options.onAddRoom(room);
      _toast(`Room ${num} added.`);
    });

    // ── Status modal ──
    function openStatusModal(num) {
      const r = rooms.find(x => x.num === num);
      if (!r) return;
      statusRoomNum = num;
      document.getElementById(instId + '-statnum').textContent  = num;
      document.getElementById(instId + '-stattype').textContent = r.type || '';
      document.getElementById(instId + '-statcur').textContent  = statusLabel(r.status);
      document.getElementById(instId + '-statnote').value       = r.notes || '';
      const opts = TRANSITIONS[r.status] || [];
      const sel  = document.getElementById(instId + '-statnew');
      sel.innerHTML = opts.length === 0
        ? '<option value="">No changes available</option>'
        : opts.map(o => `<option value="${o.v}">${_esc(o.l)}</option>`).join('');
      openModal(statOv);
    }
    document.getElementById(instId + '-statclose').addEventListener('click', () => closeModal(statOv));
    document.getElementById(instId + '-statcancel').addEventListener('click', () => closeModal(statOv));
    document.getElementById(instId + '-statsave').addEventListener('click', () => {
      if (!statusRoomNum) return;
      const newSt = document.getElementById(instId + '-statnew').value;
      if (!newSt) return;
      const note = document.getElementById(instId + '-statnote').value.trim();
      const r = rooms.find(x => x.num === statusRoomNum);
      if (!r) return;
      const oldSt = r.status;
      r.status = newSt;
      if (note) r.notes = note;
      if (newSt === 'available') { r.guest = ''; r.checkin = ''; r.checkout = ''; }
      closeModal(statOv);
      render();
      if (typeof options.onStatusChange === 'function') options.onStatusChange(r, oldSt, newSt, note);
      _toast(`Room ${statusRoomNum} → ${statusLabel(newSt)}.`);
      statusRoomNum = null;
    });

    // ── Filter bar ──
    function renderFilters() {
      const types = deriveTypes();
      filtersEl.innerHTML = `
        <div class="drg-fbtn${filterStatus === 'all' ? ' on' : ''}" data-filt="all">All Rooms</div>
        ${STATUSES.map(s => `<div class="drg-fbtn${filterStatus === s.id ? ' on' : ''}" data-filt="${s.id}"><span class="drg-fdot" style="background:${s.color}"></span>${_esc(s.label)}</div>`).join('')}
        <div class="drg-fright">
          ${types.length ? `<select class="drg-sel" id="${instId}-typesel"><option value="">All Types</option>${types.map(t => `<option value="${_esc(t)}"${filterType === t ? ' selected' : ''}>${_esc(t)}</option>`).join('')}</select>` : ''}
          ${showAddRoom ? `<button class="drg-btn-outline" id="${instId}-addbtn">＋ Add Room</button>` : ''}
        </div>`;
      filtersEl.querySelectorAll('[data-filt]').forEach(btn => {
        btn.addEventListener('click', () => { filterStatus = btn.dataset.filt; page = 1; render(); });
      });
      const typeSel = document.getElementById(instId + '-typesel');
      if (typeSel) typeSel.addEventListener('change', () => { filterType = typeSel.value; page = 1; render(); });
      const addBtn = document.getElementById(instId + '-addbtn');
      if (addBtn) addBtn.addEventListener('click', openAddRoomModal);
    }

    // ── Card + grid rendering ──
    function cardHtml(r) {
      const color = statusColor(r.status);
      const hasGuest = !!r.guest;
      let acts = '';
      if (r.status === 'available') {
        acts = `<div class="drg-acts"><button class="drg-act" data-act="book" data-num="${_escAttr(r.num)}">📋 Book</button><button class="drg-act" data-act="status" data-num="${_escAttr(r.num)}">⚙</button></div>`;
      } else if (r.status === 'checkedin') {
        acts = `<div class="drg-acts"><button class="drg-act danger" data-act="status" data-num="${_escAttr(r.num)}">🚪 Check-out</button></div>`;
      } else if (r.status === 'reserved') {
        acts = `<div class="drg-acts"><button class="drg-act" data-act="status" data-num="${_escAttr(r.num)}">⚙ Status</button><button class="drg-act" data-act="edit" data-num="${_escAttr(r.num)}">✏ Edit</button></div>`;
      } else {
        acts = `<div class="drg-acts"><button class="drg-act" data-act="status" data-num="${_escAttr(r.num)}">⚙ Status</button></div>`;
      }
      return `<div class="drg-card" style="--drg-accent:${color}" data-num="${_escAttr(r.num)}">
        <div class="drg-num">${_esc(r.num)}</div>
        <div class="drg-type">${_esc(r.type || '—')}</div>
        <span class="drg-chip" style="color:${color};background:${_hexA(color, .14)}">${_esc(statusLabel(r.status))}</span>
        ${hasGuest ? `<div class="drg-guest">${_esc(r.guest)}</div><div class="drg-dates">${_fmtDate(r.checkin)} → ${_fmtDate(r.checkout)}</div>` : ''}
        ${r.status === 'maintenance' && r.notes ? `<div class="drg-note">${_esc(r.notes)}</div>` : ''}
        <div class="drg-rate">${fmtMoney(r.rate)}/night</div>
        ${acts}
      </div>`;
    }
    function _escAttr(s) { return _esc(s).replace(/"/g, '&quot;'); }
    function _hexA(hex, a) {
      hex = (hex || '#9ca3af').replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substr(0, 2), 16) || 0, g = parseInt(hex.substr(2, 2), 16) || 0, b = parseInt(hex.substr(4, 2), 16) || 0;
      return `rgba(${r},${g},${b},${a})`;
    }

    function filteredRooms() {
      return rooms.filter(r => (filterStatus === 'all' || r.status === filterStatus) && (!filterType || r.type === filterType));
    }

    function renderPagination(total) {
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (page > totalPages) page = totalPages;
      const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
      const to   = Math.min(page * PAGE_SIZE, total);
      paginLbl.textContent = total === 0 ? 'No rooms' : `${from}–${to} of ${total}`;
      pageBtnsEl.innerHTML = '';
      const mk = (label, p, disabled, active) => {
        const b = document.createElement('button');
        b.className = 'drg-pagebtn' + (active ? ' on' : '');
        b.textContent = label; b.disabled = !!disabled;
        b.addEventListener('click', () => { page = p; renderGrid(); });
        return b;
      };
      pageBtnsEl.appendChild(mk('‹', page - 1, page === 1, false));
      let start = Math.max(1, page - 2), end = Math.min(totalPages, start + 4);
      start = Math.max(1, end - 4);
      for (let i = start; i <= end; i++) pageBtnsEl.appendChild(mk(String(i), i, false, i === page));
      pageBtnsEl.appendChild(mk('›', page + 1, page >= totalPages, false));
    }

    function renderGrid() {
      const list = filteredRooms();
      countEl.textContent = list.length + (list.length === 1 ? ' room' : ' rooms');
      const start = (page - 1) * PAGE_SIZE;
      const pageList = list.slice(start, start + PAGE_SIZE);
      gridEl.innerHTML = pageList.length === 0
        ? `<div class="drg-empty"><i>▢</i>No rooms match this filter.</div>`
        : pageList.map(cardHtml).join('');
      renderPagination(list.length);
    }

    function render() {
      renderFilters();
      titleEl.textContent = filterStatus === 'all' ? (options.title || 'Rooms') : `${statusLabel(filterStatus)} Rooms`;
      renderGrid();
    }

    // ── Event delegation on the grid ──
    gridEl.addEventListener('click', e => {
      const actBtn = e.target.closest('[data-act]');
      if (actBtn) {
        e.stopPropagation();
        const num = actBtn.dataset.num;
        const room = rooms.find(r => r.num === num);
        const act = actBtn.dataset.act;
        if (act === 'book' && typeof options.onBook === 'function') options.onBook(room);
        else if (act === 'edit' && typeof options.onEditBooking === 'function') options.onEditBooking(room);
        else if (act === 'status') openStatusModal(num);
        return;
      }
      const card = e.target.closest('.drg-card');
      if (!card) return;
      const room = rooms.find(r => r.num === card.dataset.num);
      if (!room) return;
      if (typeof options.onCardClick === 'function') { options.onCardClick(room); return; }
      if (room.status === 'available' && typeof options.onBook === 'function') options.onBook(room);
      else if (room.guest && typeof options.onEditBooking === 'function') options.onEditBooking(room);
    });

    render();

    // ── Public control object ──
    return {
      setRooms(list) { rooms = (list || []).map(_normalize); page = 1; render(); },
      getRooms() { return rooms; },
      addRoom(roomData) { const r = _normalize(roomData); rooms.push(r); render(); return r; },
      updateRoom(num, patch) {
        const r = rooms.find(x => x.num === num);
        if (!r) return null;
        Object.assign(r, patch || {});
        render();
        return r;
      },
      removeRoom(num) {
        const i = rooms.findIndex(x => x.num === num);
        if (i === -1) return false;
        rooms.splice(i, 1);
        const room = { num };
        render();
        if (typeof options.onDeleteRoom === 'function') options.onDeleteRoom(room);
        return true;
      },
      setFilter(statusId) { filterStatus = statusId || 'all'; page = 1; render(); },
      refresh() { render(); },
      destroy() {
        addOv.remove();
        statOv.remove();
        container.innerHTML = '';
      },
    };
  }

  window.AurumhotelRoomGrid = { attach };

})();

/*─── USAGE ──────────────────────────────────────────────────────────────

  <div id="roomGridPlaceholder"></div>
  <script src="room-grid.js"></script>
  <script>
    const SEED_ROOMS = [
      { num:'101', type:'Standard', rate:35000, status:'checkedin', guest:'Mr. Adeyemi, Tunde', checkin:'2026-03-10', checkout:'2026-03-14' },
      { num:'102', type:'Standard', rate:35000, status:'available' },
      { num:'105', type:'Standard', rate:35000, status:'maintenance', notes:'Plumbing repair' },
      { num:'201', type:'Deluxe',   rate:60000, status:'reserved', guest:'Ms. Abubakar, Fatima', checkin:'2026-03-13', checkout:'2026-03-17' },
    ];

    const rg = AurumhotelRoomGrid.attach('#roomGridPlaceholder', {
      title: 'Rooms',
      rooms: SEED_ROOMS,
      currency: '₦',
      onBook:        (room) => openMyBookingModalFor(room),
      onEditBooking: (room) => openMyBookingModalToEdit(room),
      onStatusChange:(room, oldSt, newSt, note) => console.log(room.num, oldSt, '->', newSt, note),
      onAddRoom:     (room) => console.log('new room', room),
    });
  </script>

── DRIVING STATUS FROM YOUR OWN BOOKINGS ARRAY ───────────────────────────

  If your app keeps rooms and bookings as two separate arrays (like the
  original booking.html), merge them into one flat room list before calling
  `attach`/`setRooms` — each room object here expects `status`/`guest`/
  `checkin`/`checkout` inlined onto it, not looked up elsewhere. This keeps
  the component itself backend-agnostic, same as comment-section.js keeps
  its own comment tree instead of reaching into your data layer.

── CUSTOM STATUSES ────────────────────────────────────────────────────────

  Pass `statuses` (id/label/color) and `statusTransitions` (legal moves per
  status) to model a completely different board — e.g. a housekeeping
  turnover flow (dirty → cleaning → inspected → ready) — without touching
  this file.

─────────────────────────────────────────────────────────────────────────*/