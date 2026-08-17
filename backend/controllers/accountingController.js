const LedgerEntry = require('../models/LedgerEntry');
const IncomeEntry = require('../models/IncomeEntry');
const ExpenseEntry = require('../models/ExpenseEntry');
const Shift = require('../models/Shift');
const PurchaseRequest = require('../models/PurchaseRequest');
const asyncHandler = require('../middleware/asyncHandler');

exports.summary = asyncHandler(async (req, res) => {
  const incomeAgg = await LedgerEntry.aggregate([
    { $match: { type: 'income' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const expenseAgg = await LedgerEntry.aggregate([
    { $match: { type: 'expense' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const totalIncome = incomeAgg[0]?.total || 0;
  const totalExpenses = expenseAgg[0]?.total || 0;

  const openShifts = await Shift.countDocuments({ status: 'open' });
  const pendingPRs = await PurchaseRequest.countDocuments({ status: 'pending' });

  res.json({
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    openShifts,
    pendingPRs,
  });
});

exports.ledger = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.department) filter.department = req.query.department;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  const entries = await LedgerEntry.find(filter).sort({ date: -1 });
  res.json(entries);
});

exports.transactions = asyncHandler(async (req, res) => {
  const entries = await LedgerEntry.find().sort({ date: -1 });
  res.json(entries);
});

exports.pnl = asyncHandler(async (req, res) => {
  const dateFilter = {};
  if (req.query.from || req.query.to) {
    dateFilter.date = {};
    if (req.query.from) dateFilter.date.$gte = new Date(req.query.from);
    if (req.query.to) dateFilter.date.$lte = new Date(req.query.to);
  }

  const incomePipeline = [
    ...(Object.keys(dateFilter).length ? [{ $match: dateFilter }] : []),
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
  ];
  const expensePipeline = [
    ...(Object.keys(dateFilter).length ? [{ $match: dateFilter }] : []),
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
  ];

  const [incomeByCategory, expenseByCategory] = await Promise.all([
    IncomeEntry.aggregate(incomePipeline),
    ExpenseEntry.aggregate(expensePipeline),
  ]);

  res.json({ income: incomeByCategory, expenses: expenseByCategory });
});

exports.addIncome = asyncHandler(async (req, res) => {
  const [incomeEntry, ledgerEntry] = await Promise.all([
    IncomeEntry.create(req.body),
    LedgerEntry.create({ ...req.body, type: 'income' }),
  ]);
  res.status(201).json({ incomeEntry, ledgerEntry });
});

exports.addExpense = asyncHandler(async (req, res) => {
  const [expenseEntry, ledgerEntry] = await Promise.all([
    ExpenseEntry.create(req.body),
    LedgerEntry.create({ ...req.body, type: 'expense' }),
  ]);
  res.status(201).json({ expenseEntry, ledgerEntry });
});

exports.listShifts = asyncHandler(async (req, res) => {
  const shifts = await Shift.find().sort({ date: -1 });
  res.json(shifts);
});

exports.openShift = asyncHandler(async (req, res) => {
  const shift = await Shift.create(req.body);
  res.status(201).json(shift);
});

exports.reconcileShift = asyncHandler(async (req, res) => {
  const { actualCash, expectedCash } = req.body;
  const actual = Number(actualCash) || 0;
  const expected = Number(expectedCash) || 0;
  const shift = await Shift.findByIdAndUpdate(
    req.params.id,
    {
      actualCash: actual,
      expectedCash: expected,
      variance: actual - expected,
      status: 'reconciled',
    },
    { new: true, runValidators: true }
  );
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  res.json(shift);
});
