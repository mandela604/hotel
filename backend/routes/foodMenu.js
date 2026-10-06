const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/foodMenuController');
const { roleGuard } = require('../middleware/roleGuard');

const canManage = roleGuard('admin', 'manager');

// Reads: any authenticated user (both depts need it to sell)
router.get('/', ctrl.listFoodMenu);

// Categories must come before /:id so "categories" isn't treated as an id
router.get('/categories', ctrl.listCategories);
router.post('/categories', canManage, ctrl.addCategory);
router.put('/categories/:id', canManage, ctrl.renameCategory);
router.patch('/categories/:id', canManage, ctrl.renameCategory);
router.delete('/categories/:id', canManage, ctrl.deleteCategory);

// Writes: admin/manager only (entered once, centrally)
router.post('/', canManage, ctrl.addFoodMenuItem);
router.put('/:id', canManage, ctrl.updateFoodMenuItem);
router.patch('/:id', canManage, ctrl.updateFoodMenuItem);
router.delete('/:id', canManage, ctrl.deleteFoodMenuItem);

module.exports = router;
