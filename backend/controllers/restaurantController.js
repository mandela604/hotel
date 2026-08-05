/**
 * Grace Hotel — Restaurant Controller
 * Menu, Tables, Sales (POS ledger), Requisitions, and Inventory Transfers
 */

const MenuItem = require('../database/models/MenuItem');
const RestaurantTable = require('../database/models/RestaurantTable');
const Sale = require('../database/models/Sale');
const Requisition = require('../database/models/Requisition');
const StoreItem = require('../database/models/StoreItem');
const Transfer = require('../database/models/Transfer');

const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const { getPagination, buildMeta } = require('../utils/pagination');
const { nextReqNo } = require('../utils/idGen');

const DEPARTMENT = 'restaurant';

/* ═══════════════════════════════════════════
   MENU
═══════════════════════════════════════════ */

// GET /api/restaurant/menu?search=&category=&available=&page=&limit=
exports.listMenu = asyncHandler(async (req, res) => {
  const { search, category, available } = req.query;
  const filter = { department: { $in: [DEPARTMENT, 'both'] } };

  if (category) filter.category = category;
  if (available === 'true') filter.available = true;
  if (available === 'false') filter.available = false;
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

  const { page, limit, skip } = getPagination(req, { defaultLimit: 50 });
  const [items, total] = await Promise.all([
    MenuItem.find(filter).sort({ category: 1, name: 1 }).skip(skip).limit(limit),
    MenuItem.countDocuments(filter),
  ]);

  res.json({ items, meta: buildMeta({ page, limit, total }) });
});

// GET /api/restaurant/menu/:id
exports.getMenuItem = asyncHandler(async (req, res) => {
  const item = await MenuItem.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Menu item not found');
  res.json({ item });
});

// POST /api/restaurant/menu
exports.createMenuItem = asyncHandler(async (req, res) => {
  const { name, price, category, department, description, available } = req.body;
  if (!name || !category) throw new ApiError(400, 'name and category are required');
  if (price != null && Number(price) < 0) throw new ApiError(400, 'price cannot be negative');

  const item = await MenuItem.create({
    name,
    price: price != null ? Number(price) : 0,
    category,
    department: department && ['restaurant', 'poolbar', 'both'].includes(department) ? department : DEPARTMENT,
    description,
    available: available != null ? Boolean(available) : true,
  });

  res.status(201).json({ item });
});

// PUT /api/restaurant/menu/:id
exports.updateMenuItem = asyncHandler(async (req, res) => {
  const { name, price, category, department, description, available } = req.body;
  const item = await MenuItem.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Menu item not found');

  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (description !== undefined) item.description = description;
  if (department !== undefined) {
    if (!['restaurant', 'poolbar', 'both'].includes(department)) throw new ApiError(400, 'Invalid department');
    item.department = department;
  }
  if (price !== undefined) {
    if (Number(price) < 0) throw new ApiError(400, 'price cannot be negative');
    item.price = Number(price);
  }
  if (available !== undefined) item.available = Boolean(available);

  await item.save();
  res.json({ item });
});

// PATCH /api/restaurant/menu/:id/availability  { available: true|false }
exports.toggleAvailability = asyncHandler(async (req, res) => {
  const item = await MenuItem.findOne({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Menu item not found');
  item.available = req.body.available != null ? Boolean(req.body.available) : !item.available;
  await item.save();
  res.json({ item });
});

// DELETE /api/restaurant/menu/:id
exports.deleteMenuItem = asyncHandler(async (req, res) => {
  const item = await MenuItem.findOneAndDelete({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Menu item not found');
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   TABLES
═══════════════════════════════════════════ */

// GET /api/restaurant/tables
exports.listTables = asyncHandler(async (req, res) => {
  const tables = await RestaurantTable.find().sort({ tableNumber: 1 });
  res.json({ items: tables });
});

// POST /api/restaurant/tables
exports.createTable = asyncHandler(async (req, res) => {
  const { tableNumber, seats, section } = req.body;
  if (tableNumber == null) throw new ApiError(400, 'tableNumber is required');

  const exists = await RestaurantTable.findOne({ tableNumber });
  if (exists) throw new ApiError(409, `Table ${tableNumber} already exists`);

  const table = await RestaurantTable.create({ tableNumber, seats, section });
  res.status(201).json({ table });
});

// PATCH /api/restaurant/tables/:id/status  { status }
exports.updateTableStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['available', 'occupied', 'reserved', 'cleaning'];
  if (!allowed.includes(status)) throw new ApiError(400, `status must be one of: ${allowed.join(', ')}`);

  const table = await RestaurantTable.findOne({ id: req.params.id });
  if (!table) throw new ApiError(404, 'Table not found');

  table.status = status;
  await table.save();
  res.json({ table });
});

/* ═══════════════════════════════════════════
   SALES (POS ledger)
═══════════════════════════════════════════ */

// GET /api/restaurant/sales?status=&method=&search=&from=&to=&page=&limit=
exports.listSales = asyncHandler(async (req, res) => {
  const { status, method, search, from, to } = req.query;
  const filter = { department: DEPARTMENT };

  if (status) filter.status = status;
  if (method) filter.method = method;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (search) {
    filter.$or = [
      { guestName: { $regex: escapeRegex(search), $options: 'i' } },
      { notes: { $regex: escapeRegex(search), $options: 'i' } },
      { 'items.name': { $regex: escapeRegex(search), $options: 'i' } },
    ];
  }

  const { page, limit, skip } = getPagination(req);
  const [sales, total] = await Promise.all([
    Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Sale.countDocuments(filter),
  ]);

  res.json({ items: sales, meta: buildMeta({ page, limit, total }) });
});

// GET /api/restaurant/sales/:id
exports.getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ id: req.params.id, department: DEPARTMENT });
  if (!sale) throw new ApiError(404, 'Sale not found');
  res.json({ sale });
});

// POST /api/restaurant/sales
exports.createSale = asyncHandler(async (req, res) => {
  const { items, discount, method, tableNumber, guestName, notes } = req.body;

  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'items must be a non-empty array');
  const allowedMethods = ['Cash', 'Card', 'Room Charge', 'Transfer', 'POS'];
  if (method && !allowedMethods.includes(method)) throw new ApiError(400, `method must be one of: ${allowedMethods.join(', ')}`);

  const cleanItems = items.map((raw, idx) => {
    const name = raw && raw.name;
    const qty = Number(raw && raw.qty);
    const price = Number(raw && raw.price);
    if (!name) throw new ApiError(400, `items[${idx}].name is required`);
    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, `items[${idx}].qty must be a positive number`);
    if (!Number.isFinite(price) || price < 0) throw new ApiError(400, `items[${idx}].price must be a non-negative number`);
    return { name, qty, price, total: qty * price };
  });

  const subtotal = cleanItems.reduce((s, i) => s + i.total, 0);
  const discountAmt = Number(discount) > 0 ? Math.min(Number(discount), subtotal) : 0;
  const total = subtotal - discountAmt;

  const sale = await Sale.create({
    department: DEPARTMENT,
    items: cleanItems,
    subtotal,
    discount: discountAmt,
    total,
    method: method || 'Cash',
    staffId: req.user ? req.user.id : 'system',
    tableNumber: tableNumber != null ? Number(tableNumber) : undefined,
    guestName,
    notes,
    status: 'completed',
  });

  res.status(201).json({ sale });
});

// PATCH /api/restaurant/sales/:id/void  { reason }
exports.voidSale = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) throw new ApiError(400, 'A reason is required to void a sale');

  const sale = await Sale.findOne({ id: req.params.id, department: DEPARTMENT });
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (sale.status === 'voided') throw new ApiError(409, 'Sale is already voided');

  sale.status = 'voided';
  sale.voidReason = reason.trim();
  sale.voidedBy = req.user ? req.user.id : 'system';
  sale.voidedAt = new Date();
  await sale.save();

  res.json({ sale });
});

/* ═══════════════════════════════════════════
   REQUISITIONS — Restaurant → Store
═══════════════════════════════════════════ */

// GET /api/restaurant/requisitions
exports.listRequisitions = asyncHandler(async (req, res) => {
  const { status, priority, search } = req.query;
  const filter = { department: 'Restaurant' };

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (search) {
    filter.$or = [
      { reqNo: { $regex: escapeRegex(search), $options: 'i' } },
      { byName: { $regex: escapeRegex(search), $options: 'i' } },
      { 'items.name': { $regex: escapeRegex(search), $options: 'i' } },
    ];
  }

  const { page, limit, skip } = getPagination(req);
  const [items, total] = await Promise.all([
    Requisition.find(filter).sort({ dateRaised: -1 }).skip(skip).limit(limit),
    Requisition.countDocuments(filter),
  ]);

  res.json({ items, meta: buildMeta({ page, limit, total }) });
});

// GET /api/restaurant/requisitions/:id
exports.getRequisition = asyncHandler(async (req, res) => {
  const req_ = await Requisition.findOne({ id: req.params.id, department: 'Restaurant' });
  if (!req_) throw new ApiError(404, 'Requisition not found');
  res.json({ requisition: req_ });
});

// POST /api/restaurant/requisitions
exports.createRequisition = asyncHandler(async (req, res) => {
  const { needed, priority, fulfillStore, remark, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'items must be a non-empty array');
  const allowedPriority = ['Normal', 'Urgent', 'Emergency'];
  if (priority && !allowedPriority.includes(priority)) throw new ApiError(400, `priority must be one of: ${allowedPriority.join(', ')}`);

  const cleanItems = [];
  for (const [idx, raw] of items.entries()) {
    const name = raw && raw.name;
    const qty = Number(raw && raw.qty);
    if (!name) throw new ApiError(400, `items[${idx}].name is required`);
    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, `items[${idx}].qty must be a positive number`);

    const known = await StoreItem.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });

    cleanItems.push({
      name,
      qty,
      unit: (raw && raw.unit) || (known ? known.unit : 'Units'),
      fulfillStore: (raw && raw.fulfillStore) || fulfillStore,
      supplier: raw && raw.supplier,
    });
  }

  const reqNo = await nextReqNo();
  const now = new Date();

  const requisition = await Requisition.create({
    reqNo,
    mode: 'store_issue',
    byName: req.user ? req.user.name : 'Restaurant Staff',
    department: 'Restaurant',
    needed,
    priority: priority || 'Normal',
    fulfillStore,
    remark,
    items: cleanItems,
    status: 'Pending',
    dateRaised: now,
    dateDisplay: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  });

  res.status(201).json({ requisition });
});

/* ═══════════════════════════════════════════
   TRANSFERS — Kitchen → Restaurant / Pool Bar
═══════════════════════════════════════════ */

// GET /api/restaurant/transfers
exports.listTransfers = asyncHandler(async (req, res) => {
  const transfers = await Transfer.find({ toDept: { $in: ['Restaurant', 'restaurant'] } }).sort({ date: -1 });
  res.json(transfers);
});

// PATCH /api/restaurant/transfers/:no  (Accept or Reject Transfer)
exports.handleTransfer = asyncHandler(async (req, res) => {
  const transfer = await Transfer.findOne({ no: req.params.no });
  if (!transfer) throw new ApiError(404, 'Transfer record not found');

  const { status, receivedBy, remarks, reason } = req.body;
  if (!['accepted', 'rejected'].includes(status)) {
    throw new ApiError(400, "status must be 'accepted' or 'rejected'");
  }

  transfer.status = status;
  transfer.actionDate = new Date();

  if (status === 'accepted') {
    transfer.receivedBy = receivedBy || 'Restaurant Receiver';
    transfer.actionRemarks = remarks || '';

    // Automatically update Restaurant stock availability in MenuItem
    const menuItem = await MenuItem.findOne({ name: new RegExp(`^${transfer.meal.trim()}$`, 'i') });
    if (menuItem) {
      menuItem.available = true;
      await menuItem.save();
    }
  } else {
    transfer.receivedBy = '';
    transfer.actionRemarks = reason || remarks || 'Rejected by restaurant';
  }

  await transfer.save();
  res.json(transfer);
});

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}