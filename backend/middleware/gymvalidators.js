/**
 * Gym Module — Request Validators
 * Same plain-middleware style as storeValidators.js / restaurantValidators.js.
 */

const PAYMENT_MODES = ['Cash', 'POS', 'Transfer', 'Room Charge'];

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
// _id is a uuidv4 string (see models) — not a Mongo ObjectId, so this
// just checks it's a non-empty string, same looseness as Store's
// name/no-keyed params.
exports.validateParam = (paramName) => (req, res, next) => {
  const val = req.params[paramName];
  if (!isNonEmptyString(val)) return fail(res, `${paramName} param is required`, paramName);
  next();
};

/* ── Plans ── */
exports.validateCreatePlan = (req, res, next) => {
  const { name, price, durationDays, color } = req.body;
  if (!isNonEmptyString(name)) return fail(res, 'Plan name is required', 'name');
  if (price !== undefined && !isNonNegativeNumber(price)) return fail(res, 'price must be a number >= 0', 'price');
  if (durationDays !== undefined && !isPositiveNumber(durationDays)) return fail(res, 'durationDays must be a number > 0', 'durationDays');
  if (color !== undefined && !['gold', 'blue', 'purple', 'green', 'amber'].includes(color)) {
    return fail(res, 'color must be one of: gold, blue, purple, green, amber', 'color');
  }
  next();
};
exports.validateUpdatePlan = exports.validateCreatePlan;

/* ── Members ── */
exports.validateCreateMember = (req, res, next) => {
  const { name, joined, totalDue, status } = req.body;
  if (!isNonEmptyString(name)) return fail(res, 'Member name is required', 'name');
  if (joined !== undefined && !isNonEmptyString(joined)) return fail(res, 'joined must be a date string', 'joined');
  if (totalDue !== undefined && !isNonNegativeNumber(totalDue)) return fail(res, 'totalDue must be a number >= 0', 'totalDue');
  if (status !== undefined && !['active', 'frozen'].includes(status)) return fail(res, 'status must be active or frozen', 'status');
  next();
};

exports.validateUpdateMember = (req, res, next) => {
  const { name, totalDue, status, payments } = req.body;
  if (payments !== undefined) return fail(res, 'payments cannot be edited directly — use POST /members/:id/payments', 'payments');
  if (name !== undefined && !isNonEmptyString(name)) return fail(res, 'name must be a non-empty string', 'name');
  if (totalDue !== undefined && !isNonNegativeNumber(totalDue)) return fail(res, 'totalDue must be a number >= 0', 'totalDue');
  if (status !== undefined && !['active', 'frozen'].includes(status)) return fail(res, 'status must be active or frozen', 'status');
  next();
};

exports.validateAddPayment = (req, res, next) => {
  const { amount, mode, by, roomNumber } = req.body;
  if (!isPositiveNumber(amount)) return fail(res, 'amount must be a number > 0', 'amount');
  if (mode !== undefined && !PAYMENT_MODES.includes(mode)) {
    return fail(res, `mode must be one of: ${PAYMENT_MODES.join(', ')}`, 'mode');
  }
  if (mode === 'Room Charge' && !isNonEmptyString(roomNumber)) {
    return fail(res, 'roomNumber is required when mode is Room Charge', 'roomNumber');
  }
  if (by !== undefined && !isNonEmptyString(by)) return fail(res, 'by must be a non-empty string', 'by');
  next();
};

exports.validateRenewMember = (req, res, next) => {
  const { newExpiry } = req.body;
  if (!isNonEmptyString(newExpiry)) return fail(res, 'newExpiry is required', 'newExpiry');
  next();
};

/* ── Check-ins ── */
exports.validateCreateCheckin = (req, res, next) => {
  const { memberId } = req.body;
  if (!isNonEmptyString(memberId)) return fail(res, 'memberId is required', 'memberId');
  next();
};

/* ── Guests ── */
exports.validateCreateGuest = (req, res, next) => {
  const { name } = req.body;
  if (!isNonEmptyString(name)) return fail(res, 'Guest name is required', 'name');
  next();
};

exports.PAYMENT_MODES = PAYMENT_MODES;