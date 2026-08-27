const { v4: uuidv4 } = require('uuid');
const MenuItem = require('../models/MenuItem');
const RestaurantStock = require('../models/RestaurantStock'); // NOTE: model not yet supplied — created, see models/RestaurantStock.js
const RestaurantMovement = require('../models/RestaurantMovement'); // NOTE: model not yet supplied — created, see models/RestaurantMovement.js
const Sale = require('../models/Sale');
const Order = require('../models/Order');
const Transfer = require('../models/Transfer');
const Requisition = require('../models/Requisition');
const Guest = require('../models/Guest');
const Activity = require('../models/Activity');
const Category = require('../models/Category');
const asyncHandler = require('../middleware/asyncHandler');

const DEPT = 'restaurant';
const DESTINATION = 'Main Restaurant / POS';

function todayDDMMYY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}
function nowStamp() {
  const d = new Date();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${todayDDMMYY()} ${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}
async function logActivity(color, text, href) {
  try {
    await Activity.create({ dept: 'Restaurant', color, text, time: nowStamp(), href: href || '#' });
  } catch (e) { /* activity log is best-effort, never block the request on it */ }
}

/* ═══════════════════════════════════════════════
   Menu — exact REST parity with restaurant-menu.html's
   apiFetch calls: GET/POST /menu, PUT/PATCH/DELETE /menu/:id
═══════════════════════════════════════════════ */
exports.listMenu = asyncHandler(async (req, res) => {
  const items = await MenuItem.find({ department: DEPT }).sort({ category: 1, name: 1 });
  res.json({ success: true, count: items.length, data: items });
});

exports.addMenuItem = asyncHandler(async (req, res) => {
  const { name, price, category, type, avail } = req.body;

  const existing = await MenuItem.findOne({ name: new RegExp(`^${name.trim()}$`, 'i'), department: DEPT });
  if (existing) {
    return res.status(409).json({ success: false, error: `"${name}" is already on the menu` });
  }

  const item = await MenuItem.create({
    name: name.trim(),
    price: Number(price),
    category: category || 'Main',
    department: DEPT,
    available: avail !== undefined ? avail : true,
  });

  await logActivity('gold', `Menu item "${item.name}" added`, 'restaurant-menu.html');
  res.status(201).json({ success: true, data: item });
});

exports.updateMenuItem = asyncHandler(async (req, res) => {
  const item = await MenuItem.findOne({ id: req.params.id, department: DEPT });
  if (!item) return res.status(404).json({ success: false, error: 'Menu item not found' });

  const { name, price, category, avail } = req.body;
  if (name !== undefined) item.name = name.trim();
  if (price !== undefined) item.price = Number(price);
  if (category !== undefined) item.category = category;
  if (avail !== undefined) item.available = avail;

  await item.save();
  res.json({ success: true, data: item });
});

// PATCH is used by the frontend specifically for the Mark Available /
// Mark Sold Out toggle ({ avail }), but accepts any partial field.
exports.patchMenuItem = exports.updateMenuItem;

exports.deleteMenuItem = asyncHandler(async (req, res) => {
  const item = await MenuItem.findOneAndDelete({ id: req.params.id, department: DEPT });
  if (!item) return res.status(404).json({ success: false, error: 'Menu item not found' });
  res.json({ success: true, message: `"${item.name}" removed from the menu` });
});

/* ═══════════════════════════════════════════════
   Stock (restaurant inventory — independent of Kitchen)
   Looked up by name, not _id — matches
   RestaurantService.findStock/editStockItem/deleteStockItem(name).
═══════════════════════════════════════════════ */
exports.listStock = asyncHandler(async (req, res) => {
  const list = await RestaurantStock.find().sort({ name: 1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.addStockItem = asyncHandler(async (req, res) => {
  const { name, category, unit, min, price, desc } = req.body;

  const existing = await RestaurantStock.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
  if (existing) {
    return res.status(409).json({ success: false, error: `"${name}" is already tracked` });
  }

  const item = await RestaurantStock.create({
    name: name.trim(),
    category: category || 'Uncategorized',
    unit: unit || 'portion',
    qty: 0, // qty is only ever moved by transfers/sales, never set at creation
    min: Number(min) || 0,
    price: Number(price) || 0,
    desc: desc || '',
  });

  res.status(201).json({ success: true, data: item });
});

// name is looked up case-insensitively, exactly like Kitchen's stock lookups.
exports.editStockItem = asyncHandler(async (req, res) => {
  const item = await RestaurantStock.findOne({ name: new RegExp(`^${req.params.name.trim()}$`, 'i') });
  if (!item) return res.status(404).json({ success: false, error: `"${req.params.name}" not found in inventory` });

  const { category, unit, min, price, desc } = req.body;
  if (category !== undefined) item.category = category;
  if (unit !== undefined) item.unit = unit;
  if (min !== undefined) item.min = Number(min);
  if (price !== undefined) item.price = Number(price);
  if (desc !== undefined) item.desc = desc;

  await item.save();
  res.json({ success: true, data: item });
});

exports.deleteStockItem = asyncHandler(async (req, res) => {
  const item = await RestaurantStock.findOneAndDelete({ name: new RegExp(`^${req.params.name.trim()}$`, 'i') });
  if (!item) return res.status(404).json({ success: false, error: `"${req.params.name}" not found in inventory` });
  res.json({ success: true, message: `"${item.name}" removed from inventory` });
});

exports.listMovements = asyncHandler(async (req, res) => {
  const list = await RestaurantMovement.find().sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, count: list.length, data: list });
});

/* ═══════════════════════════════════════════════
   Sales (Quick Sale / Open Tab checkout, POS)
═══════════════════════════════════════════════ */
exports.listSales = asyncHandler(async (req, res) => {
  const { status, method, table, search, start, end } = req.query;
  const filter = { department: DEPT };

  if (status) filter.status = status;
  if (method) filter.method = method;
  if (table) filter.table = table;
  if (start || end) {
    filter.date = {};
    if (start) filter.date.$gte = new Date(start);
    if (end) filter.date.$lte = new Date(end);
  }
  if (search) {
    filter.$or = [
      { id: new RegExp(search, 'i') },
      { staff: new RegExp(search, 'i') },
      { table: new RegExp(search, 'i') },
      { 'items.name': new RegExp(search, 'i') },
    ];
  }

  const list = await Sale.find(filter).sort({ date: -1 });
  res.json({ success: true, count: list.length, data: list });
});

// Creates a completed sale, deducts RestaurantStock for each item sold
// (best-effort — sale still completes for items with no matching stock
// record, e.g. plain menu-only items with nothing tracked in inventory),
// and posts a room charge onto the guest's folio when paid via Room Charge.
exports.createSale = asyncHandler(async (req, res) => {
  const { items, method, table, discount, roomNumber, guestName } = req.body;

  const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const discountPct = Number(discount) || 0;
  const total = subtotal * (1 - discountPct / 100);

  const count = await Sale.countDocuments({ department: DEPT });
  const id = `RST-${String(count + 1).padStart(5, '0')}`;

  for (const it of items) {
    const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
    if (!stockItem) continue; // not every menu item is stock-tracked
    const qty = Number(it.qty);
    if (stockItem.qty < qty) {
      const err = new Error(`Not enough ${stockItem.name} on hand. Have ${stockItem.qty}, need ${qty}`);
      err.statusCode = 400;
      throw err;
    }
    stockItem.qty -= qty;
    await stockItem.save();

    await RestaurantMovement.create({
      date: nowStamp(),
      item: stockItem.name,
      qtyIn: 0,
      qtyOut: qty,
      balance: stockItem.qty,
      reason: `Sale ${id}`,
    });
  }

  const sale = await Sale.create({
    id,
    department: DEPT,
    items: items.map((i) => ({ name: i.name, qty: Number(i.qty), price: Number(i.price) })),
    subtotal,
    discount: discountPct,
    total,
    method: method || 'Cash',
    staff: req.user ? req.user.name : '',
    table: table || '',
    date: new Date(),
    status: 'completed',
  });

  if (method === 'Room Charge') {
    const guest = await Guest.findOne({ name: guestName });
    if (guest) {
      guest.charges.push({
        date: todayDDMMYY(),
        source: 'Restaurant',
        desc: items.map((i) => `${i.qty}x ${i.name}`).join(', '),
        room: roomNumber,
        amount: total,
        paid: 0,
        by: req.user ? req.user.name : '',
        status: 'Pending',
        payments: [],
      });
      await guest.save();
    } else {
      // Sale still completes even if the guest folio couldn't be found —
      // front desk can reconcile manually rather than losing the sale.
      await logActivity('amber', `Room Charge sale ${id} could not be matched to a guest folio (${guestName || 'unknown guest'})`, 'restaurant-sales.html');
    }
  }

  await logActivity('green', `Sale ${id} — ${total} (${method || 'Cash'})`, 'restaurant-sales.html');
  res.status(201).json({ success: true, data: sale });
});

// Voids a completed sale and restores stock — matches the frontend's
// "voided — stock restored" toast in restaurant-sales.html.
exports.voidSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ id: req.params.id, department: DEPT });
  if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
  if (sale.status === 'voided') return res.status(400).json({ success: false, error: 'Sale already voided' });

  const { reason } = req.body;
  sale.status = 'voided';
  sale.voidReason = reason;
  sale.voidedBy = req.user ? req.user.name : '';
  sale.voidedByRole = req.user ? req.user.role : '';
  sale.voidDate = new Date();
  await sale.save();

  for (const it of sale.items) {
    const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
    if (!stockItem) continue;
    stockItem.qty += Number(it.qty);
    await stockItem.save();

    await RestaurantMovement.create({
      date: nowStamp(),
      item: stockItem.name,
      qtyIn: Number(it.qty),
      qtyOut: 0,
      balance: stockItem.qty,
      reason: `Void Sale ${sale.id} — Restored`,
    });
  }

  await logActivity('red', `Sale ${sale.id} voided — ${reason}`, 'restaurant-sales.html');
  res.json({ success: true, data: sale });
});

/* ═══════════════════════════════════════════════
   Transfers — incoming pushes from Kitchen/Store into
   the Restaurant. Restaurant only accepts/rejects; it
   never raises these (that's Kitchen's addTransfer).
═══════════════════════════════════════════════ */
exports.listTransfers = asyncHandler(async (req, res) => {
  const list = await Transfer.find({ $or: [{ restaurant: DESTINATION }, { to: DESTINATION }] }).sort({ createdAt: -1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.acceptTransfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { receivedBy } = req.body;

  const transfer = await Transfer.findOne({ $or: [{ _id: id }, { transferNo: id }] });
  if (!transfer) return res.status(404).json({ success: false, error: 'Transfer not found' });
  if (transfer.status !== 'sent') {
    return res.status(400).json({ success: false, error: `Cannot accept a transfer with status '${transfer.status}'` });
  }

  transfer.status = 'accepted';
  transfer.receivedBy = receivedBy || (req.user ? req.user.name : '');
  transfer.dateReceived = nowStamp();
  await transfer.save();

  // Accepting adds the delivered quantity onto matching restaurant stock,
  // creating the stock record on the fly if this is the first delivery of it.
  let stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${transfer.meal.trim()}$`, 'i') });
  if (!stockItem) {
    stockItem = await RestaurantStock.create({ name: transfer.meal.trim(), unit: transfer.unit || 'portion', qty: 0 });
  }
  stockItem.qty += Number(transfer.quantity);
  await stockItem.save();

  await RestaurantMovement.create({
    date: nowStamp(),
    item: stockItem.name,
    qtyIn: Number(transfer.quantity),
    qtyOut: 0,
    balance: stockItem.qty,
    reason: `Transfer Accepted (${transfer.transferNo})`,
  });

  await logActivity('green', `Transfer ${transfer.transferNo} accepted — ${transfer.quantity} ${transfer.unit} ${transfer.meal}`, 'restaurant-transfer-history.html');
  res.json({ success: true, data: transfer });
});

// Rejecting moves the transfer to history with no stock added, matching
// the modal copy: "Rejecting … will move it to history — no stock will be added."
exports.rejectTransfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectReason } = req.body;

  const transfer = await Transfer.findOne({ $or: [{ _id: id }, { transferNo: id }] });
  if (!transfer) return res.status(404).json({ success: false, error: 'Transfer not found' });
  if (transfer.status !== 'sent') {
    return res.status(400).json({ success: false, error: `Cannot reject a transfer with status '${transfer.status}'` });
  }

  transfer.status = 'rejected';
  transfer.rejectReason = rejectReason;
  await transfer.save();

  await logActivity('red', `Transfer ${transfer.transferNo} rejected — ${rejectReason}`, 'restaurant-transfer-history.html');
  res.json({ success: true, data: transfer });
});

/* ═══════════════════════════════════════════════
   Requisitions — Restaurant raising a request to Store.
   Restaurant only submits + watches status; fulfillment
   happens on the Store side (same split as Kitchen's).
═══════════════════════════════════════════════ */
exports.listRestaurantRequisitions = asyncHandler(async (req, res) => {
  const list = await Requisition.find({ dept: 'Restaurant' }).sort({ dateRaised: -1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.submitRequisition = asyncHandler(async (req, res) => {
  const { items, requester, neededBy, priority, remark } = req.body;

  const count = await Requisition.countDocuments();
  const requisitionNo = `REQ-${String(count + 1).padStart(5, '0')}`;

  const requisition = await Requisition.create({
    id: uuidv4(),
    requisitionNo,
    mode: 'store_issue',
    requester,
    dept: 'Restaurant',
    neededBy: neededBy || '',
    priority: priority || 'Normal',
    remark: remark || '',
    items: items.map((i) => ({ name: i.name, unit: i.unit || 'Pieces', qty: Number(i.qty) })),
    status: 'Pending',
    dateRaised: new Date(),
    dateRaisedDisplay: todayDDMMYY(),
  });

  await logActivity('blue', `Requisition ${requisitionNo} sent to Store`, 'restaurant-transfer-history.html');
  res.status(201).json({ success: true, data: requisition });
});

/* ═══════════════════════════════════════════════
   Orders (Open Tab / Active Orders)
   Lifecycle: open → served → paid (deducts stock,
   creates Sale record, optional Room Charge)
   or cancelled (no stock movement).
   ID prefix RSO- mirrors Sale's RST- pattern.
═══════════════════════════════════════════════ */
exports.listOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { department: DEPT };
  if (status) filter.status = status;

  const list = await Order.find(filter).sort({ date: -1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.openTab = asyncHandler(async (req, res) => {
  const { items, discount, staff, table, notes, method, payMethod, roomNumber, guestName, guestPhone } = req.body;

  const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const discountPct = Number(discount) || 0;
  const total = subtotal * (1 - discountPct / 100);

  const count = await Order.countDocuments({ department: DEPT });
  const id = `RSO-${String(count + 1).padStart(5, '0')}`;

  const order = await Order.create({
    id,
    department: DEPT,
    items: items.map((i) => ({ name: i.name, qty: Number(i.qty), price: Number(i.price) })),
    subtotal,
    discount: discountPct,
    total,
    staff: staff || (req.user ? req.user.name : ''),
    table: table || '',
    notes: notes || '',
    date: new Date(),
    status: 'open',
    method: method || null,
    payMethod: payMethod || method || null,
    roomNumber: roomNumber || null,
    guestName: guestName || null,
    guestPhone: guestPhone || null,
  });

  await logActivity('gold', `Tab ${id} opened — ${items.length} item(s)`, 'restaurant-orders.html');
  res.status(201).json({ success: true, data: order });
});

exports.markOrderServed = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id, department: DEPT });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status !== 'open') {
    return res.status(400).json({ success: false, error: `Cannot mark a '${order.status}' order as served` });
  }

  order.status = 'served';
  await order.save();

  await logActivity('green', `Tab ${order.id} marked as served`, 'restaurant-orders.html');
  res.json({ success: true, data: order });
});

exports.payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id, department: DEPT });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status === 'paid') return res.status(400).json({ success: false, error: 'Order already paid' });
  if (order.status === 'cancelled') return res.status(400).json({ success: false, error: 'Cannot pay a cancelled order' });

  const { method, roomNumber, guestName, guestPhone } = req.body;
  const payMethod = method || 'Cash';

  /* ── Deduct RestaurantStock per item (same as createSale) ── */
  for (const it of order.items) {
    const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
    if (!stockItem) continue;
    const qty = Number(it.qty);
    if (stockItem.qty < qty) {
      const err = new Error(`Not enough ${stockItem.name} on hand. Have ${stockItem.qty}, need ${qty}`);
      err.statusCode = 400;
      throw err;
    }
    stockItem.qty -= qty;
    await stockItem.save();

    await RestaurantMovement.create({
      date: nowStamp(),
      item: stockItem.name,
      qtyIn: 0,
      qtyOut: qty,
      balance: stockItem.qty,
      reason: `Tab ${order.id} paid`,
    });
  }

  /* ── Create Sale record (source = tab) ── */
  const saleCount = await Sale.countDocuments({ department: DEPT });
  const saleId = `RST-${String(saleCount + 1).padStart(5, '0')}`;

  const sale = await Sale.create({
    id: saleId,
    source: order.id,
    department: DEPT,
    items: order.items.map((i) => ({ name: i.name, qty: Number(i.qty), price: Number(i.price) })),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    method: payMethod,
    staff: order.staff,
    table: order.table,
    notes: order.notes,
    date: new Date(),
    status: 'completed',
    roomNumber: roomNumber || null,
    guestName: guestName || null,
    guestPhone: guestPhone || null,
  });

  /* ── Room Charge → post to guest folio ── */
  if (payMethod === 'Room Charge') {
    const guest = await Guest.findOne({ name: guestName });
    if (guest) {
      guest.charges.push({
        date: todayDDMMYY(),
        source: 'Restaurant',
        desc: order.items.map((i) => `${i.qty}x ${i.name}`).join(', '),
        room: roomNumber,
        amount: order.total,
        paid: 0,
        by: order.staff,
        status: 'Pending',
        payments: [],
      });
      await guest.save();
    } else {
      await logActivity('amber', `Room Charge tab ${order.id} could not be matched to a guest folio (${guestName || 'unknown guest'})`, 'restaurant-orders.html');
    }
  }

  /* ── Mark order as paid ── */
  order.status = 'paid';
  order.method = payMethod;
  order.payMethod = payMethod;
  if (roomNumber) order.roomNumber = roomNumber;
  if (guestName) order.guestName = guestName;
  if (guestPhone) order.guestPhone = guestPhone;
  order.paidSaleId = saleId;
  await order.save();

  await logActivity('green', `Tab ${order.id} paid — ${order.total} (${payMethod})`, 'restaurant-orders.html');
  res.json({ success: true, data: order, sale });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id, department: DEPT });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status === 'paid') {
    return res.status(400).json({ success: false, error: 'Cannot cancel a paid order' });
  }
  if (order.status === 'cancelled') {
    return res.status(400).json({ success: false, error: 'Order already cancelled' });
  }

  order.status = 'cancelled';
  await order.save();

  await logActivity('red', `Tab ${order.id} cancelled`, 'restaurant-orders.html');
  res.json({ success: true, data: order });
});