const router = require('express').Router();
const ctrl = require('../controllers/procurementController');

/* Requisitions */
router.get('/requisitions', ctrl.listRequisitions);
router.get('/requisitions/:id', ctrl.getRequisition);
router.post('/requisitions', ctrl.createRequisition);
router.patch('/requisitions/:id/status', ctrl.updateRequisitionStatus);
router.patch('/requisitions/:id/fulfill', ctrl.fulfillRequisition);
router.post('/requisitions/:id/escalate', ctrl.escalateToProcurement);

/* Purchase Requests */
router.get('/requests', ctrl.listPurchaseRequests);
router.post('/requests', ctrl.createPurchaseRequest);
router.patch('/requests/:id/approval', ctrl.updatePRApproval);

/* Suppliers */
router.get('/suppliers', ctrl.listSuppliers);
router.post('/suppliers', ctrl.createSupplier);

module.exports = router;
