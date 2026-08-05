const router = require('express').Router();
const ctrl = require('../controllers/accountingController');

/* Transactions & Summaries */
router.get('/transactions', ctrl.listTransactions);
router.post('/transactions', ctrl.createTransaction);
router.get('/summary', ctrl.getFinancialSummary);

/* Shift Reconciliation */
router.get('/shifts', ctrl.listShifts);
router.get('/shifts/:key', ctrl.getShift);
router.post('/shifts', ctrl.createShift);
router.patch('/shifts/:key', ctrl.reconcileShift);

module.exports = router;
