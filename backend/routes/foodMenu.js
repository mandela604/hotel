const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/foodMenuController');
const { roleGuard } = require('../middleware/roleGuard');

const canManage = roleGuard('admin', 'manager');

// Reads: any authenticated user (both depts need it to sell)
router.get('/', ctrl.listFoodMenu);

// Writes: admin/manager only (entered once, centrally)
router.post('/', canManage, ctrl.addFoodMenuItem);
router.put('/:id', canManage, ctrl.updateFoodMenuItem);
router.patch('/:id', canManage, ctrl.updateFoodMenuItem);
router.delete('/:id', canManage, ctrl.deleteFoodMenuItem);

module.exports = router;
