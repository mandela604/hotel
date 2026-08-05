const Booking = require('../database/models/Booking');
const GymCheckin = require('../database/models/GymCheckin');
const GymMember = require('../database/models/GymMember');
const Payment = require('../database/models/Payment');
const Sale = require('../database/models/Sale');
const asyncHandler = require('../middleware/asyncHandler');
const { total, balance, nights } = require('../utils/calc');

const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Conference'];

function buildFilter(query) {
  const { from, to, type, status, pay } = query;
  const filter = { guest: { $ne: '' }, status: { $ne: 'cancelled' } };
  if (type) filter.roomType = type;
  if (status) filter.status = status;
  if (pay) filter.payStatus = pay;
  if (from || to) {
    filter.checkin = {};
    if (from) filter.checkin.$gte = new Date(from);
    if (to) filter.checkin.$lte = new Date(to);
  }
  return filter;
}

// GET /api/reports/summary?from=&to=&type=&status=&pay=&page=&limit=
exports.summary = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);
  const rows = await Booking.find(filter).sort({ checkin: -1 });

  const totRev = rows.reduce((s, b) => s + total(b), 0);
  const totPaid = rows.reduce((s, b) => s + (b.paid || 0), 0);
  const totBal = rows.reduce((s, b) => s + balance(b), 0);

  const byType = ROOM_TYPES.map((t) => {
    const trows = rows.filter((b) => b.roomType === t);
    return { type: t, count: trows.length, revenue: trows.reduce((s, b) => s + total(b), 0) };
  });

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);

  res.json({
    range: { from: req.query.from || null, to: req.query.to || null },
    totals: { count: rows.length, revenue: totRev, paid: totPaid, balance: totBal },
    byType,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(rows.length / limit)),
    data: pageRows.map((b) => ({
      room: b.room,
      guest: b.guest,
      type: b.roomType,
      checkin: b.checkin ? new Date(b.checkin).toISOString().split('T')[0] : '',
      checkout: b.checkout ? new Date(b.checkout).toISOString().split('T')[0] : '',
      nights: nights(b.checkin, b.checkout) || 1,
      rate: b.rate,
      discount: b.discount || 0,
      total: total(b),
      paid: b.paid || 0,
      balance: balance(b),
      payMethod: b.payMethod,
      status: b.status,
      recordedBy: b.recordedBy || '',
    })),
  });
});

// GET /api/reports/export.csv
exports.exportCsv = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);
  const rows = await Booking.find(filter).sort({ checkin: -1 });

  const headers = ['Room', 'Guest', 'Type', 'Check-in', 'Check-out', 'Nights', 'Rate/Night', 'Discount %', 'Total', 'Paid', 'Balance', 'Payment Method', 'Status', 'Recorded By'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(',')];

  for (const b of rows) {
    lines.push([
      b.room, b.guest, b.roomType,
      b.checkin ? new Date(b.checkin).toISOString().split('T')[0] : '',
      b.checkout ? new Date(b.checkout).toISOString().split('T')[0] : '',
      nights(b.checkin, b.checkout) || 1,
      b.rate, b.discount || 0,
      Math.round(total(b)), b.paid || 0, Math.round(balance(b)),
      b.payMethod, b.status, b.recordedBy || '',
    ].map(esc).join(','));
  }

  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="aurum-hotel-bookings-report-${today}.csv"`);
  res.send(lines.join('\n'));
});

// GET /api/reports/checkins
exports.getCheckinReports = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const checkins = await GymCheckin.find(filter).sort({ date: -1 });
  res.json({ total: checkins.length, data: checkins });
});

// GET /api/reports/members
exports.getMemberReports = asyncHandler(async (req, res) => {
  const [total, active, expired, suspended] = await Promise.all([
    GymMember.countDocuments(),
    GymMember.countDocuments({ status: 'active' }),
    GymMember.countDocuments({ status: 'expired' }),
    GymMember.countDocuments({ status: 'suspended' }),
  ]);
  const members = await GymMember.find().sort({ createdAt: -1 });
  res.json({ totals: { total, active, expired, suspended }, data: members });
});

// GET /api/reports/revenue
exports.getRevenueReports = asyncHandler(async (req, res) => {
  const [payments, sales] = await Promise.all([
    Payment.find().sort({ date: -1 }),
    Sale.find({ status: 'completed' }).sort({ createdAt: -1 }),
  ]);
  const gymRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const posRevenue = sales.reduce((s, p) => s + (p.total || 0), 0);
  res.json({ gymRevenue, posRevenue, totalRevenue: gymRevenue + posRevenue, payments, sales });
});
