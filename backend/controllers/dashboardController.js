const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Sale = require('../models/Sale');
const LedgerEntry = require('../models/LedgerEntry');
const PurchaseRequest = require('../models/PurchaseRequest');
const KitchenStock = require('../models/KitchenStock');
const Staff = require('../models/Staff');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

exports.overview = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    roomsByStatus,
    totalRooms,
    todayBookings,
    restaurantSales,
    poolbarSales,
    totalRevenue,
    pendingProcurement,
    lowStock,
    staffOnDuty,
    recentActivity,
  ] = await Promise.all([
    Room.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Room.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: today.getTime() } }),
    Sale.aggregate([
      { $match: { source: 'Restaurant', status: 'completed', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Sale.aggregate([
      { $match: { source: 'Poolbar', status: 'completed', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    LedgerEntry.aggregate([
      { $match: { type: 'income', date: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    PurchaseRequest.countDocuments({ status: { $in: ['pending', 'accountant', 'gm', 'Pending'] } }),
    KitchenStock.countDocuments({ $expr: { $lte: ['$qty', '$min'] } }),
    Staff.countDocuments({ status: 'on_duty' }),
    Activity.find().sort({ createdAt: -1 }).limit(10),
  ]);

  const statusMap = {};
  for (const entry of roomsByStatus) {
    statusMap[entry._id] = entry.count;
  }

  res.json({
    success: true,
    data: {
      rooms: {
        vacant: statusMap.vacant || statusMap.available || 0,
        available: statusMap.vacant || statusMap.available || 0,
        occupied: statusMap.occupied || statusMap.checkedin || 0,
        checkedin: statusMap.checkedin || statusMap.occupied || 0,
        maintenance: statusMap.maintenance || 0,
        reserved: statusMap.reserved || 0,
        cleaning: statusMap.cleaning || 0,
        total: totalRooms,
      },
      todayBookings,
      restaurantSalesToday: restaurantSales[0]?.total || 0,
      poolbarSalesToday: poolbarSales[0]?.total || 0,
      totalRevenueToday: totalRevenue[0]?.total || 0,
      pendingProcurement,
      lowStock,
      staffOnDuty,
      recentActivity,
    },
  });
});
