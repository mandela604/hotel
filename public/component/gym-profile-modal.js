'use strict';

(function(global) {
  // ── helpers (rely on GymService if available) ──
  const S = global.GymService || {};

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtDate(s) { return S.fmtDate ? S.fmtDate(s) : (s ? new Date(s+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'); }
  function fmtDateTime(iso) { if(!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) + ', ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }
  function timeAgo(iso) { if (!iso) return '—'; const mins=Math.floor((Date.now()-new Date(iso).getTime())/60000); if(mins<1) return 'Just now'; if(mins<60) return mins+'m ago'; const hrs=Math.floor(mins/60); if(hrs<24) return hrs+'h ago'; const days=Math.floor(hrs/24); if(days<7) return days+'d ago'; return fmtDateTime(iso); }
  function initials(name){ return (name||'').split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,2); }
  function computeStatus(m){ return S.computeStatus ? S.computeStatus(m) : (m.planId ? 'active' : 'expired'); }
  function planById(id){ return S.findPlan ? S.findPlan(id) : { id:null, name:'No Plan', price:0, durationDays:0, notes:'', color:'blue' }; }

  /**
   * Billing snapshot for a member — mirrors GymService.calcTotal/
   * calcPaid/calcBal so the profile modal never re-derives these
   * numbers itself, then maps them to the same label set the payment
   * form uses (Pending / Deposit Paid / Fully Paid). Re-uses the
   * existing green/amber/red chip classes already defined below
   * (chip-active/chip-expiring/chip-expired) instead of introducing a
   * parallel color system just for payment status.
   */
  function payStatusInfo(member, service) {
    const total = service.calcTotal ? service.calcTotal(member) : (member.totalDue || 0);
    const paid = service.calcPaid ? service.calcPaid(member) : (member.amountPaid || 0);
    const bal = service.calcBal ? service.calcBal(member) : Math.max(0, total - paid);
    const label = paid <= 0 ? 'Pending' : (bal <= 0 ? 'Fully Paid' : 'Deposit Paid');
    const chipCls = label === 'Fully Paid' ? 'chip-active' : label === 'Deposit Paid' ? 'chip-expiring' : 'chip-expired';
    return { total, paid, bal, label, chipCls };
  }

  const COLOR_TOKENS = {
    gold:   { bg:'var(--gold-dim)',   fg:'var(--gold-light)', dot:'var(--gold)' },
    blue:   { bg:'var(--blue-bg)',    fg:'var(--blue)',       dot:'var(--blue)' },
    purple: { bg:'var(--purple-bg)',  fg:'var(--purple)',     dot:'var(--purple)' },
    green:  { bg:'var(--green-bg)',   fg:'var(--green)',      dot:'var(--green)' },
    amber:  { bg:'var(--amber-bg)',   fg:'var(--amber)',      dot:'var(--amber)' },
  };
  const STATUS_LABEL = { active:'Active', expiring:'Expiring', expired:'Expired', frozen:'Inactive' };
  const STATUS_CHIP  = { active:'chip-active', expiring:'chip-expiring', expired:'chip-expired', frozen:'chip-frozen' };

  class GymProfileModal {
    constructor(options = {}) {
      this.service = options.service || S;
      this.shell = options.shell || global.shell;
      this.onEdit = options.onEdit || null;          // function(member) — called AFTER this modal has closed, see _edit()
      this.onDeleted = options.onDeleted || null;
      this.onSaved = options.onSaved || null;        // after check-in/renew
      this.session = null;
      this.memberId = null;
      this.checkinPage = 1;
      this.CHECKIN_PAGE_SIZE = 5;
      this._createModal();
    }

    setSession(session) { this.session = session; }

    open(memberId) {
      this.memberId = memberId;
      this.checkinPage = 1;
      this.modalEl.style.display = 'flex';
      this._render();
    }

    close() { this.modalEl.style.display = 'none'; }

    refresh() {
      if (this.modalEl.style.display !== 'none' && this.memberId) {
        this._render();
      }
    }

    // ── private ──

    _createModal() {
      // Inject styles if not already present
      if (!document.getElementById('gymProfileModalStyles')) {
        const style = document.createElement('style');
        style.id = 'gymProfileModalStyles';
        style.textContent = `
          /* FIX #1 (selector): the overlay element carries BOTH
             "modal-overlay" and "gym-profile-modal" classes on the same
             node. A descendant-combinator selector never matched it —
             fixed with a compound selector (no space).
             FIX #2 (palette): this modal is appended straight to
             <body>, OUTSIDE the page's .content element — which is
             where gym-members.html actually declares --gold, --surface,
             --text, etc. Custom properties don't cascade to a sibling
             outside their defining container, so every var(--gold) etc.
             in here was resolving to nothing. Re-declaring the exact
             same palette (and font) directly on this overlay makes the
             modal self-contained and guarantees it always matches the
             page, regardless of where it's mounted or which page
             includes this component. */
          /* #gymProfileModal (id) + two classes = high enough specificity
             that nothing else in the app should be able to out-rank it,
             and !important on every custom property means even an
             equal-or-higher-specificity rule elsewhere (e.g. a global
             dark palette declared for gym-shell.js's own sidebar/topbar)
             cannot leak its dark values in here. This modal is now
             ALWAYS light, regardless of what data-theme is set on
             <html> or what any other stylesheet declares. */
          #gymProfileModal.gym-profile-modal.modal-overlay {
            display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65) !important; backdrop-filter:blur(4px); z-index:300; align-items:flex-start; justify-content:center; padding:20px 16px; overflow-y:auto;
            font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
            --bg:#f4f6fb !important; --surface:#ffffff !important; --surface2:#f4f6fb !important; --surface3:#eef0f6 !important;
            --border:#eef0f6 !important; --border2:#dfe3ec !important; --text:#1c2440 !important; --text2:#6b7280 !important; --text3:#9aa1b3 !important;
            --shadow:0 4px 20px rgba(15,34,55,0.07) !important; --shadow-lg:0 8px 40px rgba(15,34,55,0.10) !important;
            --input-bg:#f4f6fb !important; --modal-bg:#ffffff !important;
            --gold:#2f6fed !important; --gold-light:#5b8ff9 !important; --gold-dim:rgba(47,111,237,0.10) !important; --gold-border:rgba(47,111,237,0.25) !important;
            --green:#12b76a !important; --green-bg:#e9f9f0 !important;
            --red:#f04438 !important; --red-bg:#feecec !important;
            --amber:#f79009 !important; --amber-bg:#fff4e5 !important;
            --blue:#2f6fed !important; --blue-bg:#eaf1ff !important;
            --purple:#8b5cf6 !important; --purple-bg:#f4efff !important;
          }
          #gymProfileModal.gym-profile-modal.modal-overlay.show { display:flex; }
          #gymProfileModal .modal { width:min(640px,96vw); background:#ffffff !important; }
          #gymProfileModal .detail-name, #gymProfileModal .modal-title { color:#1c2440 !important; }
          #gymProfileModal .detail-stat-val, #gymProfileModal .checkin-row, #gymProfileModal .detail-section-body { color:#1c2440 !important; }
          .gym-profile-modal .modal { width:min(640px,96vw); }
          .gym-profile-modal .detail-head { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
          .gym-profile-modal .detail-avatar { width:54px; height:54px; border-radius:50%; background:var(--gold-dim); border:2px solid var(--gold-border); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:var(--gold); flex-shrink:0; }
          .gym-profile-modal .detail-name { font-size:21px; font-weight:700; color:var(--text); line-height:1.2; }
          .gym-profile-modal .detail-subline { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
          .gym-profile-modal .detail-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:16px; }
          @media (max-width:480px){ .gym-profile-modal .detail-grid { grid-template-columns:1fr 1fr; } }
          .gym-profile-modal .detail-stat { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:10px 12px; }
          .gym-profile-modal .detail-stat-label { font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--text3); font-weight:600; margin-bottom:4px; }
          .gym-profile-modal .detail-stat-val { font-size:12.5px; color:var(--text); font-weight:600; line-height:1.4; }
          .gym-profile-modal .plan-detail-card { border:1px solid var(--border); border-radius:12px; padding:12px 14px; margin-bottom:14px; }
          .gym-profile-modal .plan-detail-top { display:flex; align-items:center; justify-content:space-between; font-size:13px; margin-bottom:6px; flex-wrap:wrap; gap:6px; }
          .gym-profile-modal .plan-detail-notes { font-size:12px; color:var(--text2); line-height:1.5; white-space:pre-line; }
          .gym-profile-modal .detail-section { margin-bottom:14px; }
          .gym-profile-modal .detail-section-title { font-size:10px; text-transform:uppercase; letter-spacing:1.2px; color:var(--gold); font-weight:700; margin-bottom:8px; }
          .gym-profile-modal .detail-section-body { font-size:12.5px; color:var(--text2); line-height:1.55; }
          .gym-profile-modal .checkin-row { display:flex; align-items:center; justify-content:space-between; font-size:12px; color:var(--text2); padding:6px 0; border-bottom:1px solid var(--border); }
          .gym-profile-modal .checkin-row:last-child { border-bottom:none; }
          .gym-profile-modal .modal-footer { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; padding-top:14px; border-top:1px solid var(--border); flex-wrap:wrap; }
          .gym-profile-modal .chip { display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border-radius:20px; font-size:9.5px; font-weight:700; white-space:nowrap; }
          .gym-profile-modal .chip::before { content:''; width:5px; height:5px; border-radius:50%; flex-shrink:0; }
          .gym-profile-modal .chip-active{ background:var(--green-bg); color:var(--green); } .gym-profile-modal .chip-active::before{ background:var(--green); }
          .gym-profile-modal .chip-expiring{ background:var(--amber-bg); color:var(--amber); } .gym-profile-modal .chip-expiring::before{ background:var(--amber); }
          .gym-profile-modal .chip-expired{ background:var(--red-bg); color:var(--red); } .gym-profile-modal .chip-expired::before{ background:var(--red); }
          .gym-profile-modal .chip-frozen{ background:var(--blue-bg); color:var(--blue); } .gym-profile-modal .chip-frozen::before{ background:var(--blue); }
          .gym-profile-modal .plan-chip { display:inline-flex; align-items:center; gap:5px; padding:2px 9px; border-radius:20px; font-size:9.5px; font-weight:700; white-space:nowrap; }
          .gym-profile-modal .plan-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
          .gym-profile-modal .empty-note { font-size:12.5px; color:var(--text3); padding:12px 0; text-align:center; }
          .gym-profile-modal .btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; font-size:12.5px; font-weight:500; cursor:pointer; transition:all .2s; white-space:nowrap; border:1px solid transparent; }
          .gym-profile-modal .btn-primary { background:var(--gold); color:#fff; font-weight:600; }
          .gym-profile-modal .btn-primary:hover { background:var(--gold-light); transform:translateY(-1px); }
          .gym-profile-modal .btn-outline { background:none; border-color:var(--border); color:var(--text2); }
          .gym-profile-modal .btn-outline:hover { border-color:var(--gold); color:var(--gold); }
          .gym-profile-modal .btn-sm { padding:6px 12px; font-size:11.5px; }
          .gym-profile-modal .btn:disabled { opacity:.4; cursor:not-allowed; pointer-events:none; }
          .gym-profile-modal .modal { background:var(--modal-bg,var(--surface)); border:1px solid var(--border); border-radius:18px; padding:24px; box-shadow:0 32px 80px rgba(15,34,55,0.25); animation:modalIn .22s cubic-bezier(.4,0,.2,1); margin:auto; position:relative; overflow:hidden; }
          .gym-profile-modal .modal::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--gold); }
          .gym-profile-modal .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
          .gym-profile-modal .modal-header-acts { display:flex; align-items:center; gap:6px; flex-shrink:0; }
          .gym-profile-modal .modal-title { font-size:19px; font-weight:700; color:var(--text); }
          .gym-profile-modal .modal-close { background:var(--surface2); border:1px solid var(--border); border-radius:8px; width:30px; height:30px; color:var(--text2); font-size:13px; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; transition:all .2s; }
          .gym-profile-modal .modal-close:hover { color:var(--text); border-color:var(--gold-border); }
          .gym-profile-modal .modal-close[data-edit-top]:hover { color:var(--gold); border-color:var(--gold-border); }
          .gym-profile-modal .modal-close[hidden] { display:none !important; }
          .gym-profile-modal .pagination { display:flex; align-items:center; justify-content:space-between; padding:8px 0 0; border-top:none; font-size:11.5px; color:var(--text3); flex-wrap:wrap; gap:8px; }
          .gym-profile-modal .page-btns { display:flex; gap:3px; flex-wrap:wrap; }
          .gym-profile-modal .page-btn { min-width:28px; height:28px; border-radius:7px; border:1px solid var(--border); background:none; color:var(--text3); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11.5px; transition:all .15s; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif; padding:0 7px; }
          .gym-profile-modal .page-btn:hover { border-color:var(--gold-border); color:var(--gold); }
          .gym-profile-modal .page-btn.active { background:var(--gold-dim); border-color:var(--gold-border); color:var(--gold); font-weight:600; }
          .gym-profile-modal .page-btn:disabled { opacity:.35; cursor:default; pointer-events:none; }
          .gym-profile-modal .act-btn { background:none; border:1px solid var(--border); border-radius:7px; padding:5px 10px; font-size:11px; font-weight:500; color:var(--text2); cursor:pointer; transition:all .15s; font-family:inherit; white-space:nowrap; display:inline-flex; align-items:center; gap:5px; }
          .gym-profile-modal .act-btn:hover { border-color:var(--gold-border); color:var(--gold); }
          .gym-profile-modal .act-btn.danger:hover { border-color:var(--red); color:var(--red); }
          .gym-profile-modal .act-btn:disabled { opacity:.35; cursor:not-allowed; pointer-events:none; }
          @keyframes modalIn { from{opacity:0;transform:translateY(16px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        `;
        document.head.appendChild(style);
      }

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay gym-profile-modal';
      overlay.id = 'gymProfileModal';
      overlay.style.display = 'none';
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">Member Profile</div>
            <div class="modal-header-acts">
              <button type="button" class="modal-close" data-edit-top title="Edit member" hidden><i class="fa-solid fa-pen"></i></button>
              <button type="button" class="modal-close" data-close title="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </div>
          <div id="profileDetailBody"></div>
        </div>
      `;
      document.body.appendChild(overlay);
      this.modalEl = overlay;
      this.modalEl.__profileInstance = this;
      overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
      overlay.querySelector('[data-close]').addEventListener('click', () => this.close());
      // Top-of-modal Edit button — same action as the Edit button in the
      // footer (see _render()'s modal-footer markup): both call _edit(),
      // which closes THIS modal before handing off to onEdit(member).
      overlay.querySelector('[data-edit-top]').addEventListener('click', () => this._edit());
    }

    _render() {
      const member = this.service.findMember(this.memberId);
      if (!member) {
        document.getElementById('profileDetailBody').innerHTML = '<div class="empty-note">Member not found.</div>';
        return;
      }
      const plan = planById(member.planId);
      const s = computeStatus(member);
      const c = COLOR_TOKENS[plan.color] || COLOR_TOKENS.blue;
      const billing = payStatusInfo(member, this.service);
      // Newest first, same convention as the rest of the app.
      const memberCheckins = (this.service.state.checkins || [])
        .filter(ci => ci.memberId === member.id)
        .slice()
        .sort((a, b) => new Date(b.time) - new Date(a.time));
      const totalCheckins = memberCheckins.length;
      const totalPages = Math.max(1, Math.ceil(totalCheckins / this.CHECKIN_PAGE_SIZE));
      if (this.checkinPage > totalPages) this.checkinPage = totalPages;
      const start = (this.checkinPage - 1) * this.CHECKIN_PAGE_SIZE;
      const pageCheckins = memberCheckins.slice(start, start + this.CHECKIN_PAGE_SIZE);

      const canEdit = this._hasPermission('canEdit');
      const canDelete = this._hasPermission('canDelete');
      const canCheckin = (s !== 'expired' && s !== 'frozen');

      // Top-of-modal Edit button lives outside #profileDetailBody (it's
      // part of the static header created once in _createModal), so its
      // visibility is toggled here on every render instead of rebuilt.
      const editTopBtn = this.modalEl.querySelector('[data-edit-top]');
      if (editTopBtn) editTopBtn.hidden = !canEdit;

      const body = document.getElementById('profileDetailBody');
      body.innerHTML = `
        <div class="detail-head">
          <span class="detail-avatar">${initials(member.name)}</span>
          <div>
            <div class="detail-name">${_esc(member.name)}</div>
            <div class="detail-subline">
              <span class="chip ${STATUS_CHIP[s]}">${STATUS_LABEL[s]}</span>
              ${member.planId ? this._planChipHtml(plan) : '<span style="color:var(--text3);font-size:11px;margin-left:6px;">Not set</span>'}
            </div>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-stat"><div class="detail-stat-label">Room / Contact</div><div class="detail-stat-val">${_esc(member.room||'—')}${member.phone ? '<br>'+_esc(member.phone) : ''}</div></div>
          <div class="detail-stat"><div class="detail-stat-label">Joined</div><div class="detail-stat-val">${fmtDate(member.joined)}</div></div>
          <div class="detail-stat"><div class="detail-stat-label">Expiry</div><div class="detail-stat-val">${fmtDate(member.expiry)}</div></div>
          <div class="detail-stat"><div class="detail-stat-label">Total Check-ins</div><div class="detail-stat-val">${member.checkins||0}</div></div>
          <div class="detail-stat"><div class="detail-stat-label">Last Check-in</div><div class="detail-stat-val">${member.lastCheckin ? timeAgo(member.lastCheckin) : 'Never'}</div></div>
          <div class="detail-stat"><div class="detail-stat-label">Status</div><div class="detail-stat-val">${STATUS_LABEL[s]}</div></div>
        </div>
        ${member.planId ? `<div class="plan-detail-card" style="background:${c.bg};border-color:${c.fg}55;">
          <div class="plan-detail-top"><span style="color:${c.fg};font-weight:700;">${_esc(plan.name)} Plan</span><span style="color:${c.fg};">${this._fmtN(plan.price)} / ${plan.durationDays} day${plan.durationDays!==1?'s':''}</span></div>
          ${plan.notes ? `<div class="plan-detail-notes">${_esc(plan.notes)}</div>` : ''}
        </div>` : ''}
        <div class="plan-detail-card">
          <div class="plan-detail-top">
            <span style="font-weight:700;color:var(--text);">Billing</span>
            <span class="chip ${billing.chipCls}">${billing.label}</span>
          </div>
          <div class="detail-grid" style="margin-bottom:0;">
            <div class="detail-stat"><div class="detail-stat-label">Total Due</div><div class="detail-stat-val">${this._fmtN(billing.total)}</div></div>
            <div class="detail-stat"><div class="detail-stat-label">Paid</div><div class="detail-stat-val" style="color:var(--green);font-weight:700;">${this._fmtN(billing.paid)}</div></div>
            <div class="detail-stat"><div class="detail-stat-label">Balance</div><div class="detail-stat-val" style="color:${billing.bal>0?'var(--red)':'var(--green)'};font-weight:700;">${this._fmtN(billing.bal)}</div></div>
          </div>
        </div>
        ${member.notes ? `<div class="detail-section"><div class="detail-section-title">Notes</div><div class="detail-section-body">${_esc(member.notes)}</div></div>` : ''}
        <div class="detail-section">
          <div class="detail-section-title"><i class="fa-solid fa-clock-rotate-left"></i> Check-in History</div>
          ${totalCheckins === 0 ? '<div class="empty-note" style="padding:12px 0;">No check-ins recorded yet.</div>' :
            pageCheckins.map(ci => `<div class="checkin-row"><span><i class="fa-solid fa-circle-check" style="color:var(--green);font-size:10px;margin-right:6px;"></i>${fmtDateTime(ci.time)}</span><span style="color:var(--text3);">${timeAgo(ci.time)}</span></div>`).join('')}
          ${totalCheckins > this.CHECKIN_PAGE_SIZE ? `
            <div class="pagination">
              <span style="font-size:11px;">${start+1}–${Math.min(start+this.CHECKIN_PAGE_SIZE, totalCheckins)} of ${totalCheckins}</span>
              <div class="page-btns">
                <button type="button" class="page-btn" onclick="this.closest('.modal-overlay').__profileInstance._prevCheckinPage()" ${this.checkinPage<=1?'disabled':''}><i class="fa-solid fa-chevron-left" style="font-size:9px;"></i></button>
                <button type="button" class="page-btn active">${this.checkinPage} / ${totalPages}</button>
                <button type="button" class="page-btn" onclick="this.closest('.modal-overlay').__profileInstance._nextCheckinPage()" ${this.checkinPage>=totalPages?'disabled':''}><i class="fa-solid fa-chevron-right" style="font-size:9px;"></i></button>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').__profileInstance._renew()"><i class="fa-solid fa-rotate"></i> Renew</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').__profileInstance._checkin()" ${!canCheckin ? 'disabled' : ''}><i class="fa-solid fa-check"></i> Check-in</button>
          ${canEdit ? `<button type="button" class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').__profileInstance._edit()"><i class="fa-solid fa-pen"></i> Edit</button>` : ''}
          ${canDelete ? `<button type="button" class="btn btn-sm" style="background:rgba(240,68,56,0.1);border-color:rgba(240,68,56,0.3);color:var(--red);" onclick="this.closest('.modal-overlay').__profileInstance._delete()"><i class="fa-solid fa-trash"></i> Remove</button>` : ''}
        </div>
      `;
    }

    // ── check-in pagination ──
    // Plain instance methods invoked via inline onclick (see _render()
    // above) instead of addEventListener — the previous version bound a
    // new '_profilePrev'/'_profileNext' listener on the same persistent
    // .modal element every single _render() call and never removed the
    // old ones, so listeners piled up and a single click could fire
    // several times, skipping past pages. This has no listeners to
    // accumulate, so it stays reliably 5 check-ins per page.
    _prevCheckinPage() {
      if (this.checkinPage > 1) { this.checkinPage--; this._render(); }
    }
    _nextCheckinPage() {
      const member = this.service.findMember(this.memberId);
      if (!member) return;
      const total = (this.service.state.checkins || []).filter(ci => ci.memberId === member.id).length;
      const totalPages = Math.max(1, Math.ceil(total / this.CHECKIN_PAGE_SIZE));
      if (this.checkinPage < totalPages) { this.checkinPage++; this._render(); }
    }

    // ── actions ──

    async _checkin() {
      if (!this.memberId) return;
      try {
        await this.service.checkIn(this.memberId);
        if (this.onSaved) this.onSaved();
        this.refresh();
        const m = this.service.findMember(this.memberId);
        this._toast((m ? m.name : 'Member') + ' checked in.', 'success');
      } catch (err) {
        this._toast(err.message || 'Check-in failed.', 'error');
      }
    }

    async _renew() {
      if (!this.memberId) return;
      const m = this.service.findMember(this.memberId);
      if (!m) return;
      const plan = planById(m.planId);
      const base = m.expiry && new Date(m.expiry + 'T00:00:00') > new Date() ? m.expiry : new Date().toISOString().split('T')[0];
      const d = new Date(base + 'T00:00:00');
      d.setDate(d.getDate() + (plan.durationDays || 30));
      const newExpiry = d.toISOString().split('T')[0];
      // Simple prompt for expiry (could open a small modal, but we'll use prompt for brevity)
      const manual = prompt('Enter new expiry date (YYYY-MM-DD):', newExpiry);
      if (!manual) return;
      try {
        await this.service.renewMember(this.memberId, manual);
        if (this.onSaved) this.onSaved();
        this.refresh();
        this._toast((m.name) + '\'s membership renewed to ' + fmtDate(manual) + '.', 'success');
      } catch (err) {
        this._toast(err.message || 'Renewal failed.', 'error');
      }
    }

    /**
     * Edit — closes THIS profile modal first, then hands off to onEdit.
     * Bound to both the header pen icon and the footer "Edit" button
     * (see _createModal / _render), so either one behaves identically:
     * the profile view goes away and the caller's onEdit(member) opens
     * whatever handles editing — typically GymMemberModal.openEdit(member),
     * which is the same New/Edit/View modal used for registration and
     * for recording payments. Wire it up like:
     *
     *   const profileModal = GymProfileModal.create({
     *     service: GymService,
     *     onEdit: function (member) { memberModal.openEdit(member); },
     *     ...
     *   });
     *
     * Closing before calling onEdit avoids stacking two full-screen
     * overlays — the member modal opens into a clear view instead of
     * layering on top of this one.
     */
    _edit() {
      if (!this.onEdit) return;
      const m = this.service.findMember(this.memberId);
      if (!m) return;
      this.close();
      this.onEdit(m);
    }

    _delete() {
      if (!this.memberId) return;
      const m = this.service.findMember(this.memberId);
      if (!m) return;
      this._confirm('Remove "' + _esc(m.name) + '" from the gym member list? This cannot be undone.').then(ok => {
        if (!ok) return;
        this.service.deleteMember(this.memberId)
          .then(() => {
            if (this.onDeleted) this.onDeleted();
            this.close();
            this._toast('Member removed.', 'error');
          })
          .catch(err => this._toast(err.message || 'Delete failed.', 'error'));
      });
    }

    _confirm(message) {
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(3px);z-index:400;display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML =
          '<div style="background:#fff;border-radius:14px;padding:22px 24px;max-width:400px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.25);font-family:\'Segoe UI\',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;">' +
            '<p style="font-size:14px;color:#1c2440;margin-bottom:18px;line-height:1.6;">' + message + '</p>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
              '<button class="btn-cancel" style="padding:7px 14px;border-radius:8px;border:1px solid #eef0f6;background:#fff;color:#6b7280;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>' +
              '<button class="btn-confirm" style="padding:7px 14px;border-radius:8px;border:none;background:rgba(240,68,56,0.1);color:#f04438;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Delete</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(overlay);
        overlay.querySelector('.btn-cancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
        overlay.querySelector('.btn-confirm').addEventListener('click', () => { overlay.remove(); resolve(true); });
        overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
      });
    }

    // ── helpers ──

    _planChipHtml(plan) {
      const c = COLOR_TOKENS[plan.color] || COLOR_TOKENS.blue;
      return `<span class="plan-chip" style="background:${c.bg};color:${c.fg};"><span class="plan-dot" style="background:${c.dot};"></span>${_esc(plan.name)}</span>`;
    }

    _fmtN(n) { return '₦' + Math.round(n||0).toLocaleString('en-NG'); }

    _hasPermission(perm) {
      if (window.Permissions && window.Permissions.hasPermission) {
        return window.Permissions.hasPermission(this.session, perm, 'gym');
      }
      const role = (this.session && this.session.role) || '';
      if (perm === 'canEdit') return role === 'admin' || role === 'manager' || (role === 'staff' && this.session && this.session.privilege === 'gym_attendant');
      if (perm === 'canDelete') return role === 'admin';
      return false;
    }

    _toast(msg, type) {
      type = type || 'success';
      const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
      const t = document.createElement('div');
      t.className = 'toast ' + type;
      t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#fff;border:1px solid #eef0f6;border-radius:10px;padding:11px 16px;font-size:13px;color:#1c2440;box-shadow:0 8px 28px rgba(15,20,40,0.18);z-index:999;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 40px);font-weight:600;font-family:\'Segoe UI\',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;border-left:3px solid ' + (type === 'success' ? '#12b76a' : type === 'error' ? '#f04438' : '#2f6fed') + ';';
      t.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    }
  }

  global.GymProfileModal = {
    create: function(options) {
      return new GymProfileModal(options);
    }
  };
})(window);