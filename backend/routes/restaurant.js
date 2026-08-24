const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const v = require('../middleware/restaurantValidators');

router.use(auth);

const canManage = roleGuard(['admin', 'manager', 'restaurant_manager']);
const canSell = roleGuard(['admin', 'manager', 'restaurant_manager', 'waiter', 'cashier']);

/* Menu */
router.get('/menu', restaurantController.listMenu);
router.post('/menu', canManage, v.validateAddMenuItem, restaurantController.addMenuItem);
router.put('/menu/:id', canManage, v.validateParam('id'), v.validateUpdateMenuItem, restaurantController.updateMenuItem);
router.patch('/menu/:id', canManage, v.validateParam('id'), v.validateUpdateMenuItem, restaurantController.patchMenuItem);
router.delete('/menu/:id', canManage, v.validateParam('id'), restaurantController.deleteMenuItem);

/* Stock */
router.get('/stock', restaurantController.listStock);
router.post('/stock', canManage, v.validateAddStock, restaurantController.addStockItem);
router.put('/stock/:name', canManage, v.validateParam('name'), v.validateUpdateStock, restaurantController.editStockItem);
router.delete('/stock/:name', canManage, v.validateParam('name'), restaurantController.deleteStockItem);
router.get('/movements', restaurantController.listMovements);

/* Sales */
router.get('/sales', restaurantController.listSales);
router.post('/sales', canSell, v.validateCreateSale, restaurantController.createSale);
router.post('/sales/:id/void', canManage, v.validateParam('id'), v.validateVoidSale, restaurantController.voidSale);

/* Transfers (incoming from Kitchen/Store) */
router.get('/transfers', restaurantController.listTransfers);
router.post('/transfers/:id/accept', canSell, v.validateParam('id'), restaurantController.acceptTransfer);
router.post('/transfers/:id/reject', canSell, v.validateParam('id'), v.validateRejectTransfer, restaurantController.rejectTransfer);

/* Requisitions (Restaurant -> Store) */
router.get('/requisitions', restaurantController.listRestaurantRequisitions);
router.post('/requisitions', canManage, v.validateSubmitRequisition, restaurantController.submitRequisition);

module.exports = router;