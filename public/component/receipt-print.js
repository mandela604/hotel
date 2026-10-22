/* Boston Leisure — receipt reprint for completed sales.
   `ReceiptPrint.sale(saleShape)` renders the same receipt template the
   counter print station uses and prints it locally on this device.
   Accepts a SalesDetail shape (discount = amount, dept set) or a raw
   Sale record (discount = %, subtotal present). Always prints locally —
   history reprints are never routed to the station. */
(function (global) {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtN(n) { return '\u20A6' + Math.round(Number(n) || 0).toLocaleString('en-NG'); }
  function two(n) { return String(n).padStart(2, '0'); }
  function nowStamp() {
    var d = new Date();
    return two(d.getDate()) + '/' + two(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(-2) +
      ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
  }
  function fmtDate(v) {
    if (v && typeof v === 'string' && /\d{1,2}\/\d{1,2}\/\d{4}/.test(v)) return v;
    var d = v ? new Date(v) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return two(d.getDate()) + '/' + two(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
  }

  /* hotel brand (same source as POS/station receipts) */
  var hb = {};
  function applyBrand(b) { if (b) hb = b; }
  try {
    if (global.HotelBrand && global.HotelBrand.get) {
      global.HotelBrand.get().then(applyBrand).catch(function () {});
    } else if (!document.querySelector('script[data-receipt-print-brand]')) {
      var bs = document.createElement('script');
      bs.setAttribute('data-receipt-print-brand', '1');
      bs.src = '/services/brand.js';
      bs.onload = function () { try { if (global.HotelBrand && global.HotelBrand.prefetch) global.HotelBrand.prefetch(); } catch (e) {} };
      document.head.appendChild(bs);
    }
  } catch (e) {}

  function deptLabel(s) {
    var d = s.dept || s.department || '';
    if (/pool/i.test(d)) return 'Pool Bar';
    if (/rest/i.test(d)) return 'Restaurant';
    return d || '';
  }

  function normalize(s) {
    s = s || {};
    var items = (s.items || []).map(function (i) {
      return { name: i.name || i.meal || '\u2014', qty: Number(i.qty) || 0, price: Number(i.price) || 0 };
    });
    var subtotal = 0, discPct = 0, discAmt = 0;
    var total = Number(s.total) || 0;
    if (s.subtotal != null) {                 /* raw Sale record — discount is a percentage */
      subtotal = Number(s.subtotal) || 0;
      discPct = Number(s.discount) || 0;
      discAmt = subtotal * discPct / 100;
    } else {                                  /* SalesDetail shape — discount is an amount */
      discAmt = Number(s.discount) || 0;
      if (s.total != null) subtotal = total + discAmt;
      else subtotal = items.reduce(function (a, i) { return a + i.price * i.qty; }, 0);
    }
    return {
      id: s.id || s._id || 'Receipt',
      dept: deptLabel(s),
      items: items,
      subtotal: subtotal,
      discPct: discPct,
      discAmt: discAmt,
      total: total,
      method: s.method || s.payMethod || '',
      staff: s.staff || '',
      table: s.table || '',
      notes: s.notes || '',
      date: s.date || nowStamp(),
      roomNumber: s.roomNumber || null,
      guestName: s.guestName || null,
      guestPhone: s.guestPhone || null,
      status: (s.status || '').toLowerCase(),
      voidReason: s.voidReason || '',
    };
  }

  function buildHtml(s) {
    var d = normalize(s);
    var brand = d.dept || 'Sale';
    var hbName = hb.hotelNameUpper || hb.hotelName || 'BOSTON LEISURE HOTEL AND APARTMENTS';
    var hbAddr = hb.hotelAddress || 'Idi Close, Km 75, Auchi-Benin Expressway, Ujoelen, Ekpoma, Edo State';
    var hbContact = hb.contactLine || '09039391464 / hr.bostonleisurehotel@gmail.com';
    var itemsHtml = d.items.map(function (i) {
      return '<tr><td style="padding:6px 0;border-bottom:1px solid #eee;">' + esc(i.name) + '</td>' +
        '<td style="text-align:center;padding:6px 0;border-bottom:1px solid #eee;">' + esc(i.qty) + '</td>' +
        '<td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee;">' + fmtN(i.price) + '</td>' +
        '<td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee;">' + fmtN(i.price * i.qty) + '</td></tr>';
    }).join('');
    var voidInfo = d.status === 'voided'
      ? '<div style="border:2px solid #c00;color:#c00;font-weight:800;text-align:center;padding:6px;margin-top:8px;letter-spacing:1px;">VOIDED' +
        (d.voidReason ? '<div style="font-weight:600;font-size:10px;letter-spacing:0;">' + esc(d.voidReason) + '</div>' : '') + '</div>'
      : '';
    var tableInfo = d.table && d.table !== '\u2014' ? '<div style="font-size:11px;color:#444;">Table: ' + esc(d.table) + '</div>' : '';
    var roomInfo = d.roomNumber ? '<div style="font-size:11px;color:#444;margin-top:4px;">Room ' + esc(d.roomNumber) +
      (d.guestName ? ' \u2014 ' + esc(d.guestName) : '') + (d.guestPhone ? ' \u00B7 ' + esc(d.guestPhone) : '') + '</div>' : '';
    var methodInfo = d.method ? '<div style="font-size:11px;color:#444;">Payment: ' + esc(d.method) + '</div>' : '';
    var staffInfo = d.staff ? '<div style="margin-top:8px;font-size:11px;">Staff: ' + esc(d.staff) + '</div>' : '';
    var notesInfo = d.notes ? '<div style="font-size:11px;color:#444;margin-top:6px;">Notes: ' + esc(d.notes) + '</div>' : '';

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(d.id) + '</title>' +
      '<style>@media print{@page{margin:10mm} body{margin:0}} body{font-family:Segoe UI,Arial,sans-serif;font-size:12px;color:#111;line-height:1.4;background:#fff} .r{max-width:380px;margin:0 auto;padding:18px;border:1px solid #ddd} .h{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px} .h h2{margin:0;font-size:16px;letter-spacing:.5px} .h p{margin:2px 0 0;font-size:10px;color:#555} table{width:100%;border-collapse:collapse;margin-top:8px} th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#666;border-bottom:2px solid #111;padding:6px 0} .tot{margin-top:10px;border-top:2px solid #111;padding-top:8px} .row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px} .row.total{font-weight:800;font-size:14px;border-top:1px solid #ccc;margin-top:6px;padding-top:6px} .foot{text-align:center;margin-top:14px;font-size:10px;color:#666;border-top:1px dashed #ccc;padding-top:8px}</style></head>' +
      '<body><div class="r"><div class="h"><h2>' + esc(hbName) + ' \u2014 ' + esc(brand.toUpperCase()) + '</h2>' +
      '<p>' + esc(d.dept ? 'Boston Leisure ' + d.dept : 'Boston Leisure') + ' \u00B7 Sale Receipt</p>' +
      '<p style="font-weight:700;margin-top:6px;">' + esc(d.id) + '</p>' +
      '<p>' + esc(fmtDate(d.date)) + '</p>' +
      '<p style="font-size:10px;">' + esc(hbAddr) + '</p>' +
      '<p style="font-size:10px;">' + esc(hbContact) + '</p>' +
      tableInfo + roomInfo + methodInfo + '</div>' +
      '<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amt</th></tr></thead><tbody>' +
      itemsHtml + '</tbody></table>' +
      '<div class="tot"><div class="row"><span>Subtotal</span><span>' + fmtN(d.subtotal) + '</span></div>' +
      (d.discAmt > 0
        ? '<div class="row"><span>Discount' + (d.discPct ? ' (' + d.discPct + '%)' : '') + '</span><span>-' + fmtN(d.discAmt) + '</span></div>'
        : '') +
      '<div class="row total"><span>TOTAL</span><span>' + fmtN(d.total) + '</span></div></div>' +
      voidInfo + staffInfo + notesInfo +
      '<div class="foot">Thank you for your patronage<br>Printed: ' + esc(nowStamp()) + '</div></div></body></html>';
  }

  function print(html) {
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.title = 'receipt-print';
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(f);
    try {
      var doc = f.contentWindow.document;
      doc.open(); doc.write(html); doc.close();
      setTimeout(function () {
        try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
        setTimeout(function () { try { f.parentNode && f.parentNode.removeChild(f); } catch (e) {} }, 90000);
      }, 400);
    } catch (e) {
      try { f.parentNode && f.parentNode.removeChild(f); } catch (e2) {}
    }
  }

  global.ReceiptPrint = {
    sale: function (saleShape) { print(buildHtml(saleShape)); },
    buildHtml: buildHtml,
    print: print,
  };
})(window);
