const router = require('express').Router();
const ctrl = require('../controllers/staffController');

router.get('/', ctrl.listStaff);
router.get('/:id', ctrl.getStaff);
router.post('/', ctrl.createStaff);
router.put('/:id', ctrl.updateStaff);
router.delete('/:id', ctrl.deleteStaff);

module.exports = router;
