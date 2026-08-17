/**
 * component/inventory-table.js — Shared stock / inventory data table
 * ─────────────────────────────────────────────────────────────────────
 * Used by Pool Bar Stock and Restaurant Inventory (and Kitchen later).
 * Host supplies filtered rows + action handlers. Self-contained CSS (it- prefix).
 *
 *   <script src="component/inventory-table.js"></script>
 *
 *   const table = InventoryTable.create({
 *     target: '#tableSlot',
 *     pageSize: 8,
 *     title: 'Pool Bar Stock',
 *     emptyText: 'No stock items match your filters.',
 *     // Actions
 *     showActions: true,
 *     showDeduct: true,   // Pool Bar: deduct stock
 *     showEdit: true,
 *     showDelete: true,
 *     // Behaviour
 *     rowClickable: true,
 *     onRowClick: (item) => {},
 *     onDeduct: (item) => {},
 *     onEdit: (item) => {},
 *     onDelete: (item) => {},
 *     formatMoney: (n) => '₦' + n,
 *     // Optional: custom level fn  item => 'ok'|'low'|'out'
 *     stockLevel: null,
 *   });
 *
 *   table.setRows(filteredArray);
 *   table.setTitle('…');
 *   table.setPage(1);
 *   table.destroy();
 */
(function (global) {
  'use strict';

  const CSS_ID = 'inventory-table-css';

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = `
.it-panel{
  --it-bg:var(--surface,#fff); --it-bg2:var(--surface2,#f4f6fb); --it-bg3:var(--surface3,#eef0f6);
  --it-border:var(--border,#eef0f6); --it-border2:var(--border2,#dfe3ec);
  --it-text:var(--text,#1c2440); --it-text2:var(--text2,#6b7280); --it-text3:var(--text3,#9aa1b3);
  --it-gold:var(--gold,#2f6fed); --it-gold-dim:var(--gold-dim,rgba(47,111,237,.1)); --it-gold-border:var(--gold-border,rgba(47,111,237,.25));
  --it-green:var(--green,#12b76a); --it-green-bg:var(--green-bg,#e9f9f0);
  --it-red:var(--red,#f04438); --it-red-bg:var(--red-bg,#feecec);
  --it-amber:var(--amber,#f79009); --it-amber-bg:var(--amber-bg,#fff4e5);
  --it-shadow:var(--shadow,0 4px 20px rgba(15,34,55,.07));
  background:var(--it-bg); border:1px solid var(--it-border); border-radius:14px;
  box-shadow:var(--it-shadow); overflow:hidden; min-width:0; flex-shrink:0;
  display:flex; flex-direction:column; color:var(--it-text); font-size:13px;
  font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
}
.it-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 20px 14px; border-bottom:1px solid var(--it-border); flex-wrap:wrap; gap:8px; flex-shrink:0; }
.it-title{ font-size:13px; font-weight:800; color:var(--it-text); }
.it-count{ font-size:11.5px; color:var(--it-text3); font-weight:600; }

.it-tbl-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
.it-table{ width:100%; border-collapse:collapse; font-size:12.5px; min-width:920px; }
.it-table thead th{
  text-align:left; padding:10px 14px; font-size:9px; text-transform:uppercase; letter-spacing:1.5px;
  color:var(--it-text3); font-weight:700; background:var(--it-bg2); border-bottom:1px solid var(--it-border);
  white-space:nowrap;
}
.it-table thead th.it-center{ text-align:center; }
.it-table tbody tr{ border-bottom:1px solid var(--it-border); transition:background .15s; }
.it-table tbody tr:last-child{ border-bottom:none; }
.it-table tbody tr.it-clickable{ cursor:pointer; }
.it-table tbody tr.it-clickable:hover{ background:var(--it-bg2); }
.it-table tbody td{ padding:11px 14px; color:var(--it-text); vertical-align:middle; white-space:nowrap; }
.it-table tbody td.it-center{ text-align:center; }
.it-table .it-empty td{ text-align:center; padding:32px; color:var(--it-text3); white-space:normal; cursor:default; }

.it-name{ font-weight:600; }
.it-badge{ display:inline-flex; align-items:center; gap:6px; }
.it-dot{ width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.it-cat{ font-size:9px; padding:1px 7px; border-radius:20px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; background:var(--it-gold-dim); color:var(--it-gold); }

.it-chip{ display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:20px; font-size:9.5px; font-weight:700; white-space:nowrap; }
.it-chip i{ font-size:6px; }
.it-chip-ok{ background:var(--it-green-bg); color:var(--it-green); }
.it-chip-low{ background:var(--it-amber-bg); color:var(--it-amber); }
.it-chip-out{ background:var(--it-red-bg); color:var(--it-red); }

.it-acts{ display:flex; gap:5px; flex-wrap:nowrap; }
.it-act{
  background:none; border:1px solid var(--it-border); border-radius:7px; padding:5px 10px;
  font-size:11px; font-weight:600; color:var(--it-text2); cursor:pointer; transition:all .15s;
  white-space:nowrap; display:inline-flex; align-items:center; gap:5px; font-family:inherit;
}
.it-act:hover{ border-color:var(--it-gold-border); color:var(--it-gold); }
.it-act-danger:hover{ border-color:var(--it-red); color:var(--it-red); }

.it-pagin{
  display:flex; align-items:center; justify-content:space-between; padding:12px 18px;
  border-top:1px solid var(--it-border); font-size:11.5px; color:var(--it-text3);
  flex-wrap:wrap; gap:8px; flex-shrink:0; background:var(--it-bg);
}
.it-page-btns{ display:flex; gap:3px; flex-wrap:wrap; }
.it-page-btn{
  min-width:28px; height:28px; border-radius:7px; border:1px solid var(--it-border);
  background:none; color:var(--it-text3); cursor:pointer; display:flex; align-items:center;
  justify-content:center; font-size:11.5px; padding:0 7px; transition:all .15s; font-family:inherit;
}
.it-page-btn:hover{ border-color:var(--it-gold-border); color:var(--it-gold); }
.it-page-btn.it-on{ background:var(--it-gold-dim); border-color:var(--it-gold-border); color:var(--it-gold); font-weight:700; }
.it-page-btn:disabled{ opacity:.35; cursor:default; pointer-events:none; }

@media (max-width:960px){
  .it-tbl-wrap{ overflow-x:visible; }
  .it-table{ min-width:0; width:100%; }
  .it-table thead{ display:none; }
  .it-table, .it-table tbody, .it-table tr, .it-table td{ display:block; width:100%; }
  .it-table tbody tr{
    background:var(--it-bg2); border:1px solid var(--it-border); border-radius:12px;
    margin:0 0 10px; padding:6px 14px;
  }
  .it-table tbody tr:last-child{ margin-bottom:0; }
  .it-table tbody td{
    border:none; padding:8px 0; white-space:normal !important;
    display:flex; align-items:flex-start; justify-content:space-between; gap:10px; text-align:right;
  }
  .it-table tbody td:not(:last-child){ border-bottom:1px dashed var(--it-border); }
  .it-table tbody td::before{
    content:attr(data-label); font-size:9px; text-transform:uppercase; letter-spacing:1px;
    color:var(--it-text3); font-weight:700; flex-shrink:0; text-align:left; padding-top:1px;
  }
  .it-table tbody td .it-acts{ justify-content:flex-end; flex-wrap:wrap; }
  .it-table .it-empty{ display:block; }
  .it-table .it-empty td{ display:block; text-align:center; }
  .it-table .it-empty td::before{ content:none; }
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

  function defaultLevel(i) {
    const qty = Number(i.qty) || 0;
    const min = Number(i.min) || 0;
    if (qty <= 0) return 'out';
    if (qty <= min) return 'low';
    return 'ok';
  }

  const LEVEL_LABEL = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };
  const LEVEL_CHIP = { ok: 'it-chip-ok', low: 'it-chip-low', out: 'it-chip-out' };
  const LEVEL_DOT = { ok: 'var(--it-green,#12b76a)', low: 'var(--it-amber,#f79009)', out: 'var(--it-red,#f04438)' };

  function itemKey(i) {
    return i.name || i.meal || i.id || '';
  }

  function create(options) {
    options = options || {};
    injectCSS();

    const pageSize = options.pageSize || 8;
    const showActions = options.showActions !== false;
    const showDeduct = !!options.showDeduct;
    const showEdit = options.showEdit !== false;
    const showDelete = options.showDelete !== false;
    const rowClickable = options.rowClickable !== false;
    const emptyText = options.emptyText || 'No items match your filters.';
    let panelTitle = options.title || 'Inventory';
    const fmt = typeof options.formatMoney === 'function' ? options.formatMoney : defaultMoney;
    const levelFn = typeof options.stockLevel === 'function' ? options.stockLevel : defaultLevel;

    let rows = [];
    let page = 1;
    let root = null;
    let host = null;

    function resolveTarget(t) {
      if (!t) return null;
      if (typeof t === 'string') return document.querySelector(t);
      return t;
    }

    function mount(target) {
      host = resolveTarget(target);
      if (!host) throw new Error('InventoryTable: target not found');
      root = document.createElement('div');
      root.className = 'it-panel';
      root.innerHTML =
        '<div class="it-head">' +
          '<div class="it-title" data-it="title">' + esc(panelTitle) + '</div>' +
          '<span class="it-count" data-it="count">—</span>' +
        '</div>' +
        '<div class="it-tbl-wrap">' +
          '<table class="it-table">' +
            '<thead><tr data-it="thead"></tr></thead>' +
            '<tbody data-it="body"></tbody>' +
          '</table>' +
        '</div>' +
        '<div class="it-pagin">' +
          '<span data-it="paginLabel">—</span>' +
          '<div class="it-page-btns" data-it="pageBtns"></div>' +
        '</div>';
      host.innerHTML = '';
      host.appendChild(root);
      renderHead();
      render();
    }

    function $(sel) { return root ? root.querySelector(sel) : null; }

    function colspan() {
      // Item Category Unit OnHand Min Price Batch Received Status [Actions]
      return 9 + (showActions ? 1 : 0);
    }

    function renderHead() {
      const tr = $('[data-it="thead"]');
      if (!tr) return;
      let html =
        '<th>Item</th>' +
        '<th class="it-center">Category</th>' +
        '<th class="it-center">Unit</th>' +
        '<th class="it-center">On Hand</th>' +
        '<th class="it-center">Reorder Level</th>' +
        '<th class="it-center">Price (₦)</th>' +
        '<th>Batch</th>' +
        '<th>Last Received</th>' +
        '<th class="it-center">Status</th>';
      if (showActions) html += '<th class="it-center no-print">Actions</th>';
      tr.innerHTML = html;
    }

    function renderPagination(total) {
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      if (page > totalPages) page = totalPages;
      const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
      const to = Math.min(page * pageSize, total);
      $('[data-it="paginLabel"]').textContent =
        total === 0 ? 'No records' : from + '–' + to + ' of ' + total;

      const wrap = $('[data-it="pageBtns"]');
      wrap.innerHTML = '';
      function mk(label, p, disabled, active) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'it-page-btn' + (active ? ' it-on' : '');
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

    function findRow(key) {
      return rows.find(function (r) { return itemKey(r) === key; }) || null;
    }

    function renderBody() {
      const list = rows;
      $('[data-it="count"]').textContent =
        list.length + ' item' + (list.length !== 1 ? 's' : '');

      const start = (page - 1) * pageSize;
      const pageRows = list.slice(start, start + pageSize);
      const body = $('[data-it="body"]');

      if (!pageRows.length) {
        body.innerHTML = '<tr class="it-empty"><td colspan="' + colspan() + '">' + esc(emptyText) + '</td></tr>';
        renderPagination(0);
        return;
      }

      body.innerHTML = pageRows.map(function (i) {
        const key = itemKey(i);
        const lvl = levelFn(i);
        const qty = Number(i.qty) || 0;
        const qtyColor = lvl === 'out' ? 'var(--it-red,#f04438)' : (lvl === 'low' ? 'var(--it-amber,#f79009)' : 'var(--it-text,#1c2440)');
        const clickable = rowClickable && typeof options.onRowClick === 'function';

        let html = '<tr class="' + (clickable ? 'it-clickable' : '') + '" data-key="' + esc(key) + '">';
        html += '<td class="it-name" data-label="Item"><span class="it-badge">' +
          '<span class="it-dot" style="background:' + LEVEL_DOT[lvl] + '"></span>' +
          esc(key) + '</span></td>';
        html += '<td class="it-center" data-label="Category"><span class="it-cat">' + esc(i.category || '—') + '</span></td>';
        html += '<td class="it-center" data-label="Unit">' + esc(i.unit || '—') + '</td>';
        html += '<td class="it-center" data-label="On Hand" style="font-weight:700;color:' + qtyColor + '">' + qty + '</td>';
        html += '<td class="it-center" data-label="Reorder Level">' + (Number(i.min) || 0) + '</td>';
        html += '<td class="it-center" data-label="Price" style="color:var(--it-gold,#2f6fed);font-weight:700">' + esc(fmt(i.price)) + '</td>';
        html += '<td data-label="Batch">' + esc(i.batch || '—') + '</td>';
        html += '<td data-label="Last Received">' + esc(i.received || '—') + '</td>';
        html += '<td class="it-center" data-label="Status"><span class="it-chip ' + LEVEL_CHIP[lvl] + '"><i class="fa-solid fa-circle"></i>' +
          esc(LEVEL_LABEL[lvl]) + '</span></td>';

        if (showActions) {
          html += '<td class="it-center no-print" data-label="Actions" data-it-stop="1"><div class="it-acts">';
          if (showDeduct) {
            html += '<button type="button" class="it-act" data-it-deduct="' + esc(key) + '"><i class="fa-solid fa-minus"></i> Deduct</button>';
          }
          if (showEdit) {
            html += '<button type="button" class="it-act" data-it-edit="' + esc(key) + '"><i class="fa-solid fa-pen"></i>' +
              (showDeduct ? '' : ' Edit') + '</button>';
          }
          if (showDelete) {
            html += '<button type="button" class="it-act it-act-danger" data-it-delete="' + esc(key) + '"><i class="fa-solid fa-trash"></i></button>';
          }
          html += '</div></td>';
        }
        html += '</tr>';
        return html;
      }).join('');

      body.querySelectorAll('tr[data-key]').forEach(function (tr) {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('[data-it-stop]')) return;
          if (!clickable) return;
          const item = findRow(tr.dataset.key);
          if (item && typeof options.onRowClick === 'function') options.onRowClick(item);
        });
      });
      body.querySelectorAll('[data-it-deduct]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const item = findRow(btn.getAttribute('data-it-deduct'));
          if (item && typeof options.onDeduct === 'function') options.onDeduct(item);
        });
      });
      body.querySelectorAll('[data-it-edit]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const item = findRow(btn.getAttribute('data-it-edit'));
          if (item && typeof options.onEdit === 'function') options.onEdit(item);
        });
      });
      body.querySelectorAll('[data-it-delete]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const item = findRow(btn.getAttribute('data-it-delete'));
          if (item && typeof options.onDelete === 'function') options.onDelete(item);
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
      setPage: function (p) {
        page = Math.max(1, parseInt(p, 10) || 1);
        renderBody();
      },
      setTitle: function (t) {
        panelTitle = t || panelTitle;
        const el = $('[data-it="title"]');
        if (el) el.textContent = panelTitle;
      },
      setCountLabel: function (t) {
        const el = $('[data-it="count"]');
        if (el) el.textContent = t;
      },
      getState: function () {
        return { page: page, rows: rows.slice() };
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

  global.InventoryTable = { create: create };
})(window);
