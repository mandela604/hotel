const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { roleGuard, departmentGuard, privilegeGuard } = require('../middleware/roleGuard');
const v = require('../middleware/restaurantValidators');

const inDept   = departmentGuard('Restaurant');
const isAdmin  = roleGuard('admin');
const { validateAddCategory, validateRenameCategory } = require('../middleware/storeValidators');

/* Categories (persisted in the shared Category collection) */
router.get('/categories', inDept, restaurantController.listCategories);
router.post('/categories', inDept, privilegeGuard('restaurant', 'canCreate'), validateAddCategory, restaurantController.addCategory);
router.put('/categories/:name', inDept, privilegeGuard('restaurant', 'canEdit'), v.validateParam('name'), validateRenameCategory, restaurantController.renameCategory);
router.delete('/categories/:name', isAdmin, v.validateParam('name'), restaurantController.deleteCategory);

/* Menu */
router.get('/menu', restaurantController.listMenu);
router.post('/menu', inDept, privilegeGuard('restaurant', 'canCreate'), v.validateAddMenuItem, restaurantController.addMenuItem);
router.put('/menu/:id', inDept, privilegeGuard('restaurant', 'canEdit'), v.validateStrictUuidParam('id'), v.validateUpdateMenuItem, restaurantController.updateMenuItem);
router.patch('/menu/:id', inDept, privilegeGuard('restaurant', 'canEdit'), v.validateStrictUuidParam('id'), v.validateUpdateMenuItem, restaurantController.patchMenuItem);
router.delete('/menu/:id', isAdmin, v.validateStrictUuidParam('id'), restaurantController.deleteMenuItem);

/* Stock */
router.get('/stock', restaurantController.listStock);
router.post('/stock', inDept, privilegeGuard('restaurant', 'canCreate'), v.validateAddStock, restaurantController.addStockItem);
router.put('/stock/:name', inDept, privilegeGuard('restaurant', 'canEdit'), v.validateParam('name'), v.validateUpdateStock, restaurantController.editStockItem);
router.delete('/stock/:name', isAdmin, v.validateParam('name'), restaurantController.deleteStockItem);
router.get('/movements', restaurantController.listMovements);

/* Sales */
router.get('/sales', restaurantController.listSales);
router.post('/sales', inDept, privilegeGuard('restaurant', 'canCreate'), v.validateCreateSale, restaurantController.createSale);
router.post('/sales/:id/void', inDept, privilegeGuard('restaurant', 'canVoid'), v.validateParam('id'), v.validateVoidSale, restaurantController.voidSale);

/* Orders (Open Tab / Active Orders) */
router.get('/orders', restaurantController.listOrders);
router.post('/orders', inDept, privilegeGuard('restaurant', 'canCreate'), v.validateOpenTab, restaurantController.openTab);
router.patch('/orders/:id/serve', inDept, privilegeGuard('restaurant', 'canCreate'), v.validateParam('id'), restaurantController.markOrderServed);
router.post('/orders/:id/pay', inDept, privilegeGuard('restaurant', 'canEdit'), v.validateParam('id'), v.validatePayOrder, restaurantController.payOrder);
router.patch('/orders/:id/cancel', roleGuard('admin','manager'), v.validateParam('id'), restaurantController.cancelOrder);

/* Transfers (incoming from Kitchen/Store) */
router.get('/transfers', restaurantController.listTransfers);
router.post('/transfers/:id/accept', inDept, privilegeGuard('restaurant', 'canCreate'), v.validateParam('id'), restaurantController.acceptTransfer);
router.post('/transfers/:id/reject', inDept, privilegeGuard('restaurant', 'canReject'), v.validateParam('id'), v.validateRejectTransfer, restaurantController.rejectTransfer);

/* Requisitions (Restaurant -> Store) */
router.get('/requisitions', restaurantController.listRestaurantRequisitions);
router.post('/requisitions', inDept, privilegeGuard('restaurant', 'canCreate'), v.validateSubmitRequisition, restaurantController.submitRequisition);
router.post('/requisitions/:id/receive', inDept, privilegeGuard('restaurant', 'canCreate'), restaurantController.receiveRequisition);

module.exports = router;
