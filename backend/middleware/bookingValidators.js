/**
 * Booking Module — Request Validators
 * Plain middleware, no external validation lib — matches the style of
 * kitchenValidators.js / sanitize.js / roleGuard.js exactly. Run AFTER
 * sanitize.js in the chain so fields are already trimmed/stripped when
 * these checks run.
 *
 * Each validator responds 400 directly and stops the chain on failure,
 * mirroring the { success:false, error } shape used across controllers.
 */

const ROOM_TYPES   = ['Standard', 'Deluxe', 'Suite', 'Conference'];
const ROOM_STATUS  = ['vacant', 'reserved', 'checkedin', 'checkout', 'cleaning', 'maintenance'];
const PAY_STATUS   = ['Pending', 'Deposit Paid', 'Fully Paid'];
const CHARGE_STATUS = ['Pending', 'Partially Settled', 'Settled'];

// Legal room-status transitions, mirrors STATUS_OPTS in booking-rooms.html.
// 'available' in the frontend maps to the 'vacant' status value stored on
// the record, so both keys are accepted here.
const STATUS_TRANSITIONS = {
  vacant:      ['maintenance', 'reserved'],
  available:   ['maintenance', 'reserved'],
  checkedin:   ['cleaning', 'checkout'],
  reserved:    ['checkedin', 'no-show', 'cancelled', 'vacant', 'maintenance'],
  checkout:    ['vacant', 'maintenance', 'cleaning'],
  maintenance: ['vacant'],
  cleaning:    ['vacant', 'maintenance'],
  'no-show':   ['vacant'],
  cancelled:   ['vacant'],
};

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

function isValidDateStr(v) {
  if (!isNonEmptyString(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

/* ── Rooms ── */

exports.validateAddRoom = (req, res, next) => {
  const { num, type, rate, notes } = req.body;

  if (!isNonEmptyString(num)) return fail(res, 'Room number is required', 'num');
  if (num.trim().length > 20) return fail(res, 'Room number is too long (max 20 chars)', 'num');

  if (type !== undefined && !ROOM_TYPES.includes(type)) {
    return fail(res, `type must be one of: ${ROOM_TYPES.join(', ')}`, 'type');
  }
  if (rate !== undefined && !isNonNegativeNumber(rate)) return fail(res, 'rate must be a number >= 0', 'rate');
  if (notes !== undefined && typeof notes !== 'string') return fail(res, 'notes must be a string', 'notes');

  next();
};

exports.validateUpdateRoom = (req, res, next) => {
  const { type, rate, notes } = req.body;

  if (type !== undefined && !ROOM_TYPES.includes(type)) {
    return fail(res, `type must be one of: ${ROOM_TYPES.join(', ')}`, 'type');
  }
  if (rate !== undefined && !isNonNegativeNumber(rate)) return fail(res, 'rate must be a number >= 0', 'rate');
  if (notes !== undefined && typeof notes !== 'string') return fail(res, 'notes must be a string', 'notes');

  next();
};

exports.validateRoomStatus = (req, res, next) => {
  const { status } = req.body;
  if (!isNonEmptyString(status)) return fail(res, 'status is required', 'status');
  if (!ROOM_STATUS.includes(status) && status !== 'available') {
    return fail(res, `status must be one of: ${ROOM_STATUS.join(', ')}`, 'status');
  }
  next();
};

/* ── Bookings ── */

exports.validateCreateBooking = (req, res, next) => {
  const {
    room, type, guest, checkin, checkout, rate, discount, adults, children, status,
  } = req.body;

  if (!isNonEmptyString(room)) return fail(res, 'Room number is required', 'room');
  if (!isNonEmptyString(guest)) return fail(res, 'Guest name is required', 'guest');

  if (type !== undefined && !ROOM_TYPES.includes(type)) {
    return fail(res, `type must be one of: ${ROOM_TYPES.join(', ')}`, 'type');
  }
  if (checkin !== undefined && checkin !== '' && !isValidDateStr(checkin)) {
    return fail(res, 'checkin must be a valid date', 'checkin');
  }
  if (checkout !== undefined && checkout !== '' && !isValidDateStr(checkout)) {
    return fail(res, 'checkout must be a valid date', 'checkout');
  }
  if (checkin && checkout && new Date(checkout) < new Date(checkin)) {
    return fail(res, 'checkout cannot be before checkin', 'checkout');
  }
  if (rate !== undefined && !isNonNegativeNumber(rate)) return fail(res, 'rate must be a number >= 0', 'rate');
  if (discount !== undefined) {
    const n = Number(discount);
    if (Number.isNaN(n) || n < 0) return fail(res, 'discount must be a number >= 0', 'discount');
    if (rate !== undefined && n > Number(rate)) return fail(res, 'discount cannot exceed rate', 'discount');
  }
  if (adults !== undefined && !isPositiveNumber(adults)) return fail(res, 'adults must be a number > 0', 'adults');
  if (children !== undefined && !isNonNegativeNumber(children)) return fail(res, 'children must be a number >= 0', 'children');
  if (status !== undefined && !['reserved', 'checkedin'].includes(status)) {
    return fail(res, "status must be 'reserved' or 'checkedin' when creating a booking", 'status');
  }

  next();
};

exports.validateUpdateBooking = (req, res, next) => {
  const { type, checkin, checkout, rate, discount, adults, children, payStatus } = req.body;

  if (type !== undefined && !ROOM_TYPES.includes(type)) {
    return fail(res, `type must be one of: ${ROOM_TYPES.join(', ')}`, 'type');
  }
  if (checkin !== undefined && checkin !== '' && !isValidDateStr(checkin)) {
    return fail(res, 'checkin must be a valid date', 'checkin');
  }
  if (checkout !== undefined && checkout !== '' && !isValidDateStr(checkout)) {
    return fail(res, 'checkout must be a valid date', 'checkout');
  }
  if (checkin && checkout && new Date(checkout) < new Date(checkin)) {
    return fail(res, 'checkout cannot be before checkin', 'checkout');
  }
  if (rate !== undefined && !isNonNegativeNumber(rate)) return fail(res, 'rate must be a number >= 0', 'rate');
  if (discount !== undefined) {
    const n = Number(discount);
    if (Number.isNaN(n) || n < 0) return fail(res, 'discount must be a number >= 0', 'discount');
    if (rate !== undefined && n > Number(rate)) return fail(res, 'discount cannot exceed rate', 'discount');
  }
  if (adults !== undefined && !isPositiveNumber(adults)) return fail(res, 'adults must be a number > 0', 'adults');
  if (children !== undefined && !isNonNegativeNumber(children)) return fail(res, 'children must be a number >= 0', 'children');
  if (payStatus !== undefined && !PAY_STATUS.includes(payStatus)) {
    return fail(res, `payStatus must be one of: ${PAY_STATUS.join(', ')}`, 'payStatus');
  }

  next();
};

exports.validateAddPayment = (req, res, next) => {
  const { amount, mode } = req.body;
  if (!isPositiveNumber(amount)) return fail(res, 'amount must be a number > 0', 'amount');
  if (mode !== undefined && !isNonEmptyString(mode)) return fail(res, 'mode cannot be an empty string', 'mode');
  next();
};

exports.validateCheckin = (req, res, next) => {
  const { guest } = req.body;
  // Check-in on an already-reserved room needs no body; check-in that
  // also books a vacant room walk-in style needs a guest name.
  if (req.body && Object.keys(req.body).length > 0 && guest !== undefined && !isNonEmptyString(guest)) {
    return fail(res, 'guest cannot be an empty string', 'guest');
  }
  next();
};

/* ── Guests ── */

exports.validateSaveGuest = (req, res, next) => {
  const { name, phone, email, vip, notes, idType, idNum } = req.body;

  if (name !== undefined && !isNonEmptyString(name)) return fail(res, 'name cannot be empty', 'name');
  if (phone !== undefined && typeof phone !== 'string') return fail(res, 'phone must be a string', 'phone');
  if (email !== undefined && typeof email !== 'string') return fail(res, 'email must be a string', 'email');
  if (vip !== undefined && typeof vip !== 'boolean') return fail(res, 'vip must be a boolean', 'vip');
  if (notes !== undefined && typeof notes !== 'string') return fail(res, 'notes must be a string', 'notes');
  if (idType !== undefined && !isNonEmptyString(idType)) return fail(res, 'idType cannot be empty', 'idType');
  if (idNum !== undefined && typeof idNum !== 'string') return fail(res, 'idNum must be a string', 'idNum');

  next();
};

exports.validateAddCharge = (req, res, next) => {
  const { desc, amount, source, room } = req.body;
  if (!isNonEmptyString(desc)) return fail(res, 'desc is required', 'desc');
  if (!isPositiveNumber(amount)) return fail(res, 'amount must be a number > 0', 'amount');
  if (source !== undefined && !isNonEmptyString(source)) return fail(res, 'source cannot be an empty string', 'source');
  if (room !== undefined && typeof room !== 'string') return fail(res, 'room must be a string', 'room');
  next();
};

exports.validateSettleCharge = (req, res, next) => {
  const { amount, mode } = req.body;
  if (amount !== undefined && !isPositiveNumber(amount)) {
    return fail(res, 'amount must be a number > 0 when provided', 'amount');
  }
  if (mode !== undefined && !isNonEmptyString(mode)) return fail(res, 'mode cannot be an empty string', 'mode');
  next();
};

/* ── Shared: :id / :room / :num param ── */

exports.validateParam = (paramName) => (req, res, next) => {
  const val = req.params[paramName];
  if (!isNonEmptyString(val)) return fail(res, `${paramName} param is required`, paramName);
  next();
};

exports.STATUS_TRANSITIONS = STATUS_TRANSITIONS;
exports.ROOM_STATUS = ROOM_STATUS;
exports.ROOM_TYPES = ROOM_TYPES;
exports.PAY_STATUS = PAY_STATUS;
exports.CHARGE_STATUS = CHARGE_STATUS;