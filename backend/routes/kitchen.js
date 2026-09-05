const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/kitchenController');
const { roleGuard, departmentGuard, privilegeGuard } = require('../middleware/roleGuard');
const {
  validateAddStock,
  validateUpdateStock,
  validateDeductStock,
  validateRecordProduction,
  validateCompleteProduction,
  validateVoidProduction,
  validateAddTransfer,
  validateTransferStatus,
  validateCreateRecipe,
  validateCreateRequisition,
  validateObjectIdParam,
} = require('../middleware/kitchenValidators');

// auth is already applied at the mount point in server.js — no router.use(auth) here

const inDept  = departmentGuard('Kitchen');
const isAdmin = roleGuard('admin');

/* ── Stock ──────────────────────────────────── */
router.get('/stock',   ctrl.listStock);
router.post('/stock',  inDept, privilegeGuard('kitchen', 'canCreate'), validateAddStock,  ctrl.addStock);
router.put('/stock/:id', inDept, privilegeGuard('kitchen', 'canEdit'), validateObjectIdParam('id'), validateUpdateStock, ctrl.updateStock);
router.delete('/stock/:id', isAdmin, validateObjectIdParam('id'), ctrl.deleteStock);
router.post('/stock/deduct', inDept, privilegeGuard('kitchen', 'canEdit'), validateDeductStock, ctrl.deductStock);

/* ── Production ─────────────────────────────── */
router.get('/production', ctrl.listProduction);
router.post('/production', inDept, privilegeGuard('kitchen', 'canCreate'), validateRecordProduction, ctrl.recordProduction);
router.put('/production/:id/complete', inDept, privilegeGuard('kitchen', 'canEdit'), validateObjectIdParam('id'), validateCompleteProduction, ctrl.completeProduction);
router.post('/production/:id/void', inDept, privilegeGuard('kitchen', 'canVoid'), validateObjectIdParam('id'), validateVoidProduction, ctrl.voidProduction);

/* ── Transfers ──────────────────────────────── */
router.get('/transfers',  ctrl.listTransfers);
router.post('/transfers', inDept, privilegeGuard('kitchen', 'canCreate'), validateAddTransfer, ctrl.addTransfer);
router.patch('/transfers/:id/status', inDept, privilegeGuard('kitchen', 'canEdit'), validateObjectIdParam('id'), validateTransferStatus, ctrl.updateTransferStatus);

/* ── Recipes ────────────────────────────────── */
router.get('/recipes',  ctrl.listRecipes);
router.post('/recipes', inDept, privilegeGuard('kitchen', 'canCreate'), validateCreateRecipe, ctrl.createRecipe);
router.put('/recipes/:id', inDept, privilegeGuard('kitchen', 'canEdit'), validateObjectIdParam('id'), ctrl.editRecipe);
router.delete('/recipes/:id', isAdmin, validateObjectIdParam('id'), ctrl.deleteRecipe);

/* ── Requisitions ───────────────────────────── */
router.get('/requisitions', ctrl.listKitchenRequisitions);
router.post('/requisitions', inDept, privilegeGuard('kitchen', 'canCreate'), validateCreateRequisition, ctrl.createRequisition);
router.post('/requisitions/:id/receive', inDept, privilegeGuard('kitchen', 'canCreate'), ctrl.receiveRequisition);

/* ── COO Orders ───────────────────────────── */
const cooCtrl = require('../controllers/kitchenCooController');
router.get('/coo-orders', cooCtrl.listCoo);
router.post('/coo-orders', departmentGuard('Restaurant'), privilegeGuard('restaurant','canCreate'), cooCtrl.createCoo);
router.post('/coo-orders/:id/accept', inDept, privilegeGuard('kitchen','canEdit'), cooCtrl.acceptCoo);
router.post('/coo-orders/:id/reject', inDept, cooCtrl.rejectCoo);

/* ── Movements ──────────────────────────────── */
router.get('/movements', ctrl.listMovements);

module.exports = router;
