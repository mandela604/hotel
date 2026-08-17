/**
 * component/sales-table.js — Reusable sales / report data table
 * ─────────────────────────────────────────────────────────────────────
 * Shared by Pool Bar + Restaurant Sales and Reports pages.
 * Self-contained CSS (st- prefix) + DOM. Host supplies filtered rows.
 *
 *   <script src="component/sales-table.js"></script>
 *
 *   const table = SalesTable.create({
 *     target: '#tableSlot',              // selector or HTMLElement
 *     pageSize: 8,
 *     showSummary: true,
 *     showActions: true,                 // View / Void column
 *     showSource: false,                 // Source column (reports)
 *     canVoid: false,                    // from Permissions
 *     columns: null,                     // optional override of default set
 *     emptyText: 'No sales match your filters.',
 *     title: 'Sales',                    // panel head title
 *     onRowClick: (sale) => {},
 *     onView: (sale) => {},              // if omitted, uses onRowClick
 *     onVoid: (sale) => {},              // only if canVoid
 *     formatMoney: (n) => '₦' + n,       // optional; default simple ₦
 *     theme: 'dark',                     // optional initial
 *   });
 *
 *   table.setRows(filteredArray);        // re-render
 *   table.setTitle('Report: Today');
 *   table.setCountLabel('12 records');
 *   table.setPage(1);
 *   table.getState();                    // { page, sortKey, sortDir, rows }
 *   table.destroy();
 */
(function (global) {
  'use strict';

  const CSS_ID = 'sales-table-css';

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = `
.st-panel{
  --st-bg:var(--surface,#fff); --st-bg2:var(--surface2,#f4f6fb); --st-bg3:var(--surface3,#eef0f6);
  --st-border:var(--border,#eef0f6); --st-border2:var(--border2,#dfe3ec);
  --st-text:var(--text,#1c2440); --st-text2:var(--text2,#6b7280); --st-text3:var(--text3,#9aa1b3);
  --st-gold:var(--gold,#2f6fed); --st-gold-dim:var(--gold-dim,rgba(47,111,237,.1)); --st-gold-border:var(--gold-border,rgba(47,111,237,.25));
  --st-green:var(--green,#12b76a); --st-green-bg:var(--green-bg,#e9f9f0);
  --st-red:var(--red,#f04438); --st-red-bg:var(--red-bg,#feecec);
  --st-shadow:var(--shadow,0 4px 20px rgba(15,34,55,.07));
  background:var(--st-bg); border:1px solid var(--st-border); border-radius:14px;
  box-shadow:var(--st-shadow); overflow:hidden; min-width:0; flex-shrink:0;
  display:flex; flex-direction:column; color:var(--st-text); font-size:13px;
  font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
}
.st-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 20px 14px; border-bottom:1px solid var(--st-border); flex-wrap:wrap; gap:8px; flex-shrink:0; }
.st-title{ font-size:13px; font-weight:800; color:var(--st-text); }
.st-count{ font-size:11.5px; color:var(--st-text3); font-weight:600; }

.st-tbl-wrap{ overflow-x:auto; overflow-y:visible; -webkit-overflow-scrolling:touch; }
.st-table{ width:100%; border-collapse:collapse; font-size:12.5px; min-width:840px; }
.st-table thead th{
  text-align:left; padding:10px 14px; font-size:9px; text-transform:uppercase; letter-spacing:1.5px;
  color:var(--st-text3); font-weight:700; background:var(--st-bg2); border-bottom:1px solid var(--st-border);
  white-space:nowrap; user-select:none;
}
.st-table thead th.st-center{ text-align:center; }
.st-table thead th.st-sortable{ cursor:pointer; }
.st-table thead th.st-sortable:hover{ color:var(--st-gold); }
.st-table thead th .st-arrow{ font-size:9px; margin-left:3px; opacity:.6; }
.st-table tbody tr{ border-bottom:1px solid var(--st-border); transition:background .15s; }
.st-table tbody tr:last-child{ border-bottom:none; }
.st-table tbody tr.st-clickable{ cursor:pointer; }
.st-table tbody tr.st-clickable:hover{ background:var(--st-bg2); }
.st-table tbody td{ padding:11px 14px; color:var(--st-text); vertical-align:middle; }
.st-table tbody td.st-nowrap{ white-space:nowrap; }
.st-table tbody td.st-center{ text-align:center; }
.st-table .st-empty td{ text-align:center; padding:32px; color:var(--st-text3); cursor:default; white-space:normal; }
.st-items{ max-width:280px; color:var(--st-text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.st-items .st-more{ color:var(--st-text3); font-size:10.5px; font-weight:600; }

.st-chip{ display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:20px; font-size:10.5px; font-weight:700; white-space:nowrap; }
.st-chip i{ font-size:7px; }
.st-chip-completed{ background:var(--st-green-bg); color:var(--st-green); }
.st-chip-voided{ background:var(--st-red-bg); color:var(--st-red); }
.st-chip-pay{ background:var(--st-gold-dim); color:var(--st-gold); }
.st-chip-source{ background:var(--st-bg3); color:var(--st-text3); }

.st-acts{ display:flex; gap:5px; flex-wrap:nowrap; }
.st-act{
  background:none; border:1px solid var(--st-border); border-radius:7px; padding:5px 10px;
  font-size:11px; font-weight:600; color:var(--st-text2); cursor:pointer; transition:all .15s;
  white-space:nowrap; display:inline-flex; align-items:center; gap:5px;
}
.st-act:hover{ border-color:var(--st-gold-border); color:var(--st-gold); }
.st-act-void{ border-color:rgba(240,68,56,.35); color:var(--st-red); background:var(--st-red-bg); font-weight:700; }
.st-act-void:hover{ border-color:var(--st-red); background:rgba(240,68,56,.2); color:var(--st-red); }

.st-summary{
  display:grid; grid-template-columns:repeat(4,1fr); background:var(--st-bg2);
  border-top:1px solid var(--st-border); flex-shrink:0;
}
@media (max-width:560px){ .st-summary{ grid-template-columns:1fr 1fr; } }
.st-sb{ text-align:center; padding:12px; border-right:1px solid var(--st-border); }
.st-sb:last-child{ border-right:none; }
@media (max-width:560px){ .st-sb:nth-child(2){ border-right:none; } }
.st-sb-lbl{ font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--st-text3); margin-bottom:3px; font-weight:600; }
.st-sb-val{ font-size:17px; font-weight:800; color:var(--st-text); }

.st-pagin{
  display:flex; align-items:center; justify-content:space-between; padding:12px 18px;
  border-top:1px solid var(--st-border); font-size:11.5px; color:var(--st-text3);
  flex-wrap:wrap; gap:8px; flex-shrink:0; background:var(--st-bg);
}
.st-page-btns{ display:flex; gap:3px; flex-wrap:wrap; }
.st-page-btn{
  min-width:28px; height:28px; border-radius:7px; border:1px solid var(--st-border);
  background:none; color:var(--st-text3); cursor:pointer; display:flex; align-items:center;
  justify-content:center; font-size:11.5px; padding:0 7px; transition:all .15s;
}
.st-page-btn:hover{ border-color:var(--st-gold-border); color:var(--st-gold); }
.st-page-btn.st-on{ background:var(--st-gold-dim); border-color:var(--st-gold-border); color:var(--st-gold); font-weight:700; }
.st-page-btn:disabled{ opacity:.35; cursor:default; pointer-events:none; }

@media (max-width:880px){
  .st-tbl-wrap{ overflow-x:visible; }
  .st-table{ min-width:0; width:100%; }
  .st-table thead{ display:none; }
  .st-table, .st-table tbody, .st-table tr, .st-table td{ display:block; width:100%; }
  .st-table tbody tr{
    background:var(--st-bg2); border:1px solid var(--st-border); border-radius:12px;
    margin:0 0 10px; padding:6px 14px;
  }
  .st-table tbody tr:last-child{ margin-bottom:0; }
  .st-table tbody td{
    border:none; padding:8px 0; white-space:normal !important;
    display:flex; align-items:flex-start; justify-content:space-between; gap:10px; text-align:right;
  }
  .st-table tbody td:not(:last-child){ border-bottom:1px dashed var(--st-border); }
  .st-table tbody td::before{
    content:attr(data-label); font-size:9px; text-transform:uppercase; letter-spacing:1px;
    color:var(--st-text3); font-weight:700; flex-shrink:0; text-align:left; padding-top:1px;
  }
  .st-table tbody td.st-items{ max-width:none; text-align:right; white-space:normal; }
  .st-table tbody td .st-acts{ justify-content:flex-end; flex-wrap:wrap; }
  .st-table .st-empty{ display:block; }
  .st-table .st-empty td{ display:block; text-align:center; }
  .st-table .st-empty td::before{ content:none; }
}
@media (max-width:420px){
  .st-table tbody tr{ padding:4px 10px; }
  .st-table tbody td{ font-size:12px; flex-direction:column; align-items:flex-start; gap:2px; text-align:left; }
  .st-table tbody td::before{ padding-top:0; }
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
    try {
      return '₦' + x.toLocaleString('en-NG', { maximumFractionDigits: 0 });
    } catch (e) {
      return '₦' + Math.round(x);
    }
  }

  function itemsSummary(s) {
    const items = s.items || [];
    if (!items.length) return '—';
    // Match original report/sales: first line item + "+N more" for the rest
    const first = items[0];
    const label = esc(first.name || '') + ' ×' + esc(String(first.qty || 0));
    const rest = items.length - 1;
    if (rest <= 0) return label;
    return label + ' <span class="st-more">+' + rest + ' more</span>';
  }

  function statusLabel(st) {
    if (st === 'completed') return 'Completed';
    if (st === 'voided') return 'Voided';
    return st || '—';
  }

  function create(options) {
    options = options || {};
    injectCSS();

    const pageSize = options.pageSize || 8;
    const showSummary = options.showSummary !== false;
    const showActions = !!options.showActions;
    const showSource = !!options.showSource;
    let canVoid = !!options.canVoid;
    const emptyText = options.emptyText || 'No sales match your filters.';
    let panelTitle = options.title || 'Sales';
    const fmt = typeof options.formatMoney === 'function' ? options.formatMoney : defaultMoney;
    const sortable = options.sortable !== false;

    let rows = [];
    let page = 1;
    let sortKey = options.sortKey || 'date';
    let sortDir = options.sortDir || 'desc';
    let root = null;
    let host = null;

    const COLS = options.columns || null; // advanced override later

    function resolveTarget(t) {
      if (!t) return null;
      if (typeof t === 'string') return document.querySelector(t);
      return t;
    }

    function mount(target) {
      host = resolveTarget(target);
      if (!host) throw new Error('SalesTable: target not found');
      root = document.createElement('div');
      root.className = 'st-panel';
      root.innerHTML =
        '<div class="st-head">' +
          '<div class="st-title" data-st="title">' + esc(panelTitle) + '</div>' +
          '<span class="st-count" data-st="count">—</span>' +
        '</div>' +
        '<div class="st-tbl-wrap">' +
          '<table class="st-table">' +
            '<thead><tr data-st="thead"></tr></thead>' +
            '<tbody data-st="body"></tbody>' +
          '</table>' +
        '</div>' +
        (showSummary
          ? '<div class="st-summary" data-st="summary">' +
              '<div class="st-sb"><div class="st-sb-lbl">Sales</div><div class="st-sb-val" data-st="sbCount">0</div></div>' +
              '<div class="st-sb"><div class="st-sb-lbl">Gross</div><div class="st-sb-val" data-st="sbGross">₦0</div></div>' +
              '<div class="st-sb"><div class="st-sb-lbl">Discounts</div><div class="st-sb-val" data-st="sbDisc">₦0</div></div>' +
              '<div class="st-sb"><div class="st-sb-lbl">Net Revenue</div><div class="st-sb-val" data-st="sbNet">₦0</div></div>' +
            '</div>'
          : '') +
        '<div class="st-pagin">' +
          '<span data-st="paginLabel">—</span>' +
          '<div class="st-page-btns" data-st="pageBtns"></div>' +
        '</div>';
      host.innerHTML = '';
      host.appendChild(root);
      renderHead();
      bindHeadSort();
      render();
    }

    function $(sel) { return root ? root.querySelector(sel) : null; }

    function renderHead() {
      const tr = $('[data-st="thead"]');
      if (!tr) return;
      const cells = [];
      cells.push('<th>Sale No.</th>');
      cells.push('<th>Items</th>');
      cells.push(
        sortable
          ? '<th class="st-sortable" data-sortkey="total">Total (₦) <span class="st-arrow" data-st="arrow-total"></span></th>'
          : '<th>Total (₦)</th>'
      );
      cells.push('<th>Payment</th>');
      if (showSource) cells.push('<th>Source</th>');
      cells.push('<th>Staff</th>');
      cells.push('<th>Location</th>');
      cells.push(
        sortable
          ? '<th class="st-sortable" data-sortkey="date">Date &amp; Time <span class="st-arrow" data-st="arrow-date"></span></th>'
          : '<th>Date &amp; Time</th>'
      );
      cells.push('<th class="st-center">Status</th>');
      if (showActions) cells.push('<th class="st-center">Actions</th>');
      tr.innerHTML = cells.join('');
    }

    function bindHeadSort() {
      if (!sortable || !root) return;
      root.addEventListener('click', function (e) {
        const th = e.target.closest('th[data-sortkey]');
        if (!th || !root.contains(th)) return;
        const key = th.dataset.sortkey;
        if (key !== 'total' && key !== 'date') return;
        if (sortKey === key) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
        else { sortKey = key; sortDir = 'desc'; }
        page = 1;
        render();
      });
    }

    function parseDate(str) {
      if (!str) return 0;
      // DD/MM/YY HH:MM or ISO-ish
      const m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (m) {
        const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
        const t = String(str).match(/(\d{1,2}):(\d{2})/);
        return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10),
          t ? parseInt(t[1], 10) : 0, t ? parseInt(t[2], 10) : 0).getTime();
      }
      const d = Date.parse(str);
      return isNaN(d) ? 0 : d;
    }

    function sortedRows() {
      const list = rows.slice();
      list.sort(function (a, b) {
        let cmp = 0;
        if (sortKey === 'total') cmp = (Number(a.total) || 0) - (Number(b.total) || 0);
        else cmp = parseDate(a.date) - parseDate(b.date);
        return sortDir === 'desc' ? -cmp : cmp;
      });
      return list;
    }

    function renderArrows() {
      const aT = $('[data-st="arrow-total"]');
      const aD = $('[data-st="arrow-date"]');
      if (aT) aT.textContent = sortKey === 'total' ? (sortDir === 'desc' ? '▼' : '▲') : '';
      if (aD) aD.textContent = sortKey === 'date' ? (sortDir === 'desc' ? '▼' : '▲') : '';
    }

    function renderSummary(list) {
      const bar = $('[data-st="summary"]');
      if (!bar) return;
      if (!list.length) {
        bar.style.display = 'none';
        return;
      }
      bar.style.display = 'grid';
      const completed = list.filter(function (s) { return s.status === 'completed'; });
      const gross = completed.reduce(function (n, s) { return n + (Number(s.subtotal) || 0); }, 0);
      const disc = completed.reduce(function (n, s) {
        return n + (Number(s.subtotal) || 0) * (Number(s.discount) || 0) / 100;
      }, 0);
      const net = completed.reduce(function (n, s) { return n + (Number(s.total) || 0); }, 0);
      $('[data-st="sbCount"]').textContent = String(list.length);
      $('[data-st="sbGross"]').textContent = fmt(gross);
      $('[data-st="sbDisc"]').textContent = fmt(disc);
      $('[data-st="sbNet"]').textContent = fmt(net);
    }

    function renderPagination(total) {
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      if (page > totalPages) page = totalPages;
      const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
      const to = Math.min(page * pageSize, total);
      $('[data-st="paginLabel"]').textContent =
        total === 0 ? 'No records' : from + '–' + to + ' of ' + total;

      const wrap = $('[data-st="pageBtns"]');
      wrap.innerHTML = '';
      function mk(label, p, disabled, active) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'st-page-btn' + (active ? ' st-on' : '');
        b.innerHTML = label;
        b.disabled = !!disabled;
        b.addEventListener('click', function () { page = p; renderBody(); });
        return b;
      }
      wrap.appendChild(mk('<i class="fa-solid fa-chevron-left"></i>', page - 1, page === 1, false));
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, start + 4);
      start = Math.max(1, end - 4);
      for (let i = start; i <= end; i++) wrap.appendChild(mk(String(i), i, false, i === page));
      wrap.appendChild(mk('<i class="fa-solid fa-chevron-right"></i>', page + 1, page >= totalPages, false));
    }

    function colCount() {
      // id items total payment [source] staff location date status [actions]
      return 7 + (showSource ? 1 : 0) + (showActions ? 1 : 0) + 1; // +1 status already in 7? 
      // Sale, Items, Total, Payment, Staff, Location, Date, Status = 8
      // + source + actions
    }

    function colspan() {
      let n = 8; // base without source/actions
      if (showSource) n += 1;
      if (showActions) n += 1;
      return n;
    }

    function renderBody() {
      const list = sortedRows();
      $('[data-st="count"]').textContent =
        list.length + ' record' + (list.length !== 1 ? 's' : '');
      renderArrows();
      renderSummary(list);

      const start = (page - 1) * pageSize;
      const pageRows = list.slice(start, start + pageSize);
      const body = $('[data-st="body"]');

      if (!pageRows.length) {
        body.innerHTML = '<tr class="st-empty"><td colspan="' + colspan() + '">' + esc(emptyText) + '</td></tr>';
        renderPagination(0);
        return;
      }

      body.innerHTML = pageRows.map(function (s) {
        const id = s.id || '';
        const src = (s.source === 'tab') ? 'Tab' : 'Quick';
        const clickable = typeof options.onRowClick === 'function' || typeof options.onView === 'function';
        let html = '<tr class="' + (clickable ? 'st-clickable' : '') + '" data-id="' + esc(id) + '">';
        html += '<td class="st-nowrap" data-label="Sale No." style="font-weight:700">' + esc(id) + '</td>';
        html += '<td class="st-items" data-label="Items">' + itemsSummary(s) + '</td>';
        html += '<td class="st-nowrap" data-label="Total" style="font-weight:700;color:var(--st-gold)">' + esc(fmt(s.total)) + '</td>';
        html += '<td class="st-nowrap" data-label="Payment"><span class="st-chip st-chip-pay"><i class="fa-solid fa-circle"></i>' + esc(s.method || '—') + '</span></td>';
        if (showSource) {
          html += '<td class="st-nowrap" data-label="Source"><span class="st-chip st-chip-source">' + esc(src) + '</span></td>';
        }
        html += '<td class="st-nowrap" data-label="Staff">' + esc(s.staff || '—') + '</td>';
        html += '<td class="st-nowrap" data-label="Location">' + esc(s.table || '—') + '</td>';
        html += '<td class="st-nowrap" data-label="Date &amp; Time">' + esc(s.date || '—') + '</td>';
        html += '<td class="st-center st-nowrap" data-label="Status"><span class="st-chip st-chip-' + esc(s.status || '') + '"><i class="fa-solid fa-circle"></i>' + esc(statusLabel(s.status)) + '</span></td>';
        if (showActions) {
          html += '<td class="st-nowrap" data-label="Actions" data-st-stop="1"><div class="st-acts">';
          html += '<button type="button" class="st-act" data-st-view="' + esc(id) + '"><i class="fa-solid fa-eye"></i> View</button>';
          if (canVoid && s.status === 'completed') {
            html += '<button type="button" class="st-act st-act-void" data-st-void="' + esc(id) + '"><i class="fa-solid fa-ban"></i> Void</button>';
          }
          html += '</div></td>';
        }
        html += '</tr>';
        return html;
      }).join('');

      // row click
      body.querySelectorAll('tr[data-id]').forEach(function (tr) {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('[data-st-stop]')) return;
          const sale = findRow(tr.dataset.id);
          if (!sale) return;
          if (typeof options.onRowClick === 'function') options.onRowClick(sale);
          else if (typeof options.onView === 'function') options.onView(sale);
        });
      });
      body.querySelectorAll('[data-st-view]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const sale = findRow(btn.getAttribute('data-st-view'));
          if (!sale) return;
          if (typeof options.onView === 'function') options.onView(sale);
          else if (typeof options.onRowClick === 'function') options.onRowClick(sale);
        });
      });
      body.querySelectorAll('[data-st-void]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const sale = findRow(btn.getAttribute('data-st-void'));
          if (sale && typeof options.onVoid === 'function') options.onVoid(sale);
        });
      });

      renderPagination(list.length);
    }

    function findRow(id) {
      return rows.find(function (r) { return r.id === id; }) || null;
    }

    function render() {
      if (!root) return;
      renderBody();
    }

    // ── Public API ──
    const api = {
      setRows: function (list) {
        rows = Array.isArray(list) ? list.slice() : [];
        page = 1;
        render();
      },
      getRows: function () { return rows.slice(); },
      setPage: function (p) {
        page = Math.max(1, parseInt(p, 10) || 1);
        renderBody();
      },
      setTitle: function (t) {
        panelTitle = t || panelTitle;
        const el = $('[data-st="title"]');
        if (el) el.textContent = panelTitle;
      },
      setCountLabel: function (t) {
        const el = $('[data-st="count"]');
        if (el) el.textContent = t;
      },
      setCanVoid: function (v) {
        canVoid = !!v;
        renderBody();
      },
      setSort: function (key, dir) {
        if (key) sortKey = key;
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
        root = null;
        host = null;
        rows = [];
      },
    };

    if (options.target) mount(options.target);
    return api;
  }

  global.SalesTable = { create: create };
})(window);
