const router = require('express').Router();
const ctrl = require('../controllers/procurementController');

router.get('/prs',                ctrl.listPRs);
router.post('/prs',               ctrl.createPR);
router.put('/prs/:id/approve',    ctrl.approvePR);
router.put('/prs/:id/reject',     ctrl.rejectPR);
router.get('/pos',                ctrl.listPOs);
router.post('/pos',               ctrl.createPO);
router.put('/pos/:id',            ctrl.updatePO);
router.get('/suppliers',          ctrl.listSuppliers);
router.post('/suppliers',         ctrl.createSupplier);
router.put('/suppliers/:id',      ctrl.updateSupplier);
router.delete('/suppliers/:id',   ctrl.deleteSupplier);
router.post('/goods-receipt',     ctrl.receiveGoods);

module.exports = router;
