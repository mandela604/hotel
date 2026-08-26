const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/poolbarController');
const { roleGuard, departmentGuard, privilegeGuard } = require('../middleware/roleGuard');
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
} = require('../middleware/poolbarValidators');

// auth is already applied at the mount point in server.js — no router.use(auth) here

const inDept  = departmentGuard('Pool Bar');
const isAdmin = roleGuard('admin');
const inDeptCanView = [departmentGuard('Pool Bar'), privilegeGuard('poolbar', 'canView')];

/* ── Dashboard ──────────────────────────────── */
router.get('/dashboard', ...inDeptCanView, ctrl.getDashboard);

/* ── Stock ──────────────────────────────────── */
router.get('/stock',       ...inDeptCanView, ctrl.listStock);
router.post('/stock',      inDept, privilegeGuard('poolbar', 'canCreate'), validateAddStock,  ctrl.addStock);
router.put('/stock/:id',   inDept, privilegeGuard('poolbar', 'canEdit'),   validateObjectIdParam('id'), validateUpdateStock, ctrl.updateStock);
router.delete('/stock/:id', isAdmin, validateObjectIdParam('id'), ctrl.deleteStock);
router.post('/stock/deduct', inDept, privilegeGuard('poolbar', 'canEdit'), validateDeductStock, ctrl.deductStock);
router.post('/stock/:id/deduct', inDept, privilegeGuard('poolbar', 'canEdit'), validateObjectIdParam('id'), validateDeductById, ctrl.deductStockById);

/* ── Sales ──────────────────────────────────── */
router.get('/sales',  ...inDeptCanView, ctrl.listSales);
router.post('/sales', inDept, privilegeGuard('poolbar', 'canCreate'), validateCreateSale, ctrl.createSale);
router.post('/sales/:id/void', inDept, privilegeGuard('poolbar', 'canVoid'), validateObjectIdParam('id'), validateVoidSale, ctrl.voidSale);

/* ── Orders / Tabs ──────────────────────────── */
router.get('/orders',  ...inDeptCanView, ctrl.listOrders);
router.post('/orders', inDept, privilegeGuard('poolbar', 'canCreate'), validateOpenOrder, ctrl.openTab);
router.put('/orders/:id', inDept, privilegeGuard('poolbar', 'canEdit'), validateObjectIdParam('id'), ctrl.updateOrder);
router.post('/orders/:id/serve', inDept, privilegeGuard('poolbar', 'canEdit'), validateObjectIdParam('id'), ctrl.markServed);
router.post('/orders/:id/pay', inDept, privilegeGuard('poolbar', 'canEdit'), validateObjectIdParam('id'), ctrl.payOrder);
router.post('/orders/:id/cancel', inDept, privilegeGuard('poolbar', 'canManageOrders'), validateObjectIdParam('id'), validateCancelOrder, ctrl.cancelOrder);

/* ── Requisitions (Pool Bar → Store) ─────────── */
router.get('/requisitions',  ...inDeptCanView, ctrl.listRequisitions);
router.post('/requisitions', inDept, privilegeGuard('poolbar', 'canCreate'), validateCreateRequisition, ctrl.createRequisition);
router.post('/requisitions/:id/receive', inDept, privilegeGuard('poolbar', 'canCreate'), validateObjectIdParam('id'), ctrl.receiveRequisition);

/* ── Movements ──────────────────────────────── */
router.get('/movements', ...inDeptCanView, ctrl.listMovements);

module.exports = router;
