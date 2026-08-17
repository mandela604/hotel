/**
 * sales-detail.js — View Sale modal (light theme, Segoe UI, FA6)
 * Supports Room Charge: roomNumber, guestName, guestPhone
 *
 * options.onClose (new): called every time the modal is dismissed —
 * via the Close button, the X, or clicking outside it — i.e. anywhere
 * close() runs. Lets a host page (e.g. guests.html) restore whatever
 * was showing before this modal opened. Optional; nothing changes for
 * callers that don't pass it.
 */
(function () {
  'use strict';

  const CSS = `
    .sd-overlay{
      display:none; position:fixed; inset:0; background:rgba(15,34,55,0.45); backdrop-filter:blur(4px);
      z-index:400; align-items:flex-start; justify-content:center; padding:20px 16px; overflow-y:auto;
      font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
    }
    .sd-overlay.sd-show{ display:flex; }
    .sd-modal{
      background:#ffffff; border:1px solid #eef0f6; border-radius:18px; padding:24px;
      width:min(560px,96vw); box-shadow:0 32px 80px rgba(15,34,55,0.18);
      margin:auto; position:relative; overflow:hidden;
      animation:sd-in .22s cubic-bezier(.4,0,.2,1); color:#1c2440;
    }
    .sd-modal::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:#2f6fed; }
    @keyframes sd-in{ from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

    .sd-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; gap:10px; }
    .sd-title{ font-size:18px; font-weight:800; color:#1c2440; }
    .sd-close{
      background:#f4f6fb; border:1px solid #eef0f6; border-radius:8px; width:30px; height:30px;
      color:#6b7280; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center;
    }
    .sd-close:hover{ border-color:#f04438; color:#f04438; }

    .sd-status-row{ margin-bottom:16px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .sd-chip{ display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; }
    .sd-chip i{ font-size:6px; }
    .sd-chip.ok{ background:#e9f9f0; color:#12b76a; }
    .sd-chip.void{ background:#feecec; color:#f04438; }
    .sd-chip.room{ background:#eaf1ff; color:#2f6fed; }

    .sd-meta-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px 18px; margin-bottom:16px; }
    @media (max-width:480px){ .sd-meta-grid{ grid-template-columns:1fr; } }
    .sd-meta-item .sd-ml{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.1px; color:#9aa1b3; margin-bottom:3px; font-weight:700; }
    .sd-meta-item .sd-mv{ font-size:13px; font-weight:600; color:#1c2440; }

    .sd-room-box{
      background:#eaf1ff; border:1px solid rgba(47,111,237,0.25);
      border-radius:10px; padding:12px 14px; margin-bottom:16px;
    }
    .sd-room-box .sd-ml{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.1px; color:#2f6fed; margin-bottom:6px; font-weight:700; }
    .sd-room-box .sd-room-line{ font-size:14px; font-weight:700; color:#1c2440; }
    .sd-room-box .sd-guest-line{ font-size:12.5px; font-weight:600; color:#6b7280; margin-top:4px; }

    .sd-section-title{
      font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:#2f6fed; font-weight:700;
      margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid rgba(47,111,237,0.25);
    }
    .sd-tbl-wrap{ overflow-x:auto; margin-bottom:4px; border:1px solid #eef0f6; border-radius:10px; }
    .sd-table{ width:100%; border-collapse:collapse; font-size:12.5px; min-width:380px; }
    .sd-table thead th{
      text-align:left; padding:8px 10px; font-size:9px; text-transform:uppercase; letter-spacing:1px;
      color:#9aa1b3; font-weight:700; background:#f4f6fb; border-bottom:1px solid #eef0f6;
    }
    .sd-table thead th.sd-r{ text-align:right; }
    .sd-table tbody td{ padding:9px 10px; border-bottom:1px solid #eef0f6; color:#1c2440; }
    .sd-table tbody td.sd-r{ text-align:right; }
    .sd-table tbody tr:last-child td{ border-bottom:none; }

    .sd-totals{ margin-top:10px; }
    .sd-trow{ display:flex; justify-content:space-between; padding:5px 0; font-size:12.5px; color:#6b7280; }
    .sd-trow.sd-grand{ border-top:1px solid #eef0f6; margin-top:4px; padding-top:10px; font-size:15px; font-weight:800; color:#2f6fed; }
    .sd-trow.sd-grand .sd-tv{ font-size:19px; }

    .sd-note-box{ background:#f4f6fb; border:1px solid #eef0f6; border-radius:10px; padding:11px 13px; font-size:12px; color:#6b7280; line-height:1.5; margin-top:14px; }
    .sd-note-box.sd-void{ background:#feecec; border-color:rgba(240,68,56,.3); color:#f04438; }
    .sd-note-box b{ color:#1c2440; }

    .sd-footer{ display:flex; gap:8px; justify-content:flex-end; margin-top:18px; padding-top:14px; border-top:1px solid #eef0f6; flex-wrap:wrap; }
    .sd-btn{
      display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px;
      font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
      font-size:12.5px; font-weight:700; cursor:pointer; border:1px solid transparent;
    }
    .sd-btn-outline{ background:#f4f6fb; border-color:#eef0f6; color:#6b7280; }
    .sd-btn-outline:hover{ border-color:rgba(47,111,237,0.25); color:#2f6fed; }
    .sd-btn-danger{ background:#feecec; border-color:rgba(240,68,56,.3); color:#f04438; }
    .sd-btn-danger:hover{ background:rgba(240,68,56,.15); }
    .sd-btn-primary{ background:#2f6fed; color:#fff; }
    .sd-btn-primary:hover{ background:#5b8ff9; }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'sd-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }
  function _esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  let _counter = 0;

  function create(options) {
    options = options || {};
    _injectStyles();

    const instId = 'sd' + (++_counter);
    const currency = options.currency || '₦';

    const overlay = document.createElement('div');
    overlay.className = 'sd-overlay';
    overlay.id = instId + '-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    function fmtN(n) {
      return currency + Math.round(n || 0).toLocaleString('en-NG');
    }

    let currentSale = null;

    function render(sale) {
      currentSale = sale;
      const isVoid = sale.status === 'voided';
      const items = sale.items || [];
      const subtotal = items.reduce(function (s, i) {
        return s + (i.qty || 0) * (i.price || 0);
      }, 0);
      const discount = sale.discount || 0;
      const total = sale.total != null ? sale.total : Math.max(0, subtotal - discount);

      const method = sale.method || '—';
      const isRoomCharge = method === 'Room Charge' || !!(sale.roomNumber);
      const roomNumber = sale.roomNumber || '';
      const guestName = sale.guestName || '';
      const guestPhone = sale.guestPhone || '';

      let roomBlock = '';
      if (isRoomCharge && (roomNumber || guestName || guestPhone)) {
        const guestLine = [guestName, guestPhone].filter(Boolean).join(' · ');
        roomBlock =
          '<div class="sd-room-box">' +
            '<div class="sd-ml">Charged to room</div>' +
            '<div class="sd-room-line">Room ' + _esc(roomNumber || '—') + '</div>' +
            (guestLine ? '<div class="sd-guest-line">' + _esc(guestLine) + '</div>' : '') +
          '</div>';
      }

      overlay.innerHTML =
        '<div class="sd-modal">' +
          '<div class="sd-head">' +
            '<div class="sd-title">' + _esc(sale.id || 'Sale') + '</div>' +
            '<button type="button" class="sd-close" id="' + instId + '-close"><i class="fa-solid fa-xmark"></i></button>' +
          '</div>' +
          '<div class="sd-status-row">' +
            '<span class="sd-chip ' + (isVoid ? 'void' : 'ok') + '"><i class="fa-solid fa-circle"></i>' +
              (isVoid ? 'Voided' : 'Completed') + '</span>' +
            (isRoomCharge ? '<span class="sd-chip room"><i class="fa-solid fa-hotel"></i>Room Charge</span>' : '') +
          '</div>' +
          '<div class="sd-meta-grid">' +
            '<div class="sd-meta-item"><div class="sd-ml">Department</div><div class="sd-mv">' + _esc(sale.dept || '—') + '</div></div>' +
            '<div class="sd-meta-item"><div class="sd-ml">Table / Location</div><div class="sd-mv">' + _esc(sale.table || '—') + '</div></div>' +
            '<div class="sd-meta-item"><div class="sd-ml">Staff</div><div class="sd-mv">' + _esc(sale.staff || '—') + '</div></div>' +
            '<div class="sd-meta-item"><div class="sd-ml">Payment Method</div><div class="sd-mv">' + _esc(method) + '</div></div>' +
            '<div class="sd-meta-item"><div class="sd-ml">Date &amp; Time</div><div class="sd-mv">' + _esc(sale.date || '—') + '</div></div>' +
          '</div>' +
          roomBlock +
          '<div class="sd-section-title">Items</div>' +
          '<div class="sd-tbl-wrap"><table class="sd-table">' +
            '<thead><tr><th>Item</th><th class="sd-r">Qty</th><th class="sd-r">Price</th><th class="sd-r">Subtotal</th></tr></thead>' +
            '<tbody>' +
              (items.length
                ? items.map(function (i) {
                    return '<tr><td>' + _esc(i.name) + '</td><td class="sd-r">' + (i.qty || 0) +
                      '</td><td class="sd-r">' + fmtN(i.price) + '</td><td class="sd-r">' +
                      fmtN((i.qty || 0) * (i.price || 0)) + '</td></tr>';
                  }).join('')
                : '<tr><td colspan="4" style="text-align:center;color:#9aa1b3;padding:16px;">No items recorded</td></tr>') +
            '</tbody></table></div>' +
          '<div class="sd-totals">' +
            '<div class="sd-trow"><span>Subtotal</span><span>' + fmtN(subtotal) + '</span></div>' +
            (discount ? '<div class="sd-trow"><span>Discount</span><span>−' + fmtN(discount) + '</span></div>' : '') +
            '<div class="sd-trow sd-grand"><span>Total</span><span class="sd-tv">' + fmtN(total) + '</span></div>' +
          '</div>' +
          (isVoid
            ? '<div class="sd-note-box sd-void"><b>Void reason:</b> ' + _esc(sale.voidReason || 'No reason provided') + '</div>'
            : (sale.notes ? '<div class="sd-note-box"><b>Notes:</b> ' + _esc(sale.notes) + '</div>' : '')) +
          '<div class="sd-footer">' +
            '<button type="button" class="sd-btn sd-btn-outline" id="' + instId + '-closeBtn">Close</button>' +
            ((!isVoid && typeof options.onVoid === 'function')
              ? '<button type="button" class="sd-btn sd-btn-danger" id="' + instId + '-voidBtn"><i class="fa-solid fa-ban"></i> Void Sale</button>'
              : '') +
            (typeof options.onPrint === 'function'
              ? '<button type="button" class="sd-btn sd-btn-primary" id="' + instId + '-printBtn"><i class="fa-solid fa-print"></i> Print Receipt</button>'
              : '') +
          '</div>' +
        '</div>';

      overlay.querySelector('#' + instId + '-close').onclick = close;
      overlay.querySelector('#' + instId + '-closeBtn').onclick = close;
      const voidBtn = overlay.querySelector('#' + instId + '-voidBtn');
      if (voidBtn) {
        voidBtn.onclick = function () {
          const s = currentSale;
          close();
          options.onVoid(s);
        };
      }
      const printBtn = overlay.querySelector('#' + instId + '-printBtn');
      if (printBtn) printBtn.onclick = function () { options.onPrint(currentSale); };
    }

    function open(sale) {
      if (!sale) return;
      render(sale);
      overlay.classList.add('sd-show');
    }
    function close() {
      overlay.classList.remove('sd-show');
      if (typeof options.onClose === 'function') options.onClose();
    }
    function destroy() { overlay.remove(); }

    return { open: open, close: close, destroy: destroy };
  }

  window.SalesDetail = { create: create };
})();