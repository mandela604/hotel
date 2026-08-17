const router = require('express').Router();
const {
  listRooms,
  getRoom,
  updateRoom,
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  checkout,
} = require('../controllers/bookingController');

router.get('/', listRooms);
router.get('/list', listBookings);
router.post('/list', createBooking);
router.put('/list/:id', updateBooking);
router.post('/list/:id/checkout', checkout);
router.get('/:id', getRoom);
router.put('/:id', updateRoom);

module.exports = router;
