/**
 * Procurement Module — Request Validators
 * Plain middleware, no external validation lib, matching the style of
 * kitchenValidators.js / sanitize.js / roleGuard.js. Run AFTER sanitize.js
 * in the chain so fields are already trimmed/stripped when these checks run.
 *
 * Each validator responds 400 directly and stops the chain on failure,
 * mirroring the { success:false, error } shape used across controllers.
 */

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

function validateItemsArray(res, items, { required }) {
  if (items === undefined) {
    return required ? fail(res, 'items is required', 'items') : null;
  }
  if (!Array.isArray(items) || (required && items.length === 0)) {
    return fail(res, 'items must be a non-empty array', 'items');
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object') return fail(res, `items[${i}] must be an object`, 'items');
    if (!isNonEmptyString(it.name)) return fail(res, `items[${i}].name is required`, 'items');
    if (!isPositiveNumber(it.qty)) return fail(res, `items[${i}].qty must be a number > 0`, 'items');
    if (it.cost !== undefined && it.cost !== null && it.cost !== '' && !isNonNegativeNumber(it.cost)) {
      return fail(res, `items[${i}].cost must be a number >= 0`, 'items');
    }
  }
  return null;
}

/* ── Purchase Requests / Orders ── */

exports.validateCreatePR = (req, res, next) => {
  const { dept, priority, needed } = req.body;

  if (dept !== undefined && !isNonEmptyString(dept)) return fail(res, 'dept cannot be empty', 'dept');
  if (priority !== undefined && !['Normal', 'Urgent'].includes(priority)) {
    return fail(res, "priority must be 'Normal' or 'Urgent'", 'priority');
  }
  if (needed !== undefined && !isNonEmptyString(needed)) return fail(res, 'needed cannot be empty', 'needed');

  const itemsErr = validateItemsArray(res, req.body.items, { required: true });
  if (itemsErr) return itemsErr;

  next();
};

exports.validateUpdatePR = (req, res, next) => {
  const { priority, dept } = req.body;

  if (dept !== undefined && !isNonEmptyString(dept)) return fail(res, 'dept cannot be empty', 'dept');
  if (priority !== undefined && !['Normal', 'Urgent'].includes(priority)) {
    return fail(res, "priority must be 'Normal' or 'Urgent'", 'priority');
  }

  const itemsErr = validateItemsArray(res, req.body.items, { required: false });
  if (itemsErr) return itemsErr;

  next();
};

exports.validateReject = (req, res, next) => {
  const { note, reason } = req.body;
  if (!isNonEmptyString(note) && !isNonEmptyString(reason)) {
    return fail(res, 'A rejection reason is required', 'note');
  }
  next();
};

exports.validateApprove = (req, res, next) => {
  const { note } = req.body;
  if (note !== undefined && typeof note !== 'string') return fail(res, 'note must be a string', 'note');
  next();
};

exports.validateCreatePO = (req, res, next) => {
  const { poNo, supplier } = req.body;
  if (!isNonEmptyString(poNo)) return fail(res, 'PO number is required', 'poNo');
  if (!isNonEmptyString(supplier)) return fail(res, 'Supplier is required', 'supplier');
  next();
};

exports.validateVoidAndCorrect = (req, res, next) => {
  const { items, reason } = req.body;
  if (!isNonEmptyString(reason)) return fail(res, 'A reason for voiding is required', 'reason');
  const itemsErr = validateItemsArray(res, items, { required: true });
  if (itemsErr) return itemsErr;
  next();
};

/* ── Suppliers ── */

exports.validateCreateSupplier = (req, res, next) => {
  const { name, email, rating } = req.body;
  if (!isNonEmptyString(name)) return fail(res, 'Supplier name is required', 'name');
  if (email !== undefined && email !== '' && typeof email !== 'string') return fail(res, 'email must be a string', 'email');
  if (rating !== undefined && rating !== null && rating !== '') {
    const n = Number(rating);
    if (Number.isNaN(n) || n < 0 || n > 5) return fail(res, 'rating must be a number between 0 and 5', 'rating');
  }
  next();
};

exports.validateUpdateSupplier = (req, res, next) => {
  const { name, email, rating } = req.body;
  if (name !== undefined && !isNonEmptyString(name)) return fail(res, 'name cannot be empty', 'name');
  if (email !== undefined && email !== '' && typeof email !== 'string') return fail(res, 'email must be a string', 'email');
  if (rating !== undefined && rating !== null && rating !== '') {
    const n = Number(rating);
    if (Number.isNaN(n) || n < 0 || n > 5) return fail(res, 'rating must be a number between 0 and 5', 'rating');
  }
  next();
};

/* ── Categories ── */

exports.validateCategoryName = (req, res, next) => {
  const { name } = req.body;
  if (!isNonEmptyString(name)) return fail(res, 'Category name is required', 'name');
  next();
};

/* ── Shared: :id param ── */

exports.validateObjectIdParam = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!isValidObjectId(id)) return fail(res, `${paramName} must be a valid id`, paramName);
  next();
};

// Loose variant — used for the Store requisition number (:no), which is
// a human-readable code like 'PR-2025-00046', not a Mongo ObjectId.
exports.validateStringParam = (paramName) => (req, res, next) => {
  const val = req.params[paramName];
  if (!isNonEmptyString(val)) return fail(res, `${paramName} param is required`, paramName);
  next();
};

exports.isValidObjectId = isValidObjectId;