const MenuItem = require('../models/MenuItem');
const Sale = require('../models/Sale');
const KitchenStock = require('../models/KitchenStock');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all menu items where department='poolbar'
// @route   GET /api/poolbar/menu
exports.listMenu = asyncHandler(async (req, res) => {
  const items = await MenuItem.find({ department: 'poolbar' });
  res.json(items);
});

// @desc    Create a menu item
// @route   POST /api/poolbar/menu
exports.createMenu = asyncHandler(async (req, res) => {
  const item = await MenuItem.create({ ...req.body, department: 'poolbar' });
  res.status(201).json(item);
});

// @desc    Update a menu item by id
// @route   PUT /api/poolbar/menu/:id
exports.updateMenu = asyncHandler(async (req, res) => {
  const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) {
    return res.status(404).json({ message: 'Menu item not found' });
  }
  res.json(item);
});

// @desc    Delete a menu item by id
// @route   DELETE /api/poolbar/menu/:id
exports.deleteMenu = asyncHandler(async (req, res) => {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Menu item not found' });
  }
  res.json({ message: 'Menu item removed' });
});

// @desc    Get all sales where department='poolbar'
// @route   GET /api/poolbar/sales
exports.listSales = asyncHandler(async (req, res) => {
  const sales = await Sale.find({ department: 'poolbar' }).sort({ createdAt: -1 });
  res.json(sales);
});

// @desc    Create a sale
// @route   POST /api/poolbar/sales
exports.createSale = asyncHandler(async (req, res) => {
  const saleData = {
    ...req.body,
    id: 'PBS-' + Date.now(),
    department: 'poolbar',
  };
  const sale = await Sale.create(saleData);
  res.status(201).json(sale);
});

// @desc    Void a sale by id
// @route   POST /api/poolbar/sales/:id/void
exports.voidSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ id: req.params.id });
  if (!sale) {
    return res.status(404).json({ message: 'Sale not found' });
  }
  sale.status = 'voided';
  sale.voidReason = req.body.voidReason;
  sale.voidedBy = req.body.voidedBy;
  sale.voidDate = req.body.voidDate || new Date();
  await sale.save();
  res.json(sale);
});

// @desc    Get all KitchenStock items (pool bar stock)
// @route   GET /api/poolbar/stock
exports.listStock = asyncHandler(async (req, res) => {
  const stock = await KitchenStock.find();
  res.json(stock);
});

// @desc    Create a KitchenStock item
// @route   POST /api/poolbar/stock
exports.createStock = asyncHandler(async (req, res) => {
  const item = await KitchenStock.create(req.body);
  res.status(201).json(item);
});

// @desc    Update a KitchenStock item by id
// @route   PUT /api/poolbar/stock/:id
exports.updateStock = asyncHandler(async (req, res) => {
  const item = await KitchenStock.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) {
    return res.status(404).json({ message: 'Stock item not found' });
  }
  res.json(item);
});

// @desc    Delete a KitchenStock item by id
// @route   DELETE /api/poolbar/stock/:id
exports.deleteStock = asyncHandler(async (req, res) => {
  const item = await KitchenStock.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Stock item not found' });
  }
  res.json({ message: 'Stock item removed' });
});
