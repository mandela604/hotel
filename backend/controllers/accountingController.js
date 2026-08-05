const AccountingTransaction = require('../database/models/AccountingTransaction');
const Shift = require('../database/models/Shift');
const asyncHandler = require('../middleware/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

/* ── TRANSACTIONS ── */

// GET /api/accounting/transactions
exports.listTransactions = asyncHandler(async (req, res) => {
  const { type, department, from, to } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (department) filter.department = department;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const txs = await AccountingTransaction.find(filter).sort({ date: -1 });
  res.json(txs);
});

// POST /api/accounting/transactions
exports.createTransaction = asyncHandler(async (req, res) => {
  const { date, description, type, amount, category, department, recordedById, notes } = req.body;
  if (!type || amount === undefined) throw new ApiError(400, 'type and amount are required');
  if (!['income', 'expense', 'transfer'].includes(type)) {
    throw new ApiError(400, "type must be 'income', 'expense', or 'transfer'");
  }

  const count = await AccountingTransaction.countDocuments();
  const ref = `TX-${String(count + 1).padStart(5, '0')}`;

  const tx = await AccountingTransaction.create({
    date: date ? new Date(date) : new Date(),
    ref,
    description: description || '',
    type,
    amount: Number(amount),
    category: category || 'General',
    department: department || 'General',
    recordedById: recordedById || '',
    notes: notes || '',
  });

  res.status(201).json(tx);
});

// GET /api/accounting/summary
exports.getFinancialSummary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  const agg = await AccountingTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = { income: 0, expense: 0, transfer: 0, netIncome: 0 };
  for (const item of agg) {
    if (summary[item._id] !== undefined) summary[item._id] = item.total;
  }
  summary.netIncome = summary.income - summary.expense;

  res.json(summary);
});

/* ── SHIFT RECONCILIATION ── */

// GET /api/accounting/shifts
exports.listShifts = asyncHandler(async (req, res) => {
  const shifts = await Shift.find().sort({ key: -1 });
  res.json(shifts);
});

// GET /api/accounting/shifts/:key
exports.getShift = asyncHandler(async (req, res) => {
  const shift = await Shift.findOne({ key: req.params.key });
  if (!shift) throw new ApiError(404, 'Shift record not found');
  res.json(shift);
});

// POST /api/accounting/shifts  (Open a new shift)
exports.createShift = asyncHandler(async (req, res) => {
  const { key, staff, openingFloat } = req.body;
  if (!key || !staff) throw new ApiError(400, 'key (e.g., 2026-07-17) and staff name are required');

  const exists = await Shift.findOne({ key });
  if (exists) throw new ApiError(409, `Shift for ${key} already exists`);

  const shift = await Shift.create({
    key,
    staff,
    openingFloat: Number(openingFloat) || 50000,
    status: 'open',
  });

  res.status(201).json(shift);
});

// PATCH /api/accounting/shifts/:key  (Reconcile or correct shift count)
exports.reconcileShift = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { actualCash, notes, status, actor, type } = req.body;

  if (actualCash === undefined || isNaN(actualCash)) {
    throw new ApiError(400, 'Numeric actualCash is required');
  }

  let shift = await Shift.findOne({ key });
  if (!shift) {
    // Auto-create shift if reconciling a legacy or newly generated key
    shift = new Shift({
      key,
      staff: actor || 'Staff Member',
      openingFloat: 50000,
      status: 'open',
    });
  }

  const actualNum = Number(actualCash);
  const expectedNum = shift.openingFloat; // Can be enhanced with cash transaction aggregation
  const variance = actualNum - expectedNum;

  shift.actualCash = actualNum;
  shift.status = status || 'reconciled';
  shift.notes = notes || '';

  shift.history.unshift({
    actor: actor || 'Finance Cashier',
    actualCash: actualNum,
    expected: expectedNum,
    variance,
    notes: notes || '',
    type: type === 'correction' ? 'correction' : 'initial',
    date: new Date(),
  });

  await shift.save();
  res.json(shift);
});
