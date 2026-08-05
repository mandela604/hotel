const KitchenInventory = require('../database/models/KitchenInventory');
const KitchenProduction = require('../database/models/KitchenProduction');
const KitchenTransfer = require('../database/models/KitchenTransfer');
const Transfer = require('../database/models/Transfer');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

/* ── INVENTORY ── */

// GET /api/kitchen/inventory
exports.listInventory = asyncHandler(async (req, res) => {
  const { q, lowStock } = req.query;
  const filter = {};
  if (q) filter.name = new RegExp(q, 'i');
  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$qty', '$reorder'] };
  }
  const items = await KitchenInventory.find(filter).sort({ name: 1 });
  res.json(items);
});

// POST /api/kitchen/inventory
exports.createInventoryItem = asyncHandler(async (req, res) => {
  const { name, unit, qty, reorder, costPerUnit, supplier } = req.body;
  if (!name) throw new ApiError(400, 'name is required');

  const exists = await KitchenInventory.findOne({ name: name.trim() });
  if (exists) throw new ApiError(409, `Inventory item "${name}" already exists`);

  const item = await KitchenInventory.create({
    name: name.trim(),
    unit: unit || 'kg',
    qty: Number(qty) || 0,
    reorder: Number(reorder) || 0,
    costPerUnit: Number(costPerUnit) || 0,
    supplier: supplier || '',
  });

  res.status(201).json(item);
});

// PUT /api/kitchen/inventory/:id
exports.updateInventoryItem = asyncHandler(async (req, res) => {
  const item = await KitchenInventory.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Inventory item not found');

  const { name, unit, qty, reorder, costPerUnit, supplier } = req.body;
  if (name !== undefined) item.name = name;
  if (unit !== undefined) item.unit = unit;
  if (qty !== undefined) item.qty = Number(qty);
  if (reorder !== undefined) item.reorder = Number(reorder);
  if (costPerUnit !== undefined) item.costPerUnit = Number(costPerUnit);
  if (supplier !== undefined) item.supplier = supplier;

  await item.save();
  res.json(item);
});

// DELETE /api/kitchen/inventory/:id
exports.deleteInventoryItem = asyncHandler(async (req, res) => {
  const item = await KitchenInventory.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Inventory item not found');
  await item.deleteOne();
  res.json({ ok: true });
});

/* ── PRODUCTION ── */

// GET /api/kitchen/production
exports.listProduction = asyncHandler(async (req, res) => {
  const productions = await KitchenProduction.find().sort({ date: -1 });
  res.json(productions);
});

// POST /api/kitchen/production
exports.createProduction = asyncHandler(async (req, res) => {
  const { items, qty, unit, department, chef, date, time, status } = req.body;
  const now = new Date();

  const prod = await KitchenProduction.create({
    items: items || [],
    qty: Number(qty) || 0,
    unit: unit || 'plates',
    department: department || 'Main Kitchen',
    chef: chef || '',
    date: date ? new Date(date) : now,
    time: time || now.toTimeString().split(' ')[0],
    status: status || 'planned',
  });

  res.status(201).json(prod);
});

// PATCH /api/kitchen/production/:id/status
exports.updateProductionStatus = asyncHandler(async (req, res) => {
  const prod = await KitchenProduction.findOne({ id: req.params.id });
  if (!prod) throw new ApiError(404, 'Production order not found');

  const { status } = req.body;
  if (!['planned', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  prod.status = status;
  await prod.save();
  res.json(prod);
});

/* ── TRANSFERS ── */

// GET /api/kitchen/transfers
exports.listTransfers = asyncHandler(async (req, res) => {
  const transfers = await Transfer.find({ fromDept: 'Kitchen' }).sort({ date: -1 });
  res.json(transfers);
});

// POST /api/kitchen/transfers
exports.createTransfer = asyncHandler(async (req, res) => {
  const { fromLocation, toLocation, meal, qty, unit, sender } = req.body;
  if (!meal || !qty) throw new ApiError(400, 'meal and qty are required for transfer');

  const count = await Transfer.countDocuments();
  const no = `KT-${String(count + 1040)}`;

  const transfer = await Transfer.create({
    no,
    fromDept: fromLocation || 'Kitchen',
    toDept: toLocation || 'Restaurant',
    meal,
    qty: Number(qty),
    unit: unit || 'plates',
    sender: sender || 'Head Chef',
    status: 'pending',
    date: new Date(),
  });

  res.status(201).json(transfer);
});
