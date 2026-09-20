;(function () {
  'use strict';
  const CFG = (window.CONFIG && window.CONFIG.API_BASE) ? window.CONFIG.API_BASE : '';
  const fmt = function(n) { return '\u20A6' + Number(n || 0).toLocaleString('en-NG'); };
  var esc = function(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  var state = { rows: [], kpis: {}, summary: {}, page: 1, pages: 1, total: 0, _dateFrom: '', _dateTo: '' };
  var filters = { period: 'all', roomType: '', paymentMethod: '', paymentType: '' };

  function clientDateStr() {
    var now = new Date();
    var y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function fetchData() {
    var p = new URLSearchParams();
    p.set('page', state.page); p.set('limit', '50');
    p.set('clientDate', clientDateStr());
    if (filters.period !== 'all') p.set('period', filters.period);
    if (state._dateFrom) p.set('dateFrom', state._dateFrom);
    if (state._dateTo) p.set('dateTo', state._dateTo);
    if (filters.roomType) p.set('roomType', filters.roomType);
    if (filters.paymentMethod) p.set('paymentMethod', filters.paymentMethod);
    if (filters.paymentType) p.set('paymentType', filters.paymentType);
    return fetch(CFG + '/api/booking/room-income?' + p.toString(), { credentials: 'include' })
      .then(function(r) { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(function(j) { return j.data || { rows: [], kpis: {}, summary: {}, page: 1, pages: 1, total: 0 }; });
  }

  function paintKPIs(k) {
    return '<div class="rpr-kpis">' +
      '<div class="rpr-kpi rpr-kpi-blue"><div class="rpr-kpi-ic"><i class="fa-solid fa-building-columns"></i></div><div class="rpr-kpi-body"><div class="rpr-kpi-label">Total Payments Received</div><div class="rpr-kpi-val">' + fmt(k.totalPayments) + '</div></div></div>' +
      '<div class="rpr-kpi rpr-kpi-slate"><div class="rpr-kpi-ic"><i class="fa-solid fa-receipt"></i></div><div class="rpr-kpi-body"><div class="rpr-kpi-label">Number of Transactions</div><div class="rpr-kpi-val">' + (k.txCount || 0) + '</div></div></div>' +
      '<div class="rpr-kpi rpr-kpi-teal"><div class="rpr-kpi-ic"><i class="fa-solid fa-money-bill-wave"></i></div><div class="rpr-kpi-body"><div class="rpr-kpi-label">Cash</div><div class="rpr-kpi-val">' + fmt(k.cashTotal) + '</div><div class="rpr-kpi-sub">(' + (k.cashCount || 0) + ' transactions)</div></div></div>' +
      '<div class="rpr-kpi rpr-kpi-indigo"><div class="rpr-kpi-ic"><i class="fa-solid fa-credit-card"></i></div><div class="rpr-kpi-body"><div class="rpr-kpi-label">POS</div><div class="rpr-kpi-val">' + fmt(k.posTotal) + '</div><div class="rpr-kpi-sub">(' + (k.posCount || 0) + ' transactions)</div></div></div>' +
      '<div class="rpr-kpi rpr-kpi-purple"><div class="rpr-kpi-ic"><i class="fa-solid fa-university"></i></div><div class="rpr-kpi-body"><div class="rpr-kpi-label">Bank Transfer</div><div class="rpr-kpi-val">' + fmt(k.transferTotal) + '</div><div class="rpr-kpi-sub">(' + (k.transferCount || 0) + ' transactions)</div></div></div>' +
      '<div class="rpr-kpi rpr-kpi-red"><div class="rpr-kpi-ic"><i class="fa-solid fa-rotate-left"></i></div><div class="rpr-kpi-body"><div class="rpr-kpi-label">Refunds</div><div class="rpr-kpi-val">' + fmt(k.totalRefunds) + '</div><div class="rpr-kpi-sub">(' + (k.refundCount || 0) + ' transactions)</div></div></div>' +
      '<div class="rpr-kpi rpr-kpi-green"><div class="rpr-kpi-ic"><i class="fa-solid fa-sack-dollar"></i></div><div class="rpr-kpi-body"><div class="rpr-kpi-label">Net Collections</div><div class="rpr-kpi-val">' + fmt(k.netCollections) + '</div></div></div>' +
    '</div>';
  }

  function paintFilters() {
    return '<div class="rpr-filters">' +
      '<div class="rpr-fg"><span class="rpr-fl">Business Date Range</span><div class="rpr-date-group"><input type="date" class="rpr-date" id="rprDateFrom" value="' + (state._dateFrom || '') + '"><span class="rpr-date-sep">to</span><input type="date" class="rpr-date" id="rprDateTo" value="' + (state._dateTo || '') + '"></div></div>' +
      '<div class="rpr-fg"><span class="rpr-fl">Room Type</span><select class="rpr-select" id="rprRoomType"><option value="">All</option>' +
        ['Standard','Deluxe','Super Deluxe','Premium Gold','Mini Suite','Executive Suite','Apartment'].map(function(t) { return '<option value="' + t + '"' + (filters.roomType === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="rpr-fg"><span class="rpr-fl">Payment Method</span><select class="rpr-select" id="rprPayMethod"><option value="">All</option>' +
        ['Cash','POS','Transfer'].map(function(m) { return '<option value="' + m + '"' + (filters.paymentMethod === m ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="rpr-fg"><span class="rpr-fl">Payment Type</span><select class="rpr-select" id="rprPayType"><option value="">All</option>' +
        ['Full Payment','Deposit','Balance Payment','Refund','Partial Refund','Refunded'].map(function(t) { return '<option value="' + t + '"' + (filters.paymentType === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="rpr-fg"><span class="rpr-fl">&nbsp;</span><button class="rpr-gen-btn" id="rprGenerate"><i class="fa-solid fa-filter"></i> Generate Report</button></div>' +
    '</div>';
  }

  function paintTable(rows) {
    if (!rows.length) return '<div class="rpr-empty"><i class="fa-solid fa-receipt"></i><div>No payment transactions found.</div></div>';
    var h = '<div class="rpr-table-wrap"><table class="rpr-table"><thead><tr>' +
      '<th>S/N</th><th>Date</th><th>Receipt No.</th><th>Guest Name</th><th>Booking No.</th><th>Room No.</th><th>Room Type</th><th>Payment Type</th><th>Payment Method</th><th>Amount (\u20A6)</th><th>Remarks</th><th>Cashier</th>' +
    '</tr></thead><tbody>';
    var totalAmt = 0;
    rows.forEach(function(r) {
      totalAmt += r.amount;
      h += '<tr>' +
        '<td>' + r.sn + '</td><td>' + esc(r.date) + '</td><td>' + esc(r.receiptNo) + '</td><td>' + esc(r.guest) + '</td><td>' + esc(r.bookingNo) + '</td>' +
        '<td>' + esc(r.room) + '</td><td>' + esc(r.roomType) + '</td><td><span class="rpr-ptag rpr-pt-' + r.paymentType.replace(/\s/g,'').toLowerCase() + '">' + esc(r.paymentType) + '</span></td><td>' + esc(r.paymentMethod) + '</td>' +
        '<td class="rpr-bold">' + fmt(r.amount) + '</td><td>' + esc(r.remarks) + '</td><td>' + esc(r.cashier) + '</td>' +
      '</tr>';
    });
    h += '<tr class="rpr-total-row"><td colspan="9" style="text-align:right;font-weight:700;border-right:none">TOTAL</td><td class="rpr-bold" style="border-left:none">' + fmt(totalAmt) + '</td><td colspan="2"></td></tr>';
    h += '</tbody></table></div>';
    return h;
  }

  function paintSummaries(s) {
    var method = s.methodSummary || [], type = s.typeSummary || [], room = s.roomTypeSummary || [];
    function sumTable(headers, data, key, showPct) {
      var h = '<table class="rpr-sum-table"><thead><tr>';
      headers.forEach(function(hdr) { h += '<th>' + hdr + '</th>'; });
      h += '</tr></thead><tbody>';
      var totCount = 0, totAmt = 0;
      data.forEach(function(r) { totCount += r.count; totAmt += r.amount; });
      data.forEach(function(r) {
        h += '<tr><td>' + esc(r[key]) + '</td><td style="text-align:center">' + r.count + '</td><td style="text-align:right">' + fmt(r.amount) + '</td>';
        if (showPct) h += '<td style="text-align:right">' + (totAmt > 0 ? ((r.amount / totAmt) * 100).toFixed(1) + '%' : '0%') + '</td>';
        h += '</tr>';
      });
      h += '<tr class="rpr-sum-total"><td>Total</td><td style="text-align:center">' + totCount + '</td><td style="text-align:right">' + fmt(totAmt) + '</td>';
      if (showPct) h += '<td style="text-align:right">100.0%</td>';
      h += '</tr></tbody></table>';
      return h;
    }
    return '<div class="rpr-summaries">' +
      '<div class="rpr-sum-card"><div class="rpr-sum-title">PAYMENT METHOD SUMMARY</div>' + sumTable(['Payment Method','Transactions','Amount (\u20A6)','Percentage'], method, 'method', true) + '</div>' +
      '<div class="rpr-sum-card"><div class="rpr-sum-title">PAYMENT TYPE SUMMARY</div>' + sumTable(['Payment Type','Transactions','Amount (\u20A6)'], type, 'type', false) + '</div>' +
      '<div class="rpr-sum-card"><div class="rpr-sum-title">ROOM TYPE PAYMENT SUMMARY</div>' + sumTable(['Room Type','Transactions','Amount (\u20A6)'], room, 'type', false) + '</div>' +
    '</div>';
  }

  function paintPagination() {
    if (state.pages <= 1) return '';
    var h = '<div class="rpr-pagination">';
    h += '<button class="rpr-page-btn" data-page="1"' + (state.page <= 1 ? ' disabled' : '') + '><i class="fa-solid fa-angles-left"></i></button>';
    h += '<button class="rpr-page-btn" data-page="' + (state.page - 1) + '"' + (state.page <= 1 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>';
    for (var i = Math.max(1, state.page - 2); i <= Math.min(state.pages, state.page + 2); i++) {
      h += '<button class="rpr-page-btn' + (i === state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    h += '<button class="rpr-page-btn" data-page="' + (state.page + 1) + '"' + (state.page >= state.pages ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>';
    h += '<button class="rpr-page-btn" data-page="' + state.pages + '"' + (state.page >= state.pages ? ' disabled' : '') + '><i class="fa-solid fa-angles-right"></i></button>';
    h += '<span class="rpr-page-info">Page ' + state.page + ' of ' + state.pages + ' (' + state.total + ' records)</span></div>';
    return h;
  }

  function paint(c) {
    c.innerHTML = paintKPIs(state.kpis) + paintFilters() +
      '<div class="rpr-section-title"><i class="fa-solid fa-table-list"></i> ROOM PAYMENT TRANSACTIONS</div>' +
      paintTable(state.rows) + paintSummaries(state.summary) + paintPagination();
  }

  function render(container) {
    container.innerHTML = '<div class="rpr-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading room payment report\u2026</div>';
    state.page = 1;
    return fetchData().then(function(data) {
      state.rows = data.rows || []; state.kpis = data.kpis || {}; state.summary = data.summary || {};
      state.page = data.page || 1; state.pages = data.pages || 1; state.total = data.total || 0;
      paint(container); bindEvents(container);
    }).catch(function(e) {
      container.innerHTML = '<div class="rpr-empty"><i class="fa-solid fa-triangle-exclamation"></i><div>Failed to load report.</div></div>';
      console.error('[RoomIncome]', e);
    });
  }

  function goPage(c, pg) {
    state.page = pg;
    c.innerHTML = '<div class="rpr-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading\u2026</div>';
    return fetchData().then(function(data) {
      state.rows = data.rows || []; state.kpis = data.kpis || {}; state.summary = data.summary || {};
      state.page = data.page || 1; state.pages = data.pages || 1; state.total = data.total || 0;
      paint(c); bindEvents(c);
    }).catch(function() { c.innerHTML = '<div class="rpr-empty">Failed to load.</div>'; });
  }

  function bindEvents(c) {
    var genBtn = c.querySelector('#rprGenerate');
    if (genBtn) genBtn.addEventListener('click', function() {
      filters.roomType = c.querySelector('#rprRoomType').value;
      filters.paymentMethod = c.querySelector('#rprPayMethod').value;
      filters.paymentType = c.querySelector('#rprPayType').value;
      state._dateFrom = c.querySelector('#rprDateFrom').value;
      state._dateTo = c.querySelector('#rprDateTo').value;
      filters.period = (state._dateFrom || state._dateTo) ? 'custom' : 'all';
      render(c);
    });
    c.querySelectorAll('.rpr-page-btn[data-page]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var pg = parseInt(btn.dataset.page, 10);
        if (pg >= 1 && pg <= state.pages) goPage(c, pg);
      });
    });
  }

  function printReceipt() {
    var k = state.kpis || {}, s = state.summary || {};
    var now = new Date();
    var dateStr = now.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
    var timeStr = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    var rows = state.rows || [];
    var tRows = '', tAmt = 0;
    rows.forEach(function(r) { tAmt += r.amount; tRows += '<tr><td>' + r.sn + '</td><td>' + esc(r.date) + '</td><td>' + esc(r.receiptNo) + '</td><td>' + esc(r.guest) + '</td><td>' + esc(r.bookingNo) + '</td><td>' + esc(r.room) + '</td><td>' + esc(r.roomType) + '</td><td>' + esc(r.paymentType) + '</td><td>' + esc(r.paymentMethod) + '</td><td style="text-align:right;font-weight:700">' + fmt(r.amount) + '</td><td>' + esc(r.remarks) + '</td><td>' + esc(r.cashier) + '</td></tr>'; });
    var mRows = '';
    (s.methodSummary || []).forEach(function(r) { mRows += '<tr><td>' + esc(r.method) + '</td><td style="text-align:center">' + r.count + '</td><td style="text-align:right">' + fmt(r.amount) + '</td><td style="text-align:right">' + (tAmt > 0 ? ((r.amount / tAmt) * 100).toFixed(1) + '%' : '0%') + '</td></tr>'; });
    var tpRows = '';
    (s.typeSummary || []).forEach(function(r) { tpRows += '<tr><td>' + esc(r.type) + '</td><td style="text-align:center">' + r.count + '</td><td style="text-align:right">' + fmt(r.amount) + '</td></tr>'; });
    var rtRows = '';
    (s.roomTypeSummary || []).forEach(function(r) { rtRows += '<tr><td>' + esc(r.type) + '</td><td style="text-align:center">' + r.count + '</td><td style="text-align:right">' + fmt(r.amount) + '</td></tr>'; });

    var html = '<!DOCTYPE html><html><head><title>Room Payment Report</title><style>' +
      '*{margin:0;padding:0;box-sizing:border-box;}body{font-family:"Segoe UI",Tahoma,sans-serif;padding:30px;color:#1c2440;font-size:11px;}' +
      '.hdr{text-align:center;border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:14px;}.hdr h1{font-size:18px;color:#2563eb;}.hdr p{font-size:10px;color:#6b7280;margin-top:2px;}' +
      '.kpi-row{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}.kpi{flex:1;min-width:100px;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;text-align:center;}.kpi-lbl{font-size:8px;text-transform:uppercase;color:#9ca3af;font-weight:600;}.kpi-val{font-size:15px;font-weight:800;margin-top:2px;color:#2563eb;}.kpi-sub{font-size:8px;color:#9ca3af;}' +
      'table{width:100%;border-collapse:collapse;font-size:10px;}th{text-align:left;padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:#2563eb;font-weight:700;}' +
      'td{padding:4px 6px;border-bottom:1px solid #f3f4f6;}tr:last-child td{border-bottom:none;}' +
      '.total-row td{border-top:2px solid #2563eb;font-weight:800;background:#f8fafc;}' +
      '.sum-section{margin-top:16px;}.sum-title{font-size:11px;font-weight:800;color:#2563eb;text-transform:uppercase;margin-bottom:6px;padding:4px 8px;background:#e8eef6;border-radius:4px;}' +
      '.sum-row{display:flex;gap:12px;flex-wrap:wrap;}.sum-card{flex:1;min-width:200px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}.sum-card th{font-size:7px;}.sum-card .stotal td{font-weight:700;background:#f8fafc;border-top:2px solid #2563eb;}' +
      '.notes{margin-top:16px;font-size:9px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:10px;}.notes p{margin-bottom:3px;}' +
      '.footer{text-align:center;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:9px;color:#6b7280;}' +
      '@media print{body{padding:15px;}}' +
      '</style></head><body>' +
      '<div class="hdr"><h1>Room Payment Report</h1><p>Payments Received for Room Bookings</p><p style="font-style:italic;font-size:9px">Accurate Collections. Transparent Records.</p></div>' +
      '<div class="kpi-row">' +
        '<div class="kpi"><div class="kpi-lbl">Total Payments Received</div><div class="kpi-val">' + fmt(k.totalPayments) + '</div></div>' +
        '<div class="kpi"><div class="kpi-lbl">Number of Transactions</div><div class="kpi-val">' + (k.txCount || 0) + '</div></div>' +
        '<div class="kpi"><div class="kpi-lbl">Cash</div><div class="kpi-val">' + fmt(k.cashTotal) + '</div><div class="kpi-sub">(' + (k.cashCount || 0) + ' transactions)</div></div>' +
        '<div class="kpi"><div class="kpi-lbl">POS</div><div class="kpi-val">' + fmt(k.posTotal) + '</div><div class="kpi-sub">(' + (k.posCount || 0) + ' transactions)</div></div>' +
        '<div class="kpi"><div class="kpi-lbl">Bank Transfer</div><div class="kpi-val">' + fmt(k.transferTotal) + '</div><div class="kpi-sub">(' + (k.transferCount || 0) + ' transactions)</div></div>' +
        '<div class="kpi"><div class="kpi-lbl">Refunds</div><div class="kpi-val">' + fmt(k.totalRefunds) + '</div><div class="kpi-sub">(' + (k.refundCount || 0) + ' transactions)</div></div>' +
        '<div class="kpi"><div class="kpi-lbl">Net Collections</div><div class="kpi-val" style="color:#16a34a">' + fmt(k.netCollections) + '</div></div>' +
      '</div>' +
      '<div style="font-weight:800;font-size:11px;color:#2563eb;margin-bottom:6px;text-transform:uppercase;padding:4px 8px;background:#2563eb;color:#fff;border-radius:4px;">ROOM PAYMENT TRANSACTIONS</div>' +
      '<table><thead><tr><th>S/N</th><th>Date</th><th>Receipt No.</th><th>Guest Name</th><th>Booking No.</th><th>Room No.</th><th>Room Type</th><th>Payment Type</th><th>Payment Method</th><th>Amount (\u20A6)</th><th>Remarks</th><th>Cashier</th></tr></thead><tbody>' +
      tRows + '<tr class="total-row"><td colspan="9" style="text-align:right;border-right:none">TOTAL</td><td style="text-align:left;border-left:none;font-weight:800">' + fmt(tAmt) + '</td><td colspan="2"></td></tr>' +
      '</tbody></table>' +
      '<div class="sum-section"><div class="sum-row">' +
        '<div class="sum-card"><div class="sum-title">PAYMENT METHOD SUMMARY</div><table><thead><tr><th>Payment Method</th><th>Transactions</th><th>Amount (\u20A6)</th><th>Percentage</th></tr></thead><tbody>' + mRows + '</tbody></table></div>' +
        '<div class="sum-card"><div class="sum-title">PAYMENT TYPE SUMMARY</div><table><thead><tr><th>Payment Type</th><th>Transactions</th><th>Amount (\u20A6)</th></tr></thead><tbody>' + tpRows + '</tbody></table></div>' +
        '<div class="sum-card"><div class="sum-title">ROOM TYPE PAYMENT SUMMARY</div><table><thead><tr><th>Room Type</th><th>Transactions</th><th>Amount (\u20A6)</th></tr></thead><tbody>' + rtRows + '</tbody></table></div>' +
      '</div></div>' +
      '<div class="notes"><p>1. This report shows actual payments received for room bookings within the selected business date range.</p><p>2. Payments may include deposits, full payments or balance payments.</p><p>3. Refunds (if any) are shown separately and deducted in the net collection.</p></div>' +
      '<div class="footer"><p>Generated on: ' + dateStr + ' ' + timeStr + '</p><p>Generated by: Front Desk System</p></div>' +
      '</body></html>';

    var w = window.open('', '_blank', 'width=1100,height=800');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  /* ── CSS ── */
  var cssLoaded = false;
  function injectCSS() {
    if (cssLoaded) return; cssLoaded = true;
    var s = document.createElement('style');
    s.textContent =
      '.rpr-kpis{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;margin-bottom:14px;}' +
      '@media(max-width:1200px){.rpr-kpis{grid-template-columns:repeat(4,1fr);}}' +
      '@media(max-width:768px){.rpr-kpis{grid-template-columns:repeat(2,1fr);}}' +
      '.rpr-kpi{background:#fff;border:1px solid #eef0f6;border-radius:12px;padding:12px;display:flex;align-items:flex-start;gap:8px;box-shadow:0 2px 12px rgba(15,34,55,.06);position:relative;overflow:hidden;}' +
      '.rpr-kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;}' +
      '.rpr-kpi-blue::before{background:linear-gradient(90deg,#2563eb,transparent);}' +
      '.rpr-kpi-slate::before{background:linear-gradient(90deg,#64748b,transparent);}' +
      '.rpr-kpi-teal::before{background:linear-gradient(90deg,#0d9488,transparent);}' +
      '.rpr-kpi-indigo::before{background:linear-gradient(90deg,#4f46e5,transparent);}' +
      '.rpr-kpi-purple::before{background:linear-gradient(90deg,#7c3aed,transparent);}' +
      '.rpr-kpi-red::before{background:linear-gradient(90deg,#dc2626,transparent);}' +
      '.rpr-kpi-green::before{background:linear-gradient(90deg,#16a34a,transparent);}' +
      '.rpr-kpi-ic{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}' +
      '.rpr-kpi-blue .rpr-kpi-ic{background:rgba(30,58,95,.1);color:#2563eb;}' +
      '.rpr-kpi-slate .rpr-kpi-ic{background:rgba(100,116,139,.1);color:#64748b;}' +
      '.rpr-kpi-teal .rpr-kpi-ic{background:rgba(13,148,136,.1);color:#0d9488;}' +
      '.rpr-kpi-indigo .rpr-kpi-ic{background:rgba(79,70,229,.1);color:#4f46e5;}' +
      '.rpr-kpi-purple .rpr-kpi-ic{background:rgba(124,58,237,.1);color:#7c3aed;}' +
      '.rpr-kpi-red .rpr-kpi-ic{background:rgba(220,38,38,.1);color:#dc2626;}' +
      '.rpr-kpi-green .rpr-kpi-ic{background:rgba(22,163,74,.1);color:#16a34a;}' +
      '.rpr-kpi-label{font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px;}' +
      '.rpr-kpi-val{font-size:18px;font-weight:800;color:#1c2440;margin-top:2px;}' +
      '.rpr-kpi-sub{font-size:9px;color:#9ca3af;margin-top:1px;}' +
      '.rpr-filters{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:14px;background:#fff;border:1px solid #eef0f6;border-radius:12px;padding:14px 18px;box-shadow:0 2px 12px rgba(15,34,55,.06);}' +
      '.rpr-fg{display:flex;flex-direction:column;gap:4px;}' +
      '.rpr-fl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9aa1b3;font-weight:600;}' +
      '.rpr-date-group{display:flex;align-items:center;gap:6px;}' +
      '.rpr-date{padding:5px 8px;border-radius:8px;font-size:12px;border:1px solid #eef0f6;font-family:inherit;outline:none;}' +
      '.rpr-date-sep{font-size:11px;color:#6b7280;}' +
      '.rpr-select{padding:5px 10px;border-radius:8px;font-size:12px;border:1px solid #eef0f6;background:#fff;color:#1c2440;font-family:inherit;outline:none;}' +
      '.rpr-gen-btn{padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;border:none;background:#2563eb;color:#fff;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;}' +
      '.rpr-gen-btn:hover{background:#2a4f7a;}' +
      '.rpr-section-title{font-size:12px;font-weight:800;color:#fff;background:#2563eb;padding:8px 14px;border-radius:8px;margin-bottom:0;display:flex;align-items:center;gap:6px;}' +
      '.rpr-table-wrap{background:#fff;border:1px solid #eef0f6;border-radius:0 0 12px 12px;overflow-x:auto;box-shadow:0 2px 12px rgba(15,34,55,.06);}' +
      '.rpr-table{width:100%;border-collapse:collapse;font-size:11.5px;}' +
      '.rpr-table th{text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#fff;background:#1d4ed8;font-weight:700;white-space:nowrap;}' +
      '.rpr-table td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#1c2440;white-space:nowrap;}' +
      '.rpr-table tr:last-child td{border-bottom:none;}' +
      '.rpr-table tr:hover td{background:#f8fafc;}' +
      '.rpr-bold{font-weight:700;}' +
      '.rpr-total-row td{background:#f1f5f9 !important;border-top:2px solid #2563eb !important;font-weight:800;}' +
      '.rpr-ptag{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;white-space:nowrap;}' +
      '.rpr-pt-fullpayment{background:rgba(22,163,74,.1);color:#16a34a;}' +
      '.rpr-pt-deposit{background:rgba(245,158,11,.1);color:#d97706;}' +
      '.rpr-pt-balancepayment{background:rgba(79,70,229,.1);color:#4f46e5;}' +
      '.rpr-pt-refund{background:rgba(220,38,38,.1);color:#dc2626;}' +
      '.rpr-pt-refunded{background:rgba(220,38,38,.1);color:#dc2626;}' +
      '.rpr-pt-partialrefund{background:rgba(220,38,38,.1);color:#dc2626;}' +
      '.rpr-summaries{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;}' +
      '@media(max-width:1000px){.rpr-summaries{grid-template-columns:1fr;}}' +
      '.rpr-sum-card{background:#fff;border:1px solid #eef0f6;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(15,34,55,.06);}' +
      '.rpr-sum-title{font-size:10px;font-weight:800;color:#fff;background:#2563eb;padding:8px 12px;text-transform:uppercase;letter-spacing:.5px;}' +
      '.rpr-sum-table{width:100%;border-collapse:collapse;font-size:11px;}' +
      '.rpr-sum-table th{text-align:left;padding:6px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;background:#f8fafc;font-weight:700;border-bottom:1px solid #eef0f6;}' +
      '.rpr-sum-table td{padding:6px 10px;border-bottom:1px solid #f1f5f9;}' +
      '.rpr-sum-total td{font-weight:800;background:#f8fafc;border-top:2px solid #2563eb;}' +
      '.rpr-empty{padding:40px;text-align:center;color:#9aa1b3;font-size:13px;}.rpr-empty i{font-size:24px;display:block;margin-bottom:10px;}' +
      '.rpr-loading{padding:40px;text-align:center;color:#9aa1b3;font-size:13px;}' +
      '.rpr-pagination{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:16px;padding:12px 0;}' +
      '.rpr-page-btn{width:32px;height:32px;border-radius:8px;border:1px solid #eef0f6;background:#fff;color:#6b7280;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}' +
      '.rpr-page-btn:hover:not(:disabled){background:#f4f6fb;color:#1c2440;}' +
      '.rpr-page-btn.active{background:rgba(30,58,95,.1);color:#2563eb;border-color:rgba(30,58,95,.25);}' +
      '.rpr-page-btn:disabled{opacity:.35;cursor:not-allowed;}' +
      '.rpr-page-info{font-size:11px;color:#9aa1b3;margin-left:10px;}' +
      '@media print{.rpr-filters,.rpr-pagination{display:none!important;}}';
    document.head.appendChild(s);
  }

  window.RoomIncome = { render: function(c) { injectCSS(); render(c); }, print: printReceipt };
})();