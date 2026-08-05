const router = require('express').Router();
const ctrl = require('../controllers/bookingController');

router.get('/', ctrl.listBookings);
router.post('/sync', ctrl.syncBookings);
router.post('/', ctrl.createBooking);
router.get('/:id', ctrl.getBooking);
router.put('/:id', ctrl.updateBooking);
router.patch('/:id/status', ctrl.setStatus);
router.delete('/:id', ctrl.cancelBooking);

module.exports = router;
