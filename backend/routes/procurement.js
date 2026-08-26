const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const auth = require('../middleware/auth');
const { roleGuard, departmentGuard, privilegeGuard } = require('../middleware/roleGuard');
const {
  validateCreatePR, validateUpdatePR, validateApprove, validateReject, validateCreatePO,
  validateVoidAndCorrect,
  validateCreateSupplier, validateUpdateSupplier, validateCategoryName,
  validateObjectIdParam, validateStringParam,
} = require('../middleware/procurementValidators');

router.use(auth);

const inDept  = departmentGuard('Procurement');
const isAdmin = roleGuard('admin');

/* Purchase Requests / Orders — po-form.html + po-history.html +
   requisition-history.html all read/write through these. A PR and its
   eventual PO are the same record (poNo/supplier get set on it once
   createPO fires), matching ProcurementService's single-object model. */
router.get('/requests', procurementController.listPRs);
router.get('/requests/:id', validateObjectIdParam('id'), procurementController.getPR);
router.post('/requests', inDept, privilegeGuard('procurement', 'canCreate'), validateCreatePR, procurementController.createPR);
router.put('/requests/:id', inDept, privilegeGuard('procurement', 'canEdit'), validateObjectIdParam('id'), validateUpdatePR, procurementController.updatePR);
router.post('/requests/:id/approve', inDept, privilegeGuard('procurement', 'canApprove'), validateObjectIdParam('id'), validateApprove, procurementController.approvePR);
router.post('/requests/:id/reject', inDept, privilegeGuard('procurement', 'canReject'), validateObjectIdParam('id'), validateReject, procurementController.rejectPR);
router.post('/requests/:id/create-po', inDept, privilegeGuard('procurement', 'canCreate'), validateObjectIdParam('id'), validateCreatePO, procurementController.createPO);
router.post('/requests/:id/void-correct', inDept, privilegeGuard('procurement', 'canEdit'), validateObjectIdParam('id'), validateVoidAndCorrect, procurementController.voidAndCorrectPO);

/* po-form.html create/edit modes call these two directly — same as
   /requests above but named to match the frontend's
   createPurchaseOrder()/updatePurchaseOrder() calls one-to-one. */
router.get('/purchase-orders', procurementController.listPOs);
router.post('/purchase-orders', inDept, privilegeGuard('procurement', 'canCreate'), validateCreatePR, procurementController.createPR);
router.put('/purchase-orders/:id', inDept, privilegeGuard('procurement', 'canEdit'), validateObjectIdParam('id'), validateUpdatePR, procurementController.updatePR);

router.get('/item-catalog', procurementController.getItemCatalog);

/* Suppliers */
router.get('/suppliers', procurementController.listSuppliers);
router.get('/suppliers/:id', validateObjectIdParam('id'), procurementController.getSupplier);
router.post('/suppliers', inDept, privilegeGuard('procurement', 'canCreate'), validateCreateSupplier, procurementController.createSupplier);
router.put('/suppliers/:id', inDept, privilegeGuard('procurement', 'canEdit'), validateObjectIdParam('id'), validateUpdateSupplier, procurementController.updateSupplier);

/* Categories */
router.get('/categories', procurementController.listCategories);
router.post('/categories', inDept, privilegeGuard('procurement', 'canCreate'), validateCategoryName, procurementController.addCategory);
router.put('/categories/:name', inDept, privilegeGuard('procurement', 'canEdit'), validateCategoryName, procurementController.renameCategory);
router.delete('/categories/:name', isAdmin, procurementController.deleteCategory);

/* Store → Procurement bridge */
router.get('/incoming-store-requests', procurementController.listIncomingStoreRequests);
router.post('/incoming-store-requests/:no/import', inDept, privilegeGuard('procurement', 'canCreate'), validateStringParam('no'), procurementController.importStoreRequest);

/* Dashboard */
router.get('/dashboard', procurementController.dashboardKPIs);
router.get('/pipeline', procurementController.approvalPipelineCounts);

module.exports = router;
