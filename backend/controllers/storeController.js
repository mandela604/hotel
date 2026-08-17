const StoreItem = require('../models/StoreItem');
const Requisition = require('../models/Requisition');
const GoodsReceipt = require('../models/GoodsReceipt');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

/* ── STOCK ── */

exports.listStock = asyncHandler(async (req, res) => {
  const items = await StoreItem.find().sort({ name: 1 });
  res.json(items);
});

exports.createStock = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) throw new ApiError(400, 'name is required');

  const exists = await StoreItem.findOne({ name: name.trim() });
  if (exists) throw new ApiError(409, `Store item "${name}" already exists`);

  const item = await StoreItem.create({
    ...req.body,
    name: name.trim(),
  });
  res.status(201).json(item);
});

exports.updateStock = asyncHandler(async (req, res) => {
  const { name, category, unit, reorderLevel } = req.body;
  const item = await StoreItem.findByIdAndUpdate(
    req.params.id,
    { name, category, unit, reorderLevel },
    { new: true, runValidators: true }
  );
  if (!item) throw new ApiError(404, 'Store item not found');
  res.json(item);
});

exports.deleteStock = asyncHandler(async (req, res) => {
  const item = await StoreItem.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Store item not found');
  res.json({ ok: true });
});

/* ── REQUISITIONS ── */

const DEPT_PREFIX = {
  Kitchen: 'KREQ',
  Housekeeping: 'HREQ',
  Bar: 'BREQ',
  'Front Desk': 'FREQ',
  Maintenance: 'MREQ',
};

exports.listRequisitions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.dept) filter.dept = req.query.dept;
  const reqs = await Requisition.find(filter).sort({ createdAt: -1 });
  res.json(reqs);
});

exports.createRequisition = asyncHandler(async (req, res) => {
  const { dept } = req.body;
  if (!dept) throw new ApiError(400, 'dept is required');

  const prefix = DEPT_PREFIX[dept] || 'PR';
  const year = new Date().getFullYear();
  const count = await Requisition.countDocuments({ requisitionNo: new RegExp(`^${prefix}-${year}-`) });
  const seq = String(count + 1).padStart(5, '0');
  const requisitionNo = `${prefix}-${year}-${seq}`;

  const requisition = await Requisition.create({
    ...req.body,
    requisitionNo,
    status: 'Pending',
  });
  res.status(201).json(requisition);
});

exports.issueRequisition = asyncHandler(async (req, res) => {
  const requisition = await Requisition.findById(req.params.id);
  if (!requisition) throw new ApiError(404, 'Requisition not found');

  const { items } = req.body;
  if (!items || !items.length) {
    throw new ApiError(400, 'items array is required');
  }

  let allIssued = true;

  for (const incoming of items) {
    const reqItem = requisition.items.find((i) => i.name === incoming.name);
    if (!reqItem) throw new ApiError(400, `Item "${incoming.name}" not found in requisition`);

    const storeItem = await StoreItem.findOne({ name: incoming.name });
    if (!storeItem) throw new ApiError(404, `Store item "${incoming.name}" not found`);

    const qtyToIssue = Math.min(Number(incoming.issuedQty) || 0, reqItem.qty);
    if (qtyToIssue > storeItem.qty) {
      throw new ApiError(400, `Insufficient store stock for "${incoming.name}" (available: ${storeItem.qty})`);
    }

    storeItem.qty -= qtyToIssue;
    await storeItem.save();

    reqItem.issuedQty = qtyToIssue;
    if (qtyToIssue < reqItem.qty) allIssued = false;
  }

  requisition.status = allIssued ? 'Full' : 'Partial';
  await requisition.save();

  res.json(requisition);
});

exports.rejectRequisition = asyncHandler(async (req, res) => {
  const requisition = await Requisition.findById(req.params.id);
  if (!requisition) throw new ApiError(404, 'Requisition not found');

  requisition.status = 'Rejected';
  requisition.rejectReason = req.body.rejectReason || '';
  await requisition.save();

  res.json(requisition);
});

/* ── GOODS RECEIPT ── */

exports.receiveGoods = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!items || !items.length) {
    throw new ApiError(400, 'items array is required');
  }

  for (const incoming of items) {
    const storeItem = await StoreItem.findOne({ name: incoming.name });
    if (!storeItem) throw new ApiError(404, `Store item "${incoming.name}" not found`);

    const receivedQty = Number(incoming.qty) || 0;
    const receivedCost = Number(incoming.cost) || 0;
    const oldQty = storeItem.qty;
    const oldCost = storeItem.cost;

    const newQty = oldQty + receivedQty;
    storeItem.cost = newQty > 0
      ? ((oldQty * oldCost) + (receivedQty * receivedCost)) / newQty
      : receivedCost;
    storeItem.qty = newQty;
    await storeItem.save();
  }

  const receipt = await GoodsReceipt.create({
    ...req.body,
    dateReceived: new Date(),
  });
  res.status(201).json(receipt);
});
