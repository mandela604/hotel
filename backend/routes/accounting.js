const router = require('express').Router();
const ctrl = require('../controllers/accountingController');

router.get('/summary',          ctrl.summary);
router.get('/ledger',           ctrl.ledger);
router.get('/transactions',     ctrl.transactions);
router.get('/pnl',              ctrl.pnl);
router.post('/income',          ctrl.addIncome);
router.post('/expenses',        ctrl.addExpense);
router.get('/shifts',           ctrl.listShifts);
router.post('/shifts',          ctrl.openShift);
router.put('/shifts/:id/reconcile', ctrl.reconcileShift);

module.exports = router;
