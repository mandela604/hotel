/**
 * Procurement Modals - Custom modal system for procurement module
 */
const ProcurementModals = (function() {
  let modalContainer = null;
  let overlay = null;

  function init() {
    if (modalContainer) return;
    
    overlay = document.createElement('div');
    overlay.id = 'prc-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9998;display:none;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(overlay);

    modalContainer = document.createElement('div');
    modalContainer.id = 'prc-modal-container';
    modalContainer.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;pointer-events:none;';
    document.body.appendChild(modalContainer);
  }

  function show(content, title = '') {
    init();
    
    modalContainer.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);pointer-events:all;animation:modalIn .3s ease;">
        ${title ? `<div style="font-size:16px;font-weight:700;color:var(--gold);margin-bottom:16px;font-family:'Cormorant Garamond',serif;">${title}</div>` : ''}
        <div style="color:var(--text);line-height:1.6;white-space:pre-wrap;">${content}</div>
        <div style="margin-top:20px;text-align:right;">
          <button onclick="ProcurementModals.close()" style="padding:8px 20px;background:var(--gold);color:#0a1520;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
        </div>
      </div>
    `;
    
    overlay.style.display = 'flex';
    modalContainer.style.display = 'flex';
    
    // Close on overlay click
    overlay.onclick = close;
  }

  function confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
    init();

    modalContainer.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);pointer-events:all;animation:modalIn .3s ease;">
          <div style="font-size:16px;font-weight:700;color:var(--gold);margin-bottom:12px;font-family:'Cormorant Garamond',serif;">${title}</div>
          <div style="color:var(--text);line-height:1.6;margin-bottom:20px;white-space:pre-wrap;">${message}</div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="modal-cancel" style="padding:8px 20px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>
            <button id="modal-ok" style="padding:8px 20px;background:var(--gold);color:#0a1520;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Confirm</button>
          </div>
        </div>
      `;
      
      overlay.style.display = 'flex';
      modalContainer.style.display = 'flex';
      
      document.getElementById('modal-cancel').onclick = () => { close(); resolve(false); };
      document.getElementById('modal-ok').onclick = () => { close(); resolve(true); };
    });
  }

  function alert(message, title = '') {
    show(message, title);
  }

  // Custom styled input prompt (matching modal) — replaces browser prompt().
  function askInput(message, title = 'Input', defaultValue = '') {
    return new Promise((resolve) => {
      init();
      modalContainer.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);pointer-events:all;animation:modalIn .3s ease;">
          <div style="font-size:16px;font-weight:700;color:var(--gold);margin-bottom:12px;font-family:'Cormorant Garamond',serif;">${title}</div>
          <div style="color:var(--text);line-height:1.6;margin-bottom:14px;white-space:pre-wrap;">${message}</div>
          <textarea id="modal-input" rows="2" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--text);font-size:13px;font-family:'Outfit',sans-serif;resize:vertical;">${defaultValue}</textarea>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
            <button id="modal-cancel" style="padding:8px 20px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>
            <button id="modal-ok" style="padding:8px 20px;background:var(--gold);color:#0a1520;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Continue</button>
          </div>
        </div>
      `;
      overlay.style.display = 'flex';
      modalContainer.style.display = 'flex';
      const input = document.getElementById('modal-input');
      input.focus();
      document.getElementById('modal-cancel').onclick = () => { close(); resolve(null); };
      document.getElementById('modal-ok').onclick = () => { resolve(input.value); close(); };
    });
  }

  function close() {
    if (overlay) overlay.style.display = 'none';
    if (modalContainer) modalContainer.style.display = 'none';
  }

  // PR Detail Modal
  function showPRDetail(pr) {
    if (!pr) return;
    
    const statusLabels = { pending:'Pending', accountant:'Accountant Review', gm:'GM Review', md:'MD Review', approved:'Approved', sent_to_store:'Sent to Store', fulfilled:'Fulfilled', rejected:'Rejected', voided:'Voided — Corrected' };
    const statusColors = { pending:'var(--amber)', accountant:'var(--blue)', gm:'var(--green)', md:'var(--purple)', approved:'var(--green)', sent_to_store:'var(--blue)', fulfilled:'var(--purple)', rejected:'var(--red)', voided:'var(--text3)' };
    
    const historyHtml = pr.history && pr.history.length > 0 
      ? pr.history.map(h => `
          <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
            <div style="width:8px;height:8px;border-radius:50%;background:${statusColors[h.stage] || 'var(--text3)'};margin-top:6px;flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="font-size:12px;color:var(--text);font-weight:600;">${h.action}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${h.by} · ${new Date(h.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
              ${h.note ? `<div style="font-size:11px;color:var(--text2);margin-top:4px;font-style:italic;">"${h.note}"</div>` : ''}
            </div>
          </div>
        `).join('')
      : '<div style="color:var(--text3);font-size:12px;padding:12px 0;">No history yet</div>';

    const canApprove = pr.approvalStage === 'pending' || pr.approvalStage === 'accountant' || pr.approvalStage === 'gm' || pr.approvalStage === 'md';
    const canReject = canApprove;
    const canCreatePO = pr.approvalStage === 'approved';
    // Void & Correct is only offered once Store has actually accepted the
    // PO ('fulfilled') — a PO still moving through internal approval gets
    // edited/rejected the normal way instead, and one that's already been
    // voided or rejected can't be voided again.
    const canVoid = pr.approvalStage === 'fulfilled';

    const awaitingStoreNote = pr.approvalStage === 'sent_to_store'
      ? `<div style="padding:12px;background:var(--blue-bg);border-radius:8px;margin-bottom:20px;font-size:12px;color:var(--blue);">
           <i class="fa-solid fa-circle-info"></i> Fully approved internally — now waiting on Store to accept or reject it.
         </div>`
      : '';
    const voidLinkNote = pr.voidedIntoPrId
      ? `<div style="padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:20px;font-size:12px;color:var(--text2);">
           <i class="fa-solid fa-rotate"></i> Voided — a corrected request was raised in its place (PR ${pr.voidedIntoPrNo || pr.voidedIntoPrId}).
         </div>`
      : (pr.correctionOfPrId
        ? `<div style="padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:20px;font-size:12px;color:var(--text2);">
             <i class="fa-solid fa-rotate"></i> Raised to correct ${pr.correctionOfPrNo || pr.correctionOfPrId} after the original quantities/costs didn't match what was actually received.
           </div>`
        : '');

    init();

    // ── Approval pipeline ─────────────────────────────────────────
    // Derives who approved each role from pr.history (each history row
    // records `by` + the stage it moved TO), and shows the current
    // approver (the user viewing) on the active stage.
    const stageBy = {};
    (pr.history || []).forEach(h => { if (h.stage) stageBy[h.stage] = h.by; });
    const roles = [
      { key:'accountant', label:'Accountant', icon:'fa-calculator', color:'var(--blue)' },
      { key:'gm',         label:'Manager (GM)', icon:'fa-user-tie', color:'var(--green)' },
    ];
    if (pr.totalAmount > 100000) {
      roles.push({ key:'md', label:'MD', icon:'fa-star', color:'var(--purple)' });
    }
    const approvedSet = {};
    Object.keys(stageBy).forEach(s => {
      if (s==='accountant') approvedSet['accountant']=true;
      if (s==='gm'||s==='sent_to_store') approvedSet['gm']=true;
      if (s==='md'||s==='sent_to_store') approvedSet['md']=true;
    });
    const session = (typeof ProcurementService !== 'undefined' && ProcurementService.resolveSession)
      ? ProcurementService.resolveSession() : {};
    const sRole = String(session.role || '').toLowerCase();
    const currentRole = (sRole==='md') ? 'md' : (sRole==='gm' || sRole==='manager') ? 'gm' : (sRole==='accountant') ? 'accountant' : '';
    const activeStage = pr.approvalStage;
    const pipelineHtml = `
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--gold);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">Approval Pipeline</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:stretch;">
          ${roles.map(r => {
            const done = !!approvedSet[r.key];
            const isActive = activeStage === r.key;
            const isNext = !done && !isActive && (
              (r.key==='accountant' && activeStage==='pending') ||
              (r.key==='gm' && activeStage==='accountant') ||
              (r.key==='md' && activeStage==='gm' && pr.totalAmount > (ProcurementService.CONFIG.MD_APPROVAL_THRESHOLD || 100000))
            );
            const highlit = done ? r.color : (isActive ? 'var(--amber)' : 'var(--text3)');
            const who = done ? (stageBy[r.key] || 'Approved') : (isActive && currentRole===r.key ? ((session.name||'You') + ' — now') : (isNext ? 'Next' : 'Pending'));
            return `
              <div style="flex:1;min-width:120px;border:1px solid ${done?r.color:'var(--border)'};border-radius:12px;padding:10px 12px;text-align:center;">
                <div style="font-size:18px;margin-bottom:4px;">
                  ${done
                    ? `<i class="fa-solid fa-circle-check" style="color:${r.color};"></i>`
                    : (isActive ? '<i class="fa-solid fa-spinner fa-spin" style="color:var(--amber);"></i>' : `<i class="fa-solid ${r.icon}" style="color:${highlit};"></i>`)}
                </div>
                <div style="font-size:11px;font-weight:700;color:${highlit};">${r.label}</div>
                <div style="font-size:10px;color:var(--text3);margin-top:3px;">${who}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;

    modalContainer.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);pointer-events:all;animation:modalIn .3s ease;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div>
            <div style="font-size:20px;font-weight:700;color:var(--gold);font-family:'Cormorant Garamond',serif;">${pr.prNo}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:4px;">${pr.item}</div>
          </div>
          <span style="padding:4px 12px;background:${statusColors[pr.approvalStage] || 'var(--amber)'}15;color:${statusColors[pr.approvalStage] || 'var(--amber)'};border-radius:20px;font-size:11px;font-weight:700;">${statusLabels[pr.approvalStage] || pr.approvalStage}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;padding:16px;background:var(--surface2);border-radius:10px;">
          <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Department</div><div style="font-size:13px;color:var(--text);">${pr.dept}</div></div>
          <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Requested By</div><div style="font-size:13px;color:var(--text);">${pr.by}</div></div>
          <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Date Raised</div><div style="font-size:13px;color:var(--text);">${new Date(pr.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div></div>
          <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Total Amount</div><div style="font-size:13px;color:var(--gold);font-weight:700;">₦${pr.totalAmount.toLocaleString('en-NG')}</div></div>
          <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Priority</div><div style="font-size:13px;color:var(--text);">${pr.priority}</div></div>
          <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Needs MD Approval</div><div style="font-size:13px;color:${pr.needsMDApproval ? 'var(--purple)' : 'var(--text)'};">${pr.needsMDApproval ? 'Yes (>\u20A6' + Math.round(ProcurementService.CONFIG.MD_APPROVAL_THRESHOLD || 100000).toLocaleString('en-NG') + ')' : 'No'}</div></div>
        </div>

        ${pipelineHtml}

        ${awaitingStoreNote}
        ${voidLinkNote}
        ${pr.notes ? `<div style="padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:20px;font-size:12px;color:var(--text2);font-style:italic;">"${pr.notes}"</div>` : ''}

        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:700;color:var(--gold);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">Approval History</div>
          <div style="max-height:300px;overflow-y:auto;">${historyHtml}</div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          ${canApprove ? `<button onclick="ProcurementModals.approvePR(&#39;${pr.id}&#39;)" style="padding:8px 20px;background:var(--green);color:#0a1520;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">✓ Approve</button>` : ''}
          ${canReject ? `<button onclick="ProcurementModals.rejectPR(&#39;${pr.id}&#39;)" style="padding:8px 20px;background:var(--red);color:#fff;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">✕ Reject</button>` : ''}
          ${canCreatePO ? `<button onclick="ProcurementModals.createPO(&#39;${pr.id}&#39;)" style="padding:8px 20px;background:var(--purple);color:#fff;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">📋 Create PO</button>` : ''}
          ${canVoid ? `<button onclick="ProcurementModals.showVoidCorrectModal('${pr.id}')" style="padding:8px 20px;background:var(--amber);color:#0a1520;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">↺ Void &amp; Correct</button>` : ''}
          <button onclick="ProcurementModals.close()" style="padding:8px 20px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
        </div>
      </div>
    `;
    
    overlay.style.display = 'flex';
    modalContainer.style.display = 'flex';
  }

  async function approvePR(id) {
    try {
      await ProcurementService.approvePR(id, 'current', '');
      ProcurementModals.alert('Purchase request approved successfully!', 'Success');
      location.reload();
    } catch (error) {
      ProcurementModals.alert('Error approving request: ' + error.message, 'Error');
    }
  }

  async function rejectPR(id) {
    const note = await askInput('Reason for rejection:', 'Reject Purchase Request');
    if (note === null) return; // Cancelled
    if (!note.trim()) {
      ProcurementModals.alert('Please provide a rejection reason.', 'Error');
      return;
    }
    
    try {
      await ProcurementService.rejectPR(id, 'current', note);
      ProcurementModals.alert('Purchase request rejected.', 'Rejected');
      location.reload();
    } catch (error) {
      ProcurementModals.alert('Error rejecting request: ' + error.message, 'Error');
    }
  }

  async function createPO(id) {
    const poNo = await askInput('Enter PO Number:', 'Create Purchase Order');
    if (poNo === null) return; // Cancelled
    if (!poNo.trim()) {
      ProcurementModals.alert('Please enter a PO number.', 'Error');
      return;
    }
    
    const supplier = await askInput('Enter Supplier Name:', 'Create Purchase Order');
    if (supplier === null) return;
    if (!supplier.trim()) {
      ProcurementModals.alert('Please enter a supplier name.', 'Error');
      return;
    }
    
    try {
      await ProcurementService.createPO(id, poNo.trim(), supplier.trim());
      ProcurementModals.alert(`Purchase Order ${poNo} created successfully!\n\nSupplier: ${supplier}\nStatus: Fulfilled`, 'Success');
      location.reload();
    } catch (error) {
      ProcurementModals.alert('Error creating PO: ' + error.message, 'Error');
    }
  }

  /**
   * Void & Correct — for a PO Store has already accepted ('fulfilled')
   * where the actual market purchase didn't match what was approved
   * (short quantities, different cost, etc). Voids the original PR and,
   * in the same action, raises a corrected PR pre-filled with the
   * original's items so Procurement only has to adjust the lines that
   * changed. The corrected PR skips internal review (it's a correction
   * of something already fully approved) and goes straight to
   * 'sent_to_store' — Store then either accepts it or rejects it, same
   * as any other incoming PO.
   */
  function showVoidCorrectModal(prId) {
    const pr = (ProcurementService.state.prs || []).find(p => p.id === prId);
    if (!pr) return;
    const items = (pr.items && pr.items.length)
      ? pr.items
      : [{ name: pr.item, qty: pr.qty, price: pr.unitCost }];

    init();

    const rowsHtml = items.map((it, i) => `
      <div style="display:grid;grid-template-columns:1fr 90px 110px;gap:8px;margin-bottom:8px;align-items:center;">
        <div style="font-size:12.5px;color:var(--text);">${it.name}</div>
        <input type="number" min="0" step="any" id="vc-qty-${i}" value="${it.qty}" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--input-bg,var(--surface2));color:var(--text);font-size:12.5px;">
        <input type="number" min="0" step="any" id="vc-price-${i}" value="${it.price != null ? it.price : it.cost || 0}" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--input-bg,var(--surface2));color:var(--text);font-size:12.5px;">
      </div>`).join('');

    modalContainer.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);pointer-events:all;animation:modalIn .3s ease;">
        <div style="font-size:16px;font-weight:700;color:var(--amber);margin-bottom:6px;font-family:'Cormorant Garamond',serif;">Void &amp; Correct ${pr.prNo}</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px;">
          This voids the original PO and raises a corrected request with the quantities/costs you actually received.
          The corrected request skips re-approval and goes straight back to Store to accept or reject.
        </div>

        <div style="display:grid;grid-template-columns:1fr 90px 110px;gap:8px;margin-bottom:6px;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Item</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Qty received</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Unit cost</div>
        </div>
        ${rowsHtml}

        <div style="margin-top:12px;">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Reason for voiding (required)</div>
          <textarea id="vc-reason" rows="3" placeholder="e.g. supplier only had 8 of the 12 cartons in stock" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--input-bg,var(--surface2));color:var(--text);font-family:inherit;font-size:12.5px;resize:vertical;"></textarea>
        </div>

        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
          <button onclick="ProcurementModals.close()" style="padding:8px 20px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>
          <button onclick="ProcurementModals.submitVoidCorrect('${pr.id}', ${items.length})" style="padding:8px 20px;background:var(--amber);color:#0a1520;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Void &amp; Raise Corrected PO</button>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';
    modalContainer.style.display = 'flex';
  }

  async function submitVoidCorrect(prId, itemCount) {
    const reasonEl = document.getElementById('vc-reason');
    const reason = reasonEl ? reasonEl.value.trim() : '';
    if (!reason) {
      ProcurementModals.alert('Please explain why this PO is being voided.', 'Error');
      return;
    }

    const pr = (ProcurementService.state.prs || []).find(p => p.id === prId);
    const sourceItems = (pr && pr.items && pr.items.length) ? pr.items : [{ name: pr.item, qty: pr.qty, price: pr.unitCost }];

    const items = [];
    for (let i = 0; i < itemCount; i++) {
      const qtyEl = document.getElementById('vc-qty-' + i);
      const priceEl = document.getElementById('vc-price-' + i);
      const qty = qtyEl ? Number(qtyEl.value) : 0;
      const price = priceEl ? Number(priceEl.value) : 0;
      items.push(Object.assign({}, sourceItems[i], { qty, price, cost: price }));
    }

    try {
      await ProcurementService.voidAndCorrectPO(prId, { items, reason }, 'current');
      ProcurementModals.alert('PO voided. A corrected request has been raised and sent to Store.', 'Success');
      location.reload();
    } catch (error) {
      ProcurementModals.alert('Error voiding this PO: ' + error.message, 'Error');
    }
  }

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(-10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
  `;
  document.head.appendChild(style);

  return {
    show,
    confirm,
    alert,
    close,
    showPRDetail,
    approvePR,
    rejectPR,
    createPO,
    showVoidCorrectModal,
    submitVoidCorrect
  };
})();