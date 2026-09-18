;(function () {
  'use strict';

  const CFG = (window.CONFIG && window.CONFIG.API_BASE) ? window.CONFIG.API_BASE : '';
  const fmt = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  let state = { rows: [], kpis: {}, page: 1, pages: 1, total: 0 };
  let filters = { period: 'all', roomType: '', payment: '' };

  async function fetchData() {
    const params = new URLSearchParams();
    params.set('page', state.page);
    params.set('limit', '20');
    if (filters.period !== 'all') params.set('period', filters.period);
    if (filters.roomType) params.set('roomType', filters.roomType);
    if (filters.payment) params.set('payment', filters.payment);
    const res = await fetch(CFG + '/api/booking/room-income?' + params.toString(), { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load');
    const j = await res.json();
    return j.data || { rows: [], kpis: {}, page: 1, pages: 1, total: 0 };
  }

  function renderKPIs(k) {
    return '<div class="ri-kpi-row">' +
      '<div class="ri-kpi ri-kpi-gold"><div class="ri-kpi-ic"><i class="fa-solid fa-sack-dollar"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Total Revenue</div><div class="ri-kpi-val">' + fmt(k.totalRevenue) + '</div></div></div>' +
      '<div class="ri-kpi ri-kpi-green"><div class="ri-kpi-ic"><i class="fa-solid fa-circle-check"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Collected</div><div class="ri-kpi-val">' + fmt(k.totalCollected) + '</div></div></div>' +
      '<div class="ri-kpi ri-kpi-red"><div class="ri-kpi-ic"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Outstanding</div><div class="ri-kpi-val">' + fmt(k.totalBalance) + '</div></div></div>' +
      '<div class="ri-kpi ri-kpi-purple"><div class="ri-kpi-ic"><i class="fa-solid fa-moon"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Room Nights</div><div class="ri-kpi-val">' + (k.totalNights || 0) + '</div></div></div>' +
      '<div class="ri-kpi ri-kpi-teal"><div class="ri-kpi-ic"><i class="fa-solid fa-chart-line"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Avg Rate/Night</div><div class="ri-kpi-val">' + fmt(k.avgRate) + '</div></div></div>' +
    '</div>';
  }

  function renderFilters() {
    return '<div class="ri-filters">' +
      '<div class="ri-fg"><span class="ri-fl">Period</span><div class="ri-pills" id="riPeriodPills">' +
        '<button class="ri-pill' + (filters.period === 'all' ? ' active' : '') + '" data-p="all">All Time</button>' +
        '<button class="ri-pill' + (filters.period === 'today' ? ' active' : '') + '" data-p="today">Today</button>' +
        '<button class="ri-pill' + (filters.period === '7d' ? ' active' : '') + '" data-p="7d">7 Days</button>' +
        '<button class="ri-pill' + (filters.period === '30d' ? ' active' : '') + '" data-p="30d">30 Days</button>' +
      '</div></div>' +
      '<div class="ri-fg"><span class="ri-fl">Room Type</span><select class="ri-select" id="riRoomType">' +
        '<option value="">All Types</option>' +
        '<option value="Standard"' + (filters.roomType === 'Standard' ? ' selected' : '') + '>Standard</option>' +
        '<option value="Deluxe"' + (filters.roomType === 'Deluxe' ? ' selected' : '') + '>Deluxe</option>' +
        '<option value="Suite"' + (filters.roomType === 'Suite' ? ' selected' : '') + '>Suite</option>' +
        '<option value="Conference"' + (filters.roomType === 'Conference' ? ' selected' : '') + '>Conference</option>' +
      '</select></div>' +
      '<div class="ri-fg"><span class="ri-fl">Payment</span><select class="ri-select" id="riPayment">' +
        '<option value="">All</option>' +
        '<option value="paid"' + (filters.payment === 'paid' ? ' selected' : '') + '>Fully Paid</option>' +
        '<option value="unpaid"' + (filters.payment === 'unpaid' ? ' selected' : '') + '>Outstanding</option>' +
      '</select></div>' +
      '<div class="ri-fg ri-fg-print"><span class="ri-fl">&nbsp;</span><button class="ri-print-btn" id="riPrintBtn"><i class="fa-solid fa-print"></i> Print Receipt</button></div>' +
    '</div>';
  }

  function renderTable(rows) {
    if (!rows.length) return '<div class="ri-empty"><i class="fa-solid fa-bed"></i><div>No room income data found.</div></div>';
    var html = '<div class="ri-table-wrap"><table class="ri-table"><thead><tr>' +
      '<th>Room</th><th>Guest</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Rate/Night</th><th>Total</th><th>Collected</th><th>Balance</th><th>Status</th>' +
    '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var statusCls = r.status === 'checkout' ? 'ri-st-checkout' : r.status === 'checkedin' ? 'ri-st-checkedin' : r.status === 'reserved' ? 'ri-st-reserved' : 'ri-st-other';
      html += '<tr>' +
        '<td><strong>' + esc(r.room) + '</strong> · ' + esc(r.type) + '</td>' +
        '<td>' + esc(r.guest) + '</td>' +
        '<td>' + esc(r.checkin) + '</td>' +
        '<td>' + esc(r.checkout) + '</td>' +
        '<td>' + r.nights + '</td>' +
        '<td>' + fmt(r.rate) + '</td>' +
        '<td class="ri-bold">' + fmt(r.total) + '</td>' +
        '<td class="ri-green">' + fmt(r.collected) + '</td>' +
        '<td class="' + (r.balance > 0 ? 'ri-red' : 'ri-green') + '">' + (r.balance > 0 ? fmt(r.balance) : 'Settled') + '</td>' +
        '<td><span class="ri-status ' + statusCls + '">' + esc(r.status || '—') + '</span></td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderPagination() {
    if (state.pages <= 1) return '';
    var html = '<div class="ri-pagination">';
    html += '<button class="ri-page-btn" data-page="1" ' + (state.page <= 1 ? 'disabled' : '') + '><i class="fa-solid fa-angles-left"></i></button>';
    html += '<button class="ri-page-btn" data-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? 'disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>';
    var start = Math.max(1, state.page - 2);
    var end = Math.min(state.pages, state.page + 2);
    for (var i = start; i <= end; i++) {
      html += '<button class="ri-page-btn' + (i === state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="ri-page-btn" data-page="' + (state.page + 1) + '" ' + (state.page >= state.pages ? 'disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>';
    html += '<button class="ri-page-btn" data-page="' + state.pages + '" ' + (state.page >= state.pages ? 'disabled' : '') + '><i class="fa-solid fa-angles-right"></i></button>';
    html += '<span class="ri-page-info">Page ' + state.page + ' of ' + state.pages + ' (' + state.total + ' records)</span>';
    html += '</div>';
    return html;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  async function render(container) {
    container.innerHTML = '<div class="ri-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading room income…</div>';
    try {
      state.page = 1;
      var data = await fetchData();
      state.rows = data.rows || [];
      state.kpis = data.kpis || {};
      state.page = data.page || 1;
      state.pages = data.pages || 1;
      state.total = data.total || 0;
      paint(container);
      bindEvents(container);
    } catch (e) {
      container.innerHTML = '<div class="ri-empty"><i class="fa-solid fa-triangle-exclamation"></i><div>Failed to load room income.</div></div>';
      console.error('[RoomIncome]', e);
    }
  }

  function paint(c) {
    c.innerHTML = renderKPIs(state.kpis) + renderFilters() + renderTable(state.rows) + renderPagination();
  }

  async function goPage(container, pg) {
    state.page = pg;
    container.innerHTML = '<div class="ri-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</div>';
    try {
      var data = await fetchData();
      state.rows = data.rows || [];
      state.kpis = data.kpis || {};
      state.page = data.page || 1;
      state.pages = data.pages || 1;
      state.total = data.total || 0;
      paint(container);
      bindEvents(container);
    } catch (e) {
      container.innerHTML = '<div class="ri-empty"><i class="fa-solid fa-triangle-exclamation"></i><div>Failed to load.</div></div>';
    }
  }

  function bindEvents(c) {
    c.querySelectorAll('#riPeriodPills .ri-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filters.period = btn.dataset.p;
        render(c);
      });
    });
    var rtSel = c.querySelector('#riRoomType');
    if (rtSel) rtSel.addEventListener('change', function () { filters.roomType = rtSel.value; render(c); });
    var pySel = c.querySelector('#riPayment');
    if (pySel) pySel.addEventListener('change', function () { filters.payment = pySel.value; render(c); });
    c.querySelectorAll('.ri-page-btn[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pg = parseInt(btn.dataset.page, 10);
        if (pg >= 1 && pg <= state.pages) goPage(c, pg);
      });
    });
    var printBtn = c.querySelector('#riPrintBtn');
    if (printBtn) printBtn.addEventListener('click', function () { printReceipt(); });
  }

  function printReceipt() {
    var k = state.kpis || {};
    var rows = state.rows || [];
    var filterLabel = filters.period === 'all' ? 'All Time' : filters.period === 'today' ? 'Today' : filters.period === '7d' ? 'Last 7 Days' : filters.period === '30d' ? 'Last 30 Days' : filters.period;
    if (filters.roomType) filterLabel += ' · ' + filters.roomType;
    if (filters.payment) filterLabel += ' · ' + (filters.payment === 'paid' ? 'Fully Paid' : 'Outstanding');
    var now = new Date();
    var dateStr = now.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
    var timeStr = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

    var tableRows = '';
    rows.forEach(function (r, i) {
      tableRows += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + esc(r.room) + '</td>' +
        '<td>' + esc(r.guest) + '</td>' +
        '<td>' + esc(r.checkin) + '</td>' +
        '<td>' + esc(r.checkout) + '</td>' +
        '<td style="text-align:center">' + r.nights + '</td>' +
        '<td style="text-align:right">' + fmt(r.rate) + '</td>' +
        '<td style="text-align:right;font-weight:700">' + fmt(r.total) + '</td>' +
        '<td style="text-align:right;color:#16a34a;font-weight:700">' + fmt(r.collected) + '</td>' +
        '<td style="text-align:right;font-weight:700;color:' + (r.balance > 0 ? '#dc2626' : '#16a34a') + '">' + (r.balance > 0 ? fmt(r.balance) : 'Settled') + '</td>' +
      '</tr>';
    });

    var html = '<!DOCTYPE html><html><head><title>Room Income Receipt</title>' +
      '<style>' +
      '*{margin:0;padding:0;box-sizing:border-box;}' +
      'body{font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;padding:30px;color:#1c2440;font-size:12px;}' +
      '.header{text-align:center;border-bottom:2px solid #1c2440;padding-bottom:12px;margin-bottom:16px;}' +
      '.header h1{font-size:18px;font-weight:800;letter-spacing:1px;text-transform:uppercase;}' +
      '.header p{font-size:11px;color:#6b7280;margin-top:4px;}' +
      '.meta{display:flex;justify-content:space-between;margin-bottom:14px;font-size:11px;color:#6b7280;}' +
      '.kpi-row{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;}' +
      '.kpi{flex:1;min-width:120px;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;text-align:center;}' +
      '.kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-weight:600;}' +
      '.kpi-val{font-size:16px;font-weight:800;margin-top:4px;}' +
      '.kpi-gold .kpi-val{color:#2563eb;}' +
      '.kpi-green .kpi-val{color:#16a34a;}' +
      '.kpi-red .kpi-val{color:#dc2626;}' +
      '.kpi-purple .kpi-val{color:#7c3aed;}' +
      '.kpi-teal .kpi-val{color:#0d9488;}' +
      'table{width:100%;border-collapse:collapse;margin-top:8px;}' +
      'th{text-align:left;padding:6px 8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;border-bottom:2px solid #e5e7eb;font-weight:700;}' +
      'td{padding:5px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;}' +
      'tr:last-child td{border-bottom:none;}' +
      '.footer{margin-top:16px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between;}' +
      '</style></head><body>' +
      '<div class="header"><h1>Room Income Report</h1><p>Aurum Hotel Management System</p></div>' +
      '<div class="meta"><span>Period: ' + filterLabel + '</span><span>Generated: ' + dateStr + ' ' + timeStr + '</span></div>' +
      '<div class="kpi-row">' +
        '<div class="kpi kpi-gold"><div class="kpi-label">Total Revenue</div><div class="kpi-val">' + fmt(k.totalRevenue) + '</div></div>' +
        '<div class="kpi kpi-green"><div class="kpi-label">Collected</div><div class="kpi-val">' + fmt(k.totalCollected) + '</div></div>' +
        '<div class="kpi kpi-red"><div class="kpi-label">Outstanding</div><div class="kpi-val">' + fmt(k.totalBalance) + '</div></div>' +
        '<div class="kpi kpi-purple"><div class="kpi-label">Room Nights</div><div class="kpi-val">' + (k.totalNights || 0) + '</div></div>' +
        '<div class="kpi kpi-teal"><div class="kpi-label">Avg Rate/Night</div><div class="kpi-val">' + fmt(k.avgRate) + '</div></div>' +
      '</div>' +
      '<table><thead><tr><th>#</th><th>Room</th><th>Guest</th><th>Check-in</th><th>Check-out</th><th style="text-align:center">Nights</th><th style="text-align:right">Rate/Night</th><th style="text-align:right">Total</th><th style="text-align:right">Collected</th><th style="text-align:right">Balance</th></tr></thead>' +
      '<tbody>' + tableRows + '</tbody></table>' +
      '<div class="footer"><span>Aurum Hotel · Room Income Report</span><span>Page ' + state.page + ' of ' + state.pages + ' · ' + state.total + ' records</span></div>' +
      '</body></html>';

    var w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  /* ── CSS ── */
  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return; cssInjected = true;
    var s = document.createElement('style');
    s.textContent =
      '.ri-kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px;}' +
      '@media(max-width:1100px){.ri-kpi-row{grid-template-columns:repeat(2,1fr);}}' +
      '@media(max-width:420px){.ri-kpi-row{grid-template-columns:1fr 1fr;gap:10px;}}' +
      '.ri-kpi{background:var(--surface,#fff);border:1px solid var(--border,#eef0f6);border-radius:14px;padding:14px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 4px 20px rgba(15,34,55,.07);position:relative;overflow:hidden;}' +
      '.ri-kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;}' +
      '.ri-kpi-gold::before{background:linear-gradient(90deg,var(--gold,#2f6fed),transparent);}' +
      '.ri-kpi-green::before{background:linear-gradient(90deg,var(--green,#12b76a),transparent);}' +
      '.ri-kpi-red::before{background:linear-gradient(90deg,var(--red,#f04438),transparent);}' +
      '.ri-kpi-purple::before{background:linear-gradient(90deg,var(--purple,#8b5cf6),transparent);}' +
      '.ri-kpi-teal::before{background:linear-gradient(90deg,#14b8a6,transparent);}' +
      '.ri-kpi-ic{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}' +
      '.ri-kpi-gold .ri-kpi-ic{background:rgba(47,111,237,.1);color:var(--gold,#2f6fed);}' +
      '.ri-kpi-green .ri-kpi-ic{background:rgba(18,183,106,.1);color:var(--green,#12b76a);}' +
      '.ri-kpi-red .ri-kpi-ic{background:rgba(240,68,56,.1);color:var(--red,#f04438);}' +
      '.ri-kpi-purple .ri-kpi-ic{background:rgba(139,92,246,.1);color:var(--purple,#8b5cf6);}' +
      '.ri-kpi-teal .ri-kpi-ic{background:rgba(20,184,166,.1);color:#14b8a6;}' +
      '.ri-kpi-label{font-size:11px;color:var(--text2,#6b7280);font-weight:600;}' +
      '.ri-kpi-val{font-size:20px;font-weight:800;color:var(--text,#1c2440);margin-top:2px;}' +
      '.ri-filters{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:14px;background:var(--surface,#fff);border:1px solid var(--border,#eef0f6);border-radius:14px;padding:14px 18px;box-shadow:0 4px 20px rgba(15,34,55,.07);}' +
      '.ri-fg{display:flex;flex-direction:column;gap:4px;}' +
      '.ri-fl{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:var(--text3,#9aa1b3);font-weight:600;}' +
      '.ri-pills{display:flex;gap:4px;}' +
      '.ri-pill{padding:5px 12px;border-radius:8px;font-size:11.5px;font-weight:600;border:1px solid var(--border,#eef0f6);background:var(--surface,#fff);color:var(--text2,#6b7280);cursor:pointer;transition:all .2s;}' +
      '.ri-pill.active{background:var(--gold-dim,rgba(47,111,237,.1));color:var(--gold,#2f6fed);border-color:var(--gold-border,rgba(47,111,237,.25));}' +
      '.ri-pill:hover:not(.active){background:var(--surface2,#f4f6fb);}' +
      '.ri-select{padding:5px 10px;border-radius:8px;font-size:12px;border:1px solid var(--border,#eef0f6);background:var(--surface,#fff);color:var(--text,#1c2440);font-family:inherit;outline:none;}' +
      '.ri-table-wrap{background:var(--surface,#fff);border:1px solid var(--border,#eef0f6);border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,34,55,.07);}' +
      '.ri-table{width:100%;border-collapse:collapse;font-size:12.5px;}' +
      '.ri-table th{text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3,#9aa1b3);font-weight:700;border-bottom:1px solid var(--border,#eef0f6);background:var(--surface2,#f4f6fb);white-space:nowrap;}' +
      '.ri-table td{padding:10px 14px;border-bottom:1px solid var(--border,#eef0f6);color:var(--text,#1c2440);white-space:nowrap;}' +
      '.ri-table tr:last-child td{border-bottom:none;}' +
      '.ri-table tr:hover td{background:var(--surface2,#f4f6fb);}' +
      '.ri-bold{font-weight:700;}' +
      '.ri-green{color:var(--green,#12b76a);font-weight:700;}' +
      '.ri-red{color:var(--red,#f04438);font-weight:700;}' +
      '.ri-status{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10.5px;font-weight:700;white-space:nowrap;}' +
      '.ri-st-checkout{background:rgba(240,68,56,.08);color:var(--red,#f04438);}' +
      '.ri-st-checkedin{background:rgba(47,111,237,.1);color:var(--gold,#2f6fed);}' +
      '.ri-st-reserved{background:rgba(139,92,246,.1);color:var(--purple,#8b5cf6);}' +
      '.ri-st-other{background:var(--surface2,#f4f6fb);color:var(--text3,#9aa1b3);}' +
      '.ri-empty{padding:40px;text-align:center;color:var(--text3,#9aa1b3);font-size:13px;}' +
      '.ri-empty i{font-size:24px;display:block;margin-bottom:10px;}' +
      '.ri-loading{padding:40px;text-align:center;color:var(--text3,#9aa1b3);font-size:13px;}' +
      '.ri-pagination{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:16px;padding:12px 0;}' +
      '.ri-page-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--border,#eef0f6);background:var(--surface,#fff);color:var(--text2,#6b7280);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}' +
      '.ri-page-btn:hover:not(:disabled){background:var(--surface2,#f4f6fb);color:var(--text,#1c2440);}' +
      '.ri-page-btn.active{background:var(--gold-dim,rgba(47,111,237,.1));color:var(--gold,#2f6fed);border-color:var(--gold-border,rgba(47,111,237,.25));}' +
      '.ri-page-btn:disabled{opacity:.35;cursor:not-allowed;}' +
      '.ri-page-info{font-size:11px;color:var(--text3,#9aa1b3);margin-left:10px;}' +
      '.ri-fg-print{margin-left:auto;}' +
      '.ri-print-btn{padding:5px 14px;border-radius:8px;font-size:12px;font-weight:600;border:1px solid var(--border,#eef0f6);background:var(--surface,#fff);color:var(--text2,#6b7280);cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;}' +
      '.ri-print-btn:hover{background:var(--gold-dim,rgba(47,111,237,.1));color:var(--gold,#2f6fed);border-color:var(--gold-border,rgba(47,111,237,.25));}' +
      '@media print{.ri-filters,.ri-pagination{display:none!important;}}';
    document.head.appendChild(s);
  }

  window.RoomIncome = { render: function (c) { injectCSS(); render(c); } };
})();
