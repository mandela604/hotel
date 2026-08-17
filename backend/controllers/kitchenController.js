const KitchenStock = require('../models/KitchenStock');
const Production = require('../models/Production');
const Transfer = require('../models/Transfer');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

/* ── STOCK ── */

exports.listStock = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  const items = await KitchenStock.find(filter).sort({ name: 1 });
  res.json(items);
});

exports.createStock = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) throw new ApiError(400, 'name is required');
  const item = await KitchenStock.create(req.body);
  res.status(201).json(item);
});

exports.updateStock = asyncHandler(async (req, res) => {
  const item = await KitchenStock.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, 'Kitchen stock item not found');
  res.json(item);
});

exports.deleteStock = asyncHandler(async (req, res) => {
  const item = await KitchenStock.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Kitchen stock item not found');
  res.json({ ok: true });
});

/* ── PRODUCTION ── */

exports.listProduction = asyncHandler(async (req, res) => {
  const productions = await Production.find().sort({ date: -1 });
  res.json(productions);
});

exports.createProduction = asyncHandler(async (req, res) => {
  const { ingredients } = req.body;
  if (!ingredients || !ingredients.length) {
    throw new ApiError(400, 'At least one ingredient is required');
  }

  for (const ing of ingredients) {
    const stock = await KitchenStock.findOne({ name: ing.name });
    if (!stock) throw new ApiError(404, `Kitchen stock "${ing.name}" not found`);
    if (stock.qty < ing.qty) {
      throw new ApiError(400, `Insufficient stock for "${ing.name}" (available: ${stock.qty})`);
    }
  }

  for (const ing of ingredients) {
    await KitchenStock.findOneAndUpdate({ name: ing.name }, { $inc: { qty: -ing.qty } });
  }

  const production = await Production.create({
    ...req.body,
    productionNo: 'PROD-' + String(Date.now()).slice(-6),
    status: 'completed',
  });

  res.status(201).json(production);
});

exports.voidProduction = asyncHandler(async (req, res) => {
  const production = await Production.findById(req.params.id);
  if (!production) throw new ApiError(404, 'Production not found');
  if (production.status === 'voided') throw new ApiError(400, 'Production already voided');

  for (const ing of (production.ingredients || [])) {
    await KitchenStock.findOneAndUpdate({ name: ing.name }, { $inc: { qty: ing.qty } });
  }

  production.status = 'voided';
  production.voidReason = req.body.voidReason || '';
  production.voidDate = new Date();
  production.voidedBy = req.body.voidedBy || '';
  await production.save();

  res.json(production);
});

/* ── TRANSFERS ── */

exports.listTransfers = asyncHandler(async (req, res) => {
  const transfers = await Transfer.find().sort({ dateSent: -1 });
  res.json(transfers);
});

exports.createTransfer = asyncHandler(async (req, res) => {
  const transfer = await Transfer.create({
    ...req.body,
    transferNo: 'TRF-' + String(Date.now()).slice(-6),
    status: 'sent',
  });
  res.status(201).json(transfer);
});

exports.updateTransfer = asyncHandler(async (req, res) => {
  const transfer = await Transfer.findById(req.params.id);
  if (!transfer) throw new ApiError(404, 'Transfer not found');

  const { status } = req.body;
  const allowed = ['accepted', 'rejected', 'cancelled'];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);
  }

  if (status === 'accepted') {
    transfer.receivedBy = req.body.receivedBy || '';
    transfer.dateReceived = new Date();
  } else if (status === 'rejected') {
    transfer.rejectReason = req.body.rejectReason || '';
  } else if (status === 'cancelled') {
    transfer.cancelReason = req.body.cancelReason || '';
  }

  transfer.status = status;
  await transfer.save();
  res.json(transfer);
});
