/**
 * Room Income Component — financial view of room revenue.
 * Rendered inside a container when the "Room Income" tab is clicked.
 *
 * Usage:
 *   RoomIncome.render(document.getElementById('roomIncomeSlot'));
 */
;(function () {
  'use strict';

  const CFG = (window.CONFIG && window.CONFIG.API_BASE) ? window.CONFIG.API_BASE : '';
  const fmt = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  let currentData = { rows: [], kpis: {} };
  let activePeriod = 'all';
  let activeRoomType = '';
  let activePayment = '';

  async function fetchData() {
    const params = new URLSearchParams();
    if (activePeriod !== 'all') params.set('period', activePeriod);
    if (activeRoomType) params.set('roomType', activeRoomType);
    if (activePayment) params.set('payment', activePayment);
    const qs = params.toString();
    const res = await fetch(CFG + '/api/booking/room-income' + (qs ? '?' + qs : ''), { credentials: 'include' });
    const j = await res.json();
    return j.data || { rows: [], kpis: {} };
  }

  function renderKPIs(kpis) {
    return '<div class="ri-kpi-row">' +
      '<div class="ri-kpi ri-kpi-gold"><div class="ri-kpi-ic"><i class="fa-solid fa-sack-dollar"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Total Revenue</div><div class="ri-kpi-val">' + fmt(kpis.totalRevenue) + '</div></div></div>' +
      '<div class="ri-kpi ri-kpi-green"><div class="ri-kpi-ic"><i class="fa-solid fa-circle-check"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Collected</div><div class="ri-kpi-val">' + fmt(kpis.totalCollected) + '</div></div></div>' +
      '<div class="ri-kpi ri-kpi-red"><div class="ri-kpi-ic"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Outstanding</div><div class="ri-kpi-val">' + fmt(kpis.totalBalance) + '</div></div></div>' +
      '<div class="ri-kpi ri-kpi-purple"><div class="ri-kpi-ic"><i class="fa-solid fa-moon"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Room Nights</div><div class="ri-kpi-val">' + (kpis.totalNights || 0) + '</div></div></div>' +
      '<div class="ri-kpi ri-kpi-teal"><div class="ri-kpi-ic"><i class="fa-solid fa-chart-line"></i></div><div class="ri-kpi-body"><div class="ri-kpi-label">Avg Rate/Night</div><div class="ri-kpi-val">' + fmt(kpis.avgRate) + '</div></div></div>' +
    '</div>';
  }

  function renderFilters() {
    return '<div class="ri-filters">' +
      '<div class="ri-fg">' +
        '<span class="ri-fl">Period</span>' +
        '<div class="ri-pills">' +
          '<button class="ri-pill' + (activePeriod === 'all' ? ' active' : '') + '" data-p="all">All Time</button>' +
          '<button class="ri-pill' + (activePeriod === 'today' ? ' active' : '') + '" data-p="today">Today</button>' +
          '<button class="ri-pill' + (activePeriod === '7d' ? ' active' : '') + '" data-p="7d">7 Days</button>' +
          '<button class="ri-pill' + (activePeriod === '30d' ? ' active' : '') + '" data-p="30d">30 Days</button>' +
        '</div>' +
      '</div>' +
      '<div class="ri-fg">' +
        '<span class="ri-fl">Room Type</span>' +
        '<select class="ri-select" id="riRoomType">' +
          '<option value="">All Types</option>' +
          '<option value="Standard"' + (activeRoomType === 'Standard' ? ' selected' : '') + '>Standard</option>' +
          '<option value="Deluxe"' + (activeRoomType === 'Deluxe' ? ' selected' : '') + '>Deluxe</option>' +
          '<option value="Suite"' + (activeRoomType === 'Suite' ? ' selected' : '') + '>Suite</option>' +
          '<option value="Conference"' + (activeRoomType === 'Conference' ? ' selected' : '') + '>Conference</option>' +
        '</select>' +
      '</div>' +
      '<div class="ri-fg">' +
        '<span class="ri-fl">Payment</span>' +
        '<select class="ri-select" id="riPayment">' +
          '<option value="">All</option>' +
          '<option value="paid"' + (activePayment === 'paid' ? ' selected' : '') + '>Fully Paid</option>' +
          '<option value="unpaid"' + (activePayment === 'unpaid' ? ' selected' : '') + '>Outstanding</option>' +
        '</select>' +
      '</div>' +
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

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  async function render(container) {
    container.innerHTML = '<div class="ri-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading room income…</div>';
    try {
      currentData = await fetchData();
      _paint(container);
      _bindEvents(container);
    } catch (e) {
      container.innerHTML = '<div class="ri-empty"><i class="fa-solid fa-triangle-exclamation"></i><div>Failed to load room income.</div></div>';
      console.error('[RoomIncome]', e);
    }
  }

  function _paint(container) {
    container.innerHTML =
      renderKPIs(currentData.kpis) +
      renderFilters() +
      renderTable(currentData.rows);
  }

  function _bindEvents(container) {
    container.querySelectorAll('.ri-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activePeriod = btn.dataset.p;
        render(container);
      });
    });
    var rtSel = container.querySelector('#riRoomType');
    if (rtSel) rtSel.addEventListener('change', function () { activeRoomType = rtSel.value; render(container); });
    var pySel = container.querySelector('#riPayment');
    if (pySel) pySel.addEventListener('change', function () { activePayment = pySel.value; render(container); });
  }

  /* ── CSS (injected once) ── */
  var injected = false;
  function injectCSS() {
    if (injected) return; injected = true;
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
      '@media print{.ri-filters{display:none!important;}}';
    document.head.appendChild(s);
  }

  window.RoomIncome = { render: function (c) { injectCSS(); render(c); } };
})();
