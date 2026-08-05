const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const sanitize = require('../middleware/sanitize');
const ctrl = require('../controllers/restaurantController');

router.use(sanitize);

/* ── Menu ── */
router.get('/menu', auth(), ctrl.listMenu);
router.get('/menu/:id', auth(), ctrl.getMenuItem);
router.post('/menu', auth(['admin', 'manager', 'owner']), ctrl.createMenuItem);
router.put('/menu/:id', auth(['admin', 'manager', 'owner']), ctrl.updateMenuItem);
router.patch('/menu/:id/availability', auth(['admin', 'manager', 'owner', 'staff']), ctrl.toggleAvailability);
router.delete('/menu/:id', auth(['admin', 'manager', 'owner']), ctrl.deleteMenuItem);

/* ── Tables ── */
router.get('/tables', auth(), ctrl.listTables);
router.post('/tables', auth(['admin', 'manager', 'owner']), ctrl.createTable);
router.patch('/tables/:id/status', auth(), ctrl.updateTableStatus);

/* ── Sales ── */
router.get('/sales', auth(), ctrl.listSales);
router.get('/sales/:id', auth(), ctrl.getSale);
router.post('/sales', auth(), ctrl.createSale);
router.patch('/sales/:id/void', auth(['admin', 'manager', 'owner']), ctrl.voidSale);

/* ── Requisitions (Restaurant → Store) ── */
router.get('/requisitions', auth(), ctrl.listRequisitions);
router.get('/requisitions/:id', auth(), ctrl.getRequisition);
router.post('/requisitions', auth(), ctrl.createRequisition);

/* ── Transfers (Kitchen → Restaurant) ── */
router.get('/transfers', ctrl.listTransfers);
router.patch('/transfers/:no', ctrl.handleTransfer);

module.exports = router;