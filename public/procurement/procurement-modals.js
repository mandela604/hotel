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

  function close() {
    if (overlay) overlay.style.display = 'none';
    if (modalContainer) modalContainer.style.display = 'none';
  }

  // PR Detail Modal
  function showPRDetail(pr) {
    if (!pr) return;
    
    const statusLabels = { pending:'Pending', accountant:'Accountant Review', gm:'GM Review', md:'MD Review', approved:'Approved', fulfilled:'Fulfilled', rejected:'Rejected' };
    const statusColors = { pending:'var(--amber)', accountant:'var(--blue)', gm:'var(--green)', md:'var(--purple)', approved:'var(--green)', fulfilled:'var(--purple)', rejected:'var(--red)' };
    
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

    init();
    
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
          <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Needs MD Approval</div><div style="font-size:13px;color:${pr.needsMDApproval ? 'var(--purple)' : 'var(--text)'};">${pr.needsMDApproval ? 'Yes (>₦100k)' : 'No'}</div></div>
        </div>

        ${pr.notes ? `<div style="padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:20px;font-size:12px;color:var(--text2);font-style:italic;">"${pr.notes}"</div>` : ''}

        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:700;color:var(--gold);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">Approval History</div>
          <div style="max-height:300px;overflow-y:auto;">${historyHtml}</div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          ${canApprove ? `<button onclick="approvePR('${pr.id}')" style="padding:8px 20px;background:var(--green);color:#0a1520;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">✓ Approve</button>` : ''}
          ${canReject ? `<button onclick="rejectPR('${pr.id}')" style="padding:8px 20px;background:var(--red);color:#fff;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">✕ Reject</button>` : ''}
          ${canCreatePO ? `<button onclick="createPO('${pr.id}')" style="padding:8px 20px;background:var(--purple);color:#fff;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">📋 Create PO</button>` : ''}
          <button onclick="ProcurementModals.close()" style="padding:8px 20px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
        </div>
      </div>
    `;
    
    overlay.style.display = 'flex';
    modalContainer.style.display = 'flex';
  }

  async function approvePR(id) {
    const note = prompt('Add approval note (optional):');
    if (note === null) return; // Cancelled
    
    try {
      await ProcurementAPI.approvePR(id, 'current', note || '');
      ProcurementModals.alert('Purchase request approved successfully!', 'Success');
      location.reload();
    } catch (error) {
      ProcurementModals.alert('Error approving request: ' + error.message, 'Error');
    }
  }

  async function rejectPR(id) {
    const note = prompt('Add rejection reason:');
    if (note === null) return; // Cancelled
    if (!note.trim()) {
      ProcurementModals.alert('Please provide a rejection reason.', 'Error');
      return;
    }
    
    try {
      await ProcurementAPI.rejectPR(id, 'current', note);
      ProcurementModals.alert('Purchase request rejected.', 'Rejected');
      location.reload();
    } catch (error) {
      ProcurementModals.alert('Error rejecting request: ' + error.message, 'Error');
    }
  }

  async function createPO(id) {
    const poNo = prompt('Enter PO Number:');
    if (poNo === null) return; // Cancelled
    if (!poNo.trim()) {
      ProcurementModals.alert('Please enter a PO number.', 'Error');
      return;
    }
    
    const supplier = prompt('Enter Supplier Name:');
    if (supplier === null) return;
    if (!supplier.trim()) {
      ProcurementModals.alert('Please enter a supplier name.', 'Error');
      return;
    }
    
    try {
      await ProcurementAPI.createPO(id, poNo.trim(), supplier.trim());
      ProcurementModals.alert(`Purchase Order ${poNo} created successfully!\n\nSupplier: ${supplier}\nStatus: Fulfilled`, 'Success');
      location.reload();
    } catch (error) {
      ProcurementModals.alert('Error creating PO: ' + error.message, 'Error');
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
    createPO
  };
})();