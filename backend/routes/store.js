const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { roleGuard, departmentGuard, privilegeGuard } = require('../middleware/roleGuard');
const sanitize = require('../middleware/sanitize');
const {
  validateAddStock,
  validateUpdateStock,
  validateAddCategory,
  validateRenameCategory,
  validateSubmitRequisition,
  validateUpdateRequisition,
  validateIssueRequisition,
  validateRejectRequisition,
  validateRejectDelivery,
  validateParam,
} = require('../middleware/storeValidators');

// auth is already applied at the mount point in server.js — no router.use(auth) here
router.use(sanitize);

const inDept  = departmentGuard('Store');
const isAdmin = roleGuard('admin');

/* Stock */
router.get('/stock', storeController.listStock);
router.get('/catalog', storeController.storeCatalog);
router.post('/stock', inDept, privilegeGuard('store', 'canCreate'), validateAddStock, storeController.addStock);
router.put('/stock/:id', inDept, privilegeGuard('store', 'canEdit'), validateParam('id'), validateUpdateStock, storeController.updateStock);
router.patch('/stock/:id/receive', inDept, privilegeGuard('store', 'canEdit'), validateParam('id'), storeController.receiveStock);
router.delete('/stock/:id', isAdmin, validateParam('id'), storeController.deleteStock);

/* Categories */
router.get('/categories', storeController.listCategories);
router.post('/categories', inDept, privilegeGuard('store', 'canCreate'), validateAddCategory, storeController.addCategory);
router.put('/categories/:name', inDept, privilegeGuard('store', 'canEdit'), validateParam('name'), validateRenameCategory, storeController.renameCategory);
router.delete('/categories/:name', isAdmin, validateParam('name'), storeController.deleteCategory);

/* Requisitions — store_issue (any dept -> Store) and purchase (Store -> Procurement) */
router.get('/requisitions', storeController.listRequisitions);
router.get('/requisitions/next-number', storeController.peekNextRequisitionNumber);
router.get('/requisitions/:no', validateParam('no'), storeController.getRequisition);
router.post('/requisitions', inDept, privilegeGuard('store', 'canCreate'), validateSubmitRequisition, storeController.submitRequisition);
router.put('/requisitions/:no', inDept, privilegeGuard('store', 'canEdit'), validateParam('no'), validateUpdateRequisition, storeController.updateRequisition);
router.patch('/requisitions/:no/issue', inDept, privilegeGuard('store', 'canRestock'), validateParam('no'), validateIssueRequisition, storeController.issueRequisition);
router.patch('/requisitions/:no/reject', inDept, privilegeGuard('store', 'canReject'), validateParam('no'), validateRejectRequisition, storeController.rejectRequisition);
router.patch('/requisitions/:no/confirm', inDept, privilegeGuard('store', 'canApprove'), validateParam('no'), storeController.confirmReceipt);
router.patch('/requisitions/:no/dispute', inDept, privilegeGuard('store', 'canApprove'), validateParam('no'), validateRejectDelivery, storeController.disputeDelivery);

module.exports = router;
