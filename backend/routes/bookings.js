const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const roleGuard = require('../middleware/roleGuard');
const v = require('../middleware/bookingValidators');
const { createRateLimiter } = require('../middleware/rateLimiter');

// NOTE: no router.use(auth) here — server.js already applies `auth` at
// the mount point (app.use('/api/booking', auth, require('./routes/bookings')));
// running it again here meant every request did two redundant
// User.findById lookups. req.user is already populated by the time any
// handler below runs.

const canManage = roleGuard(['admin', 'manager', 'front_desk']);

// Tighter than the global /api/* limiter (600/15min) — booking creation
// and payment recording are the two endpoints a compromised or scripted
// front-desk session could hammer to spam reservations / fake payment
// entries. 30 writes per 5 min is generous for a human at a desk, not
// for a bot.
const bookingWriteLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 30 });

/* Combined read — one round trip for dashboard/list/rooms/reports/guests,
   mirrors the frontend's BookingData.getBookingData() call. */
router.get('/data', bookingController.getBookingData);

/* Rooms */
router.get('/rooms', bookingController.listRooms);
router.post('/rooms', canManage, v.validateAddRoom, bookingController.addRoom);
router.put('/rooms/:num', canManage, v.validateParam('num'), v.validateUpdateRoom, bookingController.updateRoom);
router.delete('/rooms/:num', canManage, v.validateParam('num'), bookingController.deleteRoom);
router.patch('/rooms/:num/status', roleGuard(['admin', 'manager', 'front_desk', 'housekeeping']), v.validateParam('num'), v.validateRoomStatus, bookingController.setRoomStatus);

/* Bookings */
router.get('/bookings', bookingController.listBookings);
router.get('/bookings/:room', v.validateParam('room'), bookingController.getBooking);
router.post('/bookings', bookingWriteLimiter, canManage, v.validateCreateBooking, bookingController.createBooking);
router.put('/bookings/:room', canManage, v.validateParam('room'), v.validateUpdateBooking, bookingController.updateBooking);
router.delete('/bookings/:room', canManage, v.validateParam('room'), bookingController.deleteBooking);
router.post('/bookings/:room/checkin', roleGuard(['admin', 'manager', 'front_desk']), v.validateParam('room'), v.validateCheckin, bookingController.checkinBooking);
router.post('/bookings/:room/checkout', roleGuard(['admin', 'manager', 'front_desk']), v.validateParam('room'), bookingController.checkoutBooking);
router.post('/bookings/:room/payments', bookingWriteLimiter, roleGuard(['admin', 'manager', 'front_desk']), v.validateParam('room'), v.validateAddPayment, bookingController.addPayment);

/* Guests */
router.get('/guests', bookingController.listGuests);
router.get('/guests/:id', v.validateParam('id'), bookingController.getGuest);
router.patch('/guests/:id', canManage, v.validateParam('id'), v.validateSaveGuest, bookingController.saveGuest);
router.post('/guests/:id/charges', canManage, v.validateParam('id'), v.validateAddCharge, bookingController.addCharge);
router.patch('/guests/:id/charges/:chargeId/settle', canManage, v.validateParam('id'), v.validateStrictObjectIdParam('chargeId'), v.validateSettleCharge, bookingController.settleCharge);
router.post('/guests/:id/charges/settle-all', canManage, v.validateParam('id'), v.validateSettleCharge, bookingController.settleAllCharges);

module.exports = router;