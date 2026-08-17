const PurchaseRequest = require('../models/PurchaseRequest');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const GoodsReceipt = require('../models/GoodsReceipt');
const Config = require('../models/Config');
const asyncHandler = require('../middleware/asyncHandler');

exports.listPRs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const prs = await PurchaseRequest.find(filter).sort({ createdAt: -1 });
  res.json(prs);
});

exports.createPR = asyncHandler(async (req, res) => {
  const count = await PurchaseRequest.countDocuments();
  const qty = Number(req.body.qty) || 1;
  const unitCost = Number(req.body.unitCost) || 0;
  const pr = await PurchaseRequest.create({
    ...req.body,
    prNo: 'PR-' + String(100 + count + 1),
    totalAmount: qty * unitCost,
    qty,
    unitCost,
    approvalStage: 'pending',
    status: 'pending',
  });
  res.status(201).json(pr);
});

exports.approvePR = asyncHandler(async (req, res) => {
  const pr = await PurchaseRequest.findById(req.params.id);
  if (!pr) return res.status(404).json({ message: 'Purchase request not found' });

  const config = await Config.findOne() || {};
  const threshold = config.mdApprovalThreshold || 100000;

  const stages = pr.totalAmount > threshold
    ? ['pending', 'accountant', 'gm', 'md', 'approved']
    : ['pending', 'accountant', 'gm', 'approved'];

  const idx = stages.indexOf(pr.approvalStage);
  if (idx < 0 || idx >= stages.length - 1) {
    return res.status(400).json({ message: 'Cannot advance approval stage' });
  }

  const nextStage = stages[idx + 1];
  pr.approvalStage = nextStage;
  pr.status = nextStage;
  pr.history.push({
    date: new Date().toISOString(),
    action: 'approved',
    by: req.body.by || '',
    stage: nextStage,
  });

  await pr.save();
  res.json(pr);
});

exports.rejectPR = asyncHandler(async (req, res) => {
  const pr = await PurchaseRequest.findById(req.params.id);
  if (!pr) return res.status(404).json({ message: 'Purchase request not found' });

  pr.approvalStage = 'rejected';
  pr.status = 'rejected';
  pr.history.push({
    date: new Date().toISOString(),
    action: 'rejected',
    by: req.body.by || '',
    stage: 'rejected',
  });

  await pr.save();
  res.json(pr);
});

exports.listPOs = asyncHandler(async (req, res) => {
  const pos = await PurchaseOrder.find().sort({ createdAt: -1 });
  res.json(pos);
});

exports.createPO = asyncHandler(async (req, res) => {
  const count = await PurchaseOrder.countDocuments();
  const po = await PurchaseOrder.create({
    ...req.body,
    poNo: 'PO-' + String(1000 + count + 1),
  });
  res.status(201).json(po);
});

exports.updatePO = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!po) return res.status(404).json({ message: 'Purchase order not found' });
  res.json(po);
});

exports.listSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find().sort({ name: 1 });
  res.json(suppliers);
});

exports.createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(req.body);
  res.status(201).json(supplier);
});

exports.updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
  res.json(supplier);
});

exports.deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
  res.json({ ok: true });
});

exports.receiveGoods = asyncHandler(async (req, res) => {
  const receipt = await GoodsReceipt.create(req.body);
  res.status(201).json(receipt);
});
