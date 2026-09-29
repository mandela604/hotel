function fail(res, msg, field) {
  return res.status(400).json({ success: false, error: msg, field: field || null });
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isValidDept(v) {
  return ['Front Desk','Restaurant','Pool Bar','Gym','Other','Rooms & Bookings','Rooms'].includes(v);
}
function isValidCategory(v) {
  return ['Salaries & Wages','Utilities','Maintenance & Repairs','Marketing & Advertising','Supplies & Inventory','Insurance','Transport & Logistics','Miscellaneous'].includes(v);
}
function isValidAmount(v) {
  const n = Number(v);
  return !isNaN(n) && n > 0 && n <= 1e12;
}
function isValidDateStr(v) {
  if (!isNonEmptyString(v)) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

exports.validateAddIncome = (req, res, next) => {
  const { date, department, description, amount } = req.body;
  if (!isValidDateStr(date)) return fail(res, 'Valid date is required (YYYY-MM-DD)', 'date');
  if (!isNonEmptyString(department) || !isValidDept(department)) return fail(res, 'Valid department is required', 'department');
  if (!isNonEmptyString(description)) return fail(res, 'Description is required', 'description');
  if (!isValidAmount(amount)) return fail(res, 'Amount must be > 0 and <= 1e12', 'amount');
  if (description.length > 500) return fail(res, 'Description too long (max 500)', 'description');
  next();
};
exports.validateUpdateIncome = (req, res, next) => {
  const { date, department, description, amount } = req.body;
  if (date !== undefined && !isValidDateStr(date)) return fail(res, 'Invalid date', 'date');
  if (department !== undefined && (!isNonEmptyString(department) || !isValidDept(department))) return fail(res, 'Invalid department', 'department');
  if (description !== undefined && !isNonEmptyString(description)) return fail(res, 'Description cannot be empty', 'description');
  if (amount !== undefined && !isValidAmount(amount)) return fail(res, 'Amount must be > 0', 'amount');
  next();
};
exports.validateAddExpense = (req, res, next) => {
  const { date, category, description, amount } = req.body;
  if (!isValidDateStr(date)) return fail(res, 'Valid date is required', 'date');
  const cat = category || req.body.expenditure;
  if (!isNonEmptyString(cat) || !isValidCategory(cat)) return fail(res, 'Valid category is required', 'category');
  if (!isNonEmptyString(description)) return fail(res, 'Description is required', 'description');
  if (!isValidAmount(amount)) return fail(res, 'Amount must be > 0', 'amount');
  if (description.length > 500) return fail(res, 'Description too long', 'description');
  next();
};
exports.validateUpdateExpense = (req, res, next) => {
  const { date, category, description, amount } = req.body;
  const cat = category || req.body.expenditure;
  if (date !== undefined && !isValidDateStr(date)) return fail(res, 'Invalid date', 'date');
  if (cat !== undefined && (!isNonEmptyString(cat) || !isValidCategory(cat))) return fail(res, 'Invalid category', 'category');
  if (description !== undefined && !isNonEmptyString(description)) return fail(res, 'Description cannot be empty', 'description');
  if (amount !== undefined && !isValidAmount(amount)) return fail(res, 'Amount must be > 0', 'amount');
  next();
};
exports.validateOpenShift = (req, res, next) => {
  const { key, dept, openingFloat } = req.body;
  if (!isNonEmptyString(key)) return fail(res, 'key is required', 'key');
  if (!isNonEmptyString(dept)) return fail(res, 'dept is required', 'dept');
  if (openingFloat !== undefined && (isNaN(Number(openingFloat)) || Number(openingFloat) < 0)) return fail(res, 'openingFloat must be >=0', 'openingFloat');
  next();
};
exports.validateReconcileShift = (req, res, next) => {
  const { actualCash } = req.body;
  if (actualCash === undefined || isNaN(Number(actualCash)) || Number(actualCash) < 0) return fail(res, 'actualCash must be >=0', 'actualCash');
  next();
};
