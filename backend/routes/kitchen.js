const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/kitchenController');
const auth    = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
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
  validateObjectIdParam,
} = require('../middleware/kitchenValidators');

router.use(auth);

/* ── Stock ──────────────────────────────────── */
router.get('/stock',   ctrl.listStock);
router.post('/stock',  roleGuard('admin','manager','head_chef'), validateAddStock,  ctrl.addStock);
router.put('/stock/:id', roleGuard('admin','manager','head_chef'), validateObjectIdParam('id'), validateUpdateStock, ctrl.updateStock);
router.delete('/stock/:id', roleGuard('admin'), validateObjectIdParam('id'), ctrl.deleteStock);
router.post('/stock/deduct', validateDeductStock, ctrl.deductStock);

/* ── Production ─────────────────────────────── */
router.get('/production', ctrl.listProduction);
router.post('/production', roleGuard('admin','manager','head_chef'), validateRecordProduction, ctrl.recordProduction);
router.put('/production/:id/complete', roleGuard('admin','manager','head_chef'), validateObjectIdParam('id'), validateCompleteProduction, ctrl.completeProduction);
router.post('/production/:id/void', roleGuard('admin','manager'), validateObjectIdParam('id'), validateVoidProduction, ctrl.voidProduction);

/* ── Transfers ──────────────────────────────── */
router.get('/transfers',  ctrl.listTransfers);
router.post('/transfers', validateAddTransfer, ctrl.addTransfer);
router.patch('/transfers/:id/status', validateObjectIdParam('id'), validateTransferStatus, ctrl.updateTransferStatus);

/* ── Recipes ────────────────────────────────── */
router.get('/recipes',  ctrl.listRecipes);
router.post('/recipes', roleGuard('admin','manager','head_chef'), validateCreateRecipe, ctrl.createRecipe);
router.put('/recipes/:id', roleGuard('admin','manager','head_chef'), validateObjectIdParam('id'), ctrl.editRecipe);
router.delete('/recipes/:id', roleGuard('admin'), validateObjectIdParam('id'), ctrl.deleteRecipe);

/* ── Requisitions ───────────────────────────── */
// Was missing entirely — kitchen-service.js's getKitchenRequisitions()
// (dashboard's "Incoming Store Requisitions" panel) has nothing to call
// without this route, and would 404 on every load.
router.get('/requisitions', ctrl.listKitchenRequisitions);

/* ── Movements ──────────────────────────────── */
router.get('/movements', ctrl.listMovements);

module.exports = router;