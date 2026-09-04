/**
 * component/booking-modal.js — Compact New / Edit / View Booking modal
 * ─────────────────────────────────────────────────────────────────
 * - Check out (checked-in only) → service.checkoutBooking(room)
 *   (does checkout + moves room to cleaning in one call)
 * - Payments: ledger table + accordion for new payment
 * - Room charges: settle with custom confirm (not reversible)
 * - Discount = money amount per night × nights
 * - paid = SUM of payments[]
 */
(function (global) {
  'use strict';

  if (global.BookingModal) return;

  var CSS_ID = 'bkm-modal-css';
  var FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif";

  var CSS = `
  .bkm-overlay{
    display:none; position:fixed; inset:0; background:rgba(15,20,40,0.55); backdrop-filter:blur(5px);
    z-index:320; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;
    font-family:${FONT};
    --bkm-bg:#f4f6fb; --bkm-surface:#ffffff; --bkm-surface2:#f4f6fb; --bkm-surface3:#eef0f6;
    --bkm-border:#eef0f6; --bkm-border2:#dfe3ec;
    --bkm-text:#1c2440; --bkm-text2:#5b647a; --bkm-text3:#6b7280;
    --bkm-input:#ffffff; --bkm-modal:#ffffff;
    --bkm-gold:#2f6fed; --bkm-gold-light:#5b8ff9; --bkm-gold-dim:rgba(47,111,237,0.10); --bkm-gold-border:rgba(47,111,237,0.25);
    --bkm-green:#12b76a; --bkm-green-bg:#e9f9f0;
    --bkm-red:#f04438; --bkm-red-bg:#feecec;
    --bkm-amber:#f79009; --bkm-amber-bg:#fff4e5;
    --bkm-blue:#2f6fed; --bkm-blue-bg:#eaf1ff;
  }
  .bkm-overlay.show{ display:flex; }
  .bkm-modal{
    background:var(--bkm-modal); border:1px solid var(--bkm-border); border-radius:16px;
    padding:18px 20px 16px; width:min(980px,98vw); box-shadow:0 30px 80px rgba(15,20,40,0.25); margin:auto;
    position:relative; overflow:hidden;
  }
  .bkm-modal::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--bkm-gold); }
  .bkm-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:10px; }
  .bkm-title{ font-size:17px; font-weight:800; color:var(--bkm-text); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .bkm-sub{ font-size:11px; color:var(--bkm-text3); margin-top:2px; font-weight:600; }
  .bkm-close{
    background:var(--bkm-surface2); border:1px solid var(--bkm-border); border-radius:8px;
    width:28px; height:28px; color:var(--bkm-text2); font-size:13px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .bkm-close:hover{ color:var(--bkm-text); border-color:var(--bkm-gold-border); }
  .bkm-view-pill{
    font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1px;
    background:var(--bkm-blue-bg); color:var(--bkm-blue); padding:2px 8px; border-radius:20px;
  }
  .bkm-notice{
    display:none; align-items:center; gap:7px; font-size:11px; font-weight:600;
    color:var(--bkm-amber); background:var(--bkm-amber-bg); border:1px solid rgba(247,144,9,.25);
    border-radius:8px; padding:7px 11px; margin-bottom:10px;
  }
  .bkm-notice.show{ display:flex; }
  .bkm-notice.info{ color:var(--bkm-blue); background:var(--bkm-blue-bg); border-color:rgba(47,111,237,.25); }

  .bkm-cols{ display:grid; grid-template-columns:1.1fr 1.1fr 0.95fr; gap:12px; margin-bottom:12px; }
  @media (max-width:820px){ .bkm-cols{ grid-template-columns:1fr; } }

  .bkm-col{
    background:var(--bkm-surface2); border:1px solid var(--bkm-border); border-radius:12px; padding:12px 12px 10px;
  }
  .bkm-col-title{
    font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:var(--bkm-gold); font-weight:800;
    margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid var(--bkm-gold-border);
    display:flex; align-items:center; gap:6px;
  }
  .bkm-fg{ display:flex; flex-direction:column; gap:3px; margin-bottom:8px; }
  .bkm-fg:last-child{ margin-bottom:0; }
  .bkm-row2{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .bkm-row3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
  .bkm-label{
    font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:#5b647a; font-weight:700;
    display:flex; align-items:center; gap:4px;
  }
  .bkm-lock{
    font-size:8px; background:var(--bkm-surface3); color:var(--bkm-text3);
    padding:1px 5px; border-radius:6px; font-weight:700; text-transform:none; letter-spacing:0;
  }
  .bkm-input,.bkm-select{
    background:var(--bkm-input); border:1px solid var(--bkm-border2); border-radius:8px;
    padding:7px 10px; color:var(--bkm-text); font-family:inherit; font-size:12.5px; outline:none; width:100%;
  }
  .bkm-input:focus,.bkm-select:focus{ border-color:var(--bkm-gold-border); }
  .bkm-input[readonly],.bkm-input:disabled,.bkm-select:disabled{
    opacity:1; color:var(--bkm-text); background:#eef1f7; border-color:var(--bkm-border); cursor:default;
  }
  .bkm-hint{ font-size:10.5px; color:var(--bkm-text3); margin-top:3px; font-weight:600; }

  .bkm-guest-wrap{ position:relative; }
  .bkm-guest-drop{
    position:absolute; top:calc(100% + 2px); left:0; right:0; z-index:400;
    background:var(--bkm-surface); border:1px solid var(--bkm-border); border-radius:10px;
    box-shadow:0 12px 40px rgba(15,20,40,0.18); display:none; max-height:200px; overflow-y:auto;
  }
  .bkm-guest-drop.show{ display:block; }
  .bkm-guest-opt{ padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--bkm-border); }
  .bkm-guest-opt:last-child{ border-bottom:none; }
  .bkm-guest-opt:hover{ background:var(--bkm-gold-dim); }
  .bkm-guest-opt-name{ font-size:12px; font-weight:700; color:var(--bkm-text); display:flex; align-items:center; gap:6px; }
  .bkm-guest-opt-sub{ font-size:10.5px; color:var(--bkm-text3); margin-top:1px; }
  .bkm-tag{ font-size:8.5px; font-weight:700; padding:1px 6px; border-radius:20px; background:var(--bkm-blue-bg); color:var(--bkm-blue); }
  .bkm-tag.vip{ background:var(--bkm-amber-bg); color:var(--bkm-amber); }

  .bkm-rate-line{
    display:flex; justify-content:space-between; align-items:center; gap:8px;
    padding:5px 0; border-bottom:1px dashed var(--bkm-border); font-size:12px;
  }
  .bkm-rate-line:last-of-type{ border-bottom:none; }
  .bkm-rate-k{ color:#5b647a; font-weight:600; font-size:11px; }
  .bkm-rate-v{ font-weight:800; color:var(--bkm-text); }
  .bkm-rate-v.green{ color:var(--bkm-green); }
  .bkm-rate-v.red{ color:var(--bkm-red); }
  .bkm-rate-v.gold{ color:var(--bkm-gold); }

  .bkm-bottom{ display:grid; grid-template-columns:1fr 200px; gap:12px; margin-bottom:12px; }
  @media (max-width:720px){ .bkm-bottom{ grid-template-columns:1fr; } }

  .bkm-pay-panel,.bkm-status-panel{
    background:var(--bkm-surface2); border:1px solid var(--bkm-border); border-radius:12px; padding:12px;
  }
  .bkm-pay-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .bkm-pay-title{
    font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:var(--bkm-gold); font-weight:800;
    display:flex; align-items:center; gap:6px;
  }
  .bkm-pay-table-wrap{ overflow-x:auto; max-height:170px; overflow-y:auto; }
  .bkm-pay-table{ width:100%; border-collapse:collapse; min-width:420px; }
  .bkm-pay-table th{
    text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#5b647a;
    font-weight:700; padding:5px 8px; background:var(--bkm-surface3); border-bottom:1px solid var(--bkm-border);
    white-space:nowrap;
  }
  .bkm-pay-table td{
    padding:6px 8px; border-bottom:1px solid var(--bkm-border); font-size:12px; color:var(--bkm-text);
    vertical-align:middle; font-weight:600;
  }
  .bkm-pay-table tr:last-child td{ border-bottom:none; }
  .bkm-pay-amt{ font-weight:800; color:var(--bkm-green); white-space:nowrap; }
  .bkm-pay-empty{ font-size:11.5px; color:var(--bkm-text3); font-weight:600; padding:8px 2px; }

  .bkm-pay-acc{
    margin-top:10px; border:1px solid var(--bkm-border2); border-radius:10px; overflow:hidden; background:var(--bkm-surface);
  }
  .bkm-pay-acc[hidden]{ display:none !important; }
  .bkm-pay-acc-head{
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    padding:9px 12px; cursor:pointer; user-select:none;
    background:var(--bkm-surface3); border-bottom:1px solid transparent;
  }
  .bkm-pay-acc.open .bkm-pay-acc-head{ border-bottom-color:var(--bkm-border2); }
  .bkm-pay-acc-head span{ font-size:11.5px; font-weight:700; color:var(--bkm-text); }
  .bkm-pay-acc-head i{ font-size:11px; color:var(--bkm-text3); transition:transform .2s; }
  .bkm-pay-acc.open .bkm-pay-acc-head i{ transform:rotate(180deg); }
  .bkm-pay-acc-body{ display:none; padding:12px; }
  .bkm-pay-acc.open .bkm-pay-acc-body{ display:block; }
  .bkm-new-pay{
    display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:8px; align-items:end;
  }
  @media (max-width:560px){ .bkm-new-pay{ grid-template-columns:1fr 1fr; } }

  .bkm-status-group{ margin-bottom:12px; }
  .bkm-status-group:last-child{ margin-bottom:0; }
  .bkm-status-label{
    font-size:10px; text-transform:uppercase; letter-spacing:1.2px; color:#5b647a; font-weight:700; margin-bottom:6px;
  }
  .bkm-radio{
    display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--bkm-text);
    margin-bottom:5px; cursor:pointer;
  }
  .bkm-radio input{ accent-color:var(--bkm-gold); }
  .bkm-radio input:disabled{ cursor:default; }

  .bkm-charges{ margin-top:10px; border-top:1px dashed var(--bkm-border2); padding-top:10px; }
  .bkm-charge-card{
    background:var(--bkm-surface); border:1px solid var(--bkm-border); border-radius:8px;
    padding:10px; margin-bottom:6px;
  }
  .bkm-charge-desc{ font-size:12px; font-weight:700; color:var(--bkm-text); }
  .bkm-charge-meta{ font-size:10.5px; color:var(--bkm-text3); font-weight:600; margin-top:2px; }
  .bkm-charge-bal{ font-size:11px; font-weight:700; }
  .bkm-charge-bal.owe{ color:var(--bkm-red); }
  .bkm-charge-bal.clear{ color:var(--bkm-green); }
  .bkm-btn-sm-inline{
    background:var(--bkm-surface); border:1px solid var(--bkm-gold-border); color:var(--bkm-gold);
    font-size:10.5px; font-weight:700; padding:4px 9px; border-radius:6px; cursor:pointer; font-family:inherit;
  }
  .bkm-btn-sm-inline:hover{ background:var(--bkm-gold-dim); }
  .bkm-settle-form{
    margin-top:8px; padding-top:8px; border-top:1px dashed var(--bkm-border2);
    display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:8px; align-items:end;
  }
  @media (max-width:560px){ .bkm-settle-form{ grid-template-columns:1fr 1fr; } }
  .bkm-charge-ledger{ margin-top:6px; font-size:10.5px; color:var(--bkm-text3); font-weight:600; line-height:1.45; }

  .bkm-foot{
    display:flex; gap:8px; justify-content:flex-end; padding-top:12px;
    border-top:1px solid var(--bkm-border); flex-wrap:wrap; align-items:center;
  }
  .bkm-meta{ margin-right:auto; font-size:10.5px; color:var(--bkm-text3); font-weight:600; line-height:1.4; }
  .bkm-btn{
    display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:9px;
    font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; border:1px solid transparent;
  }
  .bkm-btn-primary{ background:var(--bkm-gold); color:#fff; border-color:var(--bkm-gold); box-shadow:0 4px 10px rgba(47,111,237,0.28); }
  .bkm-btn-primary:hover{ background:var(--bkm-gold-light); }
  .bkm-btn-primary:disabled{ opacity:.5; cursor:not-allowed; }
  .bkm-btn-outline{ background:var(--bkm-surface); border-color:var(--bkm-border); color:var(--bkm-text); }
  .bkm-btn-outline:hover{ border-color:var(--bkm-gold-border); color:var(--bkm-gold); }
  .bkm-btn-danger{ background:var(--bkm-surface); border-color:var(--bkm-border); color:var(--bkm-red); }
  .bkm-btn-danger:hover{ border-color:rgba(240,68,56,0.4); background:var(--bkm-red-bg); }
  .bkm-btn-checkout{ background:var(--bkm-amber-bg); border-color:rgba(247,144,9,.35); color:var(--bkm-amber); }
  .bkm-btn-checkout:hover{ background:#ffe8c2; }
  .bkm-btn[hidden]{ display:none !important; }

  .bkm-confirm-ov{
    display:none; position:absolute; inset:0; background:rgba(15,20,40,0.45);
    align-items:center; justify-content:center; z-index:20; border-radius:16px; padding:16px;
  }
  .bkm-confirm-ov.show{ display:flex; }
  .bkm-confirm-box{
    background:#fff; border:1px solid var(--bkm-border); border-radius:12px; padding:18px 16px;
    width:min(340px,100%); box-shadow:0 16px 40px rgba(15,20,40,0.2);
  }
  .bkm-confirm-box h4{ font-size:15px; font-weight:800; color:var(--bkm-text); margin:0 0 6px; }
  .bkm-confirm-box p{ font-size:12.5px; color:var(--bkm-text2); margin:0 0 14px; line-height:1.5; font-weight:600; }
  .bkm-confirm-acts{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }

  .bkm-toast{
    position:fixed; bottom:20px; right:20px; background:#fff; border:1px solid #eef0f6; border-radius:10px;
    padding:11px 16px; font-size:12.5px; color:#1c2440; box-shadow:0 8px 28px rgba(15,34,55,0.18);
    z-index:999; display:flex; align-items:center; gap:8px; font-family:${FONT}; max-width:calc(100vw - 40px);
  }
  .bkm-toast.success{ border-left:3px solid #12b76a; }
  .bkm-toast.error{ border-left:3px solid #f04438; }
  .bkm-toast.info{ border-left:3px solid #2f6fed; }
  `;

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function fmtN(n) {
    var num = Math.round(Number(n) || 0);
    return '₦' + num.toLocaleString('en-NG', { maximumFractionDigits: 0 });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function create(opts) {
    opts = opts || {};
    injectCss();

    var service = opts.service || global.BookingData || null;
    var onSaved = typeof opts.onSaved === 'function' ? opts.onSaved : function () {};
    var onDeleted = typeof opts.onDeleted === 'function' ? opts.onDeleted : null;
    var onCloseCb = typeof opts.onClose === 'function' ? opts.onClose : null;
    var externalSession = opts.session || null;

    function nights(ci, co) {
      if (service && service.nights) return service.nights(ci, co);
      if (!ci || !co) return 0;
      var n = (new Date(co) - new Date(ci)) / 86400000;
      return n > 0 ? n : 0;
    }
    function calcTotal(bk) {
      var n = nights(bk.checkin, bk.checkout) || 1;
      var discAmt = (Number(bk.discount) || 0) * n;
      return Math.max(0, (bk.rate || 0) * n - discAmt);
    }
    function calcPaid(bk) {
      if (service && service.calcPaid) return service.calcPaid(bk);
      if (Array.isArray(bk.payments) && bk.payments.length) {
        return bk.payments.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
      }
      return Number(bk.paid) || 0;
    }
    function calcBal(bk) {
      return Math.max(0, calcTotal(bk) - calcPaid(bk));
    }
    function chargePaid(c) {
      if (Array.isArray(c.payments) && c.payments.length) {
        return c.payments.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
      }
      return Number(c.paid) || 0;
    }
    function chargeBal(c) {
      return Math.max(0, (Number(c.amount) || 0) - chargePaid(c));
    }

    function canDiscount(session) {
      if (global.Permissions && Permissions.canGiveDiscount) {
        return !!Permissions.canGiveDiscount(session, 'booking');
      }
      if (session && session.permissions && typeof session.permissions.canGiveDiscount === 'boolean') {
        return session.permissions.canGiveDiscount;
      }
      return !!(session && String(session.role).toLowerCase() === 'admin');
    }
    function canCreate(session) {
      if (global.Permissions && Permissions.hasPermission) {
        return !!Permissions.hasPermission(session, 'canCreate', 'booking');
      }
      return true;
    }
    function canEditEntity(session, entity) {
      if (global.Permissions && Permissions.canEdit) {
        return !!Permissions.canEdit(session, 'booking', entity);
      }
      return true;
    }
    function canDeleteEntity(session, entity) {
      if (global.Permissions && Permissions.canDelete) {
        return !!Permissions.canDelete(session, 'booking', entity);
      }
      return !!(session && String(session.role).toLowerCase() === 'admin');
    }
    function roomStatus(bookingsArr, num) {
      var b = (bookingsArr || []).find(function (r) { return r.room === num; });
      if (!b || !b.status) return 'available';
      if (b.status === 'vacant') return 'available';
      if (b.status === 'reserved' && b.checkin) {
        var today = new Date(); today.setHours(0,0,0,0);
        var resStart = new Date(b.checkin); resStart.setHours(0,0,0,0);
        if (today < resStart) return 'available';
      }
      return b.status;
    }

    var mode = 'new';
    var editBooking = null;
    var currentGuest = null;
    var rooms = [];
    var bookings = [];
    var guests = [];
    var session = externalSession;
    var saving = false;
    var addingPayment = false;
    var settlingIdx = null;
    var pendingSettle = null; // { idx, amt, mode }

    var root = document.createElement('div');
    root.className = 'bkm-overlay';
    root.innerHTML =
      '<div class="bkm-modal" role="dialog" aria-modal="true">' +
        '<div class="bkm-confirm-ov" data-role="confirmOv">' +
          '<div class="bkm-confirm-box">' +
            '<h4 data-role="confirmTitle">Are you sure?</h4>' +
            '<p data-role="confirmMsg">This action cannot be reversed.</p>' +
            '<div class="bkm-confirm-acts">' +
              '<button type="button" class="bkm-btn bkm-btn-outline" data-act="confirmNo">Cancel</button>' +
              '<button type="button" class="bkm-btn bkm-btn-primary" data-act="confirmYes">Yes, continue</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="bkm-head">' +
          '<div>' +
            '<div class="bkm-title" data-role="title">New Booking</div>' +
            '<div class="bkm-sub" data-role="sub">Guest · stay · payments</div>' +
          '</div>' +
          '<button type="button" class="bkm-close" data-act="close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="bkm-notice" data-role="notice"><i class="fa-solid fa-lock"></i> <span data-role="noticeText">View only</span></div>' +

        '<div class="bkm-cols">' +
          '<div class="bkm-col">' +
            '<div class="bkm-col-title"><i class="fa-solid fa-user"></i> Guest Information</div>' +
            '<div class="bkm-fg">' +
              '<label class="bkm-label">Full name</label>' +
              '<div class="bkm-guest-wrap">' +
                '<input class="bkm-input" data-role="name" type="text" placeholder="Search guest or type new name" autocomplete="off">' +
                '<div class="bkm-guest-drop" data-role="guestDrop"></div>' +
              '</div>' +
            '</div>' +
            '<div class="bkm-row2">' +
              '<div class="bkm-fg"><label class="bkm-label">Phone</label><input class="bkm-input" data-role="phone" type="text" placeholder="+234 …"></div>' +
              '<div class="bkm-fg"><label class="bkm-label">Email</label><input class="bkm-input" data-role="email" type="email" placeholder="optional"></div>' +
            '</div>' +
            '<div class="bkm-fg"><label class="bkm-label">Address</label><input class="bkm-input" data-role="address" type="text" placeholder="Street, city"></div>' +
            '<div class="bkm-row2">' +
              '<div class="bkm-fg">' +
                '<label class="bkm-label">ID type</label>' +
                '<select class="bkm-select" data-role="idType">' +
                  '<option value="NIN">NIN</option><option value="Passport">Passport</option>' +
                  '<option value="Driver\'s Licence">Driver\'s Licence</option><option value="Voter\'s Card">Voter\'s Card</option>' +
                '</select>' +
              '</div>' +
              '<div class="bkm-fg"><label class="bkm-label">ID number</label><input class="bkm-input" data-role="idNum" type="text"></div>' +
            '</div>' +
            '<div class="bkm-fg"><label class="bkm-label">Notes</label><input class="bkm-input" data-role="notes" type="text" placeholder="Special requests…"></div>' +
          '</div>' +

          '<div class="bkm-col">' +
            '<div class="bkm-col-title"><i class="fa-solid fa-bed"></i> Booking Information</div>' +
            '<div class="bkm-fg">' +
              '<label class="bkm-label">Room</label>' +
              '<select class="bkm-select" data-role="room"></select>' +
            '</div>' +
            '<div class="bkm-row2">' +
              '<div class="bkm-fg"><label class="bkm-label">Type</label><input class="bkm-input" data-role="type" type="text" readonly></div>' +
              '<div class="bkm-fg"><label class="bkm-label">Rate / night</label><input class="bkm-input" data-role="rate" type="number" min="0" step="500"></div>' +
            '</div>' +
            '<div class="bkm-row2">' +
              '<div class="bkm-fg"><label class="bkm-label">Check-in</label><input class="bkm-input" data-role="checkin" type="date"></div>' +
              '<div class="bkm-fg"><label class="bkm-label">Check-out</label><input class="bkm-input" data-role="checkout" type="date"></div>' +
            '</div>' +
            '<div class="bkm-row3">' +
              '<div class="bkm-fg"><label class="bkm-label">Nights</label><input class="bkm-input" data-role="nightsDisp" type="text" readonly value="0"></div>' +
              '<div class="bkm-fg"><label class="bkm-label">Adults</label><input class="bkm-input" data-role="adults" type="number" min="1" max="99" value="1"></div>' +
              '<div class="bkm-fg"><label class="bkm-label">Children</label><input class="bkm-input" data-role="children" type="number" min="0" max="99" value="0"></div>' +
            '</div>' +
          '</div>' +

          '<div class="bkm-col">' +
            '<div class="bkm-col-title"><i class="fa-solid fa-naira-sign"></i> Rate Information</div>' +
            '<div class="bkm-fg">' +
              '<label class="bkm-label">Discount (₦ / night) <span class="bkm-lock" data-role="discLock" hidden>Locked</span></label>' +
              '<input class="bkm-input" data-role="discount" type="number" min="0" step="100" value="0">' +
            '</div>' +
            '<div class="bkm-rate-line"><span class="bkm-rate-k">Subtotal</span><span class="bkm-rate-v" data-role="dispTotal">₦0</span></div>' +
            '<div class="bkm-rate-line"><span class="bkm-rate-k">After discount</span><span class="bkm-rate-v gold" data-role="dispAfter">₦0</span></div>' +
            '<div class="bkm-rate-line"><span class="bkm-rate-k">Amount paid</span><span class="bkm-rate-v green" data-role="dispPaid">₦0</span></div>' +
            '<div class="bkm-rate-line"><span class="bkm-rate-k">Balance</span><span class="bkm-rate-v red" data-role="dispBal">₦0</span></div>' +
            '<div class="bkm-rate-line"><span class="bkm-rate-k">Pay status</span><span class="bkm-rate-v" data-role="payStatus">Pending</span></div>' +
            '<div class="bkm-fg" style="margin-top:8px;" data-role="depositWrap">' +
              '<label class="bkm-label">Payment</label>' +
              '<input class="bkm-input" data-role="paid" type="number" min="0" step="500" value="0">' +
            '</div>' +
            '<div class="bkm-fg" data-role="payMethodWrap">' +
              '<label class="bkm-label">Pay method</label>' +
              '<select class="bkm-select" data-role="payMethod">' +
                '<option>Cash</option><option>POS</option><option>Transfer</option>' +
                '<option>Split – Cash + Transfer</option><option>Room Charge</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="bkm-bottom">' +
          '<div class="bkm-pay-panel">' +
            '<div class="bkm-pay-head">' +
              '<div class="bkm-pay-title"><i class="fa-solid fa-clock-rotate-left"></i> Payments</div>' +
              '<button type="button" class="bkm-btn bkm-btn-primary" data-act="addPayment" style="padding:5px 10px;font-size:11.5px;" hidden>' +
                '<i class="fa-solid fa-plus"></i> Record payment' +
              '</button>' +
            '</div>' +
            '<div class="bkm-pay-acc" data-role="paymentsAcc">' +
              '<div class="bkm-pay-acc-head" data-act="togglePaymentsAcc">' +
                '<span>Payment history <span data-role="payCount" style="font-weight:600;color:var(--bkm-text3);margin-left:6px;"></span></span>' +
                '<i class="fa-solid fa-chevron-down"></i>' +
              '</div>' +
              '<div class="bkm-pay-acc-body">' +
                '<div class="bkm-pay-table-wrap">' +
                  '<table class="bkm-pay-table">' +
                    '<thead><tr><th>Amount</th><th>Mode</th><th>Date</th><th>Recorded by</th></tr></thead>' +
                    '<tbody data-role="paymentBody"></tbody>' +
                  '</table>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="bkm-pay-acc" data-role="payAcc" hidden>' +
              '<div class="bkm-pay-acc-head" data-act="togglePayAcc">' +
                '<span><i class="fa-solid fa-money-bill-wave" style="margin-right:6px;color:var(--bkm-gold);"></i>New payment</span>' +
                '<i class="fa-solid fa-chevron-down"></i>' +
              '</div>' +
              '<div class="bkm-pay-acc-body">' +
                '<div class="bkm-new-pay">' +
                  '<div class="bkm-fg" style="margin:0;"><label class="bkm-label">Amount</label>' +
                    '<input class="bkm-input" data-role="newPayAmount" type="number" min="0" step="500" placeholder="0"></div>' +
                  '<div class="bkm-fg" style="margin:0;"><label class="bkm-label">Mode</label>' +
                    '<select class="bkm-select" data-role="newPayMode"><option>Cash</option><option>POS</option><option>Transfer</option></select></div>' +
                  '<div class="bkm-fg" style="margin:0;"><label class="bkm-label">Recorded by</label>' +
                    '<input class="bkm-input" data-role="newPayBy" type="text" readonly></div>' +
                  '<button type="button" class="bkm-btn bkm-btn-primary" data-act="confirmPay" style="padding:7px 12px;font-size:12px;">' +
                    '<i class="fa-solid fa-check"></i> Add' +
                  '</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="bkm-pay-acc" data-role="chargesAcc" hidden>' +
              '<div class="bkm-pay-acc-head" data-act="toggleChargesAcc">' +
                '<span><i class="fa-solid fa-receipt" style="margin-right:6px;color:var(--bkm-gold);"></i>Room charges <span data-role="chargesCount" style="font-weight:600;color:var(--bkm-text3);margin-left:6px;"></span></span>' +
                '<i class="fa-solid fa-chevron-down"></i>' +
              '</div>' +
              '<div class="bkm-pay-acc-body">' +
                '<div data-role="chargesList"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="bkm-status-panel">' +
            '<div class="bkm-status-group">' +
              '<div class="bkm-status-label">Booking status</div>' +
              '<label class="bkm-radio"><input type="radio" name="bkmStatus" data-role="statusReserved" value="reserved"> Reserved</label>' +
              '<label class="bkm-radio"><input type="radio" name="bkmStatus" data-role="statusCheckedin" value="checkedin"> Checked-in</label>' +
            '</div>' +
            '<div class="bkm-status-group" data-role="roomStatusHint" hidden>' +
              '<div class="bkm-status-label">Room state</div>' +
              '<div style="font-size:12px;color:var(--bkm-text);font-weight:700;" data-role="roomStateText">—</div>' +
              '<button type="button" class="bkm-btn bkm-btn-checkout" data-act="checkout" hidden style="margin-top:10px;width:100%;justify-content:center;"><i class="fa-solid fa-right-from-bracket"></i> Check out</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="bkm-foot">' +
          '<div class="bkm-meta" data-role="metaFoot"></div>' +
          '<button type="button" class="bkm-btn bkm-btn-danger" data-act="delete" hidden><i class="fa-solid fa-trash"></i> Delete</button>' +
          '<button type="button" class="bkm-btn bkm-btn-outline" data-act="close">Close</button>' +
          '<button type="button" class="bkm-btn bkm-btn-primary" data-act="save"><i class="fa-solid fa-check"></i> Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    function $(sel) { return root.querySelector(sel); }
    function val(role) { var el = $('[data-role="' + role + '"]'); return el ? el.value : ''; }
    function setVal(role, v) { var el = $('[data-role="' + role + '"]'); if (el) el.value = v == null ? '' : v; }

    function toast(msg, type) {
      type = type || 'success';
      var t = document.createElement('div');
      t.className = 'bkm-toast ' + type;
      var icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
      // Use esc() on msg to prevent XSS from error messages that may contain user input
      t.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + esc(String(msg == null ? '' : msg));
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 3400);
    }

    function showConfirm(title, msg) {
      return new Promise(function (resolve) {
        var ov = $('[data-role="confirmOv"]');
        var tEl = $('[data-role="confirmTitle"]');
        var mEl = $('[data-role="confirmMsg"]');
        if (tEl) tEl.textContent = title || 'Are you sure?';
        if (mEl) mEl.textContent = msg || 'This action cannot be reversed.';
        if (ov) ov.classList.add('show');
        root._confirmResolve = resolve;
      });
    }
    function hideConfirm(answer) {
      var ov = $('[data-role="confirmOv"]');
      if (ov) ov.classList.remove('show');
      var r = root._confirmResolve;
      root._confirmResolve = null;
      if (r) r(!!answer);
    }

    function getStatusRadio() {
      var checked = root.querySelector('input[name="bkmStatus"]:checked');
      return checked ? checked.value : 'reserved';
    }
    function setStatusRadio(st) {
      var v = st === 'checkedin' ? 'checkedin' : 'reserved';
      var r = $('[data-role="statusReserved"]');
      var c = $('[data-role="statusCheckedin"]');
      if (r) r.checked = v === 'reserved';
      if (c) c.checked = v === 'checkedin';
    }

    function refreshCalcs() {
      var ci = val('checkin');
      var co = val('checkout');
      var rate = parseFloat(val('rate')) || 0;
      var disc = parseFloat(val('discount')) || 0;
      var n = nights(ci, co);
      var raw = rate * (n || 0);
      var after = Math.max(0, raw - disc * (n || 0));

      var paid = 0;
      var bal = after;
      if (mode === 'new') {
        paid = parseFloat(val('paid')) || 0;
        bal = Math.max(0, after - paid);
      } else if (editBooking) {
        paid = calcPaid(editBooking);
        bal = calcBal(Object.assign({}, editBooking, {
          rate: rate, discount: disc, checkin: ci, checkout: co,
        }));
      }

      setVal('nightsDisp', String(n || 0));
      var elT = $('[data-role="dispTotal"]');
      var elA = $('[data-role="dispAfter"]');
      var elP = $('[data-role="dispPaid"]');
      var elB = $('[data-role="dispBal"]');
      var elS = $('[data-role="payStatus"]');
      if (elT) elT.textContent = fmtN(raw);
      if (elA) elA.textContent = fmtN(after);
      if (elP) elP.textContent = fmtN(paid);
      if (elB) {
        elB.textContent = fmtN(bal);
        elB.className = 'bkm-rate-v ' + (bal > 0 ? 'red' : 'green');
      }
      var status = paid <= 0 ? 'Pending' : (paid >= after ? 'Fully Paid' : 'Deposit Paid');
      if (elS) elS.textContent = status;
    }

    function populateRooms(preferNum) {
      var sel = $('[data-role="room"]');
      if (!sel) return;
      sel.innerHTML = '<option value="">Select room…</option>';
      rooms.forEach(function (r) {
        var st = roomStatus(bookings, r.num);
        var keep = st === 'available' || r.num === preferNum;
        if (!keep) return;
        var opt = document.createElement('option');
        opt.value = r.num + '|' + r.type + '|' + r.rate;
        opt.textContent = r.num + ' – ' + r.type + ' (' + fmtN(r.rate) + '/nt)' +
          (r.num === preferNum ? ' · current' : '');
        sel.appendChild(opt);
      });
      if (preferNum) {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value.indexOf(preferNum + '|') === 0) {
            sel.value = sel.options[i].value;
            break;
          }
        }
        onRoomChange();
      }
    }

    function onRoomChange() {
      var v = val('room');
      if (!v) { setVal('type', ''); setVal('rate', ''); refreshCalcs(); return; }
      var p = v.split('|');
      setVal('type', p[1] || '');
      setVal('rate', p[2] || '');
      refreshCalcs();
    }

    function applyDiscountLock() {
      var allow = canDiscount(session);
      var disc = $('[data-role="discount"]');
      var lock = $('[data-role="discLock"]');
      var forceLock = mode === 'view';
      if (disc) disc.disabled = !allow || forceLock;
      if (lock) lock.hidden = allow && !forceLock;
    }

    function paymentActionsAllowed() {
      return (mode === 'edit' || mode === 'view') && canEditEntity(session, editBooking);
    }

    function applyEditability() {
      var notice = $('[data-role="notice"]');
      var noticeText = $('[data-role="noticeText"]');
      var saveBtn = $('[data-act="save"]');
      var delBtn = $('[data-act="delete"]');
      var checkoutBtn = $('[data-act="checkout"]');
      var depositWrap = $('[data-role="depositWrap"]');
      var payMethodWrap = $('[data-role="payMethodWrap"]');

      var editable;
      if (mode === 'new') editable = canCreate(session);
      else if (mode === 'edit') editable = canEditEntity(session, editBooking);
      else editable = false;

      if (notice) {
        notice.classList.remove('info');
        if (mode === 'view') {
          notice.classList.add('show', 'info');
          if (noticeText) noticeText.textContent = 'Read-only details. You can still record payments below if permitted.';
        } else if (!editable) {
          notice.classList.add('show');
          if (noticeText) noticeText.textContent = 'You can view this booking but cannot save changes.';
        } else {
          notice.classList.remove('show');
        }
      }

      if (saveBtn) {
        saveBtn.hidden = mode === 'view';
        saveBtn.disabled = !editable || saving || mode === 'view';
      }
      if (delBtn) {
        delBtn.hidden = !(mode === 'edit' && onDeleted && canDeleteEntity(session, editBooking));
      }
      if (checkoutBtn) {
        var canCo = !!editBooking && editBooking.status === 'checkedin' && canEditEntity(session, editBooking);
        checkoutBtn.hidden = !canCo;
      }
      if (depositWrap) depositWrap.hidden = mode !== 'new';
      if (payMethodWrap) payMethodWrap.hidden = mode !== 'new';

      root.querySelectorAll('.bkm-input, .bkm-select').forEach(function (el) {
        var role = el.getAttribute('data-role');
        if (!role) return;
        if (role === 'type' || role === 'nightsDisp' || role === 'newPayBy') return;
        if (role === 'discount') return;
        if (role === 'newPayAmount' || role === 'newPayMode') return;
        if (role === 'settleAmount' || role === 'settleMode') return;
        if (role === 'paid' && mode !== 'new') { el.disabled = true; return; }
        el.disabled = !editable;
      });

      root.querySelectorAll('input[name="bkmStatus"]').forEach(function (el) {
        el.disabled = !editable;
        // Hide status radio in edit mode — check-in goes through the
        // dedicated POST /:room/checkin endpoint, not the edit form.
        if (mode !== 'new') el.closest('.bkm-status-group').hidden = true;
        else el.closest('.bkm-status-group').hidden = false;
      });

      applyDiscountLock();
    }

    function clearForm() {
      ['name', 'phone', 'email', 'address', 'idNum', 'checkin', 'checkout', 'rate', 'paid', 'notes'].forEach(function (k) {
        setVal(k, '');
      });
      setVal('idType', 'NIN');
      setVal('adults', '1');
      setVal('children', '0');
      setVal('discount', '0');
      setVal('payMethod', 'Cash');
      setVal('type', '');
      setStatusRadio('reserved');
      settlingIdx = null;
      pendingSettle = null;
      var drop = $('[data-role="guestDrop"]');
      if (drop) drop.classList.remove('show');
      var chargesSec = $('[data-role="chargesSec"]');
      if (chargesSec) chargesSec.hidden = true;
      var payAcc = $('[data-role="payAcc"]');
      if (payAcc) {
        payAcc.hidden = true;
        payAcc.classList.remove('open');
      }
      refreshCalcs();
    }

    function searchGuests(q) {
      var drop = $('[data-role="guestDrop"]');
      if (!drop) return;
      q = (q || '').trim().toLowerCase();
      if (!q) { drop.classList.remove('show'); drop.innerHTML = ''; return; }
      var hits = (guests || []).filter(function (g) {
        return (g.name || '').toLowerCase().indexOf(q) !== -1 ||
          (g.phone || '').replace(/\s/g, '').indexOf(q.replace(/\s/g, '')) !== -1;
      }).slice(0, 8);
      if (!hits.length) { drop.classList.remove('show'); return; }
      drop._hits = hits;
      drop.innerHTML = hits.map(function (g, i) {
        return '<div class="bkm-guest-opt" data-pick="' + i + '">' +
          '<div class="bkm-guest-opt-name">' + esc(g.name) +
            '<span class="bkm-tag">Returning</span>' +
            (g.vip ? '<span class="bkm-tag vip">VIP</span>' : '') +
          '</div>' +
          '<div class="bkm-guest-opt-sub">' + esc(g.phone) +
            (g.email ? ' · ' + esc(g.email) : '') +
          '</div></div>';
      }).join('');
      drop.classList.add('show');
    }

    function fillGuest(g) {
      if (!g) return;
      setVal('name', g.name || '');
      setVal('phone', g.phone || '');
      setVal('email', g.email || '');
      setVal('address', g.address || '');
      setVal('idType', g.idType || 'NIN');
      setVal('idNum', g.idNum || '');
      var drop = $('[data-role="guestDrop"]');
      if (drop) drop.classList.remove('show');
    }

    async function loadContext() {
      if (service && typeof service.getBookingData === 'function') {
        var data = await service.getBookingData();
        rooms = data.rooms || [];
        bookings = data.bookings || [];
        guests = data.guests || [];
        if (!externalSession) session = data.session || session;
      }
    }

    function findGuestForBooking(bk) {
      if (!bk) return null;
      if (bk.guestId) {
        var byId = (guests || []).find(function (g) { return g.guestId === bk.guestId; });
        if (byId) return byId;
      }
      return (guests || []).find(function (g) {
        return g.name === bk.guest || (bk.phone && g.phone === bk.phone);
      }) || null;
    }

    function collectEntry() {
      var roomVal = val('room');
      var roomNum = mode === 'edit' && editBooking
        ? editBooking.room
        : (roomVal ? roomVal.split('|')[0] : '');
      return {
        room: roomNum,
        type: val('type'),
        guest: val('name').trim(),
        phone: val('phone').trim(),
        email: val('email').trim(),
        address: val('address').trim(),
        idType: val('idType'),
        idNum: val('idNum').trim(),
        checkin: val('checkin'),
        checkout: val('checkout'),
        rate: parseFloat(val('rate')) || 0,
        discount: parseFloat(val('discount')) || 0,
        payMethod: val('payMethod'),
        recordedBy: (session && session.name) || '',
        adults: parseInt(val('adults'), 10) || 1,
        children: parseInt(val('children'), 10) || 0,
        notes: val('notes').trim(),
        status: getStatusRadio() === 'checkedin' ? 'checkedin' : 'reserved',
      };
    }

    /* ── Payments ── */
    function setPayAccOpen(open) {
      var acc = $('[data-role="payAcc"]');
      if (!acc || acc.hidden) return;
      if (open) acc.classList.add('open');
      else acc.classList.remove('open');
    }

    function renderPayments() {
      var body = $('[data-role="paymentBody"]');
      var payAcc = $('[data-role="payAcc"]');
      var addPayBtn = $('[data-act="addPayment"]');
      var payCountEl = $('[data-role="payCount"]');
      if (!body) return;

      if (mode === 'new') {
        body.innerHTML = '<tr><td colspan="4" class="bkm-pay-empty">No payments yet. Use Payment above for the first amount.</td></tr>';
        if (payCountEl) payCountEl.textContent = '';
        if (payAcc) { payAcc.hidden = true; payAcc.classList.remove('open'); }
        if (addPayBtn) addPayBtn.hidden = true;
        setVal('newPayAmount', '');
        return;
      }
      if (!editBooking) {
        body.innerHTML = '';
        return;
      }

      var payments = Array.isArray(editBooking.payments) ? editBooking.payments.slice() : [];
      payments.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });

      if (!payments.length && (Number(editBooking.paid) || 0) > 0) {
        payments = [{
          amount: Number(editBooking.paid) || 0,
          mode: editBooking.payMethod || 'Cash',
          date: editBooking.checkin || '',
          by: editBooking.recordedBy || '—',
          ts: 0,
        }];
      }

      if (!payments.length) {
        body.innerHTML = '<tr><td colspan="4" class="bkm-pay-empty">No payments recorded yet.</td></tr>';
        if (payCountEl) payCountEl.textContent = '';
      } else {
        body.innerHTML = payments.map(function (p) {
          return '<tr>' +
            '<td class="bkm-pay-amt">' + fmtN(p.amount) + '</td>' +
            '<td>' + esc(p.mode || 'Cash') + '</td>' +
            '<td>' + esc(p.date || '—') + '</td>' +
            '<td>' + esc(p.by || '—') + '</td></tr>';
        }).join('');
        if (payCountEl) payCountEl.textContent = '(' + payments.length + ')';
      }

      var bal = calcBal(editBooking);
      var allowPay = paymentActionsAllowed() && bal > 0;

      if (addPayBtn) {
        addPayBtn.hidden = !allowPay;
        addPayBtn.disabled = addingPayment;
      }
      if (payAcc) {
        if (!allowPay) {
          payAcc.hidden = true;
          payAcc.classList.remove('open');
        }
      }

      var byEl = $('[data-role="newPayBy"]');
      if (byEl) byEl.value = (session && session.name) || '';

      refreshCalcs();
    }

    function showNewPayRow() {
      var acc = $('[data-role="payAcc"]');
      if (!acc || !editBooking) return;
      if (!paymentActionsAllowed() || calcBal(editBooking) <= 0) {
        acc.hidden = true;
        toast('This booking is already fully paid.', 'info');
        return;
      }
      acc.hidden = false;
      acc.classList.add('open');
      setVal('newPayAmount', String(calcBal(editBooking)));
      setVal('newPayMode', 'Cash');
      setVal('newPayBy', (session && session.name) || '');
      var amt = $('[data-role="newPayAmount"]');
      if (amt) amt.focus();
    }

    async function confirmPay() {
      if (addingPayment || !editBooking) return;
      var amt = parseFloat(val('newPayAmount')) || 0;
      if (amt <= 0) { toast('Enter a payment amount greater than zero.', 'error'); return; }
      var payMode = val('newPayMode');
      addingPayment = true;
      applyEditability();
      try {
        var row = await service.addBookingPayment(editBooking.room, { amount: amt, mode: payMode });
        editBooking = row;
        var payAcc = $('[data-role="payAcc"]');
        if (payAcc) { payAcc.hidden = true; payAcc.classList.remove('open'); }
        renderPayments();
        toast('Payment recorded.', 'success');
        onSaved(row);
      } catch (err) {
        toast((err && err.message) || 'Failed to record payment.', 'error');
      } finally {
        addingPayment = false;
        applyEditability();
        renderPayments();
      }
    }

    /* ── Room charges ── */
    function renderCharges() {
      var acc = $('[data-role="chargesAcc"]');
      var list = $('[data-role="chargesList"]');
      if (!acc || !list) return;
      var allCharges = (currentGuest && currentGuest.charges) || [];
      var charges = allCharges;
      var countEl = $('[data-role="chargesCount"]');
      acc.hidden = false;
      if (!charges.length) {
        list.innerHTML = '<div style="padding:12px;color:#888;font-size:13px;">No charges for this booking.</div>';
        if (countEl) countEl.textContent = '';
        settlingIdx = null;
        return;
      }
      if (countEl) countEl.textContent = '(' + charges.length + ')';
      var allow = paymentActionsAllowed();

      list.innerHTML = charges.map(function (c, idx) {
        var bal = chargeBal(c);
        var paid = chargePaid(c);
        var open = settlingIdx === idx;

        var ledgerHtml = '';
        if (Array.isArray(c.payments) && c.payments.length) {
          ledgerHtml = '<div class="bkm-charge-ledger">' +
            c.payments.map(function (p) {
              return fmtN(p.amount) + ' · ' + esc(p.mode || 'Cash') + ' · ' + esc(p.date || '') + ' · ' + esc(p.by || '');
            }).join('<br>') +
          '</div>';
        }

        var formHtml = '';
        if (open && bal > 0 && allow) {
          formHtml =
            '<div class="bkm-settle-form">' +
              '<div class="bkm-fg" style="margin:0;"><label class="bkm-label">Amount</label>' +
                '<input class="bkm-input" data-role="settleAmount" data-idx="' + idx + '" type="number" min="0" step="100" value="' + bal + '"></div>' +
              '<div class="bkm-fg" style="margin:0;"><label class="bkm-label">Mode</label>' +
                '<select class="bkm-select" data-role="settleMode" data-idx="' + idx + '">' +
                  '<option>Cash</option><option>POS</option><option>Transfer</option></select></div>' +
              '<div class="bkm-fg" style="margin:0;"><label class="bkm-label">Recorded by</label>' +
                '<input class="bkm-input" type="text" readonly value="' + esc((session && session.name) || '') + '"></div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                '<button type="button" class="bkm-btn bkm-btn-primary" data-act="confirmSettle" data-idx="' + idx + '" style="padding:7px 12px;font-size:12px;">Confirm</button>' +
                '<button type="button" class="bkm-btn bkm-btn-outline" data-act="cancelSettle" style="padding:7px 10px;font-size:12px;">Cancel</button>' +
              '</div>' +
            '</div>';
        }

        return '<div class="bkm-charge-card">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
            '<div>' +
              '<div class="bkm-charge-desc">' + esc(c.source || 'Other') + ' — ' + esc(c.desc || '') + '</div>' +
              '<div class="bkm-charge-meta">' + esc(c.date || '') +
                (c.room ? ' · Rm ' + esc(c.room) : '') +
                (c.by ? ' · added by ' + esc(c.by) : '') +
              '</div>' +
              ledgerHtml +
            '</div>' +
            '<div style="text-align:right;">' +
              '<div style="font-weight:800;font-size:13px;color:var(--bkm-text);">' + fmtN(c.amount) + '</div>' +
              '<div class="bkm-charge-bal ' + (bal > 0 ? 'owe' : 'clear') + '">' +
                (bal > 0 ? fmtN(bal) + ' due' : fmtN(paid) + ' settled') +
              '</div>' +
              (bal > 0 && allow && !open
                ? '<button type="button" class="bkm-btn-sm-inline" data-act="openSettle" data-idx="' + idx + '" style="margin-top:4px;">Settle</button>'
                : '') +
            '</div>' +
          '</div>' +
          formHtml +
        '</div>';
      }).join('');
    }

    async function requestSettle(idx) {
      if (!currentGuest || !currentGuest.charges || !currentGuest.charges[idx]) return;
      var amountEl = root.querySelector('[data-role="settleAmount"][data-idx="' + idx + '"]');
      var modeEl = root.querySelector('[data-role="settleMode"][data-idx="' + idx + '"]');
      var amt = parseFloat(amountEl && amountEl.value) || 0;
      if (amt <= 0) { toast('Enter an amount greater than zero.', 'error'); return; }
      var payMode = (modeEl && modeEl.value) || 'Cash';
      pendingSettle = { idx: idx, amt: amt, mode: payMode };
      var ok = await showConfirm(
        'Confirm settlement?',
        'Record ' + fmtN(amt) + ' (' + payMode + ') against this charge. This action cannot be reversed.'
      );
      if (!ok) {
        pendingSettle = null;
        return;
      }
      await doSettle();
    }

    async function doSettle() {
      if (!pendingSettle || !currentGuest) return;
      var idx = pendingSettle.idx;
      var amt = pendingSettle.amt;
      var payMode = pendingSettle.mode;
      pendingSettle = null;
      try {
        var updatedGuest = await service.addChargePayment(
          currentGuest.id,
          idx,
          { amount: amt, mode: payMode }
        );
        if (updatedGuest && updatedGuest.charges && updatedGuest.charges[idx]) {
          currentGuest.charges[idx] = updatedGuest.charges[idx];
        }
        settlingIdx = null;
        renderCharges();
        toast('Charge payment recorded.', 'success');
      } catch (err) {
        toast((err && err.message) || 'Failed to settle charge.', 'error');
      }
    }

    /* ── Check out → cleaning ── */
    async function checkoutStay() {
      if (!editBooking || editBooking.status !== 'checkedin') return;
      if (!canEditEntity(session, editBooking)) {
        toast("You don't have permission to check out this booking.", 'error');
        return;
      }
      if (!service || typeof service.checkoutBooking !== 'function') {
        toast('Check-out is not available.', 'error');
        return;
      }

      var bal = calcBal(editBooking);
      var msg = 'Check out Room ' + editBooking.room + ' — ' + (editBooking.guest || 'guest') +
        '? Room will move to Cleaning.';
      if (bal > 0) {
        msg = 'Outstanding balance ' + fmtN(bal) + '. ' + msg;
      }
      var ok = await showConfirm('Check out guest?', msg);
      if (!ok) return;

      try {
        var row = await service.checkoutBooking(editBooking.room);
        toast('Guest checked out. Room is now Cleaning.', 'success');
        close();
        onSaved(row);
      } catch (err) {
        toast((err && err.message) || 'Check-out failed.', 'error');
      }
    }

    /* ── Save / Delete ── */
    async function save() {
      if (saving) return;
      var entry = collectEntry();
      if (!entry.guest || !entry.checkin || !entry.checkout) {
        toast('Please fill in guest name and dates.', 'error');
        return;
      }
      if (!entry.room) {
        toast('Please select a room.', 'error');
        return;
      }
      if (mode === 'new' && !canCreate(session)) {
        toast("You don't have permission to create bookings.", 'error');
        return;
      }
      if (mode === 'edit' && !canEditEntity(session, editBooking)) {
        toast("You don't have permission to edit this booking.", 'error');
        return;
      }
      if ((entry.discount || 0) > 0 && !canDiscount(session)) {
        toast("You don't have permission to apply discounts.", 'error');
        return;
      }

      var initialDeposit = mode === 'new' ? (parseFloat(val('paid')) || 0) : 0;

      saving = true;
      applyEditability();
      try {
        var row = await service.saveBooking(entry);
        if (mode === 'new' && initialDeposit > 0 && row && row.room) {
          row = await service.addBookingPayment(row.room, { amount: initialDeposit, mode: entry.payMethod });
        }
        toast(mode === 'edit' ? 'Booking updated.' : 'Booking saved.', 'success');
        close();
        onSaved(row || entry);
      } catch (err) {
        toast((err && err.message) || 'Failed to save booking.', 'error');
      } finally {
        saving = false;
        applyEditability();
      }
    }

    async function remove() {
      if (!editBooking || !onDeleted) return;
      if (!canDeleteEntity(session, editBooking)) {
        toast("You don't have permission to delete this booking.", 'error');
        return;
      }
      var ok = await showConfirm(
        'Delete booking?',
        'Delete booking for ' + (editBooking.guest || 'guest') + ' (Room ' + editBooking.room + ')? This cannot be undone.'
      );
      if (!ok) return;
      try {
        await service.deleteBooking(editBooking.room);
        toast('Booking deleted. Room marked available.', 'info');
        close();
        onDeleted(editBooking.room);
      } catch (err) {
        toast((err && err.message) || 'Failed to delete.', 'error');
      }
    }

    function open() {
      root.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      root.classList.remove('show');
      document.body.style.overflow = '';
      settlingIdx = null;
      pendingSettle = null;
      hideConfirm(false);
      var drop = $('[data-role="guestDrop"]');
      if (drop) drop.classList.remove('show');
      if (onCloseCb) onCloseCb();
    }

    function fillBookingFields(booking) {
      setVal('name', booking.guest || '');
      setVal('phone', booking.phone || '');
      setVal('email', booking.email || '');
      setVal('address', booking.address || '');
      setVal('idType', booking.idType || 'NIN');
      setVal('idNum', booking.idNum || '');
      setVal('checkin', booking.checkin || '');
      setVal('checkout', booking.checkout || '');
      setVal('rate', booking.rate || 0);
      setVal('discount', booking.discount || 0);
      setVal('payMethod', booking.payMethod || 'Cash');
      setVal('adults', booking.adults || 1);
      setVal('children', booking.children || 0);
      setVal('notes', booking.notes || '');
      setStatusRadio(booking.status === 'checkedin' ? 'checkedin' : 'reserved');
      populateRooms(booking.room);
      setVal('type', booking.type || '');

      var meta = $('[data-role="metaFoot"]');
      if (meta) {
        var bits = [];
        if (booking.recordedBy) bits.push('Recorded by ' + booking.recordedBy);
        if (booking.createdAt) bits.push('Created ' + new Date(booking.createdAt).toLocaleString());
        if (booking.updatedAt) bits.push('Updated ' + new Date(booking.updatedAt).toLocaleString());
        meta.textContent = bits.join(' · ');
      }
      var rst = $('[data-role="roomStateText"]');
      var rsh = $('[data-role="roomStatusHint"]');
      if (rst && rsh) {
        rsh.hidden = false;
        rst.textContent = booking.status || '—';
      }
    }

    async function openNew(pre) {
      pre = pre || {};
      mode = 'new';
      editBooking = null;
      currentGuest = null;
      await loadContext();
      clearForm();
      $('[data-role="title"]').innerHTML = 'New Booking';
      $('[data-role="sub"]').textContent = 'Create a reserved or checked-in stay';
      setVal('checkin', todayStr());
      setStatusRadio(pre.status === 'checkedin' ? 'checkedin' : 'reserved');
      populateRooms(pre.room || null);
      var meta = $('[data-role="metaFoot"]');
      if (meta) meta.textContent = session && session.name ? 'Staff: ' + session.name : '';
      applyEditability();
      renderPayments();
      open();
    }

    async function openEdit(booking) {
      if (!booking) return;
      mode = 'edit';
      await loadContext();
      editBooking = (service && service.getBooking)
        ? (await service.getBooking(booking.room)) || booking
        : booking;
      currentGuest = findGuestForBooking(editBooking);
      clearForm();
      $('[data-role="title"]').innerHTML = 'Edit Booking — Room ' + esc(editBooking.room);
      $('[data-role="sub"]').textContent = 'Update guest, stay, or record another payment';
      fillBookingFields(editBooking);
      renderPayments();
      renderCharges();
      applyEditability();
      open();
    }

    async function openView(booking) {
      if (!booking) return;
      mode = 'view';
      await loadContext();
      editBooking = (service && service.getBooking)
        ? (await service.getBooking(booking.room)) || booking
        : booking;
      currentGuest = findGuestForBooking(editBooking);
      clearForm();
      $('[data-role="title"]').innerHTML = 'Booking — Room ' + esc(editBooking.room) + ' <span class="bkm-view-pill">View</span>';
      $('[data-role="sub"]').textContent = esc(editBooking.guest || 'Guest') + ' · ' + (editBooking.checkin || '') + ' → ' + (editBooking.checkout || '');
      fillBookingFields(editBooking);
      renderPayments();
      renderCharges();
      applyEditability();
      open();
    }

    root.addEventListener('click', function (e) {
      if (e.target === root) { close(); return; }

      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'close') { close(); return; }
        if (a === 'save') { save(); return; }
        if (a === 'delete') { remove(); return; }
        if (a === 'checkout') { checkoutStay(); return; }
        if (a === 'addPayment') { showNewPayRow(); return; }
        if (a === 'togglePayAcc') {
          var acc = $('[data-role="payAcc"]');
          if (acc && !acc.hidden) acc.classList.toggle('open');
          return;
        }
        if (a === 'togglePaymentsAcc') {
          var acc2 = $('[data-role="paymentsAcc"]');
          if (acc2) acc2.classList.toggle('open');
          return;
        }
        if (a === 'toggleChargesAcc') {
          var acc3 = $('[data-role="chargesAcc"]');
          if (acc3) acc3.classList.toggle('open');
          return;
        }
        if (a === 'confirmPay') { confirmPay(); return; }
        if (a === 'openSettle') {
          settlingIdx = parseInt(act.getAttribute('data-idx'), 10);
          renderCharges();
          return;
        }
        if (a === 'cancelSettle') {
          settlingIdx = null;
          renderCharges();
          return;
        }
        if (a === 'confirmSettle') {
          requestSettle(parseInt(act.getAttribute('data-idx'), 10));
          return;
        }
        if (a === 'confirmYes') { hideConfirm(true); return; }
        if (a === 'confirmNo') { hideConfirm(false); return; }
      }

      var pick = e.target.closest('[data-pick]');
      if (pick) {
        var drop = $('[data-role="guestDrop"]');
        var hits = drop && drop._hits;
        var g = hits && hits[parseInt(pick.getAttribute('data-pick'), 10)];
        fillGuest(g);
      }
    });

    root.addEventListener('input', function (e) {
      var role = e.target.getAttribute('data-role');
      if (role === 'name') searchGuests(e.target.value);
      if (role === 'rate' || role === 'discount' || role === 'paid' || role === 'checkin' || role === 'checkout') {
        refreshCalcs();
      }
    });

    root.addEventListener('change', function (e) {
      var role = e.target.getAttribute('data-role');
      if (role === 'room') onRoomChange();
      if (role === 'checkin' || role === 'checkout' || role === 'rate' || role === 'discount' || role === 'paid') {
        refreshCalcs();
      }
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.bkm-guest-wrap')) {
        var drop = $('[data-role="guestDrop"]');
        if (drop) drop.classList.remove('show');
      }
    });

    return {
      openNew: openNew,
      openEdit: openEdit,
      openView: openView,
      close: close,
      setSession: function (s) {
        session = s;
        applyDiscountLock();
        applyEditability();
        var byEl = $('[data-role="newPayBy"]');
        if (byEl) byEl.value = (session && session.name) || '';
        if (editBooking) {
          renderPayments();
          renderCharges();
        }
      },
      destroy: function () {
        close();
        if (root.parentNode) root.parentNode.removeChild(root);
      },
    };
  }

  global.BookingModal = { create: create };
})(window);