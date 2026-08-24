const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const sanitize = require('../middleware/sanitize');
const {
  validateAddStock,
  validateUpdateStock,
  validateAddCategory,
  validateRenameCategory,
  validateSubmitRequisition,
  validateIssueRequisition,
  validateRejectRequisition,
  validateRejectDelivery,
  validateParam,
} = require('../middleware/storeValidators');

router.use(auth);
router.use(sanitize);

/* Stock */
router.get('/stock', storeController.listStock);
router.post('/stock', roleGuard(['admin', 'manager', 'store_keeper']), validateAddStock, storeController.addStock);
router.put('/stock/:id', roleGuard(['admin', 'manager', 'store_keeper']), validateParam('id'), validateUpdateStock, storeController.updateStock);
router.delete('/stock/:id', roleGuard(['admin', 'manager', 'store_keeper']), validateParam('id'), storeController.deleteStock);

/* Categories */
router.get('/categories', storeController.listCategories);
router.post('/categories', roleGuard(['admin', 'manager', 'store_keeper']), validateAddCategory, storeController.addCategory);
router.put('/categories/:name', roleGuard(['admin', 'manager', 'store_keeper']), validateParam('name'), validateRenameCategory, storeController.renameCategory);
router.delete('/categories/:name', roleGuard(['admin', 'manager', 'store_keeper']), validateParam('name'), storeController.deleteCategory);

/* Requisitions — store_issue (any dept -> Store) and purchase (Store -> Procurement) */
router.get('/requisitions', storeController.listRequisitions);
router.get('/requisitions/next-number', storeController.peekNextRequisitionNumber);
router.get('/requisitions/:no', validateParam('no'), storeController.getRequisition);
router.post('/requisitions', validateSubmitRequisition, storeController.submitRequisition);
router.patch('/requisitions/:no/issue', roleGuard(['admin', 'manager', 'store_keeper']), validateParam('no'), validateIssueRequisition, storeController.issueRequisition);
router.patch('/requisitions/:no/reject', roleGuard(['admin', 'manager', 'store_keeper']), validateParam('no'), validateRejectRequisition, storeController.rejectRequisition);
router.patch('/requisitions/:no/confirm', validateParam('no'), storeController.confirmReceipt);
router.patch('/requisitions/:no/dispute', validateParam('no'), validateRejectDelivery, storeController.disputeDelivery);

module.exports = router;