const StoreItem = require('../database/models/StoreItem');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/store/items
exports.listItems = asyncHandler(async (req, res) => {
  const { category, lowStock, q } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (q) filter.name = new RegExp(q, 'i');
  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$stock', '$reorder'] };
  }
  const items = await StoreItem.find(filter).sort({ name: 1 });
  res.json(items);
});

// GET /api/store/items/:id
exports.getItem = asyncHandler(async (req, res) => {
  const item = await StoreItem.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Store item not found');
  res.json(item);
});

// POST /api/store/items
exports.createItem = asyncHandler(async (req, res) => {
  const { name, unit, stock, reorder, pricePerUnit, category, supplier } = req.body;
  if (!name) throw new ApiError(400, 'name is required');

  const exists = await StoreItem.findOne({ name: name.trim() });
  if (exists) throw new ApiError(409, `Store item "${name}" already exists`);

  const item = await StoreItem.create({
    name: name.trim(),
    unit: unit || 'units',
    stock: Number(stock) || 0,
    reorder: Number(reorder) || 0,
    pricePerUnit: Number(pricePerUnit) || 0,
    category: category || 'General',
    supplier: supplier || '',
  });

  res.status(201).json(item);
});

// PUT /api/store/items/:id
exports.updateItem = asyncHandler(async (req, res) => {
  const item = await StoreItem.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Store item not found');

  const { name, unit, stock, reorder, pricePerUnit, category, supplier } = req.body;
  if (name !== undefined) item.name = name;
  if (unit !== undefined) item.unit = unit;
  if (stock !== undefined) item.stock = Number(stock);
  if (reorder !== undefined) item.reorder = Number(reorder);
  if (pricePerUnit !== undefined) item.pricePerUnit = Number(pricePerUnit);
  if (category !== undefined) item.category = category;
  if (supplier !== undefined) item.supplier = supplier;

  await item.save();
  res.json(item);
});

// PATCH /api/store/items/:id/stock  { adjustment: +5 or -3, reason }
exports.adjustStock = asyncHandler(async (req, res) => {
  const item = await StoreItem.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Store item not found');

  const { adjustment } = req.body;
  if (adjustment === undefined || isNaN(adjustment)) {
    throw new ApiError(400, 'Numeric adjustment value is required');
  }

  const newStock = item.stock + Number(adjustment);
  if (newStock < 0) throw new ApiError(400, 'Insufficient stock');

  item.stock = newStock;
  await item.save();
  res.json(item);
});

// DELETE /api/store/items/:id
exports.deleteItem = asyncHandler(async (req, res) => {
  const item = await StoreItem.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Store item not found');
  await item.deleteOne();
  res.json({ ok: true });
});
