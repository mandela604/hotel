const router = require('express').Router();
const ctrl = require('../controllers/accountingController');
const { departmentGuard, privilegeGuard } = require('../middleware/roleGuard');

// auth is already applied at the mount point in server.js — no router.use(auth) here

/* ── Read-only (any authenticated user) ────────────────────── */
router.get('/summary',              ctrl.summary);
router.get('/ledger',               ctrl.ledger);
router.get('/transactions',         ctrl.transactions);
router.get('/pnl',                  ctrl.pnl);
router.get('/shifts',               ctrl.listShifts);

/* ── Write routes — Accounts department ────────────────────── */
const inDept = departmentGuard('Accounts');

router.post('/pnl/income',          inDept, privilegeGuard('accounting', 'canCreate'), ctrl.addIncome);
router.put('/pnl/income/:id',       inDept, privilegeGuard('accounting', 'canEdit'),   ctrl.updateIncome);
router.delete('/pnl/income/:id',    inDept, privilegeGuard('accounting', 'canDelete'), ctrl.deleteIncome);
router.post('/pnl/expense',         inDept, privilegeGuard('accounting', 'canCreate'), ctrl.addExpense);
router.put('/pnl/expense/:id',      inDept, privilegeGuard('accounting', 'canEdit'),   ctrl.updateExpense);
router.delete('/pnl/expense/:id',   inDept, privilegeGuard('accounting', 'canDelete'), ctrl.deleteExpense);
router.post('/shifts',              inDept, privilegeGuard('accounting', 'canCreate'), ctrl.openShift);
router.put('/shifts/:id/reconcile', inDept, privilegeGuard('accounting', 'canEdit'),   ctrl.reconcileShift);

module.exports = router;
