const router = require('express').Router();
const ctrl = require('../controllers/kitchenController');

/* Inventory */
router.get('/inventory', ctrl.listInventory);
router.post('/inventory', ctrl.createInventoryItem);
router.put('/inventory/:id', ctrl.updateInventoryItem);
router.delete('/inventory/:id', ctrl.deleteInventoryItem);

/* Production */
router.get('/production', ctrl.listProduction);
router.post('/production', ctrl.createProduction);
router.patch('/production/:id/status', ctrl.updateProductionStatus);

/* Transfers */
router.get('/transfers', ctrl.listTransfers);
router.post('/transfers', ctrl.createTransfer);

module.exports = router;
