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
    bookingStatusCounts,
    totalRooms,
    todayBookings,
    restaurantSales,
    poolbarSales,
    pendingProcurement,
    lowStock,
    staffOnDuty,
    recentActivity,
  ] = await Promise.all([
    // Count rooms by status from Booking (not Room)
    Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
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
    PurchaseRequest.countDocuments({ status: { $in: ['pending', 'accountant', 'gm'] } }),
    KitchenStock.countDocuments({ $expr: { $lte: ['$qty', '$min'] } }),
    Staff.countDocuments({ status: 'on_duty' }),
    Activity.find().sort({ createdAt: -1 }).limit(10),
  ]);

  // Map booking statuses to readable counts
  const statusMap = {};
  for (const entry of bookingStatusCounts) {
    statusMap[entry._id] = entry.count;
  }

  // Room revenue: sum of paid from checkedin & checkout bookings (completed stays)
  const roomRevenueAgg = await Booking.aggregate([
    { $match: { status: { $in: ['checkedin', 'checkout'] } } },
    { $project: { paid: 1 } },
    { $group: { _id: null, total: { $sum: '$paid' } } }
  ]);
  const roomRevenueToday = roomRevenueAgg[0]?.total || 0;

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
