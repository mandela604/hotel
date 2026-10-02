const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Sale = require('../models/Sale');
const LedgerEntry = require('../models/LedgerEntry');
const PurchaseRequest = require('../models/PurchaseRequest');
const KitchenStock = require('../models/KitchenStock');
const StoreStock = require('../models/StoreStock');
const RestaurantStock = require('../models/RestaurantStock');
const PoolbarStock = require('../models/PoolbarStock');
const Staff = require('../models/Staff');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

function lagosTodayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Lagos' });
}
function lagosShiftRange(shiftStartHour) {
  const now = new Date();
  const lagosNowStr = now.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', hour12: false });
  // lagosNowStr like "02/10/2026, 07:16:00" — parse to get Lagos hour
  const lagosHour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }).format(now), 10);
  const lagosDateStr = now.toLocaleDateString('sv-SE', { timeZone: 'Africa/Lagos' }); // YYYY-MM-DD Lagos
  let shiftDateStr = lagosDateStr;
  if (lagosHour < shiftStartHour) {
    // before shift start today -> shift started yesterday
    const yest = new Date(now.getTime() - 86400000);
    shiftDateStr = yest.toLocaleDateString('sv-SE', { timeZone: 'Africa/Lagos' });
  }
  const shiftStart = new Date(shiftDateStr + `T${String(shiftStartHour).padStart(2,'0')}:00:00+01:00`);
  const shiftEnd = new Date(shiftStart.getTime() + 24*60*60*1000 - 1);
  return { shiftStart, shiftEnd, shiftDateStr };
}

exports.overview = asyncHandler(async (req, res) => {
  let shiftStartHour = 9;
  try { const Config = require('../models/Config'); const cfg = await Config.findOne().sort({ createdAt: -1 }); if (cfg && typeof cfg.shiftStartHour === 'number') shiftStartHour = cfg.shiftStartHour; } catch(e){}
  const { shiftStart: todayStart, shiftEnd: todayEnd } = lagosShiftRange(shiftStartHour);

  // Count low stock across all inventory modules (kitchen store + central store + outlets)
  const lowStockFilter = { $expr: { $and: [ { $gt: ['$min', 0] }, { $lte: ['$qty', '$min'] } ] } };
  const [
    bookingStatusCounts,
    totalRooms,
    todayBookings,
    restaurantSales,
    poolbarSales,
    pendingProcurement,
    lowStocks,
    staffOnDuty,
    recentActivity,
  ] = await Promise.all([
    // Count rooms by status from Booking (not Room)
    Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Room.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: todayStart.getTime() } }),
    Sale.aggregate([
      { $match: { department: 'restaurant', status: 'completed', createdAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Sale.aggregate([
      { $match: { department: 'poolbar', status: 'completed', createdAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    PurchaseRequest.countDocuments({ status: { $in: ['pending', 'accountant', 'gm'] } }),
    Promise.all([
      KitchenStock.countDocuments(lowStockFilter),
      StoreStock.countDocuments(lowStockFilter),
      RestaurantStock.countDocuments(lowStockFilter),
      PoolbarStock.countDocuments(lowStockFilter),
    ]).then(counts => counts.reduce((a, b) => a + b, 0)),
    Staff.countDocuments({ status: 'on_duty' }),
    Activity.find().sort({ createdAt: -1 }).limit(10),
  ]);
  const lowStock = lowStocks;

  // Map booking statuses to readable counts
  const statusMap = {};
  for (const entry of bookingStatusCounts) {
    statusMap[entry._id] = entry.count;
  }

  // Room revenue: sum of payments where payDate falls in current shift (Lagos) — same as accounting
  function parsePaymentDate(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    const parts = s.split('/');
    if (parts.length===3) { const dd=parts[0].padStart(2,'0'), mm=parts[1].padStart(2,'0'); let yy=parts[2]; if(yy.length===2) yy='20'+yy; return yy+'-'+mm+'-'+dd; }
    const d=new Date(s); if(!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    return null;
  }
  function lagosDateStr(d){ try{ return new Date(d).toLocaleDateString('sv-SE',{timeZone:'Africa/Lagos'});}catch(e){ return new Date(d).toISOString().slice(0,10);} }
  const allBookingsForRoomRev = await Booking.find({ guest: { $ne: '' } }).lean();
  let roomRevenueToday = 0;
  const shiftStartStr = todayStart.toLocaleDateString('sv-SE', { timeZone: 'Africa/Lagos' });
  const shiftEndStr = todayEnd.toLocaleDateString('sv-SE', { timeZone: 'Africa/Lagos' });
  // Build shift range strings for comparison (YYYY-MM-DD)
  const shiftStartYMD = shiftStartStr;
  const shiftEndYMD = shiftEndStr;
  for (const b of allBookingsForRoomRev) {
    for (const p of (b.payments||[])) {
      const pd = parsePaymentDate(p.date || '') || (b.checkin ? b.checkin.slice(0,10) : null);
      if (!pd) continue;
      // pd is YYYY-MM-DD, check if within shift window (shiftStart <= pd < shiftEnd, but shiftEnd is next day 08:59, so use string compare)
      // Since shift is 09:00-09:00, a payment on shiftEnd date before 09:00 should still count to previous shift — approximate by date string
      // For dashboard we use calendar shift date (shiftStartStr) as key: payment belongs to shift that started that date
      let payShift = pd;
      // If payment time is before shiftStartHour, it belongs to previous shift — but p.date has no time, so assume 12:00
      // Keep simple: if pd >= shiftStartYMD && pd < shiftEndYMD+1 day, count it. Use string compare: pd === shiftStartYMD
      if (pd === shiftStartYMD) roomRevenueToday += Number(p.amount)||0;
    }
  }
  // Fallback for legacy bookings with no payments array but paid>0
  if (roomRevenueToday===0) {
    const legacy = await Booking.aggregate([
      { $match: { status: { $in: ['checkedin','checkout'] }, checkin: { $gte: shiftStartYMD, $lte: shiftEndYMD } } },
      { $group: { _id: null, total: { $sum: '$paid' } } }
    ]);
    if (legacy[0]?.total) roomRevenueToday = legacy[0].total;
  }

  // Restaurant & poolbar revenue (from Sales collection)
  const restaurantRevenueToday = restaurantSales[0]?.total || 0;
  const poolbarRevenueToday = poolbarSales[0]?.total || 0;
  const totalRevenueToday = roomRevenueToday + restaurantRevenueToday + poolbarRevenueToday;

  res.json({
    success: true,
    data: {
      rooms: {
        vacant: statusMap.vacant || 0,
        available: statusMap.vacant || 0,
        occupied: statusMap.checkedin || 0,
        checkedin: statusMap.checkedin || 0,
        maintenance: statusMap.maintenance || 0,
        reserved: statusMap.reserved || 0,
        cleaning: statusMap.cleaning || 0,
        total: totalRooms,
      },
      todayBookings,
      restaurantSalesToday: restaurantRevenueToday,
      poolbarSalesToday: poolbarRevenueToday,
      totalRevenueToday,
      pendingProcurement,
      lowStock,
      staffOnDuty,
      recentActivity,
    },
  });
});
