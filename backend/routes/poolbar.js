const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/poolbarController');
const auth    = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const {
  validateAddStock,
  validateUpdateStock,
  validateDeductStock,
  validateDeductById,
  validateCreateSale,
  validateVoidSale,
  validateOpenOrder,
  validateCancelOrder,
  validateCreateRequisition,
  validateObjectIdParam,
  validateStrictObjectIdParam,
} = require('../middleware/poolbarValidators');

router.use(auth);

/* ── Stock ──────────────────────────────────── */
router.get('/stock',   ctrl.listStock);
router.post('/stock',  roleGuard('admin','manager','poolbar_staff'), validateAddStock,  ctrl.addStock);
router.put('/stock/:id', roleGuard('admin','manager','poolbar_staff'), validateStrictObjectIdParam('id'), validateUpdateStock, ctrl.updateStock);
router.delete('/stock/:id', roleGuard('admin'), validateStrictObjectIdParam('id'), ctrl.deleteStock);
router.post('/stock/deduct', validateDeductStock, ctrl.deductStock);
router.post('/stock/:id/deduct', validateStrictObjectIdParam('id'), validateDeductById, ctrl.deductStockById);

/* ── Sales ──────────────────────────────────── */
router.get('/sales',  ctrl.listSales);
router.post('/sales', validateCreateSale, ctrl.createSale);
router.post('/sales/:id/void', roleGuard('admin','manager','poolbar_staff'), validateObjectIdParam('id'), validateVoidSale, ctrl.voidSale);

/* ── Orders / Tabs ──────────────────────────── */
router.get('/orders',  ctrl.listOrders);
router.post('/orders', validateOpenOrder, ctrl.openOrder);
router.put('/orders/:id', validateObjectIdParam('id'), ctrl.updateOrder);
router.post('/orders/:id/pay', validateObjectIdParam('id'), ctrl.payOrder);
router.post('/orders/:id/cancel', validateObjectIdParam('id'), validateCancelOrder, ctrl.cancelOrder);

/* ── Requisitions (Pool Bar → Store) ─────────── */
router.get('/requisitions',  ctrl.listRequisitions);
router.post('/requisitions', validateCreateRequisition, ctrl.createRequisition);

/* ── Movements ──────────────────────────────── */
router.get('/movements', ctrl.listMovements);

module.exports = router;