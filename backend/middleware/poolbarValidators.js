/**
 * Pool Bar Module — Request Validators
 * Plain middleware, no external validation lib, matching the style
 * of kitchenValidators.js / sanitize.js / roleGuard.js.
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

/* ── Stock ── */

exports.validateAddStock = (req, res, next) => {
  const { name, unit, cat, category, qty, min, price, cost } = req.body;

  if (!isNonEmptyString(name)) return fail(res, 'Item name is required', 'name');
  if (name.trim().length > 120) return fail(res, 'Item name is too long (max 120 chars)', 'name');

  if (unit !== undefined && (!isNonEmptyString(unit) || unit.trim().length > 40)) {
    return fail(res, 'unit must be a non-empty string (max 40 chars)', 'unit');
  }
  const finalCat = cat || category;
  if (finalCat !== undefined && (!isNonEmptyString(finalCat) || finalCat.trim().length > 60)) {
    return fail(res, 'category must be a non-empty string (max 60 chars)', 'category');
  }

  if (qty !== undefined && !isNonNegativeNumber(qty)) return fail(res, 'qty must be a number >= 0', 'qty');
  if (min !== undefined && !isNonNegativeNumber(min)) return fail(res, 'min must be a number >= 0', 'min');

  const finalPrice = price !== undefined ? price : cost;
  if (finalPrice !== undefined && !isNonNegativeNumber(finalPrice)) {
    return fail(res, 'price/cost must be a number >= 0', 'price');
  }

  next();
};

exports.validateUpdateStock = (req, res, next) => {
  const { name, unit, cat, category, qty, min, price, cost } = req.body;

  if (name !== undefined && !isNonEmptyString(name)) return fail(res, 'name cannot be empty', 'name');
  if (unit !== undefined && (!isNonEmptyString(unit) || unit.trim().length > 40)) {
    return fail(res, 'unit must be a non-empty string (max 40 chars)', 'unit');
  }
  const finalCat = cat || category;
  if (finalCat !== undefined && (!isNonEmptyString(finalCat) || finalCat.trim().length > 60)) {
    return fail(res, 'category must be a non-empty string (max 60 chars)', 'category');
  }
  if (qty !== undefined && !isNonNegativeNumber(qty)) return fail(res, 'qty must be a number >= 0', 'qty');
  if (min !== undefined && !isNonNegativeNumber(min)) return fail(res, 'min must be a number >= 0', 'min');
  const finalPrice = price !== undefined ? price : cost;
  if (finalPrice !== undefined && !isNonNegativeNumber(finalPrice)) {
    return fail(res, 'price/cost must be a number >= 0', 'price');
  }

  next();
};

exports.validateDeductStock = (req, res, next) => {
  const { name, qty } = req.body;
  if (!isNonEmptyString(name)) return fail(res, 'Item name is required', 'name');
  if (!isPositiveNumber(qty)) return fail(res, 'qty must be a number > 0', 'qty');
  next();
};

/* ── Sales ── */

exports.validateCreateSale = (req, res, next) => {
  const { items, method, staff, total } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'items must be a non-empty array', 'items');
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object') return fail(res, `items[${i}] must be an object`, 'items');
    if (!isNonEmptyString(it.name)) return fail(res, `items[${i}].name is required`, 'items');
    if (!isPositiveNumber(it.qty)) return fail(res, `items[${i}].qty must be > 0`, 'items');
    if (!isPositiveNumber(it.price)) return fail(res, `items[${i}].price must be > 0`, 'items');
  }

  if (!isNonEmptyString(method)) return fail(res, 'payment method is required', 'method');
  if (!isNonEmptyString(staff)) return fail(res, 'staff name is required', 'staff');

  if (total !== undefined && !isNonNegativeNumber(total)) {
    return fail(res, 'total must be a number >= 0', 'total');
  }

  next();
};

exports.validateVoidSale = (req, res, next) => {
  const { reason } = req.body;
  if (!isNonEmptyString(reason)) return fail(res, 'reason is required to void a sale', 'reason');
  next();
};

/* ── Orders / Tabs ── */

exports.validateOpenOrder = (req, res, next) => {
  const { items, staff } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'items must be a non-empty array', 'items');
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object') return fail(res, `items[${i}] must be an object`, 'items');
    if (!isNonEmptyString(it.name)) return fail(res, `items[${i}].name is required`, 'items');
    if (!isPositiveNumber(it.qty)) return fail(res, `items[${i}].qty must be > 0`, 'items');
    if (!isPositiveNumber(it.price)) return fail(res, `items[${i}].price must be > 0`, 'items');
  }
  if (!isNonEmptyString(staff)) return fail(res, 'staff name is required', 'staff');

  next();
};

exports.validateCancelOrder = (req, res, next) => {
  const { reason } = req.body;
  if (reason !== undefined && !isNonEmptyString(reason)) {
    return fail(res, 'reason cannot be empty', 'reason');
  }
  next();
};

/* ── Requisitions ── */

exports.validateCreateRequisition = (req, res, next) => {
  const { items, requester, dept } = req.body;

  if (!isNonEmptyString(requester)) return fail(res, 'requester is required', 'requester');
  if (!isNonEmptyString(dept)) return fail(res, 'dept is required', 'dept');

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'items must be a non-empty array', 'items');
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object') return fail(res, `items[${i}] must be an object`, 'items');
    if (!isNonEmptyString(it.name)) return fail(res, `items[${i}].name is required`, 'items');
    if (it.qty !== undefined && !isPositiveNumber(it.qty)) {
      return fail(res, `items[${i}].qty must be > 0`, 'items');
    }
  }

  next();
};

/* ── Deduct (via ID param) ── */

exports.validateDeductById = (req, res, next) => {
  const { qty } = req.body;
  if (!isPositiveNumber(qty)) return fail(res, 'qty must be a number > 0', 'qty');
  next();
};

/* ── Shared: :id param ── */

exports.validateObjectIdParam = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!isNonEmptyString(id)) return fail(res, `${paramName} param is required`, paramName);
  next();
};

exports.validateStrictObjectIdParam = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!isValidObjectId(id)) return fail(res, `${paramName} must be a valid id`, paramName);
  next();
};
