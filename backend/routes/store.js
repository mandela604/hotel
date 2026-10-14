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
  validateDepartmentIssue,
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

/* Department Issues — direct counter issue to Housekeeping / Laundry.
   The receiving dept staff member authenticates with their OWN password
   inside the same request (verifyReceiver) before stock is deducted. */
router.get('/department-staff', inDept, storeController.listDepartmentStaff);
router.post('/department-issues', inDept, privilegeGuard('store', 'canRestock'), validateDepartmentIssue, storeController.createDepartmentIssue);

router.post('/stock/:id/adjust', isAdmin, storeController.adjustStock);
router.post('/migrate/reset-all-stock', storeController.resetAllStock);
/* Start-afresh wipe: Restaurant + Pool Bar stock BALANCES (qty→0, catalog
   kept), movements/requisitions/transfers/COO + RREQ/BREQ counters. GET
   previews counts (dry run), POST actually runs. Admin only. */
router.get('/migrate/reset-outlet-data', isAdmin, storeController.resetOutletData);
router.post('/migrate/reset-outlet-data', isAdmin, storeController.resetOutletData);
/* Recovery: rebuild Restaurant + Pool Bar item catalogs (qty 0) from
   surviving Sales/Orders + Store movement ledger, or full Store catalog
   mirror with ?mirror=1. GET previews, POST applies. Admin only. */
router.get('/migrate/rebuild-outlet-stock', isAdmin, storeController.rebuildOutletStock);
router.post('/migrate/rebuild-outlet-stock', isAdmin, storeController.rebuildOutletStock);

module.exports = router;
