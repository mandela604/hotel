/**
 * Procurement API Layer - Matches Grace Hotel HMS Approval Flow
 * 
 * Approval Flow:
 * 1. Purchase Request (any department)
 * 2. Accountant Approval (all requests)
 * 3. GM Approval (all requests)
 * 4. Amount Check: if >₦100,000 → MD Approval required
 * 5. Create PO (after all approvals)
 * 
 * To switch to production, set USE_PROD = true and configure API_BASE
 */
const ProcurementAPI = (function() {
  const CONFIG = {
    USE_PROD: false,  // Set to true for production backend
    API_BASE: 'https://your-api-server.com/api',
    API_KEY: '',
    DEMO_MODE: true,
    MD_APPROVAL_THRESHOLD: 100000  // ₦100,000 threshold
  };

  // Storage keys
  const KEY_PR = 'hotel-procurement';
  const KEY_SUPPLIERS = 'hotel-suppliers';

  // Demo suppliers
  const DEMO_SUPPLIERS = [
    { id:'sp01', name:'Lagos Fresh Produce Ltd', cat:'Food & Beverage', contact:'Chidi Umeh', phone:'+234 803 555 1010', email:'sales@lagosfresh.ng', rating:5 },
    { id:'sp02', name:'PureLine Toiletries Co.', cat:'Toiletries & Amenities', contact:'Ada Nwankwo', phone:'+234 806 444 2020', email:'orders@pureline.ng', rating:4 },
    { id:'sp03', name:'SparkleClean Supplies', cat:'Cleaning Supplies', contact:'Tunde Bakare', phone:'+234 701 222 3030', email:'info@sparkleclean.ng', rating:4 },
    { id:'sp04', name:'Prestige Linen & Textiles', cat:'Linen & Uniforms', contact:'Funke Adeyinka', phone:'+234 802 666 4040', email:'sales@prestigelinen.ng', rating:5 },
    { id:'sp05', name:'TechPoint Electronics', cat:'IT & Electronics', contact:'Emeka Obasi', phone:'+234 809 333 5050', email:'b2b@techpoint.ng', rating:3 },
  ];

  // Demo PRs - matching the approval flow
  const DEMO_PR = [
    { 
      id:'pr01', prNo:'PR-041', item:'Toiletries (100 units)', cat:'Toiletries & Amenities', dept:'Housekeeping', by:'Kabiru Aliyu',
      date: daysAgo(1), needed: daysAhead(4), qty:100, unit:'Units', unitCost:480, priority:'Normal', 
      totalAmount: 48000,  // Below threshold
      status:'pending', supplier:'', poNo:'',
      notes:'Guest bathroom amenities running low across all floors.',
      approvalStage: 'pending',  // pending, accountant, gm, md, approved, rejected, fulfilled
      history:[ {date:daysAgo(1), action:'Request submitted', by:'Kabiru Aliyu', note:'', stage:'pending'} ] 
    },
    { 
      id:'pr02', prNo:'PR-039', item:'Wine Restocking (Assorted)', cat:'Food & Beverage', dept:'Restaurant / Bar', by:'Ngozi Eze',
      date: daysAgo(3), needed: daysAhead(2), qty:24, unit:'Bottles', unitCost:5000, priority:'Urgent',
      totalAmount: 120000,  // Above threshold - needs MD
      status:'accountant', supplier:'', poNo:'',
      notes:'Weekend event requires premium wine selection.',
      approvalStage: 'accountant',
      history:[ 
        {date:daysAgo(3), action:'Request submitted', by:'Ngozi Eze', note:'', stage:'pending'},
        {date:daysAgo(2), action:'Accountant review', by:'Accountant', note:'Budget available', stage:'accountant'}
      ] 
    },
    { 
      id:'pr03', prNo:'PR-038', item:'Cleaning Supplies (Bulk)', cat:'Cleaning Supplies', dept:'Housekeeping', by:'Kabiru Aliyu',
      date: daysAgo(5), needed: daysAgo(1), qty:1, unit:'Lot', unitCost:22000, priority:'Normal',
      totalAmount: 22000,  // Below threshold
      status:'gm', supplier:'', poNo:'',
      notes:'',
      approvalStage: 'gm',
      history:[ 
        {date:daysAgo(5), action:'Request submitted', by:'Kabiru Aliyu', note:'', stage:'pending'},
        {date:daysAgo(4), action:'Accountant approved', by:'Accountant', note:'', stage:'accountant'},
        {date:daysAgo(2), action:'GM review', by:'General Manager', note:'Checking operational justification', stage:'gm'}
      ] 
    },
    { 
      id:'pr04', prNo:'PR-037', item:'Guest Room Linen Set', cat:'Linen & Uniforms', dept:'Housekeeping', by:'Kabiru Aliyu',
      date: daysAgo(9), needed: daysAgo(3), qty:40, unit:'Sets', unitCost:24000, priority:'Normal',
      totalAmount: 960000,  // Above threshold - MD approved
      status:'approved', supplier:'Prestige Linen & Textiles', poNo:'PO-1014',
      notes:'',
      approvalStage: 'approved',
      history:[ 
        {date:daysAgo(9), action:'Request submitted', by:'Kabiru Aliyu', note:'', stage:'pending'},
        {date:daysAgo(8), action:'Accountant approved', by:'Accountant', note:'', stage:'accountant'},
        {date:daysAgo(6), action:'GM approved', by:'General Manager', note:'', stage:'gm'},
        {date:daysAgo(3), action:'MD approved', by:'Managing Director', note:'High value purchase', stage:'md'}
      ] 
    },
    { 
      id:'pr05', prNo:'PR-036', item:'POS Terminal Replacement', cat:'IT & Electronics', dept:'Front Desk', by:'Adewale Okafor',
      date: daysAgo(12), needed: daysAgo(5), qty:1, unit:'Unit', unitCost:95000, priority:'Urgent',
      totalAmount: 95000,  // Below threshold
      status:'rejected', supplier:'', poNo:'',
      notes:'Current terminal freezing intermittently.',
      approvalStage: 'rejected',
      history:[ 
        {date:daysAgo(12), action:'Request submitted', by:'Adewale Okafor', note:'', stage:'pending'},
        {date:daysAgo(10), action:'Rejected', by:'General Manager', note:'Repair quote came in cheaper — route through Maintenance instead', stage:'rejected'}
      ] 
    },
    { 
      id:'pr06', prNo:'PR-035', item:'Kitchen Gas Cylinders (Refill)', cat:'Maintenance & Equipment', dept:'Kitchen', by:'Chinedu Obi',
      date: daysAgo(2), needed: daysAhead(1), qty:6, unit:'Cylinders', unitCost:18000, priority:'Urgent',
      totalAmount: 108000,  // Above threshold
      status:'pending', supplier:'', poNo:'',
      notes:'Running low, needed before the weekend banquet.',
      approvalStage: 'pending',
      history:[ {date:daysAgo(2), action:'Request submitted', by:'Chinedu Obi', note:'', stage:'pending'} ] 
    },
    { 
      id:'pr07', prNo:'PR-034', item:'Pool Chemicals (Chlorine, pH)', cat:'Maintenance & Equipment', dept:'Pool Bar', by:'Bola Nwosu',
      date: daysAgo(15), needed: daysAgo(10), qty:1, unit:'Lot', unitCost:35000, priority:'Normal',
      totalAmount: 35000,  // Below threshold
      status:'fulfilled', supplier:'SparkleClean Supplies', poNo:'PO-1009',
      notes:'',
      approvalStage: 'fulfilled',
      history:[ 
        {date:daysAgo(15), action:'Request submitted', by:'Bola Nwosu', note:'', stage:'pending'},
        {date:daysAgo(13), action:'Accountant approved', by:'Accountant', note:'', stage:'accountant'},
        {date:daysAgo(10), action:'GM approved', by:'General Manager', note:'', stage:'gm'},
        {date:daysAgo(10), action:'Fulfilled', by:'Procurement Officer', note:'PO-1009 issued', stage:'fulfilled'}
      ] 
    },
    { 
      id:'pr08', prNo:'PR-033', item:'Office Stationery Restock', cat:'Office Supplies', dept:'Accounting', by:'Amaka Chukwu',
      date: daysAgo(6), needed: daysAgo(2), qty:1, unit:'Lot', unitCost:15000, priority:'Normal',
      totalAmount: 15000,  // Below threshold
      status:'accountant', supplier:'', poNo:'',
      notes:'',
      approvalStage: 'accountant',
      history:[ 
        {date:daysAgo(6), action:'Request submitted', by:'Amaka Chukwu', note:'', stage:'pending'},
        {date:daysAgo(4), action:'Accountant review', by:'Accountant', note:'', stage:'accountant'}
      ] 
    },
  ];

  // Helper functions
  function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; }
  function daysAhead(n){ return daysAgo(-n); }
  function fmtN(n){ return '₦' + Math.round(n||0).toLocaleString('en-NG'); }
  function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
  function todayISO(){ return new Date().toISOString().split('T')[0]; }

  // Initialize demo data
  function initDemoData() {
    if (!localStorage.getItem(KEY_PR)) {
      localStorage.setItem(KEY_PR, JSON.stringify(DEMO_PR));
    }
    if (!localStorage.getItem(KEY_SUPPLIERS)) {
      localStorage.setItem(KEY_SUPPLIERS, JSON.stringify(DEMO_SUPPLIERS));
    }
  }
  initDemoData();

  // ==================== API METHODS ====================

  async function getPRs() {
    if (CONFIG.USE_PROD) {
      const res = await fetch(`${CONFIG.API_BASE}/prs`, {
        headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}` }
      });
      return await res.json();
    } else {
      return JSON.parse(localStorage.getItem(KEY_PR) || '[]');
    }
  }

  async function getPR(id) {
    if (CONFIG.USE_PROD) {
      const res = await fetch(`${CONFIG.API_BASE}/prs/${id}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}` }
      });
      return await res.json();
    } else {
      const prs = JSON.parse(localStorage.getItem(KEY_PR) || '[]');
      return prs.find(p => p.id === id);
    }
  }

  async function createPR(data) {
    if (CONFIG.USE_PROD) {
      const res = await fetch(`${CONFIG.API_BASE}/prs`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return await res.json();
    } else {
      const prs = JSON.parse(localStorage.getItem(KEY_PR) || '[]');
      const totalAmount = data.qty * data.unitCost;
      const needsMDApproval = totalAmount > CONFIG.MD_APPROVAL_THRESHOLD;
      
      const newPR = {
        ...data,
        id: 'pr' + Date.now(),
        prNo: 'PR-' + String(Math.floor(Math.random()*900)+100),
        date: todayISO(),
        by: 'Current User',
        status: 'pending',
        totalAmount: totalAmount,
        needsMDApproval: needsMDApproval,
        approvalStage: 'pending',  // pending → accountant → gm → md (if needed) → approved
        supplier: '',
        poNo: '',
        history: [{ 
          date: todayISO(), 
          action: 'Request submitted', 
          by: 'Current User', 
          note: '',
          stage: 'pending'
        }]
      };
      prs.unshift(newPR);
      localStorage.setItem(KEY_PR, JSON.stringify(prs));
      return newPR;
    }
  }

  async function approvePR(id, role, note) {
    const pr = await getPR(id);
    if (!pr) throw new Error('PR not found');

    let nextStage = pr.approvalStage;
    let action = '';
    let approvedBy = '';
    
    // Approval flow: pending → accountant → gm → md (if >100k) → approved
    switch(pr.approvalStage) {
      case 'pending':
        nextStage = 'accountant';
        action = 'Accountant approved';
        approvedBy = 'Accountant';
        break;
      case 'accountant':
        nextStage = 'gm';
        action = 'GM approved';
        approvedBy = 'General Manager';
        break;
      case 'gm':
        // Check if MD approval is needed
        if (pr.totalAmount > CONFIG.MD_APPROVAL_THRESHOLD) {
          nextStage = 'md';
          action = 'Forwarded to MD';
          approvedBy = 'General Manager';
        } else {
          nextStage = 'approved';
          action = 'Fully approved';
          approvedBy = 'General Manager';
        }
        break;
      case 'md':
        nextStage = 'approved';
        action = 'MD approved';
        approvedBy = 'Managing Director';
        break;
    }

    const historyEntry = {
      date: todayISO(),
      action: action,
      by: approvedBy,
      note: note || '',
      stage: nextStage
    };

    const updates = {
      approvalStage: nextStage,
      status: nextStage === 'approved' ? 'approved' : nextStage,
      history: [...pr.history, historyEntry]
    };

    return await updatePR(id, updates);
  }

  async function rejectPR(id, role, note) {
    const pr = await getPR(id);
    if (!pr) throw new Error('PR not found');

    const historyEntry = {
      date: todayISO(),
      action: 'Rejected',
      by: role === 'gm' ? 'General Manager' : 'Managing Director',
      note: note || '',
      stage: 'rejected'
    };

    return await updatePR(id, {
      status: 'rejected',
      approvalStage: 'rejected',
      history: [...pr.history, historyEntry]
    });
  }

  async function createPO(prId, poNo, supplier) {
    const pr = await getPR(prId);
    if (!pr) throw new Error('PR not found');

    return await updatePR(prId, {
      status: 'fulfilled',
      approvalStage: 'fulfilled',
      poNo: poNo,
      supplier: supplier,
      history: [...pr.history, {
        date: todayISO(),
        action: 'PO Created',
        by: 'Procurement Officer',
        note: `PO ${poNo} issued to ${supplier}`,
        stage: 'fulfilled'
      }]
    });
  }

  async function updatePR(id, updates) {
    if (CONFIG.USE_PROD) {
      const res = await fetch(`${CONFIG.API_BASE}/prs/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      return await res.json();
    } else {
      const prs = JSON.parse(localStorage.getItem(KEY_PR) || '[]');
      const idx = prs.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('PR not found');
      
      prs[idx] = { ...prs[idx], ...updates };
      localStorage.setItem(KEY_PR, JSON.stringify(prs));
      return prs[idx];
    }
  }

  async function getSuppliers() {
    if (CONFIG.USE_PROD) {
      const res = await fetch(`${CONFIG.API_BASE}/suppliers`, {
        headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}` }
      });
      return await res.json();
    } else {
      return JSON.parse(localStorage.getItem(KEY_SUPPLIERS) || '[]');
    }
  }

  // Public API
  return {
    CONFIG,
    getPRs,
    getPR,
    createPR,
    updatePR,
    approvePR,
    rejectPR,
    createPO,
    getSuppliers,
    // Demo data access
    DEMO_PR,
    DEMO_SUPPLIERS
  };
})();