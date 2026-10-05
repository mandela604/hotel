const router = require('express').Router();
const ctrl = require('../controllers/accountingController');
const { departmentGuard, privilegeGuard } = require('../middleware/roleGuard');
const v = require('../middleware/accountingValidators');

// auth is already applied at the mount point in server.js — no router.use(auth) here

/* ── Read-only (any authenticated user) ────────────────────── */
router.get('/summary',              ctrl.summary);
router.get('/ledger',               ctrl.ledger);
router.get('/transactions',         ctrl.transactions);
router.get('/pnl',                  ctrl.pnl);
router.get('/procurement-pnl',      ctrl.procurementPnl);
router.get('/shifts',               ctrl.listShifts);

/* ── Write routes — Accounts department ────────────────────── */
const inDept = departmentGuard('Accounts');

router.post('/pnl/income',          inDept, privilegeGuard('accounting', 'canCreate'), v.validateAddIncome, ctrl.addIncome);
router.put('/pnl/income/:id',       inDept, privilegeGuard('accounting', 'canEdit'),   v.validateUpdateIncome, ctrl.updateIncome);
router.delete('/pnl/income/:id',    inDept, privilegeGuard('accounting', 'canDelete'), ctrl.deleteIncome);
router.post('/pnl/expense',         inDept, privilegeGuard('accounting', 'canCreate'), v.validateAddExpense, ctrl.addExpense);
router.put('/pnl/expense/:id',      inDept, privilegeGuard('accounting', 'canEdit'),   v.validateUpdateExpense, ctrl.updateExpense);
router.delete('/pnl/expense/:id',   inDept, privilegeGuard('accounting', 'canDelete'), ctrl.deleteExpense);
router.post('/shifts',              inDept, privilegeGuard('accounting', 'canCreate'), v.validateOpenShift, ctrl.openShift);
router.put('/shifts/:id/reconcile', inDept, privilegeGuard('accounting', 'canEdit'),   v.validateReconcileShift, ctrl.reconcileShift);

/* ── Procurement Finance Review — accountant approves pending PRs without entering procurement ── */
router.get('/procurement-pending',            inDept, privilegeGuard('accounting', 'canView'),    ctrl.listProcurementPending);
router.post('/procurement/:id/approve',       inDept, privilegeGuard('accounting', 'canApprove'), ctrl.approveProcurement);
router.post('/procurement/:id/reject',        inDept, privilegeGuard('accounting', 'canApprove'), ctrl.rejectProcurement);

/* ── COGS (posted by kitchen/restaurant/poolbar deductStock) ── */
router.get('/cogs', ctrl.listCogs);
router.post('/cogs', ctrl.addCogs);

module.exports = router;
