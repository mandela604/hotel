const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { CAN_MANAGE_PR, CAN_APPROVE } = require('../middleware/procurementRoles');
const {
  validateCreatePR, validateUpdatePR, validateApprove, validateReject, validateCreatePO,
  validateCreateSupplier, validateUpdateSupplier, validateCategoryName,
  validateObjectIdParam, validateStringParam,
} = require('../middleware/procurementValidators');

router.use(auth);

/* Purchase Requests / Orders — po-form.html + po-history.html +
   requisition-history.html all read/write through these. A PR and its
   eventual PO are the same record (poNo/supplier get set on it once
   createPO fires), matching ProcurementService's single-object model. */
router.get('/requests', procurementController.listPRs);
router.get('/requests/:id', validateObjectIdParam('id'), procurementController.getPR);
router.post('/requests', roleGuard(CAN_MANAGE_PR), validateCreatePR, procurementController.createPR);
router.put('/requests/:id', roleGuard(CAN_MANAGE_PR), validateObjectIdParam('id'), validateUpdatePR, procurementController.updatePR);
router.post('/requests/:id/approve', roleGuard(CAN_APPROVE), validateObjectIdParam('id'), validateApprove, procurementController.approvePR);
router.post('/requests/:id/reject', roleGuard(CAN_APPROVE), validateObjectIdParam('id'), validateReject, procurementController.rejectPR);
router.post('/requests/:id/create-po', roleGuard(CAN_MANAGE_PR), validateObjectIdParam('id'), validateCreatePO, procurementController.createPO);

/* po-form.html create/edit modes call these two directly — same as
   /requests above but named to match the frontend's
   createPurchaseOrder()/updatePurchaseOrder() calls one-to-one. */
router.get('/purchase-orders', procurementController.listPOs);
router.post('/purchase-orders', roleGuard(CAN_MANAGE_PR), validateCreatePR, procurementController.createPR);
router.put('/purchase-orders/:id', roleGuard(CAN_MANAGE_PR), validateObjectIdParam('id'), validateUpdatePR, procurementController.updatePR);

router.get('/item-catalog', procurementController.getItemCatalog);

/* Suppliers */
router.get('/suppliers', procurementController.listSuppliers);
router.get('/suppliers/:id', validateObjectIdParam('id'), procurementController.getSupplier);
router.post('/suppliers', roleGuard(CAN_MANAGE_PR), validateCreateSupplier, procurementController.createSupplier);
router.put('/suppliers/:id', roleGuard(CAN_MANAGE_PR), validateObjectIdParam('id'), validateUpdateSupplier, procurementController.updateSupplier);

/* Categories */
router.get('/categories', procurementController.listCategories);
router.post('/categories', roleGuard(CAN_MANAGE_PR), validateCategoryName, procurementController.addCategory);
router.put('/categories/:name', roleGuard(CAN_MANAGE_PR), validateCategoryName, procurementController.renameCategory);
router.delete('/categories/:name', roleGuard(CAN_MANAGE_PR), procurementController.deleteCategory);

/* Store → Procurement bridge */
router.get('/incoming-store-requests', procurementController.listIncomingStoreRequests);
router.post('/incoming-store-requests/:no/import', roleGuard(CAN_MANAGE_PR), validateStringParam('no'), procurementController.importStoreRequest);

/* Dashboard */
router.get('/dashboard', procurementController.dashboardKPIs);
router.get('/pipeline', procurementController.approvalPipelineCounts);

module.exports = router;