const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Sale = require('../models/Sale');
const KitchenStock = require('../models/KitchenStock');
const Transfer = require('../models/Transfer');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all menu items where department='restaurant'
// @route   GET /api/restaurant/menu
exports.listMenu = asyncHandler(async (req, res) => {
  const items = await MenuItem.find({ department: 'restaurant' });
  res.json(items);
});

// @desc    Create a menu item
// @route   POST /api/restaurant/menu
exports.createMenu = asyncHandler(async (req, res) => {
  const item = await MenuItem.create(req.body);
  res.status(201).json(item);
});

// @desc    Update a menu item by id
// @route   PUT /api/restaurant/menu/:id
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
// @route   DELETE /api/restaurant/menu/:id
exports.deleteMenu = asyncHandler(async (req, res) => {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Menu item not found' });
  }
  res.json({ message: 'Menu item removed' });
});

// @desc    Get all tables
// @route   GET /api/restaurant/tables
exports.listTables = asyncHandler(async (req, res) => {
  const tables = await Table.find();
  res.json(tables);
});

// @desc    Update a table by id
// @route   PUT /api/restaurant/tables/:id
exports.updateTable = asyncHandler(async (req, res) => {
  const table = await Table.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  res.json(table);
});

// @desc    Get all sales where department='restaurant' with optional date filter
// @route   GET /api/restaurant/sales
exports.listSales = asyncHandler(async (req, res) => {
  const filter = { department: 'restaurant' };
  if (req.query.date) {
    const start = new Date(req.query.date);
    const end = new Date(req.query.date);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  }
  const sales = await Sale.find(filter).sort({ createdAt: -1 });
  res.json(sales);
});

// @desc    Create a sale
// @route   POST /api/restaurant/sales
exports.createSale = asyncHandler(async (req, res) => {
  const saleData = {
    ...req.body,
    id: 'SALE-' + Date.now(),
  };
  const sale = await Sale.create(saleData);
  res.status(201).json(sale);
});

// @desc    Void a sale by id
// @route   POST /api/restaurant/sales/:id/void
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

// @desc    Get all KitchenStock items (restaurant inventory)
// @route   GET /api/restaurant/inventory
exports.listInventory = asyncHandler(async (req, res) => {
  const inventory = await KitchenStock.find();
  res.json(inventory);
});

// @desc    Create a KitchenStock item
// @route   POST /api/restaurant/inventory
exports.createInventory = asyncHandler(async (req, res) => {
  const item = await KitchenStock.create(req.body);
  res.status(201).json(item);
});

// @desc    Update a KitchenStock item by id
// @route   PUT /api/restaurant/inventory/:id
exports.updateInventory = asyncHandler(async (req, res) => {
  const item = await KitchenStock.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) {
    return res.status(404).json({ message: 'Inventory item not found' });
  }
  res.json(item);
});

// @desc    Delete a KitchenStock item by id
// @route   DELETE /api/restaurant/inventory/:id
exports.deleteInventory = asyncHandler(async (req, res) => {
  const item = await KitchenStock.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Inventory item not found' });
  }
  res.json({ message: 'Inventory item removed' });
});

// @desc    Get all Transfers where to='Restaurant'
// @route   GET /api/restaurant/transfers
exports.listTransfers = asyncHandler(async (req, res) => {
  const transfers = await Transfer.find({ to: 'Restaurant' });
  res.json(transfers);
});
