/**
 * component/grace-po-detail.js — Grace Hotel HMS Reusable PO / PR Detail Modal
 * ─────────────────────────────────────────────────────────────────
 * Extracted from the inline #poDetailModal in all-requisitions.html so
 * both Store and Procurement pages can show the same "full order detail
 * + approval trail + action buttons" popup without duplicating markup.
 *
 * Self-contained like booking-modal.js: it builds its own overlay and
 * appends it to <body> on attach() — no placeholder <div> required in
 * the host page's HTML. Call .open(id) to fetch + show a record,
 * .close() to hide it, .destroy() to remove it entirely.
 *
 *   const poDetail = GracePODetail.attach({
 *     service: ProcurementService,        // REQUIRED — needs getPR(id)
 *     fmtMoney: ProcurementService.fmtN,  // optional — defaults to ₦ formatter
 *     actions: [                          // optional — buttons shown in the footer
 *       {
 *         key: 'accept',
 *         label: 'Accept & Receive Stock',
 *         icon: 'fa-check',
 *         style: 'primary',               // 'primary' | 'danger' | 'outline'
 *         show: (po) => po.approvalStage === 'sent_to_store',
 *         confirm: false,                 // true → runs handler immediately, no reason box
 *         handler: async (po) => { await StoreService.acceptPO(po.id); },
 *       },
 *       {
 *         key: 'reject',
 *         label: 'Reject',
 *         icon: 'fa-xmark',
 *         style: 'danger',
 *         show: (po) => po.approvalStage === 'sent_to_store',
 *         requireReason: true,            // true → shows a reason textarea before running
 *         handler: async (po, reason) => { await StoreService.rejectPO(po.id, reason); },
 *       },
 *     ],
 *     onSuccess: (key, po) => { ... },    // called after any action handler resolves
 *     onClose: () => { ... },
 *   });
 *
 *   poDetail.open(id);   // fetch by id via service.getPR(id) and show
 *   poDetail.close();
 *   poDetail.destroy();  // remove from DOM, unbind everything
 *
 * ── WHY "actions" IS A GENERIC LIST ──────────────────────────────────
 * Store's use case (Accept & Receive / Reject a sent_to_store order) and
 * Procurement's use case (Approve to next stage / Reject at any pending
 * stage, or just read-only viewing of its own history) are different
 * button sets shown under different conditions. Rather than hardcode
 * Accept/Reject, the host page supplies its own `actions` array — each
 * entry controls its own visibility (`show`), whether it needs a typed
 * reason first (`requireReason`), and what actually happens
 * (`handler`). The component only owns rendering, the confirm/reason
 * step, loading state, and error display — never the business logic.
 *
 * ── DATA SHAPE EXPECTED FROM service.getPR(id) ───────────────────────
 * Same shape procurement-service.js / StoreService's PR/PO records
 * already use:
 *   { id, poNo, prNo, by, dept, source, date, needed, priority,
 *     supplier, notes, totalAmount, needsMDApproval, approvalStage,
 *     items: [{ name, qty, unit, cost }],
 *     history: [{ action, by, date, note, stage }] }
 */

(function () {
  'use strict';

  if (window.__gracePODetail) return;
  window.__gracePODetail = true;

  const CSS = `
  .gpo-overlay{
    display:none; position:fixed; inset:0; background:rgba(15,20,40,0.55); backdrop-filter:blur(5px);
    z-index:9000; align-items:flex-start; justify-content:center; padding:24px 16px; overflow-y:auto;
    font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
    --gpo-bg:#ffffff; --gpo-surface2:#f4f6fb; --gpo-border:#eef0f6;
    --gpo-text:#1c2440; --gpo-text2:#6b7280; --gpo-text3:#9aa1b3;
    --gpo-gold:#2f6fed; --gpo-gold-light:#5b8ff9; --gpo-gold-bg:rgba(47,111,237,0.10);
    --gpo-green:#12b76a; --gpo-green-bg:#e9f9f0;
    --gpo-red:#f04438; --gpo-red-bg:#feecec;
    --gpo-amber:#f79009; --gpo-amber-bg:#fff4e5;
    --gpo-blue:#2f6fed; --gpo-blue-bg:#eaf1ff;
  }
  .gpo-overlay.show{ display:flex; }
  .gpo-box{
    background:var(--gpo-bg); border:1px solid var(--gpo-border); border-radius:18px; padding:22px;
    width:min(920px,96vw); position:relative; margin:auto; box-shadow:0 30px 80px rgba(15,20,40,0.25);
    animation:gpoIn .22s cubic-bezier(.4,0,.2,1);
  }
  @keyframes gpoIn{ from{opacity:0;transform:translateY(14px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  .gpo-close{
    position:absolute; top:14px; right:14px; background:var(--gpo-surface2); border:1px solid var(--gpo-border);
    border-radius:8px; width:30px; height:30px; color:var(--gpo-text2); cursor:pointer; font-size:14px;
    z-index:3; display:flex; align-items:center; justify-content:center;
  }
  .gpo-close:hover{ border-color:var(--gpo-red); color:var(--gpo-red); }

  .gpo-state{ text-align:center; padding:40px; color:var(--gpo-text3); font-size:13px; }
  .gpo-state.gpo-err{ color:var(--gpo-red); }

  .gpo-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
  .gpo-head-id{ font-size:18px; font-weight:800; color:var(--gpo-text); }
  .gpo-head-sub{ font-size:12px; color:var(--gpo-text3); margin-top:3px; }
  .gpo-chip{ display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
  .gpo-chip i{ font-size:6px; }
  .gpo-chip-pending{ background:var(--gpo-amber-bg); color:var(--gpo-amber); }
  .gpo-chip-progress{ background:var(--gpo-blue-bg); color:var(--gpo-blue); }
  .gpo-chip-ok{ background:var(--gpo-green-bg); color:var(--gpo-green); }
  .gpo-chip-bad{ background:var(--gpo-red-bg); color:var(--gpo-red); }

  .gpo-meta-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:18px; padding:16px; background:var(--gpo-surface2); border-radius:12px; }
  .gpo-meta-lbl{ font-size:9.5px; color:var(--gpo-text3); text-transform:uppercase; letter-spacing:1px; margin-bottom:3px; font-weight:700; }
  .gpo-meta-val{ font-size:13px; color:var(--gpo-text); }

  .gpo-notes{ font-size:12.5px; color:var(--gpo-text2); background:var(--gpo-surface2); border-radius:10px; padding:11px 14px; margin-bottom:16px; }
  .gpo-notes b{ color:var(--gpo-text); }

  .gpo-section-title{ font-size:12px; font-weight:800; color:var(--gpo-text); margin:16px 0 8px; }
  .gpo-table-wrap{ overflow-x:auto; border:1px solid var(--gpo-border); border-radius:10px; }
  .gpo-table{ width:100%; min-width:520px; border-collapse:collapse; font-size:12.5px; }
  .gpo-table th{ text-align:left; padding:9px 10px; font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--gpo-text3); background:var(--gpo-surface2); border-bottom:1px solid var(--gpo-border); }
  .gpo-table th.center{ text-align:center; } .gpo-table th.right{ text-align:right; }
  .gpo-table td{ padding:9px 10px; border-bottom:1px solid var(--gpo-border); color:var(--gpo-text); }
  .gpo-table td.center{ text-align:center; } .gpo-table td.right{ text-align:right; }
  .gpo-table tfoot td{ font-weight:800; color:var(--gpo-text); }
  .gpo-table tfoot td.right{ color:var(--gpo-gold); }

  .gpo-trail{ border:1px solid var(--gpo-border); border-radius:10px; padding:10px 12px; max-height:240px; overflow-y:auto; }
  .gpo-trail-empty{ font-size:12px; color:var(--gpo-text3); }
  .gpo-trail-row{ display:flex; gap:10px; padding:9px 0; border-bottom:1px solid var(--gpo-border); align-items:flex-start; }
  .gpo-trail-row:last-child{ border-bottom:none; padding-bottom:0; }
  .gpo-trail-ic{ width:24px; height:24px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
  .gpo-trail-action{ font-size:13px; color:var(--gpo-text); font-weight:600; }
  .gpo-trail-meta{ font-size:11.5px; color:var(--gpo-text2); margin-top:1px; }
  .gpo-trail-note{ font-size:11.5px; color:var(--gpo-text2); background:var(--gpo-surface2); border-radius:6px; padding:6px 8px; margin-top:5px; }

  .gpo-md-note{ font-size:11px; color:var(--gpo-amber); margin-top:8px; }

  .gpo-footer{ display:flex; gap:10px; justify-content:flex-end; margin-top:20px; flex-wrap:wrap; }
  .gpo-btn{ padding:9px 16px; border-radius:9px; font-size:13px; cursor:pointer; border:none; font-family:inherit; display:inline-flex; align-items:center; gap:7px; }
  .gpo-btn-outline{ background:var(--gpo-surface2); border:1px solid var(--gpo-border); color:var(--gpo-text2); }
  .gpo-btn-primary{ background:var(--gpo-green); color:#0a1520; font-weight:700; }
  .gpo-btn-danger{ background:var(--gpo-red); color:#fff; font-weight:700; }
  .gpo-btn:disabled{ opacity:.6; cursor:default; }

  /* Reason panel — slides over the whole box when an action requires one */
  .gpo-reason-panel{
    position:absolute; inset:0; background:var(--gpo-bg); z-index:5; display:flex; flex-direction:column;
    justify-content:center; padding:28px; border-radius:18px;
  }
  .gpo-reason-head{ display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .gpo-reason-ic{ width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; background:var(--gpo-red-bg); color:var(--gpo-red); }
  .gpo-reason-title{ font-size:16px; font-weight:800; color:var(--gpo-text); }
  .gpo-reason-sub{ font-size:12px; color:var(--gpo-text3); margin-top:2px; }
  .gpo-reason-label{ font-size:11px; font-weight:700; color:var(--gpo-text2); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; display:block; }
  .gpo-reason-textarea{
    width:100%; box-sizing:border-box; background:var(--gpo-surface2); border:1px solid var(--gpo-border);
    border-radius:9px; color:var(--gpo-text); font-size:13px; padding:11px 12px; resize:vertical;
    font-family:inherit; outline:none; min-height:70px;
  }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'gpo-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _defaultFmtMoney(n) { return '\u20A6' + Math.round(n || 0).toLocaleString('en-NG'); }
  function _defaultFmtDate(d) { if (!d) return '—'; return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Loose status → chip class mapping. Host pages can pass their own
  // `statusChipClass(po)` / `statusLabel(po)` to override entirely.
  function _defaultStatusChip(po) {
    const stage = (po.approvalStage || po.status || '').toLowerCase();
    if (['rejected', 'voided'].includes(stage)) return 'gpo-chip-bad';
    if (['fulfilled', 'approved'].includes(stage)) return 'gpo-chip-ok';
    if (['pending'].includes(stage)) return 'gpo-chip-pending';
    return 'gpo-chip-progress';
  }
  function _defaultStatusLabel(po) {
    const map = {
      pending: 'Pending', accountant: 'Accountant Review', gm: 'GM Review', md: 'MD Review',
      sent_to_store: 'Awaiting Store', approved: 'Approved', fulfilled: 'Fulfilled',
      rejected: 'Rejected', voided: 'Voided',
    };
    const stage = po.approvalStage || po.status || '';
    return map[stage] || stage || '—';
  }

  function attach(options) {
    options = options || {};
    _injectStyles();

    const service = options.service;
    if (!service || typeof service.getPR !== 'function') {
      console.error('[GracePODetail] options.service with a getPR(id) method is required.');
      return null;
    }

    const fmtMoney = options.fmtMoney || _defaultFmtMoney;
    const fmtDate = options.fmtDate || _defaultFmtDate;
    const statusChipClass = options.statusChipClass || _defaultStatusChip;
    const statusLabel = options.statusLabel || _defaultStatusLabel;
    const actions = Array.isArray(options.actions) ? options.actions : [];
    const onSuccess = typeof options.onSuccess === 'function' ? options.onSuccess : function () {};
    const onClose = typeof options.onClose === 'function' ? options.onClose : function () {};
    const subtitle = options.subtitle || 'Full order detail and approval trail';

    let current = null;
    let busy = false;

    const root = document.createElement('div');
    root.className = 'gpo-overlay';
    root.innerHTML = '<div class="gpo-box" role="dialog" aria-modal="true"><button class="gpo-close" data-act="close" title="Close"><i class="fa-solid fa-xmark"></i></button><div data-role="body" class="gpo-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</div></div>';
    document.body.appendChild(root);

    function box() { return root.querySelector('.gpo-box'); }
    function body() { return root.querySelector('[data-role="body"]'); }

    function trailHtml(po) {
      const hist = po.history || [];
      if (!hist.length) return '<div class="gpo-trail-empty">No approval records yet.</div>';
      return hist.map(h => {
        const act = (h.action || '').toLowerCase();
        const icon = act.indexOf('reject') >= 0
          ? '<i class="fa-solid fa-circle-xmark" style="color:var(--gpo-red);"></i>'
          : (act.indexOf('submit') >= 0 || act.indexOf('import') >= 0)
            ? '<i class="fa-solid fa-file-pen" style="color:var(--gpo-text3);"></i>'
            : '<i class="fa-solid fa-circle-check" style="color:var(--gpo-green);"></i>';
        return `<div class="gpo-trail-row">
            <div class="gpo-trail-ic">${icon}</div>
            <div style="flex:1;min-width:0;">
              <div class="gpo-trail-action">${_esc(h.action || 'Step')}</div>
              <div class="gpo-trail-meta">by <strong>${_esc(h.by || '—')}</strong> · ${fmtDate(h.date)}</div>
              ${h.note ? `<div class="gpo-trail-note"><i class="fa-solid fa-quote-left" style="font-size:9px;"></i> ${_esc(h.note)}</div>` : ''}
            </div>
          </div>`;
      }).join('');
    }

    function itemsHtml(po) {
      const items = po.items || [];
      const rows = items.map((i, idx) => `
        <tr>
          <td>${idx + 1}. ${_esc(i.name || '—')}</td>
          <td class="center">${_esc(i.qty)}</td>
          <td class="center">${_esc(i.unit || 'unit')}</td>
          <td class="right">${fmtMoney(i.price || 0)}</td>
          <td class="right" style="font-weight:700;">${fmtMoney((Number(i.qty) || 0) * (Number(i.price) || 0))}</td>
        </tr>`).join('');
      const total = Number(po.totalAmount) || items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
      return `<div class="gpo-table-wrap"><table class="gpo-table">
          <thead><tr><th>Item</th><th class="center">Qty</th><th class="center">Unit</th><th class="right">Unit Cost</th><th class="right">Subtotal</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4" class="right">Total</td><td class="right">${fmtMoney(total)}</td></tr></tfoot>
        </table></div>`;
    }

    function render() {
      const po = current;
      if (!po) return;
      const docId = po.poNo || po.prNo || po.id || '—';

      body().className = '';
      body().innerHTML = `
        <div class="gpo-head">
          <div>
            <div class="gpo-head-id">${_esc(docId)}</div>
            <div class="gpo-head-sub">${_esc(subtitle)}</div>
          </div>
          <span class="gpo-chip ${statusChipClass(po)}"><i class="fa-solid fa-circle"></i>${_esc(statusLabel(po))}</span>
        </div>

        <div class="gpo-meta-grid">
          <div><div class="gpo-meta-lbl">Requested By</div><div class="gpo-meta-val">${_esc(po.by || '—')}</div></div>
          <div><div class="gpo-meta-lbl">Department</div><div class="gpo-meta-val">${_esc(po.dept || '—')}</div></div>
          <div><div class="gpo-meta-lbl">Source</div><div class="gpo-meta-val">${_esc(po.source || 'Procurement')}</div></div>
          <div><div class="gpo-meta-lbl">Date Raised</div><div class="gpo-meta-val">${fmtDate(po.date)}</div></div>
          <div><div class="gpo-meta-lbl">Needed By</div><div class="gpo-meta-val">${fmtDate(po.needed)}</div></div>
          <div><div class="gpo-meta-lbl">Priority</div><div class="gpo-meta-val">${_esc(po.priority || 'Normal')}</div></div>
          <div><div class="gpo-meta-lbl">Supplier</div><div class="gpo-meta-val">${_esc(po.supplier || '—')}</div></div>
        </div>

        ${po.notes ? `<div class="gpo-notes"><b>Notes:</b> ${_esc(po.notes)}</div>` : ''}

        <div class="gpo-section-title">Line Items (${(po.items || []).length})</div>
        ${itemsHtml(po)}

        <div class="gpo-section-title">Approval Trail</div>
        <div class="gpo-trail">${trailHtml(po)}</div>
        ${po.needsMDApproval ? '<div class="gpo-md-note"><i class="fa-solid fa-circle-info"></i> This order exceeded the MD approval threshold and required MD sign-off.</div>' : ''}

        <div class="gpo-footer" data-role="footer"></div>
      `;

      const footer = body().querySelector('[data-role="footer"]');
      footer.innerHTML = '<button type="button" class="gpo-btn gpo-btn-outline" data-act="close">Cancel</button>';
      actions.forEach(a => {
        if (typeof a.show === 'function' && !a.show(po)) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gpo-btn ' + (a.style === 'danger' ? 'gpo-btn-danger' : a.style === 'outline' ? 'gpo-btn-outline' : 'gpo-btn-primary');
        btn.innerHTML = `<i class="fa-solid ${a.icon || 'fa-check'}"></i> ${_esc(a.label || a.key)}`;
        btn.addEventListener('click', () => runAction(a));
        footer.appendChild(btn);
      });
    }

    function showReasonPanel(action) {
      const existing = box().querySelector('.gpo-reason-panel');
      if (existing) existing.remove();
      const panel = document.createElement('div');
      panel.className = 'gpo-reason-panel';
      panel.innerHTML = `
        <div class="gpo-reason-head">
          <div class="gpo-reason-ic"><i class="fa-solid fa-circle-xmark"></i></div>
          <div>
            <div class="gpo-reason-title">${_esc(action.confirmTitle || ('Confirm: ' + (action.label || action.key)))}</div>
            <div class="gpo-reason-sub">${_esc(action.confirmSub || 'This cannot be undone.')}</div>
          </div>
        </div>
        <label class="gpo-reason-label">${_esc(action.reasonLabel || 'Reason')}</label>
        <textarea class="gpo-reason-textarea" data-role="reasonInput" placeholder="${_esc(action.reasonPlaceholder || 'Required — describe why…')}"></textarea>
        <div class="gpo-footer" style="margin-top:16px;">
          <button type="button" class="gpo-btn gpo-btn-outline" data-role="reasonCancel">Cancel</button>
          <button type="button" class="gpo-btn gpo-btn-danger" data-role="reasonConfirm"><i class="fa-solid fa-xmark"></i> Confirm</button>
        </div>`;
      box().appendChild(panel);
      panel.querySelector('[data-role="reasonCancel"]').addEventListener('click', () => panel.remove());
      panel.querySelector('[data-role="reasonConfirm"]').addEventListener('click', () => {
        const val = panel.querySelector('[data-role="reasonInput"]').value.trim();
        if (!val) { panel.querySelector('[data-role="reasonInput"]').focus(); return; }
        panel.remove();
        execute(action, val);
      });
      setTimeout(() => { const el = panel.querySelector('[data-role="reasonInput"]'); if (el) el.focus(); }, 30);
    }

    function runAction(action) {
      if (busy || !current) return;
      if (action.requireReason) { showReasonPanel(action); return; }
      execute(action, null);
    }

    async function execute(action, reason) {
      if (busy || !current) return;
      busy = true;
      const footer = body().querySelector('[data-role="footer"]');
      if (footer) footer.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        await action.handler(current, reason);
        onSuccess(action.key, current);
        close();
      } catch (err) {
        busy = false;
        if (footer) footer.querySelectorAll('button').forEach(b => b.disabled = false);
        showError(err && err.message ? err.message : 'Action failed — please try again.');
      }
    }

    function showError(msg) {
      const existing = box().querySelector('.gpo-inline-error');
      if (existing) existing.remove();
      const el = document.createElement('div');
      el.className = 'gpo-inline-error';
      el.style.cssText = 'margin-top:10px;font-size:12px;color:var(--gpo-red);background:var(--gpo-red-bg);border-radius:8px;padding:9px 12px;';
      el.textContent = msg;
      const footer = body().querySelector('[data-role="footer"]');
      if (footer) footer.insertAdjacentElement('beforebegin', el);
    }

    async function open(id) {
      current = null;
      body().className = 'gpo-state';
      body().innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading order details…';
      root.classList.add('show');
      document.body.style.overflow = 'hidden';
      try {
        const po = await service.getPR(id);
        if (!po) throw new Error('Order not found.');
        current = po;
        render();
      } catch (err) {
        body().className = 'gpo-state gpo-err';
        body().innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${_esc(err && err.message ? err.message : 'Could not load order details.')}`;
      }
    }

    function close() {
      root.classList.remove('show');
      document.body.style.overflow = '';
      current = null;
      busy = false;
      const panel = box().querySelector('.gpo-reason-panel');
      if (panel) panel.remove();
      onClose();
    }

    root.addEventListener('click', e => {
      if (e.target === root) { close(); return; }
      const act = e.target.closest('[data-act="close"]');
      if (act) close();
    });

    return {
      open,
      close,
      isOpen: () => root.classList.contains('show'),
      getCurrent: () => current,
      destroy() {
        close();
        if (root.parentNode) root.parentNode.removeChild(root);
      },
    };
  }

  window.GracePODetail = { attach };

})();