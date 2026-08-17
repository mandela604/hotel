const router = require('express').Router();
const ctrl = require('../controllers/storeController');

router.get('/stock', ctrl.listStock);
router.post('/stock', ctrl.createStock);
router.put('/stock/:id', ctrl.updateStock);
router.delete('/stock/:id', ctrl.deleteStock);

router.get('/requisitions', ctrl.listRequisitions);
router.post('/requisitions', ctrl.createRequisition);
router.put('/requisitions/:id/issue', ctrl.issueRequisition);
router.put('/requisitions/:id/reject', ctrl.rejectRequisition);

router.post('/goods-receipt', ctrl.receiveGoods);

module.exports = router;
