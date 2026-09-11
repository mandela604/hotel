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
const Recipe = require('../models/Recipe');
const KitchenCooOrder = require('../models/KitchenCooOrder');
const Booking = require('../models/Booking');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

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
  const { name, category, unit, min, price, desc, storeId, recipeId } = req.body;

  const sid = (storeId || '').trim();
  const rid = (recipeId || '').trim();
  if (!sid && !rid) {
    return res.status(400).json({ success: false, error: 'Please select an item from Store catalog or Kitchen recipes — free-typed items not allowed.' });
  }

  if (rid) {
    const Recipe = require('../models/Recipe');
    const recipe = await Recipe.findOne({ id: rid }).catch(function(){ return null; });
    if (!recipe) {
      return res.status(400).json({ success: false, error: 'Selected Kitchen recipe not found — please re-pick from dropdown.' });
    }
    const existing = await RestaurantStock.findOne({ $or: [{ recipeId: rid }, { name: new RegExp(`^${name.trim()}$`, 'i') }] });
    if (existing) {
      return res.status(409).json({ success: false, error: `"${name}" is already tracked` });
    }
    const item = await RestaurantStock.create({
      id: rid,
      name: name.trim(),
      category: category || 'Kitchen Recipes',
      unit: unit || recipe.expectedYieldUnit || 'portion',
      recipeId: rid,
      qty: 0,
      min: Number(min) || 0,
      price: Number(price) || 0,
      cost: recipe.gasCostPerUnit || 0,
      desc: desc || 'Cook-on-Order — recipe linked',
    });
    return res.status(201).json({ success: true, data: item });
  }

  const StoreStock = require('../models/StoreStock');
  const storeItem = await StoreStock.findOne({ id: sid }).catch(function(){ return null; });
  if (!storeItem) {
    return res.status(400).json({ success: false, error: 'Selected Store item not found — please re-pick from dropdown.' });
  }

  const existing = await RestaurantStock.findOne({ $or: [{ storeId: sid }, { name: new RegExp(`^${name.trim()}$`, 'i') }] });
  if (existing) {
    return res.status(409).json({ success: false, error: `"${name}" is already tracked` });
  }
  const item = await RestaurantStock.create({
    id: sid,
    name: name.trim(),
    category: category || 'Uncategorized',
    unit: unit || 'portion',
    storeId: sid,
    procurementId: storeItem.procurementId || '',
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
  const { items, method, table, discount, roomNumber, guestName, guestId } = req.body;

  const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const discountPct = Number(discount) || 0;
  const total = subtotal * (1 - discountPct / 100);

  const count = await Sale.countDocuments({ department: DEPT });
  const id = `RST-${String(count + 1).padStart(5, '0')}`;

  const stockIdMap = {};
  const procIdMap = {};
  for (const it of items) {
    const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
    if (!stockItem) continue;
    stockIdMap[it.name.trim().toLowerCase()] = stockItem.id;
    procIdMap[it.name.trim().toLowerCase()] = stockItem.procurementId || '';
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
    items: items.map((i) => ({ name: i.name, stockId: stockIdMap[i.name.trim().toLowerCase()] || '', procurementId: procIdMap[i.name.trim().toLowerCase()] || '', qty: Number(i.qty), price: Number(i.price) })),
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
    const guest = guestId ? await Guest.findOne({ guestId: guestId }) : await Guest.findOne({ name: guestName });
    if (guest) {
      var bRefR = '';
      if (roomNumber) { var bkR = await Booking.findOne({ room: roomNumber, status: 'checkedin' }); if (bkR) bRefR = bkR.id; }
      guest.charges.push({
        bookingRef: bRefR,
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
      await logActivity('amber', `Room Charge sale ${id} could not be matched to a guest folio (${guestName || 'unknown guest'})`, 'restaurant-sales.html');
    }
    /* Also post to Booking.payments[] — same as Pool Bar */
    if (roomNumber) {
      const booking = await Booking.findOne({ room: String(roomNumber).trim(), status: 'checkedin' });
      if (booking) {
        booking.payments.push({
          id: uuidv4(),
          amount: total,
          mode: 'Room Charge (Restaurant)',
          date: todayDDMMYY(),
          by: req.user ? req.user.name : '',
          ts: Date.now(),
        });
        booking.paid = (booking.paid || 0) + total;
        recomputePayStatus(booking);
        await booking.save();
      }
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
    const stockItem = it.stockId ? await RestaurantStock.findOne({ id: it.stockId }) : null;
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
  const list = await Transfer.find({ to: DESTINATION }).sort({ createdAt: -1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.pendingCount = asyncHandler(async (req, res) => {
  const count = await Transfer.countDocuments({
    status: 'sent',
    to: DESTINATION,
  });
  res.json({ success: true, count });
});

exports.acceptTransfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { receivedBy } = req.body;

  const transfer = await Transfer.findOne({ id: id });
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

  if (transfer.cooId) {
    const KitchenCooOrder = require('../models/KitchenCooOrder');
    const cooOrder = await KitchenCooOrder.findOne({ id: transfer.cooId });
    if (cooOrder) {
      cooOrder.status = 'served';
      await cooOrder.save();
      if (cooOrder.restaurantOrderId) {
        const linkedOrder = await Order.findOne({ id: cooOrder.restaurantOrderId });
        if (linkedOrder && linkedOrder.status !== 'paid') {
          linkedOrder.status = 'served';
          await linkedOrder.save();
        }
      }
    }
  }

  res.json({ success: true, data: transfer });
});

// Rejecting moves the transfer to history with no stock added, matching
// the modal copy: "Rejecting … will move it to history — no stock will be added."
exports.rejectTransfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectReason } = req.body;

  const transfer = await Transfer.findOne({ id: id });
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

const Counter = require('../models/Counter');
const sanitizeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

  const counter = await Counter.findOneAndUpdate(
    { key: 'req:RREQ' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const requisitionNo = `RREQ-${new Date().getFullYear()}-${String(counter.seq).padStart(5, '0')}`;
  const now = new Date();
  const dateRaisedDisplay = todayDDMMYY();

  const requisition = await Requisition.create({
    id: uuidv4(),
    requisitionNo,
    mode: 'store_issue',
    requester: requester || 'Restaurant Staff',
    dept: 'Restaurant',
    neededBy: neededBy || '',
    priority: priority || 'Normal',
    remark: remark || '',
    items: (items || []).map((i) => ({
      name: i.name,
      stockId: i.stockId || '',
      unit: i.unit || 'Pieces',
      qty: Number(i.qty) || 0,
      issuedQty: 0,
      cost: Number(i.cost) || 0,
      remark: i.remark || '',
    })),
    status: 'Pending',
    dateRaised: now,
    dateRaisedDisplay,
  });

  await logActivity('blue', `Requisition ${requisitionNo} sent to Store`, 'restaurant-transfer-history.html');
  res.status(201).json({ success: true, data: requisition });
});

exports.receiveRequisition = asyncHandler(async (req, res) => {
  const reqDoc = await Requisition.findOne({ $or: [{ id: req.params.id }, { requisitionNo: req.params.id }] });
  if (!reqDoc) return res.status(404).json({ success: false, error: 'Requisition not found' });

  /* credit issued items to stock + log movements */
  for (const it of (reqDoc.items || [])) {
    const addQty = Number(it.issuedQty > 0 ? it.issuedQty : (it.issuedQty !== 0 ? it.qty : 0)) || 0;
    if (addQty <= 0) continue;

    let stockItem = null;
    if (it.stockId) {
      stockItem = await RestaurantStock.findOne({ id: it.stockId }).catch(() => null);
    }
    if (!stockItem) {
      stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${sanitizeRegex(it.name.trim())}$`, 'i') });
    }

    if (stockItem) {
      stockItem.qty += addQty;
      await stockItem.save();
    } else {
      const StoreStock = require('../models/StoreStock');
      const storeRef = it.stockId ? await StoreStock.findOne({ id: it.stockId }).catch(() => null) : null;
      stockItem = await RestaurantStock.create({
        name: it.name.trim(),
        category: 'General',
        unit: it.unit || 'portion',
        qty: addQty,
        min: 10,
        price: Number(it.cost) || 0,
        storeId: it.stockId || '',
        procurementId: storeRef ? (storeRef.procurementId || '') : '',
      });
    }

    await RestaurantMovement.create({
      date: nowStamp(),
      item: stockItem.name,
      qtyIn: addQty,
      qtyOut: 0,
      balance: stockItem.qty,
      reason: `Requisition Received (${reqDoc.requisitionNo})`,
    });
  }

  reqDoc.status = 'Completed';
  await reqDoc.save();

  res.json({ success: true, data: reqDoc });
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
  const { items, discount, staff, table, notes, method, payMethod, roomNumber, guestName, guestPhone, createdBy } = req.body;

  const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const discountPct = Number(discount) || 0;
  const total = subtotal * (1 - discountPct / 100);

  const count = await Order.countDocuments({ department: DEPT });
  const id = `RSO-${String(count + 1).padStart(5, '0')}`;

  const orderItems = [];
  for (const it of items) {
    const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
    orderItems.push({ name: it.name.trim(), qty: Number(it.qty), price: Number(it.price), procurementId: stockItem ? (stockItem.procurementId || '') : '' });
  }

  const order = await Order.create({
    id,
    department: DEPT,
    items: orderItems,
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
    createdBy: createdBy || (req.user ? req.user.name : ''),
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

  /* ── Deduct RestaurantStock per item (skip items not yet in stock) ── */
  const stockIdMap = {};
  const procIdMap2 = {};
  for (const it of order.items) {
    const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
    if (!stockItem) continue;
    stockIdMap[it.name.trim().toLowerCase()] = stockItem.id;
    procIdMap2[it.name.trim().toLowerCase()] = stockItem.procurementId || '';
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
      reason: `Tab ${order.id} served`,
    });
  }

  /* ── Create pending Sale record ── */
  const saleCount = await Sale.countDocuments({ department: DEPT });
  const pendingSaleId = `RST-${String(saleCount + 1).padStart(5, '0')}`;

  const sale = await Sale.create({
    id: pendingSaleId,
    source: order.id,
    department: DEPT,
    items: order.items.map((i) => ({ name: i.name, stockId: stockIdMap[i.name.trim().toLowerCase()] || '', procurementId: procIdMap2[i.name.trim().toLowerCase()] || '', qty: Number(i.qty), price: Number(i.price) })),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    method: '',
    staff: order.staff,
    table: order.table,
    notes: order.notes,
    date: new Date(),
    status: 'pending',
  });

  /* ── Update order ── */
  order.status = 'served';
  order.pendingSaleId = pendingSaleId;
  await order.save();

  await logActivity('green', `Tab ${order.id} marked as served`, 'restaurant-orders.html');
  res.json({ success: true, data: order, sale });
});

exports.payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id, department: DEPT });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status === 'paid') return res.status(400).json({ success: false, error: 'Order already paid' });
  if (order.status === 'cancelled') return res.status(400).json({ success: false, error: 'Cannot pay a cancelled order' });
  if (order.status !== 'open' && order.status !== 'served') {
    return res.status(400).json({ success: false, error: `Cannot pay an order with status '${order.status}'` });
  }

  const { method, roomNumber, guestName, guestPhone, guestId } = req.body;
  const payMethod = method || 'Cash';

  let sale;

  if (order.pendingSaleId) {
    /* ── Already served — find the pending Sale and finalize it ── */
    sale = await Sale.findOne({ id: order.pendingSaleId });
    if (sale) {
      sale.status = 'completed';
      sale.method = payMethod;
      if (roomNumber) sale.roomNumber = roomNumber;
      if (guestName) sale.guestName = guestName;
      if (guestPhone) sale.guestPhone = guestPhone;
      await sale.save();
    }
  } else {
    /* ── Direct pay (skip serve) — deduct stock + create completed Sale ── */
    const stockIdMap = {};
    const procIdMap2 = {};
    for (const it of order.items) {
      const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
      if (!stockItem) continue;
      stockIdMap[it.name.trim().toLowerCase()] = stockItem.id;
      procIdMap2[it.name.trim().toLowerCase()] = stockItem.procurementId || '';
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

    const saleCount = await Sale.countDocuments({ department: DEPT });
    const saleId = `RST-${String(saleCount + 1).padStart(5, '0')}`;

    sale = await Sale.create({
      id: saleId,
      source: order.id,
      department: DEPT,
      items: order.items.map((i) => ({ name: i.name, stockId: stockIdMap[i.name.trim().toLowerCase()] || '', procurementId: procIdMap2[i.name.trim().toLowerCase()] || '', qty: Number(i.qty), price: Number(i.price) })),
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
  }

  /* ── Room Charge → post to guest folio ── */
  if (payMethod === 'Room Charge') {
    const guest = guestId ? await Guest.findOne({ guestId: guestId }) : await Guest.findOne({ name: guestName });
    if (guest) {
      var bRefR2 = '';
      if (roomNumber) { var bkR2 = await Booking.findOne({ room: roomNumber, status: 'checkedin' }); if (bkR2) bRefR2 = bkR2.id; }
      guest.charges.push({
        bookingRef: bRefR2,
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
    /* Also post to Booking.payments[] — same as Pool Bar */
    if (roomNumber) {
      const booking = await Booking.findOne({ room: String(roomNumber).trim(), status: 'checkedin' });
      if (booking) {
        booking.payments.push({
          id: uuidv4(),
          amount: order.total,
          mode: 'Room Charge (Restaurant)',
          date: todayDDMMYY(),
          by: order.staff || '',
          ts: Date.now(),
        });
        booking.paid = (booking.paid || 0) + order.total;
        recomputePayStatus(booking);
        await booking.save();
      }
    }
  }

  /* ── Mark order as paid ── */
  order.status = 'paid';
  order.method = payMethod;
  order.payMethod = payMethod;
  order.processedBy = req.user ? req.user.name : '';
  if (roomNumber) order.roomNumber = roomNumber;
  if (guestName) order.guestName = guestName;
  if (guestPhone) order.guestPhone = guestPhone;
  order.paidSaleId = sale ? sale.id : order.pendingSaleId || '';
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

  /* ── If served with pending sale: restore stock + void sale ── */
  if (order.status === 'served' && order.pendingSaleId) {
    for (const it of order.items) {
      const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
      if (!stockItem) continue;
      const qty = Number(it.qty);
      stockItem.qty += qty;
      await stockItem.save();

      await RestaurantMovement.create({
        date: nowStamp(),
        item: stockItem.name,
        qtyIn: qty,
        qtyOut: 0,
        balance: stockItem.qty,
        reason: `Tab ${order.id} cancelled — stock restored`,
      });
    }

    const pendingSale = await Sale.findOne({ id: order.pendingSaleId });
    if (pendingSale) {
      pendingSale.status = 'voided';
      pendingSale.voidReason = 'Order cancelled';
      pendingSale.voidedBy = req.user ? req.user.name : '';
      pendingSale.voidDate = new Date();
      await pendingSale.save();
    }
  }

  order.status = 'cancelled';
  await order.save();

  await logActivity('red', `Tab ${order.id} cancelled`, 'restaurant-orders.html');
  res.json({ success: true, data: order });
});

/* ── Categories (persisted in the shared Category collection) ── */

exports.listCategories = asyncHandler(async (req, res) => {
  const derived = await RestaurantStock.distinct('category');
  const saved = await Category.find({ module: 'restaurant' }).lean();
  const set = new Set(derived.filter(Boolean));
  saved.forEach(c => set.add(c.name));
  res.json({ success: true, data: Array.from(set).sort((a, b) => a.localeCompare(b)) });
});

exports.addCategory = asyncHandler(async (req, res) => {
  const name = req.body.name.trim();
  const existing = await Category.findOne({ module: 'restaurant', name });
  if (existing) throw new ApiError(409, `Category "${name}" already exists.`);
  await Category.create({ module: 'restaurant', name });
  res.status(201).json({ success: true, data: { name } });
});

exports.renameCategory = asyncHandler(async (req, res) => {
  const oldName = req.params.name;
  const newName = req.body.name.trim();
  await RestaurantStock.updateMany({ category: oldName }, { $set: { category: newName } });
  await Category.updateMany({ module: 'restaurant', name: oldName }, { $set: { name: newName } });
  res.json({ success: true, data: { name: newName } });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const name = req.params.name;
  const reassignTo = (req.body && req.body.reassignTo) || 'Uncategorized';
  if (name === reassignTo) throw new ApiError(400, `Cannot delete "${name}" — it is the fallback category.`);
  await RestaurantStock.updateMany({ category: name }, { $set: { category: reassignTo } });
  await Category.deleteMany({ module: 'restaurant', name });
  res.json({ success: true, data: { reassignedTo: reassignTo } });
});

/* ═══════════════════════════════════════════════
   Cook on Order — Kitchen Recipes for COO
   Restaurant staff picks from Kitchen's recipe
   catalog when placing COO orders.
══════════════════════════════════════════════ */
exports.listKitchenRecipes = asyncHandler(async (req, res) => {
  const list = await Recipe.find().sort({ dish: 1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.addRecipeToStock = asyncHandler(async (req, res) => {
  const { recipeId, price, category } = req.body;
  if (!recipeId) throw new ApiError(400, 'recipeId is required');

  const recipe = await Recipe.findOne({ id: recipeId });
  if (!recipe) throw new ApiError(404, 'Recipe not found');

  const existingByName = await RestaurantStock.findOne({ name: new RegExp('^' + recipe.dish.trim() + '$', 'i') });
  if (existingByName) {
    if (!existingByName.recipeId) {
      existingByName.recipeId = recipe.id;
      existingByName.desc = 'Cook-on-Order — recipe linked';
      await existingByName.save();
      return res.status(200).json({ success: true, data: existingByName });
    }
    throw new ApiError(409, `"${recipe.dish}" is already in Restaurant stock`);
  }

  const stockItem = await RestaurantStock.create({
    name: recipe.dish,
    category: category || 'Kitchen Recipes',
    unit: recipe.expectedYieldUnit || 'portions',
    recipeId: recipe.id,
    price: Number(price) || 0,
    cost: recipe.gasCostPerUnit || 0,
    desc: `Cook-on-Order — recipe linked`,
  });

  res.status(201).json({ success: true, data: stockItem });
});

/* ═══════════════════════════════════════════════
   Cook on Order — create COO order
   Creates both an Order (type: coo) for tracking
   in Active Orders / Sales, and a KitchenCooOrder
   for Kitchen to see and accept.
══════════════════════════════════════════════ */
exports.createCooOrder = asyncHandler(async (req, res) => {
  const { items, discount, staff, table, covers, notes, method, roomNumber, guestName, guestPhone, guestId, createdBy } = req.body;
  if (!items || !items.length) throw new ApiError(400, 'Add at least one item');

  const subtotal = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0);
  const discountPct = Number(discount) || 0;
  const total = subtotal * (1 - discountPct / 100);

  const count = await Order.countDocuments({ department: DEPT });
  const id = `RSO-${String(count + 1).padStart(5, '0')}`;

  const orderItems = [];
  for (const it of items) {
    const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
    orderItems.push({
      id: uuidv4(),
      name: it.name.trim(),
      qty: Number(it.qty),
      price: Number(it.price) || 0,
      recipeId: it.recipeId || (stockItem ? stockItem.recipeId : '') || '',
      procurementId: stockItem ? (stockItem.procurementId || '') : '',
    });
  }

  const kitchenItems = orderItems.filter(i => i.recipeId);

  const order = await Order.create({
    id,
    department: DEPT,
    type: 'coo',
    items: orderItems,
    subtotal,
    discount: discountPct,
    total,
    staff: staff || (req.user ? req.user.name : ''),
    table: table || '',
    notes: notes || '',
    date: new Date(),
    status: 'open',
    method: method || null,
    payMethod: method || null,
    roomNumber: roomNumber || null,
    guestName: guestName || null,
    guestPhone: guestPhone || null,
    createdBy: createdBy || (req.user ? req.user.name : ''),
  });

  let coo = null;
  if (kitchenItems.length) {
    coo = await KitchenCooOrder.create({
      id: uuidv4(),
      restaurantOrderId: id,
      table: table || '',
      covers: Number(covers) || 1,
      items: kitchenItems.map(i => ({ name: i.name, qty: i.qty, price: i.price, recipeId: i.recipeId })),
      notes: notes || '',
      staff: staff || (req.user ? req.user.name : ''),
      method: method || 'Cash',
      roomNumber: roomNumber || '',
      guestName: guestName || '',
      guestId: guestId || '',
      guestPhone: guestPhone || '',
      total: kitchenItems.reduce((s, i) => s + i.price * i.qty, 0),
      status: 'pending',
      createdBy: createdBy || (req.user ? req.user.name : ''),
    });
    order.cooId = coo.id;
    await order.save();
  }

  const kitchenCount = kitchenItems.length;
  const regularCount = orderItems.length - kitchenCount;
  let activityText = `COO ${id} — ${orderItems.length} item(s)`;
  if (kitchenCount && regularCount) activityText += ` (${kitchenCount} kitchen, ${regularCount} regular)`;
  else if (kitchenCount) activityText += ` sent to Kitchen`;
  await logActivity('gold', activityText, 'restaurant-orders.html');
  res.status(201).json({ success: true, data: { order, coo } });
});

exports.getPendingCooTransfers = asyncHandler(async (req, res) => {
  const KitchenCooOrder = require('../models/KitchenCooOrder');
  const transfers = await Transfer.find({ status: 'sent', cooId: { $ne: '' } }).sort({ createdAt: -1 });
  const results = [];
  for (const t of transfers) {
    const coo = await KitchenCooOrder.findOne({ id: t.cooId });
    const order = coo && coo.restaurantOrderId
      ? await Order.findOne({ id: coo.restaurantOrderId })
      : null;
    results.push({
      transferNo: t.transferNo,
      cooId: t.cooId,
      meal: t.meal,
      quantity: t.quantity,
      unit: t.unit,
      sentBy: t.sentBy,
      dateSent: t.dateSent,
      table: coo ? coo.table : '',
      orderNo: order ? order.id : '',
      orderStatus: order ? order.status : '',
    });
  }
  res.json({ success: true, data: results });
});

/* ═══════════════════════════════════════════════
   COO Order — get single, update items
═══════════════════════════════════════════════ */
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id, department: DEPT });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  res.json({ success: true, data: order });
});

exports.updateCooOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { items, discount, notes, table, covers } = req.body;

  const order = await Order.findOne({ id, department: DEPT });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status !== 'open') return res.status(400).json({ success: false, error: `Cannot edit a '${order.status}' order` });

  if (order.cooId) {
    const cooOrder = await KitchenCooOrder.findOne({ id: order.cooId });
    if (cooOrder && cooOrder.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Kitchen has already started — editing is locked' });
    }
  }

  if (items && items.length) {
    const orderItems = [];
    for (const it of items) {
      const stockItem = await RestaurantStock.findOne({ name: new RegExp(`^${it.name.trim()}$`, 'i') });
      orderItems.push({
        id: it.id || uuidv4(),
        name: it.name.trim(),
        qty: Number(it.qty),
        price: Number(it.price) || 0,
        recipeId: it.recipeId || (stockItem ? stockItem.recipeId : '') || '',
        procurementId: stockItem ? (stockItem.procurementId || '') : '',
      });
    }
    order.items = orderItems;
    order.subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    order.discount = Number(discount) || order.discount || 0;
    order.total = order.subtotal * (1 - order.discount / 100);

    const kitchenItems = orderItems.filter(i => i.recipeId);
    if (order.cooId) {
      const cooOrder = await KitchenCooOrder.findOne({ id: order.cooId });
      if (cooOrder) {
        cooOrder.items = kitchenItems.map(i => ({ name: i.name, qty: i.qty, price: i.price, recipeId: i.recipeId }));
        cooOrder.total = kitchenItems.reduce((s, i) => s + i.price * i.qty, 0);
        await cooOrder.save();
      }
    } else if (kitchenItems.length) {
      const coo = await KitchenCooOrder.create({
        id: uuidv4(),
        restaurantOrderId: id,
        table: order.table || '',
        covers: Number(covers) || 1,
        items: kitchenItems.map(i => ({ name: i.name, qty: i.qty, price: i.price, recipeId: i.recipeId })),
        notes: order.notes || '',
        staff: order.staff || '',
        method: order.payMethod || 'Cash',
        total: kitchenItems.reduce((s, i) => s + i.price * i.qty, 0),
        status: 'pending',
        createdBy: order.createdBy || '',
      });
      order.cooId = coo.id;
    }
  }

  if (notes !== undefined) order.notes = notes;
  if (table !== undefined) order.table = table;
  await order.save();

  res.json({ success: true, data: order });
});

exports.deleteCooOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findOne({ id, department: DEPT });
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.type !== 'coo') return res.status(400).json({ success: false, error: 'Only COO orders can be deleted' });
  if (order.status !== 'open') return res.status(400).json({ success: false, error: `Cannot delete a '${order.status}' order` });

  if (order.cooId) {
    const cooOrder = await KitchenCooOrder.findOne({ id: order.cooId });
    if (cooOrder && cooOrder.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Kitchen has already started — cannot cancel' });
    }
    if (cooOrder) {
      cooOrder.status = 'rejected';
      await cooOrder.save();
    }
  }

  order.status = 'cancelled';
  await order.save();
  res.json({ success: true, data: order });
});