/**
 * Store Module — Request Validators
 * Plain middleware, no external validation lib — matches the style of
 * restaurantValidators.js / kitchenValidators.js exactly. Run AFTER
 * sanitize.js in the chain so fields are already trimmed/stripped when
 * these checks run.
 *
 * Each validator responds 400 directly and stops the chain on failure,
 * mirroring the { success:false, error } shape used across controllers.
 *
 * Mirrors services/store-service.js on the frontend:
 *  - Stock: { name, cat, unit, qty, cost, min }
 *  - Requisitions: mode 'store_issue' (any dept -> Store) | 'purchase'
 *    (Store -> Procurement), status Pending/Partial/Full/Rejected/
 *    Completed/Disputed, items: [{ name, unit, qty, cost, remark, issuedQty }]
 */

const REQ_MODES = ['store_issue', 'purchase'];
const REQ_PRIORITIES = ['Normal', 'Urgent'];

function fail(res, msg, field) {
  return res.status(400).json({ success: false, error: msg, field: field || null });
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPositiveNumber(v) {
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && !Number.isNaN(n) && n > 0;
}

function isNonNegativeNumber(v) {
  const n = Number(v);
  return !Number.isNaN(n) && n >= 0;
}

function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

/* ── Stock ── */

exports.validateAddStock = (req, res, next) => {
  const { name, cat, category, unit, min, cost, price } = req.body;

  if (!isNonEmptyString(name)) return fail(res, 'Item name is required', 'name');
  if (name.trim().length > 120) return fail(res, 'Item name is too long (max 120 chars)', 'name');

  const catVal = cat !== undefined ? cat : category;
  if (catVal !== undefined && (!isNonEmptyString(catVal) || catVal.trim().length > 60)) {
    return fail(res, 'cat must be a non-empty string (max 60 chars)', 'cat');
  }
  if (unit !== undefined && (!isNonEmptyString(unit) || unit.trim().length > 40)) {
    return fail(res, 'unit must be a non-empty string (max 40 chars)', 'unit');
  }
  if (min !== undefined && !isNonNegativeNumber(min)) return fail(res, 'min must be a number >= 0', 'min');

  const costVal = cost !== undefined ? cost : price;
  if (costVal !== undefined && !isNonNegativeNumber(costVal)) return fail(res, 'cost must be a number >= 0', 'cost');

  next();
};

// Matches the frontend contract: qty is never edited directly on the
// Add/Edit Item form — it's only ever changed by issuing a requisition
// (approveAndIssue) or a goods receipt. Reject it here rather than
// silently ignoring it, same as restaurantValidators.validateUpdateStock.
exports.validateUpdateStock = (req, res, next) => {
  const { qty, cat, category, unit, min, cost, price } = req.body;

  if (qty !== undefined) return fail(res, 'qty cannot be edited directly — it is set by issuing requisitions or goods receipts', 'qty');

  const catVal = cat !== undefined ? cat : category;
  if (catVal !== undefined && (!isNonEmptyString(catVal) || catVal.trim().length > 60)) {
    return fail(res, 'cat must be a non-empty string (max 60 chars)', 'cat');
  }
  if (unit !== undefined && (!isNonEmptyString(unit) || unit.trim().length > 40)) {
    return fail(res, 'unit must be a non-empty string (max 40 chars)', 'unit');
  }
  if (min !== undefined && !isNonNegativeNumber(min)) return fail(res, 'min must be a number >= 0', 'min');

  const costVal = cost !== undefined ? cost : price;
  if (costVal !== undefined && !isNonNegativeNumber(costVal)) return fail(res, 'cost must be a number >= 0', 'cost');

  next();
};

/* ── Categories ── */

exports.validateAddCategory = (req, res, next) => {
  const { name } = req.body;
  if (!isNonEmptyString(name)) return fail(res, 'Category name is required', 'name');
  if (name.trim().length > 60) return fail(res, 'Category name is too long (max 60 chars)', 'name');
  next();
};

exports.validateRenameCategory = (req, res, next) => {
  const { name } = req.body;
  if (!isNonEmptyString(name)) return fail(res, 'New category name is required', 'name');
  if (name.trim().length > 60) return fail(res, 'Category name is too long (max 60 chars)', 'name');
  next();
};

/* ── Requisitions ── */

function validateItemsArray(res, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'items must be a non-empty array', 'items');
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object') return fail(res, `items[${i}] must be an object`, 'items');
    if (!isNonEmptyString(it.name)) return fail(res, `items[${i}].name is required`, 'items');
    if (!isPositiveNumber(it.qty)) return fail(res, `items[${i}].qty must be a number > 0`, 'items');
    if (it.cost !== undefined && !isNonNegativeNumber(it.cost)) {
      return fail(res, `items[${i}].cost must be a number >= 0`, 'items');
    }
  }
  return null;
}

exports.validateSubmitRequisition = (req, res, next) => {
  const { mode, by, dept, needed, priority, items, supplier } = req.body;

  if (mode !== undefined && !REQ_MODES.includes(mode)) {
    return fail(res, `mode must be one of: ${REQ_MODES.join(', ')}`, 'mode');
  }
  if (!isNonEmptyString(by)) return fail(res, 'by (requester name) is required', 'by');
  if (!isNonEmptyString(dept)) return fail(res, 'dept is required', 'dept');
  if (!isNonEmptyString(needed)) return fail(res, 'needed (needed-by date) is required', 'needed');
  if (priority !== undefined && !REQ_PRIORITIES.includes(priority)) {
    return fail(res, `priority must be one of: ${REQ_PRIORITIES.join(', ')}`, 'priority');
  }
  if (mode === 'purchase' && supplier !== undefined && typeof supplier !== 'string') {
    return fail(res, 'supplier must be a string', 'supplier');
  }

  const itemsErr = validateItemsArray(res, items);
  if (itemsErr) return itemsErr;

  next();
};

// issuedQtyByItem: { "Item Name": issuedQty, ... } — same shape
// approveAndIssue() expects on the frontend.
exports.validateIssueRequisition = (req, res, next) => {
  const { issuedQtyByItem } = req.body;
  if (!issuedQtyByItem || typeof issuedQtyByItem !== 'object' || Array.isArray(issuedQtyByItem)) {
    return fail(res, 'issuedQtyByItem must be an object mapping item name -> issued qty', 'issuedQtyByItem');
  }
  for (const key of Object.keys(issuedQtyByItem)) {
    if (!isNonNegativeNumber(issuedQtyByItem[key])) {
      return fail(res, `issuedQtyByItem["${key}"] must be a number >= 0`, 'issuedQtyByItem');
    }
  }
  next();
};

exports.validateRejectRequisition = (req, res, next) => {
  const { reason } = req.body;
  if (!isNonEmptyString(reason)) return fail(res, 'reason is required to reject a requisition', 'reason');
  next();
};

exports.validateRejectDelivery = (req, res, next) => {
  const { reason } = req.body;
  if (!isNonEmptyString(reason)) return fail(res, 'reason is required to dispute a delivery', 'reason');
  next();
};

/* ── Shared: :id / :name / :no param ── */

// Store stock is looked up by its own generated id (not always a Mongo
// _id in demo data), and requisitions/categories are looked up by their
// human-readable no/name — so only reject if empty/whitespace, same
// looseness restaurantValidators.validateParam uses for name-keyed lookups.
exports.validateParam = (paramName) => (req, res, next) => {
  const val = req.params[paramName];
  if (!isNonEmptyString(val)) return fail(res, `${paramName} param is required`, paramName);
  next();
};

// Strict variant — use only on routes that are guaranteed Mongo _id lookups.
exports.validateStrictObjectIdParam = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!isValidObjectId(id)) return fail(res, `${paramName} must be a valid id`, paramName);
  next();
};

exports.isValidObjectId = isValidObjectId;
exports.REQ_MODES = REQ_MODES;
exports.REQ_PRIORITIES = REQ_PRIORITIES;