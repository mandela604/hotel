/**
 * Kitchen Module — Request Validators
 * Plain middleware, no external validation lib, matching the style
 * of sanitize.js / roleGuard.js. Run AFTER sanitize.js in the chain
 * so fields are already trimmed/stripped when these checks run.
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

function validateIngredientsArray(res, ingredients, { required }) {
  if (ingredients === undefined) {
    return required ? fail(res, 'ingredients is required', 'ingredients') : null;
  }
  if (!Array.isArray(ingredients) || (required && ingredients.length === 0)) {
    return fail(res, 'ingredients must be a non-empty array', 'ingredients');
  }
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    if (!ing || typeof ing !== 'object') return fail(res, `ingredients[${i}] must be an object`, 'ingredients');
    if (!isNonEmptyString(ing.name)) return fail(res, `ingredients[${i}].name is required`, 'ingredients');
    if (!isPositiveNumber(ing.qty)) return fail(res, `ingredients[${i}].qty must be a number > 0`, 'ingredients');
  }
  return null;
}

/* ── Stock ── */

exports.validateAddStock = (req, res, next) => {
  const { name, unit, cat, category, qty, min, price, cost } = req.body;

  if (!isNonEmptyString(name)) return fail(res, 'Item name is required', 'name');
  if (name.trim().length > 120) return fail(res, 'Item name is too long (max 120 chars)', 'name');

  // unit/category are free text — kitchen can introduce new ones on the fly.
  // Just make sure whatever's sent is a real, sane string, not garbage/huge input.
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
  if (!isNonEmptyString(name)) return fail(res, 'Ingredient name is required', 'name');
  if (!isPositiveNumber(qty)) return fail(res, 'qty must be a number > 0', 'qty');
  next();
};

/* ── Production ── */

/**
 * Start a production run (POST /production).
 * The kitchen-production.html "Start production" form does NOT collect
 * outputQty — actual yield is only known later, once cooking finishes,
 * and is recorded separately via completeProduction. So outputQty must
 * NOT be required here (that was the bug: every start was being
 * rejected). What the form does always send is dish + ingredients
 * (+ optionally expectedYield/expectedYieldUnit for the variance KPI).
 */
exports.validateRecordProduction = (req, res, next) => {
  const { dish, expectedYield, expectedYieldUnit, outputQty, outputUnit, ingredients } = req.body;

  if (!isNonEmptyString(dish)) return fail(res, 'Dish name is required', 'dish');

  const ingErr = validateIngredientsArray(res, ingredients, { required: true });
  if (ingErr) return ingErr;

  // outputQty is optional at start time — only validate shape if it was sent.
  if (outputQty !== undefined && outputQty !== null && outputQty !== '' && !isPositiveNumber(outputQty)) {
    return fail(res, 'outputQty must be a number > 0', 'outputQty');
  }
  if (outputUnit !== undefined && !isNonEmptyString(outputUnit)) {
    return fail(res, 'outputUnit cannot be empty', 'outputUnit');
  }
  if (expectedYield !== undefined && expectedYield !== null && expectedYield !== '' && !isPositiveNumber(expectedYield)) {
    return fail(res, 'expectedYield must be a number > 0', 'expectedYield');
  }
  if (expectedYieldUnit !== undefined && !isNonEmptyString(expectedYieldUnit)) {
    return fail(res, 'expectedYieldUnit cannot be empty', 'expectedYieldUnit');
  }

  next();
};

/**
 * Complete/adjust a production run (PUT /production/:id).
 * This validator was missing entirely, which crashed router registration
 * (Express throws immediately if a route references undefined middleware).
 */
exports.validateCompleteProduction = (req, res, next) => {
  const { outputQty, outputUnit, notes, status } = req.body;

  if (outputQty !== undefined && !isPositiveNumber(outputQty)) {
    return fail(res, 'outputQty must be a number > 0', 'outputQty');
  }
  if (outputUnit !== undefined && !isNonEmptyString(outputUnit)) {
    return fail(res, 'outputUnit cannot be empty', 'outputUnit');
  }
  if (notes !== undefined && typeof notes !== 'string') {
    return fail(res, 'notes must be a string', 'notes');
  }
  const allowedStatus = ['draft', 'sent', 'accepted', 'in-progress', 'completed', 'voided'];
  if (status !== undefined && !allowedStatus.includes(status)) {
    return fail(res, `status must be one of: ${allowedStatus.join(', ')}`, 'status');
  }

  next();
};

exports.validateVoidProduction = (req, res, next) => {
  const { reason } = req.body;
  if (reason !== undefined && !isNonEmptyString(reason)) {
    return fail(res, 'reason cannot be an empty string', 'reason');
  }
  next();
};

/* ── Transfers ── */

exports.validateAddTransfer = (req, res, next) => {
  const { meal, quantity, unit } = req.body;
  if (!isNonEmptyString(meal)) return fail(res, 'Meal name is required', 'meal');
  if (!isPositiveNumber(quantity)) return fail(res, 'quantity must be a number > 0', 'quantity');
  if (unit !== undefined && !isNonEmptyString(unit)) return fail(res, 'unit cannot be empty', 'unit');
  next();
};

exports.validateTransferStatus = (req, res, next) => {
  const { status, cancelReason, rejectReason } = req.body;
  // status: free text, not enforced (n/a per product decision).
  if (status === 'cancelled' && !isNonEmptyString(cancelReason)) {
    return fail(res, 'cancelReason is required when cancelling a transfer', 'cancelReason');
  }
  if (status === 'rejected' && !isNonEmptyString(rejectReason)) {
    return fail(res, 'rejectReason is required when rejecting a transfer', 'rejectReason');
  }
  next();
};

/* ── Recipes ── */

/**
 * The Recipe schema's field is `dish` (unique), not `name` — and that's
 * exactly what kitchen-recipes.html sends: { dish, baseQty, baseUnit,
 * ingredients, expectedYield, expectedYieldUnit }. The old validator
 * checked req.body.name, which is always undefined here, so every
 * recipe create/edit was rejected before it ever reached the controller.
 */
exports.validateCreateRecipe = (req, res, next) => {
  const { dish, baseQty, baseUnit, expectedYield, expectedYieldUnit, ingredients } = req.body;

  if (!isNonEmptyString(dish)) return fail(res, 'Dish name is required', 'dish');

  if (baseQty !== undefined && !isPositiveNumber(baseQty)) {
    return fail(res, 'baseQty must be a number > 0', 'baseQty');
  }
  if (baseUnit !== undefined && !isNonEmptyString(baseUnit)) {
    return fail(res, 'baseUnit cannot be empty', 'baseUnit');
  }
  if (expectedYield !== undefined && expectedYield !== null && expectedYield !== '' && !isNonNegativeNumber(expectedYield)) {
    return fail(res, 'expectedYield must be a number >= 0', 'expectedYield');
  }
  if (expectedYieldUnit !== undefined && !isNonEmptyString(expectedYieldUnit)) {
    return fail(res, 'expectedYieldUnit cannot be empty', 'expectedYieldUnit');
  }

  const ingErr = validateIngredientsArray(res, ingredients, { required: true });
  if (ingErr) return ingErr;

  next();
};

/* ── Shared: :id param ── */

exports.validateObjectIdParam = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  // Kitchen routes accept either a Mongo _id or a human-readable no
  // (e.g. PROD-00097, KTN-00046), so only reject if it's empty/whitespace —
  // don't force ObjectId shape here.
  if (!isNonEmptyString(id)) return fail(res, `${paramName} param is required`, paramName);
  next();
};

// Strict variant — use only on routes that are guaranteed Mongo _id lookups.
exports.validateStrictObjectIdParam = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!isValidObjectId(id)) return fail(res, `${paramName} must be a valid id`, paramName);
  next();
};