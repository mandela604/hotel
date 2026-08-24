/**
 * Restaurant Module — Request Validators
 * Plain middleware, no external validation lib — matches the style of
 * bookingValidation.js / kitchenValidators.js exactly. Run AFTER
 * sanitize.js in the chain so fields are already trimmed/stripped when
 * these checks run.
 *
 * Each validator responds 400 directly and stops the chain on failure,
 * mirroring the { success:false, error } shape used across controllers.
 */

const PAYMENT_METHODS = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];
const SALE_STATUS = ['completed', 'voided'];
const TRANSFER_STATUS = ['sent', 'accepted', 'rejected', 'cancelled'];

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

/* ── Menu ── */

exports.validateAddMenuItem = (req, res, next) => {
  const { name, price, category, type } = req.body;

  if (!isNonEmptyString(name)) return fail(res, 'Item name is required', 'name');
  if (name.trim().length > 120) return fail(res, 'Item name is too long (max 120 chars)', 'name');
  if (!isPositiveNumber(price)) return fail(res, 'price must be a number > 0', 'price');

  if (category !== undefined && !isNonEmptyString(category)) return fail(res, 'category cannot be an empty string', 'category');
  if (type !== undefined && !['food', 'drink'].includes(type)) {
    return fail(res, "type must be one of: food, drink", 'type');
  }

  next();
};

exports.validateUpdateMenuItem = (req, res, next) => {
  const { name, price, category, type, avail } = req.body;

  if (name !== undefined && !isNonEmptyString(name)) return fail(res, 'name cannot be empty', 'name');
  if (price !== undefined && !isPositiveNumber(price)) return fail(res, 'price must be a number > 0', 'price');
  if (category !== undefined && !isNonEmptyString(category)) return fail(res, 'category cannot be an empty string', 'category');
  if (type !== undefined && !['food', 'drink'].includes(type)) {
    return fail(res, "type must be one of: food, drink", 'type');
  }
  if (avail !== undefined && typeof avail !== 'boolean') return fail(res, 'avail must be a boolean', 'avail');

  next();
};

/* ── Stock ── */

exports.validateAddStock = (req, res, next) => {
  const { name, unit, category, min, price } = req.body;

  if (!isNonEmptyString(name)) return fail(res, 'Item name is required', 'name');
  if (name.trim().length > 120) return fail(res, 'Item name is too long (max 120 chars)', 'name');

  if (unit !== undefined && (!isNonEmptyString(unit) || unit.trim().length > 40)) {
    return fail(res, 'unit must be a non-empty string (max 40 chars)', 'unit');
  }
  if (category !== undefined && (!isNonEmptyString(category) || category.trim().length > 60)) {
    return fail(res, 'category must be a non-empty string (max 60 chars)', 'category');
  }
  if (min !== undefined && !isNonNegativeNumber(min)) return fail(res, 'min must be a number >= 0', 'min');
  if (price !== undefined && !isNonNegativeNumber(price)) return fail(res, 'price must be a number >= 0', 'price');

  next();
};

// Matches the frontend contract exactly: qty is never sent by the Add/Edit
// Item form ("Qty on hand is set by transfers & sales — not edited here").
// If a caller sends qty anyway, reject it rather than silently ignoring it.
exports.validateUpdateStock = (req, res, next) => {
  const { unit, category, min, price, desc, qty } = req.body;

  if (qty !== undefined) return fail(res, 'qty cannot be edited directly — it is set by transfers and sales', 'qty');
  if (unit !== undefined && (!isNonEmptyString(unit) || unit.trim().length > 40)) {
    return fail(res, 'unit must be a non-empty string (max 40 chars)', 'unit');
  }
  if (category !== undefined && (!isNonEmptyString(category) || category.trim().length > 60)) {
    return fail(res, 'category must be a non-empty string (max 60 chars)', 'category');
  }
  if (min !== undefined && !isNonNegativeNumber(min)) return fail(res, 'min must be a number >= 0', 'min');
  if (price !== undefined && !isNonNegativeNumber(price)) return fail(res, 'price must be a number >= 0', 'price');
  if (desc !== undefined && typeof desc !== 'string') return fail(res, 'desc must be a string', 'desc');

  next();
};

/* ── Sales ── */

exports.validateCreateSale = (req, res, next) => {
  const { items, method, table, discount, roomNumber, guestName } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'items must be a non-empty array', 'items');
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object') return fail(res, `items[${i}] must be an object`, 'items');
    if (!isNonEmptyString(it.name)) return fail(res, `items[${i}].name is required`, 'items');
    if (!isPositiveNumber(it.qty)) return fail(res, `items[${i}].qty must be a number > 0`, 'items');
    if (!isNonNegativeNumber(it.price)) return fail(res, `items[${i}].price must be a number >= 0`, 'items');
  }

  if (method !== undefined && !PAYMENT_METHODS.includes(method)) {
    return fail(res, `method must be one of: ${PAYMENT_METHODS.join(', ')}`, 'method');
  }
  if (method === 'Room Charge') {
    if (!isNonEmptyString(roomNumber)) return fail(res, 'roomNumber is required for Room Charge sales', 'roomNumber');
    if (!isNonEmptyString(guestName)) return fail(res, 'guestName is required for Room Charge sales', 'guestName');
  }
  if (table !== undefined && typeof table !== 'string') return fail(res, 'table must be a string', 'table');
  if (discount !== undefined) {
    const n = Number(discount);
    if (Number.isNaN(n) || n < 0 || n > 100) return fail(res, 'discount must be a number between 0 and 100', 'discount');
  }

  next();
};

exports.validateVoidSale = (req, res, next) => {
  const { reason } = req.body;
  if (!isNonEmptyString(reason)) return fail(res, 'reason is required to void a sale', 'reason');
  next();
};

/* ── Transfers (incoming, Kitchen/Store → Restaurant) ── */

exports.validateRejectTransfer = (req, res, next) => {
  const { rejectReason } = req.body;
  if (!isNonEmptyString(rejectReason)) return fail(res, 'rejectReason is required to reject a transfer', 'rejectReason');
  next();
};

/* ── Requisitions (Restaurant → Store) ── */

exports.validateSubmitRequisition = (req, res, next) => {
  const { items, requester, neededBy, priority, remark } = req.body;

  if (!isNonEmptyString(requester)) return fail(res, 'requester is required', 'requester');
  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'items must be a non-empty array', 'items');
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object') return fail(res, `items[${i}] must be an object`, 'items');
    if (!isNonEmptyString(it.name)) return fail(res, `items[${i}].name is required`, 'items');
    if (!isPositiveNumber(it.qty)) return fail(res, `items[${i}].qty must be a number > 0`, 'items');
  }
  if (priority !== undefined && !['Normal', 'Urgent'].includes(priority)) {
    return fail(res, "priority must be one of: Normal, Urgent", 'priority');
  }
  if (neededBy !== undefined && typeof neededBy !== 'string') return fail(res, 'neededBy must be a string', 'neededBy');
  if (remark !== undefined && typeof remark !== 'string') return fail(res, 'remark must be a string', 'remark');

  next();
};

/* ── Shared: :id / :name param ── */

// Restaurant stock is looked up by name (see restaurant-inventory.html —
// RestaurantService.editStockItem(editName, ...) / deleteStockItem(name)),
// not by Mongo _id, so only reject if it's empty/whitespace.
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
exports.PAYMENT_METHODS = PAYMENT_METHODS;
exports.SALE_STATUS = SALE_STATUS;
exports.TRANSFER_STATUS = TRANSFER_STATUS;