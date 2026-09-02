const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const StoreStock = require('../models/StoreStock');
const Requisition = require('../models/Requisition');
const Counter = require('../models/Counter');
const Category = require('../models/Category');

const DEPT_PREFIX = { Kitchen: 'KREQ', Housekeeping: 'HREQ', 'Pool Bar': 'BREQ', 'Front Desk': 'FREQ', Gym: 'GREQ', Store: 'PR' };

function actorName(req) {
  return (req.user && (req.user.name || req.user.role)) || 'User';
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function todayDisplay() {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function prefixForDept(dept, mode) {
  if (mode === 'purchase') return 'PR';
  return DEPT_PREFIX[dept] || 'REQ';
}

async function peekNumber(dept, mode) {
  const prefix = prefixForDept(dept, mode);
  const counter = await Counter.findOne({ key: 'req:' + prefix });
  const n = counter ? counter.seq : 45;
  return prefix + '-' + new Date().getFullYear() + '-' + String(n + 1).padStart(5, '0');
}

async function nextNumber(dept, mode) {
  const prefix = prefixForDept(dept, mode);
  const counter = await Counter.findOneAndUpdate(
    { key: 'req:' + prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return prefix + '-' + new Date().getFullYear() + '-' + String(counter.seq).padStart(5, '0');
}

/**
 * Resolves a requisition line's item name to a Store stock record.
 * Requesting departments don't always spell an item exactly the way
 * Store's central stock does ("Bottled Water" on a requisition vs
 * "Bottled Water 1.5L" in Store's stock) — mirrors the same three-pass
 * fallback as the frontend's findStock() in services/store-service.js,
 * so the backend and the demo/local frontend never disagree on whether
 * an item exists.
 */
async function findStockFuzzy(name) {
  const n = (name || '').trim();
  if (!n) return null;

  let found = await StoreStock.findOne({ name: new RegExp('^' + escapeRegex(n) + '$', 'i') });
  if (found) return found;

  found = await StoreStock.findOne({ name: new RegExp(escapeRegex(n), 'i') });
  if (found) return found;

  // Pass 3 (stock name is contained in the requisition's item name) needs
  // a full scan since Mongo can't do "needle in haystack" the other way
  // round in a single indexed query — fine at Store's stock-list scale.
  const all = await StoreStock.find({});
  found = all.find((s) => n.toLowerCase().includes((s.name || '').toLowerCase()));
  return found || null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ═══════════════ Stock ═══════════════ */

exports.listStock = asyncHandler(async (req, res) => {
  const stock = await StoreStock.find({}).sort({ name: 1 });
  res.json({ success: true, data: stock });
});

exports.storeCatalog = asyncHandler(async (req, res) => {
  const stock = await StoreStock.find({}, { name: 1, unit: 1, baseUnit: 1, packSize: 1, qty: 1, cost: 1, cat: 1 }).sort({ name: 1 });
  res.json({ success: true, data: stock.map(s => ({ id: s.id, name: s.name, unit: s.unit, baseUnit: s.baseUnit, packSize: s.packSize, qty: s.qty, cost: s.cost, cat: s.cat })) });
});

exports.addStock = asyncHandler(async (req, res) => {
  const { name, cat, category, unit, baseUnit, packSize, min, cost, price, qty } = req.body;
  const n = (name || '').trim();
  if (!n) throw new ApiError(400, 'Item name is required');
  const existing = await StoreStock.findOne({ name: new RegExp('^' + escapeRegex(n) + '$', 'i') });
  if (existing) throw new ApiError(409, `"${name}" is already tracked — edit it instead.`);

  const item = await StoreStock.create({
    name: name.trim(),
    cat: (cat || category || 'Other').trim(),
    unit: (unit || 'unit').trim(),
    baseUnit: (baseUnit || '').trim(),
    packSize: Number(packSize) || 0,
    qty: Number(qty) || 0,
    cost: Number(cost || price) || 0,
    min: Number(min) || 0,
  });
  res.status(201).json({ success: true, data: item });
});

exports.updateStock = asyncHandler(async (req, res) => {
  const { cat, category, unit, baseUnit, packSize, min, cost, price, name, qty } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (cat !== undefined || category !== undefined) updates.cat = (cat || category).trim();
  if (unit !== undefined) updates.unit = unit.trim();
  if (baseUnit !== undefined) updates.baseUnit = (baseUnit || '').trim();
  if (packSize !== undefined) updates.packSize = Number(packSize) || 0;
  if (min !== undefined) updates.min = Number(min);
  if (cost !== undefined || price !== undefined) updates.cost = Number(cost !== undefined ? cost : price);
  if (qty !== undefined) updates.qty = Number(qty);

  const item = await StoreStock.findOneAndUpdate({ id: req.params.id }, updates, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, 'Stock item not found.');
  res.json({ success: true, data: item });
});

exports.deleteStock = asyncHandler(async (req, res) => {
  const item = await StoreStock.findOneAndDelete({ id: req.params.id });
  if (!item) throw new ApiError(404, 'Stock item not found.');
  res.json({ success: true, data: { deleted: true } });
});

/* ═══════════════ Categories ═══════════════
   Derived live from stock.cat, same as the frontend's deriveCategories()
   — there is no separate categories collection, so "add" seeds a
   placeholder-free category by tagging it onto nothing until a stock
   item actually uses it (rename/delete just re-point every stock row). */

exports.listCategories = asyncHandler(async (req, res) => {
  const derived = await StoreStock.distinct('cat');
  const saved = await Category.find({ module: 'store' }).lean();
  const set = new Set(derived.filter(Boolean));
  saved.forEach(c => set.add(c.name));
  res.json({ success: true, data: Array.from(set).sort((a, b) => a.localeCompare(b)) });
});

exports.addCategory = asyncHandler(async (req, res) => {
  const name = req.body.name.trim();
  // Check both the Category model AND stock items for duplicates
  const existing = await Category.findOne({ module: 'store', name });
  if (existing) throw new ApiError(409, `Category "${name}" already exists.`);
  const stockHasIt = await StoreStock.findOne({ cat: name });
  if (stockHasIt) throw new ApiError(409, `Category "${name}" already exists (used by a stock item).`);
  await Category.create({ module: 'store', name });
  res.status(201).json({ success: true, data: { name } });
});

exports.renameCategory = asyncHandler(async (req, res) => {
  const oldName = req.params.name;
  const newName = req.body.name.trim();
  const result = await StoreStock.updateMany({ cat: oldName }, { $set: { cat: newName } });
  await Category.updateMany({ module: 'store', name: oldName }, { $set: { name: newName } });
  res.json({ success: true, data: { name: newName, stockUpdated: result.modifiedCount || result.nModified || 0 } });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const name = req.params.name;
  const reassignTo = (req.body && req.body.reassignTo) || 'Other';
  if (name === reassignTo) throw new ApiError(400, `Cannot delete "${name}" — it is the fallback category.`);
  const result = await StoreStock.updateMany({ cat: name }, { $set: { cat: reassignTo } });
  await Category.deleteMany({ module: 'store', name });
  res.json({ success: true, data: { reassignedTo: reassignTo, stockUpdated: result.modifiedCount || result.nModified || 0 } });
});

/* ═══════════════ Requisitions ═══════════════ */

exports.listRequisitions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.mode) filter.mode = req.query.mode;
  if (req.query.dept) filter.dept = req.query.dept;
  if (req.query.status) filter.status = req.query.status;
  const rows = await Requisition.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: rows });
});

// Lets the requisition form preview what number it WILL get without
// actually consuming the counter — mirrors peekNextNumber() on the
// frontend, used to render "This will be raised as PR-2025-00048".
exports.peekNextRequisitionNumber = asyncHandler(async (req, res) => {
  const { dept, mode } = req.query;
  const no = await peekNumber(dept, mode);
  res.json({ success: true, data: { no } });
});

exports.getRequisition = asyncHandler(async (req, res) => {
  const row = await Requisition.findOne({ requisitionNo: req.params.no });
  if (!row) throw new ApiError(404, `Requisition ${req.params.no} not found.`);
  res.json({ success: true, data: row });
});

exports.submitRequisition = asyncHandler(async (req, res) => {
  const { mode, by, dept, needed, priority, remark, fulfillStore, supplier, linked, items } = req.body;
  const finalMode = mode === 'purchase' ? 'purchase' : 'store_issue';

  const no = await nextNumber(dept, finalMode);
  const row = await Requisition.create({
    id: no,
    requisitionNo: no,
    mode: finalMode,
    requester: by.trim(),
    dept,
    neededBy: needed,
    priority: priority || 'Normal',
    remark: (remark || '').trim(),
    fulfillStore: finalMode === 'store_issue' ? (fulfillStore || 'Central Store') : null,
    supplier: finalMode === 'purchase' ? (supplier || '').trim() : null,
    linked: finalMode === 'purchase' ? (linked || '').trim() : null,
    items: items.map((i) => ({
      name: i.name.trim(), stockId: i.stockId || '', unit: i.unit || 'unit', packSize: Number(i.packSize) || 0, baseUnit: i.baseUnit || '', qty: Number(i.qty) || 0,
      cost: Number(i.cost) || 0, remark: i.remark || '', issuedQty: 0,
    })),
    status: 'Pending',
    dateRaised: todayISO(),
    dateRaisedDisplay: todayDisplay(),
  });
  res.status(201).json({ success: true, data: row });
});

exports.updateRequisition = asyncHandler(async (req, res) => {
  const row = await Requisition.findOne({ requisitionNo: req.params.no });
  if (!row) throw new ApiError(404, `Requisition ${req.params.no} not found.`);

  if (row.status !== 'Pending' && row.status !== 'Rejected') {
    throw new ApiError(400, 'Can only edit requisitions that are Pending or Rejected.');
  }

  const { by, dept, needed, priority, remark, fulfillStore, supplier, linked, items } = req.body;

  if (by !== undefined) row.requester = by.trim();
  if (dept !== undefined) row.dept = dept;
  if (needed !== undefined) row.neededBy = needed;
  if (priority !== undefined) row.priority = priority;
  if (remark !== undefined) row.remark = remark.trim();
  if (row.mode === 'store_issue' && fulfillStore !== undefined) row.fulfillStore = fulfillStore || 'Central Store';
  if (row.mode === 'purchase' && supplier !== undefined) row.supplier = supplier.trim();
  if (row.mode === 'purchase' && linked !== undefined) row.linked = linked.trim();
  if (Array.isArray(items)) {
    row.items = items.map((i) => ({
      name: (i.name || '').trim(), stockId: i.stockId || '', unit: i.unit || 'unit', packSize: Number(i.packSize) || 0, baseUnit: i.baseUnit || '', qty: Number(i.qty) || 0,
      cost: Number(i.cost) || 0, remark: i.remark || '', issuedQty: i.issuedQty || 0,
    }));
  }
  if (row.status === 'Rejected') row.status = 'Pending';

  await row.save();
  res.json({ success: true, data: row });
});

/**
 * Approve & issue items against a Store-issue requisition. Deducts stock
 * only for the DELTA between what was previously issued and what's
 * issued this time, so re-approving a partial doesn't double-deduct —
 * same rule as approveAndIssue() on the frontend.
 */
exports.issueRequisition = asyncHandler(async (req, res) => {
  const row = await Requisition.findOne({ requisitionNo: req.params.no });
  if (!row) throw new ApiError(404, `Requisition ${req.params.no} not found.`);
  if (row.mode !== 'store_issue') throw new ApiError(400, 'Only Store-issue requisitions can be issued from here.');
  if (row.status === 'Rejected') throw new ApiError(400, 'This requisition was rejected and cannot be issued.');

  const { issuedQtyByItem } = req.body;

  // Phase 1: resolve all items and compute deltas — NO writes yet.
  const plan = [];
  let totalReq = 0, totalIssued = 0;

  for (const it of row.items) {
    const prevIssued = it.issuedQty || 0;
    if (!it.stockId) throw new ApiError(400, `Missing stockId for item "${it.name}" — pick from Store catalog (uuid)`);
    const stockItem = await StoreStock.findOne({ id: it.stockId });
    if (!stockItem) {
      console.error(`[storeController:issue] stockId not found: ${it.stockId} for "${it.name}" — available:`, (await StoreStock.find({}).select('id name')).map(s=>s.id+':'+s.name).join(', '));
      throw new ApiError(404, `Store item not found for stockId ${it.stockId} — pick from Store catalog (uuid) again.`);
    }
    const avail = stockItem ? stockItem.qty : 0; // always in base units
    const raw = Object.prototype.hasOwnProperty.call(issuedQtyByItem, it.name) ? issuedQtyByItem[it.name] : prevIssued;

    // Convert issued qty to base units if needed
    const packSize = stockItem ? (stockItem.packSize || 0) : 0;
    const reqUnit = (it.unit || '').trim().toLowerCase();
    const stockBaseUnit = stockItem ? (stockItem.baseUnit || '').trim().toLowerCase() : '';
    const isBulkUnit = packSize > 0 && reqUnit !== stockBaseUnit;

    const issuedInReqUnit = Math.max(0, Number(raw) || 0);
    const issuedInBase = isBulkUnit ? issuedInReqUnit * packSize : issuedInReqUnit;
    const reqQtyInBase = isBulkUnit ? it.qty * packSize : it.qty;

    const issued = Math.max(0, Math.min(issuedInBase, avail, reqQtyInBase));
    const delta = issued - (isBulkUnit ? prevIssued * packSize : prevIssued);

    plan.push({ it, stockItem, delta, issued, issuedDisplay: raw });
    totalReq += reqQtyInBase;
    totalIssued += issued;
  }

  // Phase 2: apply all stock deductions — if any fails, none are applied.
  for (const entry of plan) {
    if (entry.delta > 0 && entry.stockItem) {
      entry.stockItem.qty = Math.max(0, entry.stockItem.qty - entry.delta);
      await entry.stockItem.save();
    }
    entry.it.issuedQty = entry.issuedDisplay;
    if (entry.stockItem && !entry.it.cost) {
      entry.it.cost = entry.stockItem.cost || entry.stockItem.price || 0;
    }
  }

  row.status = totalIssued >= totalReq ? 'Full' : totalIssued > 0 ? 'Partial' : 'Pending';
  await row.save();
  res.json({ success: true, data: row });
});

exports.rejectRequisition = asyncHandler(async (req, res) => {
  const row = await Requisition.findOneAndUpdate(
    { requisitionNo: req.params.no },
    { $set: { status: 'Rejected', rejectReason: req.body.reason.trim() } },
    { new: true }
  );
  if (!row) throw new ApiError(404, `Requisition ${req.params.no} not found.`);
  res.json({ success: true, data: row });
});

exports.confirmReceipt = asyncHandler(async (req, res) => {
  const row = await Requisition.findOne({ requisitionNo: req.params.no });
  if (!row) throw new ApiError(404, `Requisition ${req.params.no} not found.`);
  if (row.status !== 'Full' && row.status !== 'Partial') {
    throw new ApiError(400, 'Only a Full or Partial requisition can be confirmed received.');
  }
  row.status = 'Completed';
  await row.save();
  res.json({ success: true, data: row });
});

exports.disputeDelivery = asyncHandler(async (req, res) => {
  const row = await Requisition.findOne({ requisitionNo: req.params.no });
  if (!row) throw new ApiError(404, `Requisition ${req.params.no} not found.`);
  if (row.status !== 'Full' && row.status !== 'Partial') {
    throw new ApiError(400, 'Only a Full or Partial requisition can be disputed.');
  }
  row.status = 'Disputed';
  row.disputeReason = req.body.reason.trim();
  await row.save();
  res.json({ success: true, data: row });
});

exports.receiveStock = asyncHandler(async (req, res) => {
  const { qty, cost, packSize, baseUnit, unit } = req.body;
  const addQty = Number(qty) || 0;
  if (addQty <= 0) throw new ApiError(400, 'qty must be a positive number');
  const updates = { $inc: { qty: addQty } };
  if (Number(cost) > 0) updates.$set = { cost: Number(cost) };
  if (packSize) updates.$set = { ...updates.$set, packSize: Number(packSize) };
  if (baseUnit) updates.$set = { ...updates.$set, baseUnit: baseUnit.trim() };
  if (unit) updates.$set = { ...updates.$set, unit: unit.trim() };
  const item = await StoreStock.findOneAndUpdate({ id: req.params.id }, updates, { new: true });
  if (!item) throw new ApiError(404, 'Stock item not found.');
  res.json({ success: true, data: item });
});

exports._internal = { peekNumber, nextNumber, findStockFuzzy, actorName };