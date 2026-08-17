/**
 * component/gym-member-modal.js — New / Edit / View Gym Member modal
 * ─────────────────────────────────────────────────────────────────
 * Same shape as component/booking-modal.js, adapted for gym membership:
 *   - Payments: ledger table + accordion for recording another
 *     installment. paid = SUM of payments[] (via GymService.calcPaid).
 *   - Room Charge: pick an in-house guest/room and the payment posts
 *     to their booking folio via GymService.postToGuestFolio — same
 *     mechanism Restaurant/Pool Bar/Orders-Workspace use.
 *   - "Search In-House Guest" autofills name/phone/room from
 *     GymService.getInHouseGuests(), exactly like the old inline
 *     version in gym-members.html, but the guest list and the folio
 *     write both now live in GymService, not this component or the page.
 *
 * Usage (mirrors BookingModal.create):
 *
 *   const memberModal = GymMemberModal.create({
 *     service: GymService,
 *     session: getSession(),
 *     onSaved: function (member) { refreshMembers(); },
 *     onDeleted: function (memberId) { refreshMembers(); },
 *   });
 *
 *   memberModal.openNew({ room: '204' });   // optional prefill
 *   memberModal.openEdit(member);
 *   memberModal.openView(member);
 *   memberModal.setSession(session);
 *   memberModal.destroy();
 *
 * Every read/write goes through `service` — GymService.saveMember(),
 * .addMemberPayment(), .deleteMember(), .getInHouseGuests(). This
 * component never touches localStorage or BookingData directly.
 */
(function (global) {
  'use strict';

  if (global.GymMemberModal) return;

  var CSS_ID = 'gmm-modal-css';
  var FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif";

  var CSS = `
  .gmm-overlay{
    display:none; position:fixed; inset:0; background:rgba(15,20,40,0.55); backdrop-filter:blur(5px);
    z-index:320; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;
    font-family:${FONT};
    --gmm-bg:#f4f6fb; --gmm-surface:#ffffff; --gmm-surface2:#f4f6fb; --gmm-surface3:#eef0f6;
    --gmm-border:#eef0f6; --gmm-border2:#dfe3ec;
    --gmm-text:#1c2440; --gmm-text2:#5b647a; --gmm-text3:#6b7280;
    --gmm-input:#ffffff; --gmm-modal:#ffffff;
    --gmm-gold:#2f6fed; --gmm-gold-light:#5b8ff9; --gmm-gold-dim:rgba(47,111,237,0.10); --gmm-gold-border:rgba(47,111,237,0.25);
    --gmm-green:#12b76a; --gmm-green-bg:#e9f9f0;
    --gmm-red:#f04438; --gmm-red-bg:#feecec;
    --gmm-amber:#f79009; --gmm-amber-bg:#fff4e5;
    --gmm-blue:#2f6fed; --gmm-blue-bg:#eaf1ff;
  }
  .gmm-overlay.show{ display:flex; }
  .gmm-modal{
    background:var(--gmm-modal); border:1px solid var(--gmm-border); border-radius:16px;
    padding:18px 20px 16px; width:min(880px,98vw); box-shadow:0 30px 80px rgba(15,20,40,0.25); margin:auto;
    position:relative; overflow:hidden;
  }
  .gmm-modal::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--gmm-gold); }
  .gmm-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:10px; }
  .gmm-title{ font-size:17px; font-weight:800; color:var(--gmm-text); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .gmm-sub{ font-size:11px; color:var(--gmm-text3); margin-top:2px; font-weight:600; }
  .gmm-close{
    background:var(--gmm-surface2); border:1px solid var(--gmm-border); border-radius:8px;
    width:28px; height:28px; color:var(--gmm-text2); font-size:13px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .gmm-close:hover{ color:var(--gmm-text); border-color:var(--gmm-gold-border); }
  .gmm-view-pill{
    font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1px;
    background:var(--gmm-blue-bg); color:var(--gmm-blue); padding:2px 8px; border-radius:20px;
  }
  .gmm-notice{
    display:none; align-items:center; gap:7px; font-size:11px; font-weight:600;
    color:var(--gmm-amber); background:var(--gmm-amber-bg); border:1px solid rgba(247,144,9,.25);
    border-radius:8px; padding:7px 11px; margin-bottom:10px;
  }
  .gmm-notice.show{ display:flex; }
  .gmm-notice.info{ color:var(--gmm-blue); background:var(--gmm-blue-bg); border-color:rgba(47,111,237,.25); }

  .gmm-cols{ display:grid; grid-template-columns:1.2fr 1fr; gap:12px; margin-bottom:12px; }
  @media (max-width:760px){ .gmm-cols{ grid-template-columns:1fr; } }

  .gmm-col{ background:var(--gmm-surface2); border:1px solid var(--gmm-border); border-radius:12px; padding:12px 12px 10px; }
  .gmm-col-title{
    font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:var(--gmm-gold); font-weight:800;
    margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid var(--gmm-gold-border);
    display:flex; align-items:center; gap:6px;
  }
  .gmm-fg{ display:flex; flex-direction:column; gap:3px; margin-bottom:8px; }
  .gmm-fg:last-child{ margin-bottom:0; }
  .gmm-row2{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .gmm-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:#5b647a; font-weight:700; display:flex; align-items:center; gap:4px; }
  .gmm-label .opt{ font-size:9px; text-transform:none; letter-spacing:0; color:var(--gmm-text3); font-weight:400; }
  .gmm-input,.gmm-select,.gmm-textarea{
    background:var(--gmm-input); border:1px solid var(--gmm-border2); border-radius:8px;
    padding:7px 10px; color:var(--gmm-text); font-family:inherit; font-size:12.5px; outline:none; width:100%;
  }
  .gmm-textarea{ resize:vertical; min-height:52px; }
  .gmm-input:focus,.gmm-select:focus,.gmm-textarea:focus{ border-color:var(--gmm-gold-border); }
  .gmm-input[readonly],.gmm-input:disabled,.gmm-select:disabled{
    opacity:1; color:var(--gmm-text); background:#eef1f7; border-color:var(--gmm-border); cursor:default;
  }
  .gmm-hint{ font-size:10.5px; color:var(--gmm-text3); margin-top:3px; font-weight:600; }

  .gmm-guest-wrap{ position:relative; }
  .gmm-guest-drop{
    position:absolute; top:calc(100% + 2px); left:0; right:0; z-index:400;
    background:var(--gmm-surface); border:1px solid var(--gmm-border); border-radius:10px;
    box-shadow:0 12px 40px rgba(15,20,40,0.18); display:none; max-height:200px; overflow-y:auto;
  }
  .gmm-guest-drop.show{ display:block; }
  .gmm-guest-opt{ padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--gmm-border); }
  .gmm-guest-opt:last-child{ border-bottom:none; }
  .gmm-guest-opt:hover{ background:var(--gmm-gold-dim); }
  .gmm-guest-opt-name{ font-size:12px; font-weight:700; color:var(--gmm-text); }
  .gmm-guest-opt-sub{ font-size:10.5px; color:var(--gmm-text3); margin-top:1px; }
  .gmm-guest-empty{ padding:10px 12px; font-size:11.5px; color:var(--gmm-text3); }

  .gmm-rate-line{ display:flex; justify-content:space-between; align-items:center; gap:8px; padding:5px 0; border-bottom:1px dashed var(--gmm-border); font-size:12px; }
  .gmm-rate-line:last-of-type{ border-bottom:none; }
  .gmm-rate-k{ color:#5b647a; font-weight:600; font-size:11px; }
  .gmm-rate-v{ font-weight:800; color:var(--gmm-text); }
  .gmm-rate-v.green{ color:var(--gmm-green); }
  .gmm-rate-v.red{ color:var(--gmm-red); }
  .gmm-rate-v.gold{ color:var(--gmm-gold); }

  .gmm-pay-panel{ background:var(--gmm-surface2); border:1px solid var(--gmm-border); border-radius:12px; padding:12px; margin-bottom:12px; }
  .gmm-pay-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .gmm-pay-title{ font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:var(--gmm-gold); font-weight:800; display:flex; align-items:center; gap:6px; }
  .gmm-pay-table-wrap{ overflow-x:auto; max-height:150px; overflow-y:auto; }
  .gmm-pay-table{ width:100%; border-collapse:collapse; min-width:440px; }
  .gmm-pay-table th{ text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#5b647a; font-weight:700; padding:5px 8px; background:var(--gmm-surface3); border-bottom:1px solid var(--gmm-border); white-space:nowrap; }
  .gmm-pay-table td{ padding:6px 8px; border-bottom:1px solid var(--gmm-border); font-size:12px; color:var(--gmm-text); vertical-align:middle; font-weight:600; }
  .gmm-pay-table tr:last-child td{ border-bottom:none; }
  .gmm-pay-amt{ font-weight:800; color:var(--gmm-green); white-space:nowrap; }
  .gmm-pay-empty{ font-size:11.5px; color:var(--gmm-text3); font-weight:600; padding:8px 2px; }

  .gmm-pay-acc{ margin-top:10px; border:1px solid var(--gmm-border2); border-radius:10px; overflow:hidden; background:var(--gmm-surface); }
  .gmm-pay-acc[hidden]{ display:none !important; }
  .gmm-pay-acc-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 12px; cursor:pointer; user-select:none; background:var(--gmm-surface3); border-bottom:1px solid transparent; }
  .gmm-pay-acc.open .gmm-pay-acc-head{ border-bottom-color:var(--gmm-border2); }
  .gmm-pay-acc-head span{ font-size:11.5px; font-weight:700; color:var(--gmm-text); }
  .gmm-pay-acc-head i{ font-size:11px; color:var(--gmm-text3); transition:transform .2s; }
  .gmm-pay-acc.open .gmm-pay-acc-head i{ transform:rotate(180deg); }
  .gmm-pay-acc-body{ display:none; padding:12px; }
  .gmm-pay-acc.open .gmm-pay-acc-body{ display:block; }
  .gmm-new-pay{ display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:8px; align-items:end; }
  @media (max-width:560px){ .gmm-new-pay{ grid-template-columns:1fr 1fr; } }

  .gmm-room-wrap{ margin-top:8px; display:none; }
  .gmm-room-wrap.show{ display:block; }
  .gmm-room-results{ max-height:140px; overflow-y:auto; border:1px solid var(--gmm-border); border-radius:9px; background:var(--gmm-surface2); margin-top:4px; display:none; }
  .gmm-room-results.show{ display:block; }
  .gmm-room-item{ padding:8px 11px; cursor:pointer; border-bottom:1px solid var(--gmm-border); transition:background .15s; }
  .gmm-room-item:last-child{ border-bottom:none; }
  .gmm-room-item:hover{ background:var(--gmm-gold-dim); }
  .gmm-room-item .rn{ font-weight:700; color:var(--gmm-text); font-size:12px; }
  .gmm-room-item .gn{ font-size:11px; color:var(--gmm-text2); margin-top:1px; }
  .gmm-selected-room{ display:none; align-items:center; justify-content:space-between; gap:8px; background:var(--gmm-blue-bg); border:1px solid rgba(47,111,237,.3); border-radius:9px; padding:8px 11px; margin-top:6px; }
  .gmm-selected-room.show{ display:flex; }
  .gmm-selected-room .info{ font-size:12px; font-weight:700; color:var(--gmm-blue); }
  .gmm-selected-room .info span{ display:block; font-size:10.5px; font-weight:600; color:var(--gmm-text2); margin-top:1px; }
  .gmm-selected-room .clear-btn{ background:none; border:none; color:var(--gmm-text3); cursor:pointer; font-size:12px; padding:2px 4px; }
  .gmm-selected-room .clear-btn:hover{ color:var(--gmm-red); }

  .gmm-foot{ display:flex; gap:8px; justify-content:flex-end; padding-top:12px; border-top:1px solid var(--gmm-border); flex-wrap:wrap; align-items:center; }
  .gmm-meta{ margin-right:auto; font-size:10.5px; color:var(--gmm-text3); font-weight:600; line-height:1.4; }
  .gmm-btn{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:9px; font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; border:1px solid transparent; }
  .gmm-btn-primary{ background:var(--gmm-gold); color:#fff; border-color:var(--gmm-gold); box-shadow:0 4px 10px rgba(47,111,237,0.28); }
  .gmm-btn-primary:hover{ background:var(--gmm-gold-light); }
  .gmm-btn-primary:disabled{ opacity:.5; cursor:not-allowed; }
  .gmm-btn-outline{ background:var(--gmm-surface); border-color:var(--gmm-border); color:var(--gmm-text); }
  .gmm-btn-outline:hover{ border-color:var(--gmm-gold-border); color:var(--gmm-gold); }
  .gmm-btn-danger{ background:var(--gmm-surface); border-color:var(--gmm-border); color:var(--gmm-red); }
  .gmm-btn-danger:hover{ border-color:rgba(240,68,56,0.4); background:var(--gmm-red-bg); }
  .gmm-btn[hidden]{ display:none !important; }

  .gmm-confirm-ov{ display:none; position:absolute; inset:0; background:rgba(15,20,40,0.45); align-items:center; justify-content:center; z-index:20; border-radius:16px; padding:16px; }
  .gmm-confirm-ov.show{ display:flex; }
  .gmm-confirm-box{ background:#fff; border:1px solid var(--gmm-border); border-radius:12px; padding:18px 16px; width:min(340px,100%); box-shadow:0 16px 40px rgba(15,20,40,0.2); }
  .gmm-confirm-box h4{ font-size:15px; font-weight:800; color:var(--gmm-text); margin:0 0 6px; }
  .gmm-confirm-box p{ font-size:12.5px; color:var(--gmm-text2); margin:0 0 14px; line-height:1.5; font-weight:600; }
  .gmm-confirm-acts{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }

  .gmm-toast{
    position:fixed; bottom:20px; right:20px; background:#fff; border:1px solid #eef0f6; border-radius:10px;
    padding:11px 16px; font-size:12.5px; color:#1c2440; box-shadow:0 8px 28px rgba(15,34,55,0.18);
    z-index:999; display:flex; align-items:center; gap:8px; font-family:${FONT}; max-width:calc(100vw - 40px);
  }
  .gmm-toast.success{ border-left:3px solid #12b76a; }
  .gmm-toast.error{ border-left:3px solid #f04438; }
  .gmm-toast.info{ border-left:3px solid #2f6fed; }
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
  function todayISO() { return new Date().toISOString().split('T')[0]; }
  function addDaysISO(iso, days) {
    var d = iso ? new Date(iso) : new Date();
    d.setDate(d.getDate() + (parseInt(days, 10) || 0));
    return d.toISOString().split('T')[0];
  }

  function create(opts) {
    opts = opts || {};
    injectCss();

    var service = opts.service || global.GymService || null;
    if (!service) throw new Error('[GymMemberModal] options.service (GymService) is required.');
    var onSaved = typeof opts.onSaved === 'function' ? opts.onSaved : function () {};
    var onDeleted = typeof opts.onDeleted === 'function' ? opts.onDeleted : null;
    var session = opts.session || null;

    function canCreate() {
      if (global.Permissions && Permissions.hasPermission) {
        return !!Permissions.hasPermission(session, 'canCreate', 'gym');
      }
      return true;
    }
    function canEditEntity() {
      if (global.Permissions && Permissions.canEdit) {
        return !!Permissions.canEdit(session, 'gym', editMember);
      }
      return true;
    }
    function canDeleteEntity() {
      if (global.Permissions && Permissions.canDelete) {
        return !!Permissions.canDelete(session, 'gym', editMember);
      }
      return !!(session && String(session.role).toLowerCase() === 'admin');
    }

    var mode = 'new';        // 'new' | 'edit' | 'view'
    var editMember = null;
    var guests = [];         // in-house guests, from service.getInHouseGuests()
    var guestsLoadFailed = false;
    var saving = false;
    var addingPayment = false;
    var pendingDelete = false;

    var root = document.createElement('div');
    root.className = 'gmm-overlay';
    root.innerHTML =
      '<div class="gmm-modal" role="dialog" aria-modal="true">' +
        '<div class="gmm-confirm-ov" data-role="confirmOv">' +
          '<div class="gmm-confirm-box">' +
            '<h4 data-role="confirmTitle">Are you sure?</h4>' +
            '<p data-role="confirmMsg">This action cannot be reversed.</p>' +
            '<div class="gmm-confirm-acts">' +
              '<button type="button" class="gmm-btn gmm-btn-outline" data-act="confirmNo">Cancel</button>' +
              '<button type="button" class="gmm-btn gmm-btn-primary" data-act="confirmYes">Yes, continue</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="gmm-head">' +
          '<div>' +
            '<div class="gmm-title" data-role="title">New Member</div>' +
            '<div class="gmm-sub" data-role="sub">Member details, plan & payments</div>' +
          '</div>' +
          '<button type="button" class="gmm-close" data-act="close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="gmm-notice" data-role="notice"><i class="fa-solid fa-lock"></i> <span data-role="noticeText">View only</span></div>' +

        '<div class="gmm-cols">' +
          '<div class="gmm-col">' +
            '<div class="gmm-col-title"><i class="fa-solid fa-id-card"></i> Member Details</div>' +
            '<div class="gmm-fg">' +
              '<label class="gmm-label">Search In-House Guest <span class="opt">(optional — autofills name, phone &amp; room)</span></label>' +
              '<div class="gmm-guest-wrap">' +
                '<input class="gmm-input" data-role="guestSearch" type="text" placeholder="Search by guest name, phone, or room…" autocomplete="off">' +
                '<div class="gmm-guest-drop" data-role="guestDrop"></div>' +
              '</div>' +
            '</div>' +
            '<div class="gmm-fg"><label class="gmm-label">Full Name</label><input class="gmm-input" data-role="name" type="text" placeholder="Member name"></div>' +
            '<div class="gmm-row2">' +
              '<div class="gmm-fg"><label class="gmm-label">Phone</label><input class="gmm-input" data-role="phone" type="text" placeholder="+234 …"></div>' +
              '<div class="gmm-fg"><label class="gmm-label">Room <span class="opt">(if a hotel guest)</span></label><input class="gmm-input" data-role="room" type="text" placeholder="e.g. 204"></div>' +
            '</div>' +
            '<div class="gmm-row2">' +
              '<div class="gmm-fg"><label class="gmm-label">Joined</label><input class="gmm-input" data-role="joined" type="date"></div>' +
              '<div class="gmm-fg"><label class="gmm-label">Expiry <span class="opt">(auto)</span></label><input class="gmm-input" data-role="expiry" type="date" readonly></div>' +
            '</div>' +
            '<div class="gmm-fg"><label class="gmm-label">Notes</label><textarea class="gmm-textarea" data-role="notes" placeholder="Health notes, preferences…"></textarea></div>' +
          '</div>' +

          '<div class="gmm-col">' +
            '<div class="gmm-col-title"><i class="fa-solid fa-dumbbell"></i> Plan &amp; Billing</div>' +
            '<div class="gmm-fg"><label class="gmm-label">Plan</label><select class="gmm-select" data-role="plan"><option value="">No plan / pay later</option></select></div>' +
            '<div class="gmm-fg"><label class="gmm-label">Total Due (₦)</label><input class="gmm-input" data-role="totalDue" type="number" min="0" step="500"></div>' +
            '<div class="gmm-rate-line"><span class="gmm-rate-k">Paid so far</span><span class="gmm-rate-v green" data-role="dispPaid">₦0</span></div>' +
            '<div class="gmm-rate-line"><span class="gmm-rate-k">Balance</span><span class="gmm-rate-v red" data-role="dispBal">₦0</span></div>' +
            '<div class="gmm-rate-line"><span class="gmm-rate-k">Pay status</span><span class="gmm-rate-v" data-role="payStatus">Pending</span></div>' +

            '<div class="gmm-fg" style="margin-top:8px;" data-role="depositWrap">' +
              '<label class="gmm-label">Initial Payment <span class="opt">(optional)</span></label>' +
              '<div class="gmm-new-pay" style="grid-template-columns:1fr 1fr;">' +
                '<input class="gmm-input" data-role="initAmount" type="number" min="0" step="500" placeholder="0">' +
                '<select class="gmm-select" data-role="initMode"><option>Cash</option><option>POS</option><option>Transfer</option><option>Room Charge</option></select>' +
              '</div>' +
              '<div class="gmm-room-wrap" data-role="initRoomWrap">' +
                '<input class="gmm-input" data-role="initRoomSearch" placeholder="Search room, guest, or phone…">' +
                '<div class="gmm-room-results" data-role="initRoomResults"></div>' +
                '<div class="gmm-selected-room" data-role="initSelectedRoom">' +
                  '<div class="info"></div><button type="button" class="clear-btn" data-act="clearInitRoom"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>' +
                '<input type="hidden" data-role="initRoomNumber"><input type="hidden" data-role="initGuestName"><input type="hidden" data-role="initGuestPhone">' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="gmm-pay-panel" data-role="payPanel">' +
          '<div class="gmm-pay-head">' +
            '<div class="gmm-pay-title"><i class="fa-solid fa-clock-rotate-left"></i> Payments</div>' +
            '<button type="button" class="gmm-btn gmm-btn-primary" data-act="addPayment" style="padding:5px 10px;font-size:11.5px;" hidden>' +
              '<i class="fa-solid fa-plus"></i> Record payment' +
            '</button>' +
          '</div>' +
          '<div class="gmm-pay-table-wrap">' +
            '<table class="gmm-pay-table">' +
              '<thead><tr><th>Amount</th><th>Mode</th><th>Date</th><th>Recorded by</th></tr></thead>' +
              '<tbody data-role="paymentBody"></tbody>' +
            '</table>' +
          '</div>' +
          '<div class="gmm-pay-acc" data-role="payAcc" hidden>' +
            '<div class="gmm-pay-acc-head" data-act="togglePayAcc">' +
              '<span><i class="fa-solid fa-money-bill-wave" style="margin-right:6px;color:var(--gmm-gold);"></i>New payment</span>' +
              '<i class="fa-solid fa-chevron-down"></i>' +
            '</div>' +
            '<div class="gmm-pay-acc-body">' +
              '<div class="gmm-new-pay">' +
                '<div class="gmm-fg" style="margin:0;"><label class="gmm-label">Amount</label><input class="gmm-input" data-role="newPayAmount" type="number" min="0" step="500" placeholder="0"></div>' +
                '<div class="gmm-fg" style="margin:0;"><label class="gmm-label">Mode</label><select class="gmm-select" data-role="newPayMode"><option>Cash</option><option>POS</option><option>Transfer</option><option>Room Charge</option></select></div>' +
                '<div class="gmm-fg" style="margin:0;"><label class="gmm-label">Recorded by</label><input class="gmm-input" data-role="newPayBy" type="text" readonly></div>' +
                '<button type="button" class="gmm-btn gmm-btn-primary" data-act="confirmPay" style="padding:7px 12px;font-size:12px;"><i class="fa-solid fa-check"></i> Add</button>' +
              '</div>' +
              '<div class="gmm-room-wrap" data-role="payRoomWrap">' +
                '<input class="gmm-input" data-role="payRoomSearch" placeholder="Search room, guest, or phone…">' +
                '<div class="gmm-room-results" data-role="payRoomResults"></div>' +
                '<div class="gmm-selected-room" data-role="paySelectedRoom">' +
                  '<div class="info"></div><button type="button" class="clear-btn" data-act="clearPayRoom"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>' +
                '<input type="hidden" data-role="payRoomNumber"><input type="hidden" data-role="payGuestName"><input type="hidden" data-role="payGuestPhone">' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="gmm-foot">' +
          '<div class="gmm-meta" data-role="metaFoot"></div>' +
          '<button type="button" class="gmm-btn gmm-btn-danger" data-act="delete" hidden><i class="fa-solid fa-trash"></i> Delete</button>' +
          '<button type="button" class="gmm-btn gmm-btn-outline" data-act="close">Close</button>' +
          '<button type="button" class="gmm-btn gmm-btn-primary" data-act="save"><i class="fa-solid fa-check"></i> Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    function $(sel) { return root.querySelector(sel); }
    function val(role) { var el = $('[data-role="' + role + '"]'); return el ? el.value : ''; }
    function setVal(role, v) { var el = $('[data-role="' + role + '"]'); if (el) el.value = v == null ? '' : v; }

    function toast(msg, type) {
      type = type || 'success';
      var t = document.createElement('div');
      t.className = 'gmm-toast ' + type;
      var icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
      t.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + msg;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 3400);
    }

    function showConfirm(title, msg) {
      return new Promise(function (resolve) {
        var ov = $('[data-role="confirmOv"]');
        $('[data-role="confirmTitle"]').textContent = title || 'Are you sure?';
        $('[data-role="confirmMsg"]').textContent = msg || 'This action cannot be reversed.';
        ov.classList.add('show');
        root._confirmResolve = resolve;
      });
    }
    function hideConfirm(answer) {
      $('[data-role="confirmOv"]').classList.remove('show');
      var r = root._confirmResolve;
      root._confirmResolve = null;
      if (r) r(!!answer);
    }

    // ── Plan select + billing recompute ──
    function populatePlans(selectedId) {
      var sel = $('[data-role="plan"]');
      var plans = (service.state && service.state.plans) || [];
      sel.innerHTML = '<option value="">No plan / pay later</option>' + plans.map(function (p) {
        return '<option value="' + p.id + '" data-price="' + (p.price || 0) + '" data-duration="' + (p.durationDays || 0) + '"' +
          (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + ' — ' + fmtN(p.price) + ' / ' + p.durationDays + ' day' + (p.durationDays !== 1 ? 's' : '') + '</option>';
      }).join('');
    }
    function onPlanChange() {
      var sel = $('[data-role="plan"]');
      var o = sel.options[sel.selectedIndex];
      var price = o ? parseFloat(o.dataset.price) || 0 : 0;
      var duration = o ? parseInt(o.dataset.duration, 10) || 0 : 0;
      setVal('totalDue', price || '');
      if (duration) setVal('expiry', addDaysISO(val('joined') || todayISO(), duration));
      refreshCalcs();
    }
    function onJoinedChange() {
      var sel = $('[data-role="plan"]');
      var o = sel.options[sel.selectedIndex];
      var duration = o ? parseInt(o.dataset.duration, 10) || 0 : 0;
      if (duration) setVal('expiry', addDaysISO(val('joined'), duration));
    }

    function refreshCalcs() {
      var total = parseFloat(val('totalDue')) || 0;
      var paid = 0;
      if (mode === 'new') {
        paid = parseFloat(val('initAmount')) || 0;
      } else if (editMember) {
        // Preview against the CURRENT saved payments — the "totalDue"
        // field being edited hasn't been persisted yet, so balance here
        // is against what's actually been paid so far, using the
        // in-progress total for the "after" figure.
        paid = service.calcPaid(editMember);
      }
      var bal = Math.max(0, total - paid);
      $('[data-role="dispPaid"]').textContent = fmtN(paid);
      var elB = $('[data-role="dispBal"]');
      elB.textContent = fmtN(bal);
      elB.className = 'gmm-rate-v ' + (bal > 0 ? 'red' : 'green');
      var status = paid <= 0 ? 'Pending' : (bal <= 0 ? 'Fully Paid' : 'Deposit Paid');
      $('[data-role="payStatus"]').textContent = status;
    }

    // ── Guest search (Member Info column) ──
    function searchGuests(q) {
      var drop = $('[data-role="guestDrop"]');
      q = (q || '').trim().toLowerCase();
      if (!q) { drop.classList.remove('show'); drop.innerHTML = ''; return; }
      if (guestsLoadFailed) {
        drop.innerHTML = '<div class="gmm-guest-empty">Guest search is unavailable right now.</div>';
        drop.classList.add('show');
        return;
      }
      var hits = guests.filter(function (g) {
        return (g.name || '').toLowerCase().indexOf(q) !== -1 ||
          (g.phone || '').replace(/\s/g, '').indexOf(q.replace(/\s/g, '')) !== -1 ||
          String(g.room || '').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);
      if (!hits.length) {
        drop.innerHTML = '<div class="gmm-guest-empty">No matching in-house guests.</div>';
        drop.classList.add('show');
        return;
      }
      drop._hits = hits;
      drop.innerHTML = hits.map(function (g, i) {
        return '<div class="gmm-guest-opt" data-pick="' + i + '">' +
          '<div class="gmm-guest-opt-name">' + esc(g.name) + '</div>' +
          '<div class="gmm-guest-opt-sub">Room ' + esc(g.room) + (g.phone ? ' · ' + esc(g.phone) : '') + '</div></div>';
      }).join('');
      drop.classList.add('show');
    }
    function fillGuest(g) {
      if (!g) return;
      setVal('name', g.name || '');
      setVal('phone', g.phone || '');
      setVal('room', g.room || '');
      $('[data-role="guestSearch"]').value = '';
      $('[data-role="guestDrop"]').classList.remove('show');
    }

    // ── Room-charge picker (shared logic for "init" and "pay" prefixes) ──
    function roomFields(prefix) {
      return {
        room: ($('[data-role="' + prefix + 'RoomNumber"]') || {}).value || '',
        guest: ($('[data-role="' + prefix + 'GuestName"]') || {}).value || '',
        phone: ($('[data-role="' + prefix + 'GuestPhone"]') || {}).value || '',
      };
    }
    function onRoomSearch(prefix) {
      var input = $('[data-role="' + prefix + 'RoomSearch"]');
      var results = $('[data-role="' + prefix + 'RoomResults"]');
      if (!input || !results) return;
      var q = (input.value || '').trim().toLowerCase();
      if (!q) { results.classList.remove('show'); results.innerHTML = ''; return; }
      if (guestsLoadFailed) {
        results.innerHTML = '<div class="gmm-guest-empty">Room search is unavailable right now.</div>';
        results.classList.add('show');
        return;
      }
      var list = guests.filter(function (g) {
        return String(g.room).toLowerCase().indexOf(q) !== -1 ||
          (g.name || '').toLowerCase().indexOf(q) !== -1 ||
          (g.phone || '').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);
      if (!list.length) { results.classList.remove('show'); results.innerHTML = ''; return; }
      results.innerHTML = list.map(function (g) {
        return '<div class="gmm-room-item" data-pick-room="' + esc(g.room) + '" data-pick-guest="' + esc(g.name) + '" data-pick-phone="' + esc(g.phone || '') + '" data-pick-prefix="' + prefix + '">' +
          '<div class="rn">Room ' + esc(g.room) + '</div><div class="gn">' + esc(g.name) + (g.phone ? ' · ' + esc(g.phone) : '') + '</div></div>';
      }).join('');
      results.classList.add('show');
    }
    function selectRoom(prefix, room, name, phone) {
      $('[data-role="' + prefix + 'RoomNumber"]').value = room;
      $('[data-role="' + prefix + 'GuestName"]').value = name;
      $('[data-role="' + prefix + 'GuestPhone"]').value = phone || '';
      $('[data-role="' + prefix + 'RoomSearch"]').value = '';
      $('[data-role="' + prefix + 'RoomResults"]').classList.remove('show');
      var box = $('[data-role="' + prefix + (prefix === 'init' ? 'SelectedRoom' : 'SelectedRoom') + '"]');
      if (box) {
        box.querySelector('.info').innerHTML = 'Room ' + esc(room) + '<span>' + esc(name) + (phone ? ' · ' + esc(phone) : '') + '</span>';
        box.classList.add('show');
      }
    }
    function clearRoom(prefix) {
      ['RoomNumber', 'GuestName', 'GuestPhone'].forEach(function (r) {
        var el = $('[data-role="' + prefix + r + '"]'); if (el) el.value = '';
      });
      var search = $('[data-role="' + prefix + 'RoomSearch"]'); if (search) search.value = '';
      var results = $('[data-role="' + prefix + 'RoomResults"]');
      if (results) { results.classList.remove('show'); results.innerHTML = ''; }
      var box = $('[data-role="' + prefix + 'SelectedRoom"]'); if (box) box.classList.remove('show');
    }
    function toggleRoomWrap(modeSel, wrapRole) {
      var show = ($(modeSel) || {}).value === 'Room Charge';
      var wrap = $('[data-role="' + wrapRole + '"]');
      if (wrap) wrap.classList.toggle('show', show);
      if (!show) clearRoom(wrapRole === 'initRoomWrap' ? 'init' : 'pay');
    }

    // ── Payments ledger (edit/view mode) ──
    function renderPayments() {
      var body = $('[data-role="paymentBody"]');
      var payAcc = $('[data-role="payAcc"]');
      var addBtn = $('[data-act="addPayment"]');
      var depositWrap = $('[data-role="depositWrap"]');
      var payPanel = $('[data-role="payPanel"]');

      if (mode === 'new') {
        payPanel.style.display = 'none';
        depositWrap.style.display = '';
        return;
      }
      payPanel.style.display = '';
      depositWrap.style.display = 'none';
      if (!editMember) { body.innerHTML = ''; return; }

      var payments = (editMember.payments || []).slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      body.innerHTML = payments.length
        ? payments.map(function (p) {
            return '<tr><td class="gmm-pay-amt">' + fmtN(p.amount) + '</td><td>' + esc(p.mode || 'Cash') +
              (p.roomNumber ? ' (Rm ' + esc(p.roomNumber) + ')' : '') + '</td><td>' + esc(p.date || '—') + '</td><td>' + esc(p.by || '—') + '</td></tr>';
          }).join('')
        : '<tr><td colspan="4" class="gmm-pay-empty">No payments recorded yet.</td></tr>';

      var bal = service.calcBal(editMember);
      var allow = (mode === 'edit') && canEditEntity() && bal > 0;
      addBtn.hidden = !allow;
      if (!allow) { payAcc.hidden = true; payAcc.classList.remove('open'); }
      var byEl = $('[data-role="newPayBy"]'); if (byEl) byEl.value = (session && session.name) || '';
      refreshCalcs();
    }

    function showNewPayRow() {
      var acc = $('[data-role="payAcc"]');
      if (!acc || !editMember) return;
      if (service.calcBal(editMember) <= 0) {
        toast('This membership is already fully paid.', 'info');
        return;
      }
      acc.hidden = false;
      acc.classList.add('open');
      setVal('newPayAmount', String(service.calcBal(editMember)));
      setVal('newPayMode', 'Cash');
      setVal('newPayBy', (session && session.name) || '');
      toggleRoomWrap('[data-role="newPayMode"]', 'payRoomWrap');
      var amtEl = $('[data-role="newPayAmount"]'); if (amtEl) amtEl.focus();
    }

    async function confirmPay() {
      if (addingPayment || !editMember) return;
      var amt = parseFloat(val('newPayAmount')) || 0;
      if (amt <= 0) { toast('Enter a payment amount greater than zero.', 'error'); return; }
      var payMode = val('newPayMode');
      var room = roomFields('pay');
      if (payMode === 'Room Charge' && !room.room) { toast('Search and select a room for Room Charge.', 'error'); return; }

      addingPayment = true;
      applyEditability();
      try {
        var updated = await service.addMemberPayment(editMember.id, {
          amount: amt, mode: payMode, by: (session && session.name) || 'Gym Attendant',
          roomNumber: payMode === 'Room Charge' ? room.room : null,
          guestName: payMode === 'Room Charge' ? room.guest : null,
          guestPhone: payMode === 'Room Charge' ? room.phone : null,
        });
        editMember = updated;
        $('[data-role="payAcc"]').hidden = true;
        $('[data-role="payAcc"]').classList.remove('open');
        clearRoom('pay');
        renderPayments();
        toast('Payment recorded.', 'success');
        onSaved(updated);
      } catch (err) {
        // addMemberPayment still records the payment even if the room
        // charge post fails — reflect that instead of implying nothing happened.
        if (err && err.paymentRecorded) {
          editMember = err.member || editMember;
          renderPayments();
          onSaved(editMember);
        }
        toast((err && err.message) || 'Failed to record payment.', 'error');
      } finally {
        addingPayment = false;
        applyEditability();
      }
    }

    // ── Editability / permission UI ──
    function applyEditability() {
      var notice = $('[data-role="notice"]');
      var noticeText = $('[data-role="noticeText"]');
      var saveBtn = $('[data-act="save"]');
      var delBtn = $('[data-act="delete"]');

      var editable;
      if (mode === 'new') editable = canCreate();
      else if (mode === 'edit') editable = canEditEntity();
      else editable = false;

      notice.classList.remove('info');
      if (mode === 'view') {
        notice.classList.add('show', 'info');
        noticeText.textContent = 'Read-only details. You can still record payments below if permitted.';
      } else if (!editable) {
        notice.classList.add('show');
        noticeText.textContent = 'You can view this member but cannot save changes.';
      } else {
        notice.classList.remove('show');
      }

      saveBtn.hidden = mode === 'view';
      saveBtn.disabled = !editable || saving || mode === 'view';
      delBtn.hidden = !(mode === 'edit' && onDeleted && canDeleteEntity());

      root.querySelectorAll('.gmm-input, .gmm-select, .gmm-textarea').forEach(function (el) {
        var role = el.getAttribute('data-role');
        if (!role) return;
        if (role === 'expiry') return; // always readonly, calculated
        if (['newPayAmount', 'newPayMode', 'newPayBy', 'payRoomSearch', 'initRoomSearch'].indexOf(role) > -1) return;
        el.disabled = !editable;
      });
    }

    function clearForm() {
      setVal('name', ''); setVal('phone', ''); setVal('room', '');
      setVal('joined', todayISO()); setVal('expiry', ''); setVal('notes', '');
      setVal('totalDue', ''); setVal('initAmount', ''); setVal('initMode', 'Cash');
      populatePlans(null);
      var gd = $('[data-role="guestDrop"]'); if (gd) gd.classList.remove('show');
      clearRoom('init'); clearRoom('pay');
      var payAcc = $('[data-role="payAcc"]'); if (payAcc) { payAcc.hidden = true; payAcc.classList.remove('open'); }
      refreshCalcs();
    }

    async function loadGuests() {
      try {
        guests = await service.getInHouseGuests();
        guestsLoadFailed = false;
      } catch (e) {
        guests = [];
        guestsLoadFailed = true;
        console.warn('[GymMemberModal] in-house guest lookup unavailable:', e && e.message ? e.message : e);
      }
    }

    function collectEntry() {
      return {
        id: mode === 'edit' && editMember ? editMember.id : undefined,
        name: val('name').trim(),
        phone: val('phone').trim(),
        room: val('room').trim(),
        planId: val('plan') || null,
        joined: val('joined') || todayISO(),
        expiry: val('expiry') || '',
        notes: val('notes').trim(),
        totalDue: parseFloat(val('totalDue')) || 0,
      };
    }

    async function save() {
      if (saving) return;
      var entry = collectEntry();
      if (!entry.name) { toast('Please enter the member\'s name.', 'error'); return; }
      if (mode === 'new' && !canCreate()) { toast("You don't have permission to add members.", 'error'); return; }
      if (mode === 'edit' && !canEditEntity()) { toast("You don't have permission to edit this member.", 'error'); return; }

      var initAmt = mode === 'new' ? (parseFloat(val('initAmount')) || 0) : 0;
      var initMode = val('initMode');
      var initRoom = roomFields('init');
      if (mode === 'new' && initAmt > 0 && initMode === 'Room Charge' && !initRoom.room) {
        toast('Search and select a room for the Room Charge payment, or choose a different payment mode.', 'error');
        return;
      }

      saving = true;
      applyEditability();
      try {
        var row = await service.saveMember(entry);
        if (mode === 'new' && initAmt > 0) {
          try {
            row = await service.addMemberPayment(row.id, {
              amount: initAmt, mode: initMode, by: (session && session.name) || 'Gym Attendant',
              roomNumber: initMode === 'Room Charge' ? initRoom.room : null,
              guestName: initMode === 'Room Charge' ? initRoom.guest : null,
              guestPhone: initMode === 'Room Charge' ? initRoom.phone : null,
            });
          } catch (payErr) {
            toast((payErr && payErr.message) || 'Member saved, but the initial payment failed.', 'error');
            close();
            onSaved(row);
            return;
          }
        }
        toast(mode === 'edit' ? 'Member updated.' : 'Member registered.', 'success');
        close();
        onSaved(row);
      } catch (err) {
        toast((err && err.message) || 'Failed to save member.', 'error');
      } finally {
        saving = false;
        applyEditability();
      }
    }

    async function remove() {
      if (!editMember || !onDeleted) return;
      if (!canDeleteEntity()) { toast("You don't have permission to delete this member.", 'error'); return; }
      var ok = await showConfirm('Delete member?', 'Delete ' + (editMember.name || 'this member') + '? This cannot be undone.');
      if (!ok) return;
      try {
        await service.deleteMember(editMember.id);
        toast('Member deleted.', 'info');
        var id = editMember.id;
        close();
        onDeleted(id);
      } catch (err) {
        toast((err && err.message) || 'Failed to delete.', 'error');
      }
    }

    function open() { root.classList.add('show'); document.body.style.overflow = 'hidden'; }
    function close() {
      root.classList.remove('show');
      document.body.style.overflow = '';
      hideConfirm(false);
      var gd = $('[data-role="guestDrop"]'); if (gd) gd.classList.remove('show');
    }

    function fillMemberFields(m) {
      setVal('name', m.name || '');
      setVal('phone', m.phone || '');
      setVal('room', m.room || '');
      setVal('joined', m.joined || todayISO());
      setVal('expiry', m.expiry || '');
      setVal('notes', m.notes || '');
      populatePlans(m.planId || null);
      setVal('totalDue', service.calcTotal(m));

      var meta = $('[data-role="metaFoot"]');
      var bits = [];
      if (m.checkins != null) bits.push(m.checkins + ' check-in' + (m.checkins !== 1 ? 's' : ''));
      if (m.lastCheckin) bits.push('Last visit ' + new Date(m.lastCheckin).toLocaleDateString('en-GB'));
      meta.textContent = bits.join(' · ');
    }

    async function openNew(pre) {
      pre = pre || {};
      mode = 'new';
      editMember = null;
      await loadGuests();
      clearForm();
      $('[data-role="title"]').innerHTML = 'New Member';
      $('[data-role="sub"]').textContent = 'Register a member and take the first payment';
      if (pre.room) setVal('room', pre.room);
      if (pre.name) setVal('name', pre.name);
      if (pre.phone) setVal('phone', pre.phone);
      var meta = $('[data-role="metaFoot"]');
      meta.textContent = session && session.name ? 'Staff: ' + session.name : '';
      applyEditability();
      renderPayments();
      open();
    }

    async function openEdit(member) {
      if (!member) return;
      mode = 'edit';
      await loadGuests();
      editMember = service.findMember(member.id) || member;
      clearForm();
      $('[data-role="title"]').innerHTML = 'Edit Member — ' + esc(editMember.name);
      $('[data-role="sub"]').textContent = 'Update details, plan, or record another payment';
      fillMemberFields(editMember);
      renderPayments();
      applyEditability();
      open();
    }

    async function openView(member) {
      if (!member) return;
      mode = 'view';
      await loadGuests();
      editMember = service.findMember(member.id) || member;
      clearForm();
      $('[data-role="title"]').innerHTML = 'Member — ' + esc(editMember.name) + ' <span class="gmm-view-pill">View</span>';
      $('[data-role="sub"]').textContent = 'Read-only — use Edit to make changes';
      fillMemberFields(editMember);
      renderPayments();
      applyEditability();
      open();
    }

    // ── Event delegation ──
    root.addEventListener('click', function (e) {
      if (e.target === root) { close(); return; }

      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'close') { close(); return; }
        if (a === 'save') { save(); return; }
        if (a === 'delete') { remove(); return; }
        if (a === 'addPayment') { showNewPayRow(); return; }
        if (a === 'togglePayAcc') {
          var acc = $('[data-role="payAcc"]');
          if (acc && !acc.hidden) acc.classList.toggle('open');
          return;
        }
        if (a === 'confirmPay') { confirmPay(); return; }
        if (a === 'clearInitRoom') { clearRoom('init'); return; }
        if (a === 'clearPayRoom') { clearRoom('pay'); return; }
        if (a === 'confirmYes') { hideConfirm(true); return; }
        if (a === 'confirmNo') { hideConfirm(false); return; }
      }

      var pick = e.target.closest('[data-pick]');
      if (pick) {
        var drop = $('[data-role="guestDrop"]');
        var hits = drop && drop._hits;
        var g = hits && hits[parseInt(pick.getAttribute('data-pick'), 10)];
        fillGuest(g);
        return;
      }
      var pickRoom = e.target.closest('[data-pick-room]');
      if (pickRoom) {
        selectRoom(pickRoom.dataset.pickPrefix, pickRoom.dataset.pickRoom, pickRoom.dataset.pickGuest, pickRoom.dataset.pickPhone || '');
      }
    });

    root.addEventListener('input', function (e) {
      var role = e.target.getAttribute('data-role');
      if (role === 'guestSearch') searchGuests(e.target.value);
      if (role === 'totalDue' || role === 'initAmount') refreshCalcs();
      if (role === 'initRoomSearch') onRoomSearch('init');
      if (role === 'payRoomSearch') onRoomSearch('pay');
    });

    root.addEventListener('change', function (e) {
      var role = e.target.getAttribute('data-role');
      if (role === 'plan') onPlanChange();
      if (role === 'joined') onJoinedChange();
      if (role === 'initMode') toggleRoomWrap('[data-role="initMode"]', 'initRoomWrap');
      if (role === 'newPayMode') toggleRoomWrap('[data-role="newPayMode"]', 'payRoomWrap');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.gmm-guest-wrap')) {
        var drop = $('[data-role="guestDrop"]');
        if (drop) drop.classList.remove('show');
      }
      if (!e.target.closest('[data-role="initRoomWrap"]')) {
        var r1 = $('[data-role="initRoomResults"]'); if (r1) r1.classList.remove('show');
      }
      if (!e.target.closest('[data-role="payRoomWrap"]')) {
        var r2 = $('[data-role="payRoomResults"]'); if (r2) r2.classList.remove('show');
      }
    });

    return {
      openNew: openNew,
      openEdit: openEdit,
      openView: openView,
      close: close,
      setSession: function (s) {
        session = s;
        applyEditability();
        var byEl = $('[data-role="newPayBy"]');
        if (byEl) byEl.value = (session && session.name) || '';
      },
      destroy: function () {
        close();
        if (root.parentNode) root.parentNode.removeChild(root);
      },
    };
  }

  global.GymMemberModal = { create: create };
})(window);