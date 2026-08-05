const router = require('express').Router();
const ctrl = require('../controllers/roomController');

router.get('/', ctrl.listRooms);
router.get('/with-status', ctrl.roomsWithStatus);
router.post('/sync', ctrl.syncRooms);
router.post('/', ctrl.createRoom);
router.put('/:num', ctrl.updateRoom);
router.patch('/:num/status', ctrl.setRoomStatus);
router.delete('/:num', ctrl.deleteRoom);

module.exports = router;
