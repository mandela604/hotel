/**
 * component/front-desk-table.js — Reusable booking / front-desk data table
 * ─────────────────────────────────────────────────────────────────────
 * Same idea as component/sales-table.js: self-contained CSS (ft- prefix)
 * + DOM, host supplies filtered rows, component only renders + paginates
 * + sorts + sums. One component, two front-desk pages:
 *
 *   - booking-list.html   → columns incl. an Actions column (View/Edit/Delete)
 *   - booking-reports.html → columns incl. Rate/Disc/Method/Recorded By,
 *                             no actions column, whole row opens a detail modal
 *
 * Column set, summary labels and row permissions are all supplied by the
 * host page, so the same file drives both without a fork.
 *
 *   <script src="../component/front-desk-table.js"></script>
 *
 *   const table = FrontDeskTable.create({
 *     target: '#tableSlot',
 *     title: 'All Bookings',
 *     pageSize: 10,
 *     columns: ['room','guest','checkin','checkout','nights','total','paid','balance','payment','status','actions'],
 *     showSummary: true,
 *     summaryLabels: { count:'Bookings', total:'Total Revenue', paid:'Collected', balance:'Balance' },
 *     emptyText: 'No bookings found',
 *     onRowClick: (b) => bookingModal.openView(b),
 *     onView:   (b) => bookingModal.openView(b),
 *     onEdit:   (b) => bookingModal.openEdit(b),
 *     onDelete: (b) => openDelete(b),
 *     getRowPerm: (b) => ({ canEdit: canEdit(session,'booking',b), canDelete: canDelete(session,'booking',b) }),
 *   });
 *
 *   table.setRows(filteredArray);   // re-render
 *   table.setSession(session);      // re-evaluate getRowPerm on next render
 *   table.setTitle('Room 101');
 *   table.setCountLabel('12 records');
 *   table.getState();               // { page, sortKey, sortDir, rows }
 *   table.destroy();
 *
 * Reports usage (no actions column, row opens a read-only detail modal):
 *
 *   const table = FrontDeskTable.create({
 *     target: '#tableSlot',
 *     title: 'Full Report',
 *     columns: ['room','guest','checkin','checkout','nights','rate','discount','total','paid','balance','method','payment','status','recordedBy'],
 *     summaryLabels: { count:'Records', total:'Total Revenue', paid:'Collected', balance:'Balance Due' },
 *     onRowClick: (b) => openDetailModal(b),
 *   });
 */
(function (global) {
  'use strict';

  const CSS_ID = 'front-desk-table-css';

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = `
.ft-panel{
  --ft-bg:var(--surface,#fff); --ft-bg2:var(--surface2,#f4f6fb); --ft-bg3:var(--surface3,#eef0f6);
  --ft-border:var(--border,#eef0f6); --ft-border2:var(--border2,#dfe3ec);
  --ft-text:var(--text,#1c2440); --ft-text2:var(--text2,#6b7280); --ft-text3:var(--text3,#9aa1b3);
  --ft-gold:var(--gold,#2f6fed); --ft-gold-dim:var(--gold-dim,rgba(47,111,237,.1)); --ft-gold-border:var(--gold-border,rgba(47,111,237,.25));
  --ft-green:var(--green,#12b76a); --ft-green-bg:var(--green-bg,#e9f9f0);
  --ft-red:var(--red,#f04438); --ft-red-bg:var(--red-bg,#feecec);
  --ft-amber:var(--amber,#f79009); --ft-amber-bg:var(--amber-bg,#fff4e5);
  --ft-blue:var(--blue,#2f6fed); --ft-blue-bg:var(--blue-bg,#eaf1ff);
  --ft-purple:var(--purple,#8b5cf6);
  --ft-shadow:var(--shadow,0 4px 20px rgba(15,34,55,.07));
  background:var(--ft-bg); border:1px solid var(--ft-border); border-radius:14px;
  box-shadow:var(--ft-shadow); overflow:hidden; min-width:0;
  display:flex; flex-direction:column; color:var(--ft-text); font-size:13px;
  font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
}
.ft-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 20px 14px; flex-wrap:wrap; gap:8px; flex-shrink:0; }
.ft-title{ font-size:14px; font-weight:800; color:var(--ft-text); }
.ft-count{ font-size:11.5px; color:var(--ft-text3); font-weight:600; }

.ft-tbl-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
.ft-table{ width:100%; border-collapse:collapse; }
.ft-table thead th{
  text-align:left; padding:9px 12px; font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px;
  color:var(--ft-text3); font-weight:700; background:var(--ft-bg2); border-bottom:1px solid var(--ft-border);
  white-space:nowrap; user-select:none;
}
.ft-table thead th.ft-center{ text-align:center; }
.ft-table thead th.ft-sortable{ cursor:pointer; }
.ft-table thead th.ft-sortable:hover{ color:var(--ft-gold); }
.ft-table thead th .ft-arrow{ font-size:9px; margin-left:3px; opacity:.65; }
.ft-table tbody tr{ border-bottom:1px solid var(--ft-border); transition:background .15s; }
.ft-table tbody tr:last-child{ border-bottom:none; }
.ft-table tbody tr.ft-clickable{ cursor:pointer; }
.ft-table tbody tr.ft-clickable:hover{ background:var(--ft-bg2); }
.ft-table tbody td{ padding:9px 12px; color:var(--ft-text); vertical-align:middle; font-size:12.5px; }
.ft-table tbody td.ft-center{ text-align:center; }
.ft-table .ft-empty td{ text-align:center; padding:28px; color:var(--ft-text3); cursor:default; white-space:normal; }

.ft-room{ display:inline-flex; align-items:center; gap:5px; font-weight:700; }
.ft-dot{ width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.ft-dot-standard{ background:var(--ft-blue); } .ft-dot-deluxe{ background:var(--ft-purple); }
.ft-dot-suite{ background:var(--ft-gold); } .ft-dot-conf{ background:#34d399; } .ft-dot-default{ background:var(--ft-text3); }

.ft-guest-name{ font-weight:600; font-size:12.5px; }
.ft-guest-sub{ font-size:10.5px; color:var(--ft-text3); }

.ft-chip{ display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; white-space:nowrap; }
.ft-chip i{ font-size:6px; }
.ft-chip-checkedin{ background:var(--ft-green-bg); color:var(--ft-green); }
.ft-chip-checkout{ background:var(--ft-red-bg); color:var(--ft-red); }
.ft-chip-reserved{ background:var(--ft-blue-bg); color:var(--ft-blue); }
.ft-chip-vacant{ background:rgba(156,163,175,.14); color:#6b7280; }
.ft-chip-maintenance{ background:var(--ft-amber-bg); color:var(--ft-amber); }
.ft-chip-noshow{ background:var(--ft-red-bg); color:var(--ft-red); }
.ft-chip-cancelled{ background:var(--ft-red-bg); color:var(--ft-red); }
.ft-chip-cleaning{ background:rgba(56,189,248,.14); color:#0284c7; }
.ft-chip-default{ background:var(--ft-bg3); color:var(--ft-text3); }

.ft-pay{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; padding:1px 7px; border-radius:20px; white-space:nowrap; }
.ft-pay i{ font-size:6px; }
.ft-pay-full{ background:var(--ft-green-bg); color:var(--ft-green); }
.ft-pay-deposit{ background:var(--ft-amber-bg); color:var(--ft-amber); }
.ft-pay-pending{ background:var(--ft-red-bg); color:var(--ft-red); }
.ft-pay-partial{ background:var(--ft-amber-bg); color:var(--ft-amber); }

.ft-acts{ display:flex; gap:4px; align-items:center; flex-wrap:wrap; }
.ft-act{ background:var(--ft-bg); border:1px solid var(--ft-border); border-radius:6px; padding:4px 9px;
  font-size:11px; font-weight:700; color:var(--ft-text3); cursor:pointer; font-family:inherit;
  display:inline-flex; align-items:center; gap:5px; white-space:nowrap; transition:all .15s; }
.ft-act.ft-view:hover{ border-color:var(--ft-gold-border); color:var(--ft-gold); }
.ft-act.ft-edit:hover{ border-color:var(--ft-gold-border); color:var(--ft-gold); }
.ft-act.ft-del:hover{ border-color:rgba(240,68,56,.4); color:var(--ft-red); }
.ft-view-only{ font-size:10.5px; color:var(--ft-text3); font-style:italic; }

.ft-summary{ display:grid; grid-template-columns:repeat(4,1fr); background:var(--ft-bg2); border-top:1px solid var(--ft-border); flex-shrink:0; }
@media (max-width:560px){ .ft-summary{ grid-template-columns:1fr 1fr; } }
.ft-sb{ text-align:center; padding:10px 12px; border-right:1px solid var(--ft-border); }
.ft-sb:last-child{ border-right:none; }
@media (max-width:560px){ .ft-sb:nth-child(2){ border-right:none; } }
.ft-sb-lbl{ font-size:9px; text-transform:uppercase; letter-spacing:1.2px; color:var(--ft-text3); margin-bottom:3px; font-weight:700; }
.ft-sb-val{ font-size:17px; font-weight:800; color:var(--ft-text); }

.ft-pagin{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px;
  border-top:1px solid var(--ft-border); font-size:12px; color:var(--ft-text3); flex-wrap:wrap; gap:8px; font-weight:600; flex-shrink:0; }
.ft-page-btns{ display:flex; gap:3px; flex-wrap:wrap; }
.ft-page-btn{ min-width:28px; height:28px; border-radius:7px; border:1px solid var(--ft-border); background:var(--ft-bg);
  color:var(--ft-text3); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px;
  font-family:inherit; padding:0 7px; font-weight:600; transition:all .15s; }
.ft-page-btn:hover{ border-color:var(--ft-gold-border); color:var(--ft-gold); }
.ft-page-btn.ft-on{ background:var(--ft-gold-dim); border-color:var(--ft-gold-border); color:var(--ft-gold); }
.ft-page-btn:disabled{ opacity:.3; cursor:default; pointer-events:none; }

@media (max-width:760px){
  .ft-tbl-wrap{ overflow-x:visible; }
  .ft-table thead{ display:none; }
  .ft-table, .ft-table tbody, .ft-table tr, .ft-table td{ display:block; width:100%; }
  .ft-table tbody tr{ border:1px solid var(--ft-border); border-radius:10px; margin:10px; padding:4px; background:var(--ft-bg); }
  .ft-table tbody td{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 10px;
    border-bottom:1px dashed var(--ft-border); text-align:right; }
  .ft-table tbody td:last-child{ border-bottom:none; }
  .ft-table tbody td::before{ content:attr(data-label); font-size:9.5px; text-transform:uppercase; letter-spacing:1px;
    color:var(--ft-text3); font-weight:600; text-align:left; flex-shrink:0; }
  .ft-table tbody td.ft-mcard-head{ padding:10px 10px 8px; border-bottom:1px solid var(--ft-border); }
  .ft-table tbody td.ft-mcard-head::before{ display:none; }
  .ft-table tbody td.ft-mcard-actions::before{ display:none; }
  .ft-table tbody td.ft-mcard-actions .ft-acts{ width:100%; }
  .ft-table tbody td.ft-mcard-actions .ft-act{ flex:1; justify-content:center; padding:7px 0; }
  .ft-table .ft-empty td{ display:block; text-align:center; }
  .ft-table .ft-empty td::before{ content:none; }
}
`;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function defaultMoney(n) {
    const x = Number(n) || 0;
    try { return '₦' + x.toLocaleString('en-NG', { maximumFractionDigits: 0 }); }
    catch (e) { return '₦' + Math.round(x); }
  }

  function defaultDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function defaultNights(ci, co) {
    if (!ci || !co) return 0;
    const n = (new Date(co) - new Date(ci)) / 86400000;
    return n > 0 ? n : 0;
  }

  const DEFAULT_DOT_CLASS = { Standard: 'ft-dot-standard', Deluxe: 'ft-dot-deluxe', Suite: 'ft-dot-suite', Conference: 'ft-dot-conf' };
  const DEFAULT_STATUS_MAP = {
    checkedin:   { cls: 'ft-chip-checkedin',   label: 'Checked In' },
    checkout:    { cls: 'ft-chip-checkout',    label: 'Check-out' },
    reserved:    { cls: 'ft-chip-reserved',    label: 'Reserved' },
    vacant:      { cls: 'ft-chip-vacant',      label: 'Vacant' },
    maintenance: { cls: 'ft-chip-maintenance', label: 'Maintenance' },
    'no-show':   { cls: 'ft-chip-noshow',     label: 'No-Show' },
    cancelled:   { cls: 'ft-chip-cancelled',  label: 'Cancelled' },
    cleaning:    { cls: 'ft-chip-cleaning',    label: 'Cleaning' },
  };
  const DEFAULT_PAY_MAP = {
    'Fully Paid':        'ft-pay-full',
    'Deposit Paid':       'ft-pay-deposit',
    'Partially Settled':  'ft-pay-partial',
    'Pending':            'ft-pay-pending',
  };

  function create(options) {
    options = options || {};
    injectCSS();

    const pageSize = options.pageSize || 10;
    const showSummary = options.showSummary !== false;
    const emptyText = options.emptyText || 'No records found.';
    let panelTitle = options.title || 'Bookings';
    const fmt = typeof options.formatMoney === 'function' ? options.formatMoney : defaultMoney;
    const fmtDate = typeof options.formatDate === 'function' ? options.formatDate : defaultDate;
    const sortable = options.sortable !== false;
    const dotClass = Object.assign({}, DEFAULT_DOT_CLASS, options.dotClass || {});
    const statusMap = Object.assign({}, DEFAULT_STATUS_MAP, options.statusMap || {});
    const payMap = Object.assign({}, DEFAULT_PAY_MAP, options.payMap || {});
    const summaryLabels = Object.assign(
      { count: 'Records', total: 'Total Revenue', paid: 'Collected', balance: 'Balance' },
      options.summaryLabels || {}
    );

    // Calculation hooks — default to window.BookingData if present, else
    // sane fallbacks so the table works even before that service loads.
    const BD = global.BookingData || null;
    const calcNights = (options.calc && options.calc.nights) || (BD && BD.nights) || defaultNights;
    const calcTotal = (options.calc && options.calc.total) || (BD && BD.calcTotal) || function (b) {
      const n = calcNights(b.checkin, b.checkout) || 1;
      return (b.rate || 0) * n * (1 - (b.discount || 0) / 100);
    };
    const calcPaid = (options.calc && options.calc.paid) || (BD && BD.calcPaid) || function (b) {
      if (Array.isArray(b.payments) && b.payments.length) {
        return b.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      }
      return Number(b.paid) || 0;
    };
    const calcBal = (options.calc && options.calc.balance) || (BD && BD.calcBal) || function (b) {
      return Math.max(0, calcTotal(b) - calcPaid(b));
    };
    function derivePayLabel(b) {
      if (b.payStatus) return b.payStatus;
      const paid = calcPaid(b), total = calcTotal(b);
      if (paid <= 0) return 'Pending';
      if (paid >= total) return 'Fully Paid';
      return 'Deposit Paid';
    }

    // ── Column registry ──────────────────────────────────────────────
    // Each column: { id, label, sortkey?, align?, cell(row, ctx) -> html, headHtml? }
    const BUILT_IN = {
      room: {
        label: 'Room',
        headExtra: 'ft-mcard-head',
        cell: (b) => {
          const dot = dotClass[b.type] || 'ft-dot-default';
          const st = statusMap[b.status] || { cls: 'ft-chip-default', label: b.status || '—' };
          return '<span class="ft-room"><span class="ft-dot ' + dot + '"></span>' + esc(b.room) + ' · ' + esc(b.type || '') + '</span>' +
            '<span class="ft-chip ' + st.cls + '"><i class="fa-solid fa-circle"></i>' + esc(st.label) + '</span>';
        },
      },
      guest: {
        label: 'Guest',
        cell: (b) => '<div class="ft-guest-name">' + esc(b.guest || '—') + '</div><div class="ft-guest-sub">' + esc(b.phone || '') + '</div>',
      },
      checkin: { label: 'Check-in', sortkey: 'checkin', cell: (b) => fmtDate(b.checkin) },
      checkout: { label: 'Check-out', sortkey: 'checkout', cell: (b) => fmtDate(b.checkout) },
      nights: { label: 'Nts', align: 'center', cell: (b) => String(calcNights(b.checkin, b.checkout) || '—') },
      rate: { label: 'Rate/Night (₦)', align: 'right', cell: (b) => fmt(b.rate) },
      discount: { label: 'Disc %', align: 'center', cell: (b) => (b.discount || 0) + '%' },
      total: { label: 'Total (₦)', sortkey: 'total', align: 'right', cell: (b) => '<strong>' + fmt(calcTotal(b)) + '</strong>' },
      paid: { label: 'Paid (₦)', align: 'right', cell: (b) => '<span style="color:var(--ft-green)">' + fmt(calcPaid(b)) + '</span>' },
      balance: {
        label: 'Balance (₦)', align: 'right',
        cell: (b) => {
          const bal = calcBal(b);
          return '<span style="color:' + (bal > 0 ? 'var(--ft-red)' : 'var(--ft-green)') + ';font-weight:700;">' + fmt(bal) + '</span>';
        },
      },
      method: { label: 'Method', cell: (b) => esc(b.payMethod || '—') },
      payment: {
        label: 'Payment',
        cell: (b) => {
          const label = derivePayLabel(b);
          const cls = payMap[label] || 'ft-pay-pending';
          return '<span class="ft-pay ' + cls + '"><i class="fa-solid fa-circle"></i>' + esc(label) + '</span>';
        },
      },
      status: {
        label: 'Status', align: 'center',
        cell: (b) => {
          const st = statusMap[b.status] || { cls: 'ft-chip-default', label: b.status || '—' };
          return '<span class="ft-chip ' + st.cls + '"><i class="fa-solid fa-circle"></i>' + esc(st.label) + '</span>';
        },
      },
      recordedBy: { label: 'Recorded By', cell: (b) => esc(b.recordedBy || '—') },
      notes: { label: 'Notes', cell: (b) => esc(b.notes || '—') },
      actions: {
        label: 'Actions', align: 'center', noPrint: true, stop: true,
        cell: (b, ctx) => {
          const perm = typeof options.getRowPerm === 'function'
            ? (options.getRowPerm(b, ctx.session) || {})
            : { canEdit: true, canDelete: true };
          const canView = perm.canView !== false; // default visible
          const showEdit = perm.canEdit && typeof options.onEdit === 'function';
          const showDelete = perm.canDelete && typeof options.onDelete === 'function';
          let html = '<div class="ft-acts">';
          if (canView && typeof options.onView === 'function') {
            html += '<button type="button" class="ft-act ft-view" data-ft-view="1"><i class="fa-solid fa-eye"></i> View</button>';
          }
          if (showEdit) {
            html += '<button type="button" class="ft-act ft-edit" data-ft-edit="1"><i class="fa-solid fa-pen"></i> Edit</button>';
          }
          if (showDelete) {
            html += '<button type="button" class="ft-act ft-del" data-ft-del="1"><i class="fa-solid fa-trash"></i> Delete</button>';
          }
          if (!showEdit && !showDelete && !(canView && typeof options.onView === 'function')) {
            html += '<span class="ft-view-only">View only</span>';
          }
          html += '</div>';
          return html;
        },
      },
    };

    // Resolve the column list: array of ids (built-in) and/or full column
    // definition objects supplied by the host for anything custom.
    const columns = (options.columns || ['room', 'guest', 'checkin', 'checkout', 'nights', 'total', 'paid', 'balance', 'payment', 'status'])
      .map((c) => (typeof c === 'string' ? Object.assign({ id: c }, BUILT_IN[c] || { label: c, cell: () => '' }) : c));

    let rows = [];
    let page = 1;
    let sortKey = options.sortKey || null;
    let sortDir = options.sortDir || 'desc';
    let session = options.session || null;
    let root = null;
    let host = null;

    function resolveTarget(t) {
      if (!t) return null;
      return typeof t === 'string' ? document.querySelector(t) : t;
    }

    function mount(target) {
      host = resolveTarget(target);
      if (!host) throw new Error('FrontDeskTable: target not found');
      root = document.createElement('div');
      root.className = 'ft-panel';
      root.innerHTML =
        '<div class="ft-head">' +
          '<div class="ft-title" data-ft="title">' + esc(panelTitle) + '</div>' +
          '<span class="ft-count" data-ft="count">—</span>' +
        '</div>' +
        '<div class="ft-tbl-wrap">' +
          '<table class="ft-table">' +
            '<thead><tr data-ft="thead"></tr></thead>' +
            '<tbody data-ft="body"></tbody>' +
          '</table>' +
        '</div>' +
        (showSummary
          ? '<div class="ft-summary" data-ft="summary">' +
              '<div class="ft-sb"><div class="ft-sb-lbl">' + esc(summaryLabels.count) + '</div><div class="ft-sb-val" data-ft="sbCount">0</div></div>' +
              '<div class="ft-sb"><div class="ft-sb-lbl">' + esc(summaryLabels.total) + '</div><div class="ft-sb-val" data-ft="sbTotal">₦0</div></div>' +
              '<div class="ft-sb"><div class="ft-sb-lbl">' + esc(summaryLabels.paid) + '</div><div class="ft-sb-val" data-ft="sbPaid">₦0</div></div>' +
              '<div class="ft-sb"><div class="ft-sb-lbl">' + esc(summaryLabels.balance) + '</div><div class="ft-sb-val" data-ft="sbBal">₦0</div></div>' +
            '</div>'
          : '') +
        '<div class="ft-pagin">' +
          '<span data-ft="paginLabel">—</span>' +
          '<div class="ft-page-btns" data-ft="pageBtns"></div>' +
        '</div>';
      host.innerHTML = '';
      host.appendChild(root);
      renderHead();
      bindEvents();
      render();
    }

    function $(sel) { return root ? root.querySelector(sel) : null; }

    function renderHead() {
      const tr = $('[data-ft="thead"]');
      if (!tr) return;
      tr.innerHTML = columns.map((c) => {
        const alignCls = c.align === 'center' ? ' ft-center' : '';
        const noPrintCls = c.noPrint ? ' no-print' : '';
        if (sortable && c.sortkey) {
          return '<th class="ft-sortable' + alignCls + noPrintCls + '" data-sortkey="' + esc(c.sortkey) + '">' +
            esc(c.label) + ' <span class="ft-arrow" data-ft="arrow-' + esc(c.sortkey) + '"></span></th>';
        }
        return '<th class="' + alignCls.trim() + noPrintCls + '">' + esc(c.label) + '</th>';
      }).join('');
    }

    function bindEvents() {
      if (!root) return;
      if (sortable) {
        root.addEventListener('click', function (e) {
          const th = e.target.closest('th[data-sortkey]');
          if (!th || !root.contains(th)) return;
          const key = th.dataset.sortkey;
          if (sortKey === key) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
          else { sortKey = key; sortDir = 'desc'; }
          page = 1;
          render();
        });
      }
    }

    function sortValue(row, key) {
      const v = row[key];
      if (v == null) return 0;
      if (key === 'checkin' || key === 'checkout') {
        const d = Date.parse(v);
        return isNaN(d) ? 0 : d;
      }
      if (key === 'total') return calcTotal(row);
      const n = Number(v);
      return isNaN(n) ? String(v) : n;
    }

    function sortedRows() {
      if (!sortKey) return rows.slice();
      const list = rows.slice();
      list.sort(function (a, b) {
        const av = sortValue(a, sortKey), bv = sortValue(b, sortKey);
        let cmp = av > bv ? 1 : av < bv ? -1 : 0;
        return sortDir === 'desc' ? -cmp : cmp;
      });
      return list;
    }

    function renderArrows() {
      columns.forEach((c) => {
        if (!c.sortkey) return;
        const el = $('[data-ft="arrow-' + c.sortkey + '"]');
        if (el) el.textContent = sortKey === c.sortkey ? (sortDir === 'desc' ? '▼' : '▲') : '';
      });
    }

    function renderSummary(list) {
      if (!showSummary) return;
      const bar = $('[data-ft="summary"]');
      if (!bar) return;
      if (!list.length) { bar.style.display = 'none'; return; }
      bar.style.display = 'grid';
      const total = list.reduce((s, b) => s + calcTotal(b), 0);
      const paid = list.reduce((s, b) => s + calcPaid(b), 0);
      const bal = list.reduce((s, b) => s + calcBal(b), 0);
      $('[data-ft="sbCount"]').textContent = String(list.length);
      $('[data-ft="sbTotal"]').textContent = fmt(total);
      $('[data-ft="sbPaid"]').textContent = fmt(paid);
      $('[data-ft="sbBal"]').textContent = fmt(bal);
    }

    function renderPagination(total) {
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      if (page > totalPages) page = totalPages;
      const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
      const to = Math.min(page * pageSize, total);
      $('[data-ft="paginLabel"]').textContent = total === 0 ? 'No records' : from + '–' + to + ' of ' + total;

      const wrap = $('[data-ft="pageBtns"]');
      wrap.innerHTML = '';
      function mk(label, p, disabled, active) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ft-page-btn' + (active ? ' ft-on' : '');
        b.innerHTML = label;
        b.disabled = !!disabled;
        b.addEventListener('click', function () { page = p; renderBody(); });
        return b;
      }
      wrap.appendChild(mk('<i class="fa-solid fa-chevron-left"></i>', page - 1, page === 1, false));
      let start = Math.max(1, page - 2), end = Math.min(totalPages, start + 4);
      start = Math.max(1, end - 4);
      for (let i = start; i <= end; i++) wrap.appendChild(mk(String(i), i, false, i === page));
      wrap.appendChild(mk('<i class="fa-solid fa-chevron-right"></i>', page + 1, page >= totalPages, false));
    }

    function findRow(id) {
      return rows.find((r) => String(r.room) === String(id)) || null;
    }

    function renderBody() {
      const list = sortedRows();
      $('[data-ft="count"]').textContent = list.length + ' record' + (list.length !== 1 ? 's' : '');
      renderArrows();
      renderSummary(list);

      const start = (page - 1) * pageSize;
      const pageRows = list.slice(start, start + pageSize);
      const body = $('[data-ft="body"]');
      const clickable = typeof options.onRowClick === 'function' || typeof options.onView === 'function';
      const ctx = { session };

      if (!pageRows.length) {
        body.innerHTML = '<tr class="ft-empty"><td colspan="' + columns.length + '">' + esc(emptyText) + '</td></tr>';
        renderPagination(0);
        return;
      }

      body.innerHTML = pageRows.map((b) => {
        let html = '<tr class="' + (clickable ? 'ft-clickable' : '') + '" data-id="' + esc(b.room) + '">';
        columns.forEach((c) => {
          const alignCls = c.align === 'center' ? ' ft-center' : '';
          const extraCls = c.headExtra ? ' ' + c.headExtra : '';
          const stopCls = c.stop ? ' ft-mcard-actions' : '';
          const noPrintCls = c.noPrint ? ' no-print' : '';
          const stopAttr = c.stop ? ' onclick="event.stopPropagation()"' : '';
          html += '<td class="' + (alignCls + extraCls + stopCls + noPrintCls).trim() + '" data-label="' + esc(c.label) + '"' + stopAttr + '>' +
            c.cell(b, ctx) + '</td>';
        });
        html += '</tr>';
        return html;
      }).join('');

      body.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('[data-ft-view],[data-ft-edit],[data-ft-del]')) return;
          const row = findRow(tr.dataset.id);
          if (!row) return;
          if (typeof options.onRowClick === 'function') options.onRowClick(row);
          else if (typeof options.onView === 'function') options.onView(row);
        });
      });
      body.querySelectorAll('[data-ft-view]').forEach((btn) => {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const row = findRow(btn.closest('tr').dataset.id);
          if (row && typeof options.onView === 'function') options.onView(row);
        });
      });
      body.querySelectorAll('[data-ft-edit]').forEach((btn) => {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const row = findRow(btn.closest('tr').dataset.id);
          if (row && typeof options.onEdit === 'function') options.onEdit(row);
        });
      });
      body.querySelectorAll('[data-ft-del]').forEach((btn) => {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const row = findRow(btn.closest('tr').dataset.id);
          if (row && typeof options.onDelete === 'function') options.onDelete(row);
        });
      });

      renderPagination(list.length);
    }

    function render() {
      if (!root) return;
      renderBody();
    }

    const api = {
      setRows: function (list) {
        rows = Array.isArray(list) ? list.slice() : [];
        page = 1;
        render();
      },
      getRows: function () { return rows.slice(); },
      setSession: function (s) { session = s; renderBody(); },
      setPage: function (p) { page = Math.max(1, parseInt(p, 10) || 1); renderBody(); },
      setTitle: function (t) {
        panelTitle = t || panelTitle;
        const el = $('[data-ft="title"]');
        if (el) el.textContent = panelTitle;
      },
      setCountLabel: function (t) {
        const el = $('[data-ft="count"]');
        if (el) el.textContent = t;
      },
      setSort: function (key, dir) {
        sortKey = key || null;
        if (dir) sortDir = dir;
        page = 1;
        render();
      },
      getState: function () {
        return { page: page, sortKey: sortKey, sortDir: sortDir, rows: rows.slice() };
      },
      refresh: render,
      destroy: function () {
        if (root && root.parentNode) root.parentNode.removeChild(root);
        root = null; host = null; rows = [];
      },
    };

    if (options.target) mount(options.target);
    return api;
  }

  global.FrontDeskTable = { create: create };
})(window);