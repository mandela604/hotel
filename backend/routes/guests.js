const router = require('express').Router();
const ctrl = require('../controllers/guestController');

router.get('/', ctrl.listGuests);
router.get('/search', ctrl.listGuests);
router.get('/:id', ctrl.getGuest);
router.patch('/:id', ctrl.updateGuest);
router.post('/:id/charges', ctrl.addCharge);
router.patch('/:id/charges/settle-all', ctrl.settleAllCharges);
router.patch('/:id/charges/:chargeId', ctrl.settleCharge);

module.exports = router;
