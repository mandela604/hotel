const { v4: uuidv4 } = require('uuid');
const PoolbarStock   = require('../models/PoolbarStock');
const Sale           = require('../models/Sale');
const Order           = require('../models/Order');
const PoolbarMovement = require('../models/PoolbarMovement');
const Requisition    = require('../models/Requisition');
const Booking        = require('../models/Booking');
const Category       = require('../models/Category');
const asyncHandler   = require('../middleware/asyncHandler');
const { ApiError }   = require('../middleware/errorHandler');

/* ── helpers ────────────────────────────────── */

/**
 * Recomputes a booking's payStatus from its payments array + paid field,
 * matching the same logic in bookingController.js. Called after any
 * room-charge write so the booking record stays consistent.
 */
function recomputePayStatus(booking) {
  const total = ((booking.rate || 0) - (booking.discount || 0)) *
    (Math.max(1, (new Date(booking.checkout) - new Date(booking.checkin)) / 86400000) || 1);
  const paid = Array.isArray(booking.payments) && booking.payments.length
    ? booking.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    : (Number(booking.paid) || 0);
  if (paid <= 0) booking.payStatus = 'Pending';
  else if (paid >= total) booking.payStatus = 'Fully Paid';
  else booking.payStatus = 'Deposit Paid';
}

function sanitizeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function todayDDMMYY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

function stockLevel(i) {
  return i.qty <= 0 ? 'out' : (i.qty <= i.min ? 'low' : 'ok');
}

async function nextId(prefix, Model) {
  const count = await Model.countDocuments();
  return `${prefix}-${String(count + 1001).padStart(6, '0')}`;
}

async function logMovement(item, qtyIn, qtyOut, balance, reason) {
  return PoolbarMovement.create({ item, qtyIn, qtyOut, balance, reason });
}

/**
 * Validates that every sold item with a matching stock record has enough
 * on hand. Throws (never partially deducts) if anything is short. Items
 * with no matching stock record (e.g. a misc/service line) are skipped.
 * Returns the resolved { stockItem, qty } pairs so the caller can deduct
 * them in a second pass, after validation has fully passed.
 */
async function resolveStockForItems(items) {
  const resolved = [];
  for (const it of items) {
    const q = Number(it.qty);
    const stockItem = await PoolbarStock.findOne({ name: new RegExp(`^${sanitizeRegex(it.name.trim())}$`, 'i') });
    if (!stockItem) continue;
    if (stockItem.qty < q) {
      const err = new Error(`Not enough ${stockItem.name} on hand. Have ${stockItem.qty}, need ${q}`);
      err.statusCode = 400;
      throw err;
    }
    resolved.push({ stockItem, qty: q });
  }
  return resolved;
}

async function deductResolvedStock(resolved, reason) {
  for (const r of resolved) {
    r.stockItem.qty -= r.qty;
    await r.stockItem.save();
    await logMovement(r.stockItem.name, 0, r.qty, r.stockItem.qty, reason);
  }
}

/* ═══════════════════════════════════════════════
   1. STOCK CRUD
   ═══════════════════════════════════════════════ */

exports.listStock = asyncHandler(async (req, res) => {
  const { search, category, level } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (search) {
    const safe = sanitizeRegex(search);
    filter.$or = [
      { name: new RegExp(safe, 'i') },
      { batch: new RegExp(safe, 'i') },
    ];
  }

  let list = await PoolbarStock.find(filter).sort({ name: 1 });
  if (level) list = list.filter(i => stockLevel(i) === level);

  res.json({ success: true, count: list.length, data: list });
});

exports.addStock = asyncHandler(async (req, res) => {
  const { name, category, cat, unit, qty, min, price, cost, batch, received, desc } = req.body;

  const existing = await PoolbarStock.findOne({ name: new RegExp(`^${sanitizeRegex(name.trim())}$`, 'i') });
  if (existing) {
    return res.status(409).json({ success: false, error: `"${name}" is already tracked in Pool Bar inventory` });
  }

  const item = await PoolbarStock.create({
    id: uuidv4(),
    name: name.trim(),
    category: category || cat || 'Beverages',
    cat: cat || category || 'Beverages',
    unit: unit || 'bottle',
    qty: Number(qty) || 0,
    min: Number(min) || 10,
    price: Number(price != null ? price : cost) || 0,
    cost: Number(cost != null ? cost : price) || 0,
    batch: batch || '—',
    received: received || todayDDMMYY(),
    desc: desc || '',
  });

  res.status(201).json({ success: true, data: item });
});

exports.updateStock = asyncHandler(async (req, res) => {
  const item = await PoolbarStock.findOne({ id: req.params.id });
  if (!item) return res.status(404).json({ success: false, error: 'Stock item not found' });

  const { name, category, cat, unit, min, price, cost, desc, qty, batch } = req.body;
  if (name) item.name = name.trim();
  if (category || cat) {
    item.category = category || cat;
    item.cat = cat || category;
  }
  if (unit) item.unit = unit;
  if (min !== undefined) item.min = Number(min);
  if (price !== undefined || cost !== undefined) {
    const val = Number(price != null ? price : cost);
    item.price = val;
    item.cost = val;
  }
  if (desc !== undefined) item.desc = desc;
  if (qty !== undefined) item.qty = Number(qty);
  if (batch !== undefined) item.batch = batch;

  await item.save();
  res.json({ success: true, data: item });
});

exports.deleteStock = asyncHandler(async (req, res) => {
  const item = await PoolbarStock.findOneAndDelete({ id: req.params.id });
  if (!item) return res.status(404).json({ success: false, error: 'Stock item not found' });
  res.json({ success: true, message: `Pool Bar item "${item.name}" deleted` });
});

exports.deductStock = asyncHandler(async (req, res) => {
  const { name, qty, reason, notes } = req.body;

  const item = await PoolbarStock.findOne({ name: new RegExp(`^${sanitizeRegex(name.trim())}$`, 'i') });
  if (!item) return res.status(404).json({ success: false, error: `"${name}" not found in Pool Bar stock` });
  if (item.qty < Number(qty)) {
    return res.status(400).json({ success: false, error: `Cannot deduct ${qty} ${item.unit}. Only ${item.qty} on hand.` });
  }

  item.qty -= Number(qty);
  await item.save();

  const fullReason = notes ? `${reason || 'Manual deduction'} — ${notes}` : (reason || 'Manual deduction');
  await logMovement(item.name, 0, Number(qty), item.qty, fullReason);

  res.json({ success: true, data: item });
});

/**
 * Deduct stock by the item's :id param (as opposed to /stock/deduct,
 * which looks the item up by name). Added so routes/poolbarRoutes.js's
 * `POST /stock/:id/deduct` (paired with validateDeductById) actually has
 * a handler to call — it referenced ctrl.deductStockById before this
 * existed.
 */
exports.deductStockById = asyncHandler(async (req, res) => {
  const { qty, reason, notes } = req.body;

  const item = await PoolbarStock.findOne({ id: req.params.id });
  if (!item) return res.status(404).json({ success: false, error: 'Stock item not found' });
  if (item.qty < Number(qty)) {
    return res.status(400).json({ success: false, error: `Cannot deduct ${qty} ${item.unit}. Only ${item.qty} on hand.` });
  }

  item.qty -= Number(qty);
  await item.save();

  const fullReason = notes ? `${reason || 'Manual deduction'} — ${notes}` : (reason || 'Manual deduction');
  await logMovement(item.name, 0, Number(qty), item.qty, fullReason);

  res.json({ success: true, data: item });
});

/* ═══════════════════════════════════════════════
   2. SALES
   ═══════════════════════════════════════════════ */

exports.listSales = asyncHandler(async (req, res) => {
  const { status, method, from, to } = req.query;
  const filter = { department: 'poolbar' };
  if (status) filter.status = status;
  if (method) filter.method = method;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to + 'T23:59:59.999Z');
  }

  const sales = await Sale.find(filter).sort({ date: -1 });
  res.json({ success: true, count: sales.length, data: sales });
});

exports.createSale = asyncHandler(async (req, res) => {
  const { items, discount, method, staff, table, notes, roomNumber, guestName, guestPhone } = req.body;

  // Validate stock is sufficient BEFORE any writes — the whole sale is
  // rejected (nothing partially deducts) if anything is short.
  const resolved = await resolveStockForItems(items);

  const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const total = subtotal * (1 - (Number(discount) || 0) / 100);
  const saleId = await nextId('PBS', Sale);

  await deductResolvedStock(resolved, `Sale (${saleId})`);

  /* Room Charge → attach to active booking folio */
  const effectiveMethod = (roomNumber && method === 'Room Charge') ? 'Room Charge' : (method || 'Cash');
  if (effectiveMethod === 'Room Charge' && roomNumber) {
    const booking = await Booking.findOne({ room: String(roomNumber).trim(), status: 'checkedin' });
    if (booking) {
      booking.payments.push({
        id: uuidv4(),
        amount: total,
        mode: 'Room Charge (Pool Bar)',
        date: todayDDMMYY(),
        by: staff || (req.user ? req.user.name : 'Barman'),
        ts: Date.now(),
      });
      booking.paid = (booking.paid || 0) + total;
      recomputePayStatus(booking);
      await booking.save();
    }
  }

  const sale = await Sale.create({
    id: saleId,
    source: 'Poolbar',
    department: 'poolbar',
    items: items.map(it => ({ name: it.name.trim(), qty: Number(it.qty), price: Number(it.price) })),
    subtotal,
    discount: Number(discount) || 0,
    total,
    method: effectiveMethod,
    staff: staff || (req.user ? req.user.name : ''),
    table: table || '',
    notes: notes || '',
    date: new Date(),
    status: 'completed',
    roomNumber: roomNumber || null,
    guestName: guestName || null,
    guestPhone: guestPhone || null,
  });

  res.status(201).json({ success: true, data: sale });
});

exports.voidSale = asyncHandler(async (req, res) => {
  // Looked up by the app-level `id` (e.g. "PBS-001042"), never Mongo's
  // `_id` — the frontend only ever knows this id.
  const sale = await Sale.findOne({ id: req.params.id, department: 'poolbar' });
  if (!sale) return res.status(404).json({ success: false, error: 'Sale record not found' });
  if (sale.status === 'voided') return res.status(400).json({ success: false, error: 'Sale is already voided' });

  /* restore stock + log movements */
  for (const it of (sale.items || [])) {
    const stockItem = await PoolbarStock.findOne({ name: new RegExp(`^${sanitizeRegex(it.name.trim())}$`, 'i') });
    if (stockItem) {
      stockItem.qty += Number(it.qty) || 0;
      await stockItem.save();
      await logMovement(stockItem.name, Number(it.qty) || 0, 0, stockItem.qty, `Voided Sale (${sale.id})`);
    }
  }

  sale.status = 'voided';
  sale.voidReason = req.body.reason || 'Voided by manager';
  sale.voidedBy = req.user ? req.user.name : '';
  sale.voidDate = new Date();
  await sale.save();

  res.json({ success: true, data: sale });
});

/* ═══════════════════════════════════════════════
   3. ORDERS / TABS
   ═══════════════════════════════════════════════ */

exports.listOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { department: 'poolbar' };
  if (status) filter.status = status;

  const orders = await Order.find(filter).sort({ date: -1 });
  res.json({ success: true, count: orders.length, data: orders });
});

exports.openTab = asyncHandler(async (req, res) => {
  const { items, discount, staff, table, notes, roomNumber, guestName, guestPhone } = req.body;

  const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const total = subtotal * (1 - (Number(discount) || 0) / 100);
  const orderId = await nextId('PB', Order);

  const order = await Order.create({
    id: orderId,
    department: 'poolbar',
    items: items.map(it => ({ name: it.name.trim(), qty: Number(it.qty), price: Number(it.price) })),
    subtotal,
    discount: Number(discount) || 0,
    total,
    staff: staff || (req.user ? req.user.name : ''),
    table: table || '',
    notes: notes || '',
    date: new Date(),
    status: 'open',
    source: 'tab',
    roomNumber: roomNumber || null,
    guestName: guestName || null,
    guestPhone: guestPhone || null,
  });

  res.status(201).json({ success: true, data: order });
});

/**
 * Lets an OPEN tab's items/notes/table/discount be edited before it's
 * paid or cancelled — restored from Version A, since Version B had no
 * equivalent and tabs need to be correctable before checkout.
 */
exports.updateOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status !== 'open') {
    return res.status(400).json({ success: false, error: 'Only an open order can be edited' });
  }

  const { items, notes, table, discount } = req.body;
  if (items !== undefined) {
    order.items = items.map(it => ({ name: it.name.trim(), qty: Number(it.qty), price: Number(it.price) }));
    order.subtotal = order.items.reduce((s, i) => s + i.qty * i.price, 0);
  }
  if (discount !== undefined) order.discount = Number(discount);
  order.total = order.subtotal * (1 - (Number(order.discount) || 0) / 100);

  if (notes !== undefined) order.notes = notes;
  if (table !== undefined) order.table = table;

  await order.save();
  res.json({ success: true, data: order });
});

exports.markServed = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status !== 'open') {
    return res.status(400).json({ success: false, error: `Cannot mark "${order.status}" order as served` });
  }

  order.status = 'served';
  await order.save();
  res.json({ success: true, data: order });
});

exports.payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status === 'paid') return res.status(400).json({ success: false, error: 'Order is already paid' });
  if (order.status === 'cancelled') return res.status(400).json({ success: false, error: 'Cannot pay a cancelled order' });

  const { method, roomNumber, guestName, guestPhone } = req.body;
  const payMethod = method || 'Cash';
  const effectiveRoom = roomNumber || order.roomNumber || null;
  const effectiveGuest = guestName || order.guestName || null;
  const effectivePhone = guestPhone || order.guestPhone || null;

  // Validate stock is sufficient BEFORE any writes.
  const resolved = await resolveStockForItems(order.items);

  const saleId = await nextId('PBS', Sale);
  await deductResolvedStock(resolved, `Tab Payment (${order.id})`);

  /* Room Charge → attach to active booking folio */
  const effectiveMethod = (effectiveRoom && payMethod === 'Room Charge') ? 'Room Charge' : payMethod;
  if (effectiveMethod === 'Room Charge' && effectiveRoom) {
    const booking = await Booking.findOne({ room: String(effectiveRoom).trim(), status: 'checkedin' });
    if (booking) {
      booking.payments.push({
        id: uuidv4(),
        amount: order.total,
        mode: 'Room Charge (Pool Bar)',
        date: todayDDMMYY(),
        by: order.staff || (req.user ? req.user.name : 'Barman'),
        ts: Date.now(),
      });
      booking.paid = (booking.paid || 0) + order.total;
      recomputePayStatus(booking);
      await booking.save();
    }
  }

  /* create linked sale */
  const sale = await Sale.create({
    id: saleId,
    source: 'Poolbar',
    department: 'poolbar',
    items: order.items.map(it => ({ name: it.name, qty: Number(it.qty), price: Number(it.price) })),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    method: effectiveMethod,
    staff: order.staff,
    table: order.table,
    notes: order.notes,
    date: new Date(),
    status: 'completed',
    roomNumber: effectiveRoom,
    guestName: effectiveGuest,
    guestPhone: effectivePhone,
  });

  /* update order */
  order.status = 'paid';
  order.payMethod = effectiveMethod;
  order.paidSaleId = saleId;
  if (effectiveRoom) order.roomNumber = effectiveRoom;
  if (effectiveGuest) order.guestName = effectiveGuest;
  if (effectivePhone) order.guestPhone = effectivePhone;
  await order.save();

  res.json({ success: true, data: { order, sale } });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status === 'paid') {
    return res.status(400).json({ success: false, error: 'Cannot cancel a paid order' });
  }
  if (order.status === 'cancelled') {
    return res.status(400).json({ success: false, error: 'Order is already cancelled' });
  }

  const { reason } = req.body;
  order.status = 'cancelled';
  order.notes = reason ? `${order.notes ? order.notes + ' — ' : ''}Cancelled: ${reason}` : order.notes;
  await order.save();

  res.json({ success: true, data: order });
});

/* ═══════════════════════════════════════════════
   4. REQUISITIONS
   ═══════════════════════════════════════════════ */

exports.listRequisitions = asyncHandler(async (req, res) => {
  const list = await Requisition.find({ dept: /pool/i }).sort({ createdAt: -1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.createRequisition = asyncHandler(async (req, res) => {
  const { requester, dept, priority, remark, neededBy, items } = req.body;

  const count = await Requisition.countDocuments();
  const requisitionNo = `REQ-${String(count + 1).padStart(5, '0')}`;

  const reqDoc = await Requisition.create({
    id: uuidv4(),
    requisitionNo,
    mode: 'store_issue',
    requester: requester || (req.user ? req.user.name : 'Pool Bar Supervisor'),
    dept: dept || 'Pool Bar',
    priority: priority || 'Normal',
    remark: remark || '',
    neededBy: neededBy || '',
    items: items.map(i => ({
      name: i.name,
      unit: i.unit || 'bottles',
      qty: Number(i.qty) || 0,
      cost: Number(i.cost) || 0,
      remark: i.remark || '',
      issuedQty: 0,
    })),
    status: 'Pending',
  });

  res.status(201).json({ success: true, data: reqDoc });
});

exports.receiveRequisition = asyncHandler(async (req, res) => {
  const reqDoc = await Requisition.findOne({ id: req.params.id });
  if (!reqDoc) return res.status(404).json({ success: false, error: 'Requisition not found' });

  /* credit issued items to stock + log movements */
  for (const it of (reqDoc.items || [])) {
    const addQty = Number(it.issuedQty || it.qty) || 0;
    if (addQty <= 0) continue;

    let stockItem = await PoolbarStock.findOne({ name: new RegExp(`^${sanitizeRegex(it.name.trim())}$`, 'i') });
    if (stockItem) {
      stockItem.qty += addQty;
      await stockItem.save();
    } else {
      stockItem = await PoolbarStock.create({
        id: uuidv4(),
        name: it.name.trim(),
        category: 'Beverages',
        unit: it.unit || 'bottle',
        qty: addQty,
        min: 10,
        price: Number(it.cost) || 0,
        cost: Number(it.cost) || 0,
      });
    }
    await logMovement(stockItem.name, addQty, 0, stockItem.qty, `Requisition Received (${reqDoc.requisitionNo})`);
  }

  reqDoc.status = 'Full';
  await reqDoc.save();

  res.json({ success: true, data: reqDoc });
});

/* ═══════════════════════════════════════════════
   5. MOVEMENTS
   ═══════════════════════════════════════════════ */

exports.listMovements = asyncHandler(async (req, res) => {
  const { item, from, to } = req.query;
  const filter = {};
  if (item) filter.item = new RegExp(sanitizeRegex(item), 'i');
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to + 'T23:59:59.999Z');
  }

  const list = await PoolbarMovement.find(filter).sort({ date: -1 });
  res.json({ success: true, count: list.length, data: list });
});

/* ═══════════════════════════════════════════════
   6. DASHBOARD
   ═══════════════════════════════════════════════ */

exports.getDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [stockList, salesToday, pendingReqs, activeOrders] = await Promise.all([
    PoolbarStock.find(),
    Sale.find({ department: 'poolbar', status: 'completed', date: { $gte: today } }),
    Requisition.countDocuments({ dept: /pool/i, status: 'Pending' }),
    Order.countDocuments({ department: 'poolbar', status: { $in: ['open', 'served'] } }),
  ]);

  const salesCount = salesToday.length;
  const totalRevenue = salesToday.reduce((sum, s) => sum + (s.total || 0), 0);
  const lowStockCount = stockList.filter(i => stockLevel(i) === 'low').length;
  const outOfStockCount = stockList.filter(i => stockLevel(i) === 'out').length;
  const unitsOnHand = stockList.reduce((sum, i) => sum + i.qty, 0);

  res.json({
    success: true,
    data: {
      salesTodayCount: salesCount,
      totalRevenueToday: totalRevenue,
      lowStockCount,
      outOfStockCount,
      totalStockItems: stockList.length,
      unitsOnHand,
      pendingRequisitions: pendingReqs,
      activeOrders,
    },
  });
});

/* ── Categories (persisted in the shared Category collection) ── */

exports.listCategories = asyncHandler(async (req, res) => {
  const derived = await PoolbarStock.distinct('category');
  const saved = await Category.find({ module: 'poolbar' }).lean();
  const set = new Set(derived.filter(Boolean));
  saved.forEach(c => set.add(c.name));
  res.json({ success: true, data: Array.from(set).sort((a, b) => a.localeCompare(b)) });
});

exports.addCategory = asyncHandler(async (req, res) => {
  const name = req.body.name.trim();
  const existing = await Category.findOne({ module: 'poolbar', name });
  if (existing) throw new ApiError(409, `Category "${name}" already exists.`);
  await Category.create({ module: 'poolbar', name });
  res.status(201).json({ success: true, data: { name } });
});

exports.renameCategory = asyncHandler(async (req, res) => {
  const oldName = req.params.name;
  const newName = req.body.name.trim();
  await PoolbarStock.updateMany({ category: oldName }, { $set: { category: newName, cat: newName } });
  await Category.updateMany({ module: 'poolbar', name: oldName }, { $set: { name: newName } });
  res.json({ success: true, data: { name: newName } });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const name = req.params.name;
  const reassignTo = (req.body && req.body.reassignTo) || 'Uncategorized';
  if (name === reassignTo) throw new ApiError(400, `Cannot delete "${name}" — it is the fallback category.`);
  await PoolbarStock.updateMany({ category: name }, { $set: { category: reassignTo, cat: reassignTo } });
  await Category.deleteMany({ module: 'poolbar', name });
  res.json({ success: true, data: { reassignedTo: reassignTo } });
});