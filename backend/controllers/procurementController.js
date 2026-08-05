const Requisition = require('../database/models/Requisition');
const PurchaseRequest = require('../database/models/PurchaseRequest');
const Supplier = require('../database/models/Supplier');
const StoreItem = require('../database/models/StoreItem');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

/* ── REQUISITIONS ── */

// GET /api/procurement/requisitions
exports.listRequisitions = asyncHandler(async (req, res) => {
  const { status, department, mode } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (mode) filter.mode = mode;

  const reqs = await Requisition.find(filter).sort({ dateRaised: -1 });
  res.json(reqs);
});

// GET /api/procurement/requisitions/:id
exports.getRequisition = asyncHandler(async (req, res) => {
  const reqDoc = await Requisition.findOne({ $or: [{ id: req.params.id }, { reqNo: req.params.id }] });
  if (!reqDoc) throw new ApiError(404, 'Requisition not found');
  res.json(reqDoc);
});

// POST /api/procurement/requisitions
exports.createRequisition = asyncHandler(async (req, res) => {
  const { no, mode, by, byName, dept, department, priority, items, needed, fulfillStore, supplier, remark, linked } = req.body;
  const requester = by || byName;
  const deptName = dept || department;
  const rawItems = items || [];

  if (!requester || !deptName || !rawItems.length) {
    throw new ApiError(400, 'Requester name, department, and at least one item are required');
  }

  let reqNo = no;
  if (!reqNo) {
    const count = await Requisition.countDocuments();
    reqNo = `REQ-${String(count + 1).padStart(4, '0')}`;
  }

  const now = new Date();
  const formattedItems = rawItems.map((i) => ({
    name: i.name,
    qty: Number(i.qty) || 0,
    unit: i.unit || 'Units',
    issuedQty: Number(i.issuedQty) || 0,
    fulfillStore: i.fulfillStore || fulfillStore || '',
    supplier: i.supplier || supplier || '',
    cost: Number(i.cost) || 0,
    remark: i.remark || '',
  }));

  const requisition = await Requisition.create({
    reqNo,
    mode: mode === 'purchase' ? 'purchase' : 'store_issue',
    byName: requester,
    department: deptName,
    needed: needed || '',
    priority: priority || 'Normal',
    fulfillStore: fulfillStore || '',
    supplier: supplier || '',
    linked: linked || '',
    remark: remark || '',
    items: formattedItems,
    status: 'Pending',
    dateRaised: now,
    dateDisplay: now.toISOString().split('T')[0],
  });

  res.status(201).json(requisition);
});

// PATCH /api/procurement/requisitions/:id/status
exports.updateRequisitionStatus = asyncHandler(async (req, res) => {
  const reqDoc = await Requisition.findOne({ $or: [{ id: req.params.id }, { reqNo: req.params.id }] });
  if (!reqDoc) throw new ApiError(404, 'Requisition not found');

  const { status, remark } = req.body;
  const allowed = ['Pending', 'Partial', 'Full', 'Rejected', 'Completed'];
  if (status && !allowed.includes(status)) throw new ApiError(400, 'Invalid requisition status');

  if (status) reqDoc.status = status;
  if (remark !== undefined) reqDoc.remark = remark;
  await reqDoc.save();
  res.json(reqDoc);
});

// PATCH /api/procurement/requisitions/:id/fulfill (Store issuing store_issue items)
exports.fulfillRequisition = asyncHandler(async (req, res) => {
  const reqDoc = await Requisition.findOne({ $or: [{ id: req.params.id }, { reqNo: req.params.id }] });
  if (!reqDoc) throw new ApiError(404, 'Requisition not found');

  const { issuedItems, remarks } = req.body; // Array of { name, qtyIssued }
  if (!Array.isArray(issuedItems)) throw new ApiError(400, 'issuedItems array is required');

  let allFull = true;
  let anyIssued = false;

  for (const issue of issuedItems) {
    const item = reqDoc.items.find((i) => i.name.toLowerCase() === String(issue.name).toLowerCase());
    if (item) {
      const addQty = Number(issue.qtyIssued) || 0;
      item.issuedQty = (item.issuedQty || 0) + addQty;
      if (addQty > 0) anyIssued = true;

      // Decrement StoreItem inventory if item exists in store
      const storeItem = await StoreItem.findOne({ name: new RegExp(`^${item.name.trim()}$`, 'i') });
      if (storeItem) {
        storeItem.stock = Math.max(0, storeItem.stock - addQty);
        await storeItem.save();
      }

      if (item.issuedQty < item.qty) {
        allFull = false;
      }
    }
  }

  if (allFull) reqDoc.status = 'Full';
  else if (anyIssued) reqDoc.status = 'Partial';
  if (remarks) reqDoc.remark = remarks;

  await reqDoc.save();
  res.json(reqDoc);
});

// POST /api/procurement/requisitions/:id/escalate (Escalate unfilled store_issue -> Purchase Request)
exports.escalateToProcurement = asyncHandler(async (req, res) => {
  const reqDoc = await Requisition.findOne({ $or: [{ id: req.params.id }, { reqNo: req.params.id }] });
  if (!reqDoc) throw new ApiError(404, 'Requisition not found');

  const unfulfilled = reqDoc.items.filter((i) => (i.issuedQty || 0) < i.qty);
  if (!unfulfilled.length) throw new ApiError(400, 'All items in this requisition have already been fulfilled');

  const createdPRs = [];
  for (const item of unfulfilled) {
    const remainingQty = item.qty - (item.issuedQty || 0);
    const prCount = await PurchaseRequest.countDocuments();
    const prNo = `PR-${String(prCount + 1).padStart(4, '0')}`;

    const pr = await PurchaseRequest.create({
      prNo,
      item: item.name,
      category: 'Store Escalation',
      department: reqDoc.department,
      requestedById: reqDoc.byName,
      qty: remainingQty,
      unit: item.unit || 'Units',
      unitCost: item.cost || 0,
      totalAmount: remainingQty * (item.cost || 0),
      priority: reqDoc.priority || 'Normal',
      notes: `Escalated from store requisition ${reqDoc.reqNo}`,
      approvalStage: 'pending',
      status: 'pending',
      supplier: item.supplier || reqDoc.supplier || '',
    });
    createdPRs.push(pr);
  }

  reqDoc.linked = createdPRs.map((p) => p.prNo).join(', ');
  reqDoc.remark = (reqDoc.remark || '') + ' [Escalated to Procurement]';
  await reqDoc.save();

  res.status(201).json({ requisition: reqDoc, purchaseRequests: createdPRs });
});

/* ── PURCHASE REQUESTS ── */

// GET /api/procurement/requests
exports.listPurchaseRequests = asyncHandler(async (req, res) => {
  const { approvalStage, department } = req.query;
  const filter = {};
  if (approvalStage) filter.approvalStage = approvalStage;
  if (department) filter.department = department;

  const prs = await PurchaseRequest.find(filter).sort({ createdAt: -1 });
  res.json(prs);
});

// POST /api/procurement/requests
exports.createPurchaseRequest = asyncHandler(async (req, res) => {
  const { item, category, department, requestedById, qty, unit, unitCost, priority, notes, supplier } = req.body;
  if (!item) throw new ApiError(400, 'item name is required');

  const count = await PurchaseRequest.countDocuments();
  const prNo = `PR-${String(count + 1).padStart(4, '0')}`;
  const q = Number(qty) || 1;
  const cost = Number(unitCost) || 0;

  const pr = await PurchaseRequest.create({
    prNo,
    item,
    category: category || 'General',
    department: department || 'General',
    requestedById: requestedById || '',
    qty: q,
    unit: unit || 'Units',
    unitCost: cost,
    totalAmount: q * cost,
    priority: priority || 'Normal',
    notes: notes || '',
    approvalStage: 'pending',
    status: 'pending',
    supplier: supplier || '',
  });

  res.status(201).json(pr);
});

// PATCH /api/procurement/requests/:id/approval
exports.updatePRApproval = asyncHandler(async (req, res) => {
  const pr = await PurchaseRequest.findOne({ $or: [{ id: req.params.id }, { prNo: req.params.id }] });
  if (!pr) throw new ApiError(404, 'Purchase request not found');

  const { approvalStage, status } = req.body;
  const allowed = ['pending', 'accountant', 'gm', 'md', 'approved', 'rejected', 'fulfilled'];
  if (approvalStage && !allowed.includes(approvalStage)) {
    throw new ApiError(400, 'Invalid approval stage');
  }

  if (approvalStage) pr.approvalStage = approvalStage;
  if (status) pr.status = status;
  await pr.save();
  res.json(pr);
});

/* ── SUPPLIERS ── */

// GET /api/procurement/suppliers
exports.listSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find().sort({ name: 1 });
  res.json(suppliers);
});

// POST /api/procurement/suppliers
exports.createSupplier = asyncHandler(async (req, res) => {
  const { name, category, contactName, phone, email, address, rating } = req.body;
  if (!name) throw new ApiError(400, 'supplier name is required');

  const supplier = await Supplier.create({
    name,
    category: category || '',
    contactName: contactName || '',
    phone: phone || '',
    email: email || '',
    address: address || '',
    rating: Number(rating) || 3,
    status: 'active',
  });

  res.status(201).json(supplier);
});
