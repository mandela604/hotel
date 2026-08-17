const router = require('express').Router();
const ctrl = require('../controllers/kitchenController');

router.get('/stock', ctrl.listStock);
router.post('/stock', ctrl.createStock);
router.put('/stock/:id', ctrl.updateStock);
router.delete('/stock/:id', ctrl.deleteStock);

router.get('/production', ctrl.listProduction);
router.post('/production', ctrl.createProduction);
router.post('/production/:id/void', ctrl.voidProduction);

router.get('/transfers', ctrl.listTransfers);
router.post('/transfers', ctrl.createTransfer);
router.put('/transfers/:id', ctrl.updateTransfer);

module.exports = router;
