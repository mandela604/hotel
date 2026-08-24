const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.use(auth);

router.get('/', staffController.listStaff);
router.get('/:id', staffController.getStaffById);
router.post('/', roleGuard(['admin', 'manager']), staffController.createStaff);
router.put('/:id', roleGuard(['admin', 'manager']), staffController.updateStaff);
router.delete('/:id', roleGuard(['admin', 'manager']), staffController.deleteStaff);
router.patch('/:id/status', roleGuard(['admin', 'manager']), staffController.updateStatus);

module.exports = router;
