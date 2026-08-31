const PurchaseRequest = require('../models/PurchaseRequest');
const Requisition = require('../models/Requisition');
const Supplier = require('../models/Supplier');
const ProcurementCategory = require('../models/ProcurementCategory');
const Config = require('../models/Config');
const mongoose = require('mongoose');
const { ApiError } = require('../middleware/errorHandler');
const { ROLES, STAGE_APPROVER_ROLE } = require('../middleware/procurementRoles');

const PIPELINE_STAGES = ['pending', 'accountant', 'gm', 'md', 'sent_to_store', 'fulfilled'];
const ACTIVE_STAGES = ['pending', 'accountant', 'gm', 'md', 'sent_to_store'];

async function getMDThreshold() {
  const cfg = await Config.findOne().sort({ createdAt: -1 });
  return (cfg && cfg.mdApprovalThreshold) || 100000;
}

function actorName(req) {
  return (req.user && (req.user.name || req.user.role)) || 'User';
}
/**
 * Enforces STAGE_APPROVER_ROLE for the stage a PR is CURRENTLY at —
 * called from approvePR/rejectPR. roleGuard(CAN_APPROVE) at the route
 * level only confirms the caller is SOME kind of approver; this is what
 * actually checks they're the RIGHT one for this specific stage. Admin
 * always passes, matching roleGuard.js's own bypass rule.
 */
function assertCanActOnStage(req, stage) {
  const role = (req.user && req.user.role || '').toLowerCase();
  if (role === ROLES.ADMIN) return;
  const required = STAGE_APPROVER_ROLE[stage];
  if (required && role !== required) {
    throw new ApiError(403, `Only ${required} can act on a request at the '${stage}' stage`);
  }
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function computeItemsTotal(items) {
  return (items || []).reduce((sum, i) => {
    const qty = Number(i.qty) || 0;
    const price = i.price != null ? Number(i.price) : Number(i.cost) || 0;
    const subtotal = i.subtotal != null ? Number(i.subtotal) : qty * price;
    return sum + (isNaN(subtotal) ? 0 : subtotal);
  }, 0);
}
async function nextPurchaseOrderNumbers() {
  const n = (await PurchaseRequest.countDocuments()) + 1;
  const year = new Date().getFullYear();
  const seq = String(n).padStart(3, '0');
  return { prNo: `PR-${year}-${seq}`, poNo: `PO-${year}-${seq}` };
}

/* ── Purchase Requests ── */

exports.listPRs = async (req, res, next) => {
  try {
    const prs = await PurchaseRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: prs });
  } catch (err) { next(err); }
};

exports.getPR = async (req, res, next) => {
  try {
    const id = req.params.id;
    let pr = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      pr = await PurchaseRequest.findById(id);
    }
    if (!pr) pr = await PurchaseRequest.findOne({ id });
    if (!pr) pr = await PurchaseRequest.findOne({ prNo: id }).orFail().catch(() => null);
    if (!pr) pr = await PurchaseRequest.findOne({ poNo: id }).orFail().catch(() => null);
    if (!pr) return next(new ApiError(404, 'Purchase request not found'));
    res.json({ success: true, data: pr });
  } catch (err) { next(err); }
};

exports.listPOs = async (req, res, next) => {
  try {
    const pos = await PurchaseRequest.find({ poNo: { $ne: '' } }).sort({ createdAt: -1 });
    res.json({ success: true, data: pos });
  } catch (err) { next(err); }
};

/**
 * Create a purchase request/order — same computation as
 * ProcurementService.createPurchaseOrder() on the frontend: assigns
 * sequential PR/PO numbers (unless already supplied), computes
 * totalAmount + needsMDApproval from items, derives the `item` summary
 * string, and seeds history.
 */
exports.createPR = async (req, res, next) => {
  try {
    const body = req.body;
    const items = body.items || [];
    const totalAmount = computeItemsTotal(items);
    const threshold = await getMDThreshold();
    const needsMDApproval = totalAmount > threshold;
    const nums = await nextPurchaseOrderNumbers();
    const by = body.by || actorName(req);
    const source = body.source === 'Store' ? 'Store' : 'Procurement';

    const pr = await PurchaseRequest.create({
      prNo: body.prNo || nums.prNo,
      poNo: body.poNo || nums.poNo,
      item: items.map((i) => i.name).join(', ') || body.item || '',
      cat: body.cat || 'General',
      dept: body.dept || '',
      source,
      storeReqNo: body.storeReqNo || '',
      by,
      date: body.date ? new Date(body.date) : new Date(),
      needed: body.needed || '',
      qty: body.qty != null ? Number(body.qty) : 1,
      unit: body.unit || 'Units',
      unitCost: body.unitCost != null ? Number(body.unitCost) : 0,
      priority: body.priority || 'Normal',
      totalAmount,
      needsMDApproval,
      status: 'pending',
      approvalStage: 'pending',
      supplier: body.supplier || '',
      notes: body.notes || '',
      items,
      history: [{
        date: todayISO(),
        action: source === 'Store' ? 'Imported from Store request' : 'Request submitted',
        by,
        note: body.storeReqNo ? `Originally raised as ${body.storeReqNo}` : '',
        stage: 'pending',
      }],
    });

    res.status(201).json({ success: true, data: pr });
  } catch (err) { next(err); }
};

/**
 * Edit an existing PR/PO — recomputes totalAmount and needsMDApproval
 * from the (possibly changed) items list, matching
 * ProcurementService.updatePurchaseOrder(). Fields not present on the
 * body are left untouched.
 */
exports.updatePR = async (req, res, next) => {
  try {
    const pr = await PurchaseRequest.findOne({ id: req.params.id });
    if (!pr) return next(new ApiError(404, 'Purchase request not found'));

    const body = req.body;
    const items = body.items !== undefined ? body.items : pr.items;
    const totalAmount = computeItemsTotal(items);
    const threshold = await getMDThreshold();
    const needsMDApproval = totalAmount > threshold;

    const updatable = ['dept', 'priority', 'supplier', 'notes', 'needed', 'unit', 'unitCost', 'qty', 'approvalStage', 'status', 'rejectReason'];
    updatable.forEach((k) => { if (body[k] !== undefined) pr[k] = body[k]; });
    if (body.history !== undefined) pr.history = body.history;

    pr.items = items;
    pr.totalAmount = totalAmount;
    pr.needsMDApproval = needsMDApproval;
    if (items.length) pr.item = items.map((i) => i.name).join(', ');

    await pr.save();
    res.json({ success: true, data: pr });
  } catch (err) { next(err); }
};

/**
 * Advance one stage: pending -> accountant -> gm -> (md if
 * totalAmount > ₦100,000, else approved) -> approved. Same state
 * machine as ProcurementService.approvePR() on the frontend — every
 * approver just calls this, and the stage they were approving FROM
 * determines what happens, rather than the backend hard-checking the
 * caller's specific role against the specific stage.
 */
exports.approvePR = async (req, res, next) => {
  try {
    const pr = await PurchaseRequest.findOne({ id: req.params.id });
    if (!pr) return next(new ApiError(404, 'Purchase request not found'));
    assertCanActOnStage(req, pr.approvalStage);

    let nextStage, action;
    switch (pr.approvalStage) {
      case 'pending':
        nextStage = 'accountant'; action = 'Accountant approved'; break;
      case 'accountant':
        nextStage = 'gm'; action = 'GM approved'; break;
      case 'gm':
        if (pr.totalAmount > await getMDThreshold()) {
          nextStage = 'md'; action = 'Forwarded to MD';
        } else {
          nextStage = 'sent_to_store'; action = 'Fully approved — sent to Store';
        }
        break;
      case 'md':
        nextStage = 'sent_to_store'; action = 'MD approved — sent to Store'; break;
      default:
        return next(new ApiError(400, `Cannot approve from stage: ${pr.approvalStage}`));
    }

    pr.approvalStage = nextStage;
    pr.status = nextStage;
    pr.history.push({
      date: todayISO(), action, by: actorName(req),
      note: req.body.note || '', stage: nextStage,
    });
    await pr.save();
    res.json({ success: true, data: pr });
  } catch (err) { next(err); }
};

exports.rejectPR = async (req, res, next) => {
  try {
    const pr = await PurchaseRequest.findOne({ id: req.params.id });
    if (!pr) return next(new ApiError(404, 'Purchase request not found'));
    assertCanActOnStage(req, pr.approvalStage);

    const note = req.body.note || req.body.reason;
    pr.status = 'rejected';
    pr.approvalStage = 'rejected';
    pr.history.push({ date: todayISO(), action: 'Rejected', by: actorName(req), note, stage: 'rejected' });
    await pr.save();
    res.json({ success: true, data: pr });
  } catch (err) { next(err); }
};

/**
 * Issue a PO against an already-fully-approved PR — same guard as
 * ProcurementService.createPO(): refuses unless approvalStage==='approved'.
 */
exports.createPO = async (req, res, next) => {
  try {
    const pr = await PurchaseRequest.findOne({ id: req.params.id });
    if (!pr) return next(new ApiError(404, 'Purchase request not found'));
    if (pr.approvalStage !== 'approved') {
      return next(new ApiError(400, 'PR must be fully approved before creating a PO'));
    }

    pr.status = 'fulfilled';
    pr.approvalStage = 'fulfilled';
    pr.poNo = req.body.poNo.trim();
    pr.supplier = req.body.supplier.trim();
    pr.history.push({
      date: todayISO(), action: 'PO Created', by: actorName(req),
      note: `PO ${pr.poNo} issued to ${pr.supplier}`, stage: 'fulfilled',
    });
    await pr.save();
    res.json({ success: true, data: pr });
  } catch (err) { next(err); }
};

/**
 * Void & Correct — marks a fulfilled PO as voided (with reason), then
 * raises a NEW corrected PR that skips the approval chain and goes
 * straight to 'sent_to_store'. Both records are cross-linked:
 *   original.voidedIntoPrId  → corrected._id
 *   corrected.correctionOfPrId → original._id
 *
 * Only legal when the source PO is at 'fulfilled' stage (Store already
 * accepted it, but the actual purchase came back short/different).
 */
exports.voidAndCorrectPO = async (req, res, next) => {
  try {
    const pr = await PurchaseRequest.findOne({ id: req.params.id });
    if (!pr) return next(new ApiError(404, 'Purchase request not found'));
    if (pr.approvalStage !== 'fulfilled') {
      return next(new ApiError(400, 'Only fulfilled POs can be voided and corrected'));
    }

    const { items, reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return next(new ApiError(400, 'A reason for voiding is required'));
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new ApiError(400, 'Corrected items are required'));
    }

    const by = actorName(req);

    // 1) Mark the original as voided
    pr.approvalStage = 'voided';
    pr.status = 'voided';
    pr.voidReason = String(reason).trim();
    pr.history.push({
      date: todayISO(),
      action: 'PO Voided — correcting',
      by,
      note: String(reason).trim(),
      stage: 'voided',
    });
    await pr.save();

    // 2) Create the corrected PR — same prNo sequence, same dept/supplier,
    //    but with the actual received items and amounts. Goes straight to
    //    'sent_to_store' (skips the approval chain).
    const totalAmount = computeItemsTotal(items);
    const nums = await nextPurchaseOrderNumbers();
    const corrected = await PurchaseRequest.create({
      prNo: nums.prNo,
      poNo: pr.poNo || '',
      item: items.map((i) => i.name).join(', '),
      cat: pr.cat || 'General',
      dept: pr.dept || '',
      source: pr.source || 'Procurement',
      storeReqNo: pr.storeReqNo || '',
      by,
      date: new Date(),
      needed: pr.needed || '',
      qty: items.length,
      unit: pr.unit || 'Units',
      unitCost: 0,
      priority: pr.priority || 'Normal',
      totalAmount,
      needsMDApproval: false,
      status: 'sent_to_store',
      approvalStage: 'sent_to_store',
      supplier: pr.supplier || '',
      notes: `Corrected from ${pr.prNo}. ${String(reason).trim()}`,
      items,
      correctionOfPrId: String(pr._id),
      history: [
        {
          date: todayISO(),
          action: 'Corrected PO raised — sent to Store',
          by,
          note: `Corrected from ${pr.prNo}. ${String(reason).trim()}`,
          stage: 'sent_to_store',
        },
      ],
    });

    // 3) Cross-link: stamp the corrected PR's _id back onto the original
    pr.voidedIntoPrId = String(corrected._id);
    await pr.save();

    res.json({ success: true, data: { original: pr, corrected } });
  } catch (err) { next(err); }
};

/**
 * Item-name + last-cost suggestions for the po-form.html entry-row
 * autocomplete — derived fresh from every item ever purchased, same as
 * ProcurementService.getItemCatalog(). No separate cache collection.
 */
exports.getItemCatalog = async (req, res, next) => {
  try {
    const StoreStock = require('../models/StoreStock');
    const stockItems = await StoreStock.find({}, { name: 1, unit: 1, baseUnit: 1, packSize: 1, qty: 1, cost: 1 });

    const seen = new Map();

    // Only show items that currently exist in Store stock
    (stockItems || []).forEach((s) => {
      const key = (s.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.set(key, { name: (s.name || '').trim(), unit: s.unit || '', baseUnit: s.baseUnit || '', packSize: s.packSize || 0, price: s.cost || 0, stockQty: s.qty || 0, stockId: s.id || s._id.toString() });
    });

    res.json({ success: true, data: Array.from(seen.values()) });
  } catch (err) { next(err); }
};

/* ── Suppliers ──
   Schema uses `category`/`contactPerson`; older frontend calls sent
   `cat`/`contact` — accepted as fallbacks here so either naming works. */

exports.listSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json({ success: true, data: suppliers });
  } catch (err) { next(err); }
};

exports.getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return next(new ApiError(404, 'Supplier not found'));
    res.json({ success: true, data: supplier });
  } catch (err) { next(err); }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const body = req.body;
    const name = body.name.trim();
    const exists = await Supplier.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (exists) return next(new ApiError(409, 'A supplier with that name already exists'));

    const supplier = await Supplier.create({
      name,
      category: body.category || body.cat || 'General',
      contactPerson: body.contactPerson || body.contact || '',
      phone: body.phone || '',
      email: body.email || '',
      rating: body.rating != null ? Number(body.rating) : 0,
    });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) { next(err); }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return next(new ApiError(404, 'Supplier not found'));

    const body = req.body;
    if (body.name !== undefined) {
      const name = body.name.trim();
      const dup = await Supplier.findOne({ _id: { $ne: supplier._id }, name: new RegExp(`^${name}$`, 'i') });
      if (dup) return next(new ApiError(409, 'A supplier with that name already exists'));
      supplier.name = name;
    }
    if (body.category !== undefined || body.cat !== undefined) supplier.category = body.category || body.cat;
    if (body.contactPerson !== undefined || body.contact !== undefined) supplier.contactPerson = body.contactPerson || body.contact;
    if (body.phone !== undefined) supplier.phone = body.phone;
    if (body.email !== undefined) supplier.email = body.email;
    if (body.rating !== undefined) supplier.rating = Number(body.rating);

    await supplier.save();
    res.json({ success: true, data: supplier });
  } catch (err) { next(err); }
};

/* ── Categories ──
   Independently persisted (see ProcurementCategory.js docblock) — NOT
   derived from Supplier.category on the fly. */

exports.listCategories = async (req, res, next) => {
  try {
    const cats = await ProcurementCategory.find().sort({ name: 1 });
    res.json({ success: true, data: cats.map((c) => c.name) });
  } catch (err) { next(err); }
};

exports.addCategory = async (req, res, next) => {
  try {
    const name = req.body.name.trim();
    const exists = await ProcurementCategory.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (exists) return next(new ApiError(409, `Category "${name}" already exists`));
    await ProcurementCategory.create({ name });
    res.status(201).json({ success: true, data: name });
  } catch (err) { next(err); }
};

exports.renameCategory = async (req, res, next) => {
  try {
    const oldName = req.params.name;
    const newName = req.body.name.trim();
    const cat = await ProcurementCategory.findOne({ name: oldName });
    if (!cat) return next(new ApiError(404, `Category "${oldName}" not found`));

    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      const dup = await ProcurementCategory.findOne({ name: new RegExp(`^${newName}$`, 'i') });
      if (dup) return next(new ApiError(409, `Category "${newName}" already exists`));
    }
    cat.name = newName;
    await cat.save();
    await Supplier.updateMany({ category: oldName }, { $set: { category: newName } });
    res.json({ success: true, data: newName });
  } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const name = req.params.name;
    const reassignTo = (req.body.reassignTo || 'Other').trim() || 'Other';
    const cat = await ProcurementCategory.findOne({ name });
    if (!cat) return next(new ApiError(404, `Category "${name}" not found`));

    await cat.deleteOne();
    const reassignExists = await ProcurementCategory.findOne({ name: new RegExp(`^${reassignTo}$`, 'i') });
    if (!reassignExists) await ProcurementCategory.create({ name: reassignTo });
    await Supplier.updateMany({ category: name }, { $set: { category: reassignTo } });
    res.json({ success: true, data: { deleted: name, reassignedTo: reassignTo } });
  } catch (err) { next(err); }
};

/* ── Store → Procurement bridge ──
   Requisition (mode:'purchase') is the backend equivalent of Kitchen's
   incoming-requisitions read — same cross-module idea, just against the
   real DB instead of shared key/value storage. */

exports.listIncomingStoreRequests = async (req, res, next) => {
  try {
    const reqs = await Requisition.find({
      mode: 'purchase',
      procurementPrId: null,
      status: { $ne: 'Rejected' },
    }).sort({ dateRaised: -1 });
    res.json({ success: true, data: reqs });
  } catch (err) { next(err); }
};

/**
 * Pulls one Store purchase-mode requisition into Procurement as a
 * normal 'pending'-stage PR (source:'Store'), then stamps
 * procurementPrId/procurementPrNo back onto the Requisition so it can't
 * be imported twice. Item unit costs come across as whatever Store had
 * (usually 0 — Store doesn't price purchase requests); Procurement is
 * expected to price them via PUT /procurement/purchase-orders/:id
 * before approving.
 */
exports.importStoreRequest = async (req, res, next) => {
  try {
    const requisition = await Requisition.findOne({ requisitionNo: req.params.no });
    if (!requisition) return next(new ApiError(404, `Store request ${req.params.no} not found`));
    if (requisition.mode !== 'purchase') return next(new ApiError(400, `${req.params.no} is not a purchase request`));
    if (requisition.procurementPrId) return next(new ApiError(409, `${req.params.no} has already been imported`));

    const items = (requisition.items || []).map((it) => ({
      name: it.name, qty: it.qty, unit: it.unit || 'unit', cost: it.cost || 0, packSize: it.packSize || 0, baseUnit: it.baseUnit || '',
    }));
    const totalAmount = computeItemsTotal(items);
    const nums = await nextPurchaseOrderNumbers();
    const by = requisition.requester || 'Store';

    const pr = await PurchaseRequest.create({
      prNo: nums.prNo,
      item: items.map((i) => i.name).join(', '),
      cat: 'General',
      dept: requisition.dept || 'Store',
      source: 'Store',
      storeReqNo: requisition.requisitionNo,
      by,
      date: new Date(),
      needed: requisition.neededBy || '',
      qty: items.length,
      unit: 'Units',
      unitCost: 0,
      priority: requisition.priority || 'Normal',
      totalAmount,
      needsMDApproval: totalAmount > await getMDThreshold(),
      status: 'pending',
      approvalStage: 'pending',
      supplier: requisition.supplier || '',
      notes: requisition.remark || '',
      items,
      history: [{
        date: todayISO(),
        action: 'Imported from Store request',
        by,
        note: `Originally raised as ${requisition.requisitionNo}`,
        stage: 'pending',
      }],
    });

    requisition.procurementPrId = pr._id;
    requisition.procurementPrNo = pr.prNo;
    await requisition.save();

    res.status(201).json({ success: true, data: pr });
  } catch (err) { next(err); }
};

/* ── Dashboard aggregates ── */

exports.dashboardKPIs = async (req, res, next) => {
  try {
    const prs = await PurchaseRequest.find();
    const pending = prs.filter((p) => ACTIVE_STAGES.includes(p.approvalStage)).length;
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const closedThisMonth = prs.filter((p) =>
      (p.approvalStage === 'approved' || p.approvalStage === 'fulfilled') &&
      new Date(p.date).toISOString().startsWith(monthPrefix));
    const needsMD = prs.filter((p) => p.needsMDApproval && ACTIVE_STAGES.includes(p.approvalStage)).length;
    const sentToStore = prs.filter((p) => p.approvalStage === 'sent_to_store').length;

    res.json({
      success: true,
      data: {
        pending,
        approvedThisMonth: closedThisMonth.length,
        spendThisMonth: closedThisMonth.reduce((s, p) => s + (p.totalAmount || 0), 0),
        needsMD,
        sentToStore,
      },
    });
  } catch (err) { next(err); }
};

exports.approvalPipelineCounts = async (req, res, next) => {
  try {
    const prs = await PurchaseRequest.find({}, { approvalStage: 1 });
    const counts = {};
    PIPELINE_STAGES.forEach((stage) => {
      counts[stage] = prs.filter((p) => p.approvalStage === stage).length;
    });
    res.json({ success: true, data: counts });
  } catch (err) { next(err); }
};

exports.deletePR = async (req, res, next) => {
  try {
    const id = req.params.id;
    const pr = await PurchaseRequest.findOne({ id });
    if (!pr) return next(new ApiError(404, 'Purchase order not found'));

    const deletable = ['pending', 'accountant', 'gm', 'md'].includes(pr.approvalStage);
    if (!deletable) {
      return next(new ApiError(400, 'Only pending or in-review purchase orders can be deleted.'));
    }

    await PurchaseRequest.deleteOne({ id });
    res.json({ success: true, data: { id } });
  } catch (err) { next(err); }
};