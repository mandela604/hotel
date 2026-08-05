const router = require('express').Router();
const ctrl = require('../controllers/reportController');

router.get('/summary', ctrl.summary);
router.get('/export.csv', ctrl.exportCsv);
router.get('/checkins', ctrl.getCheckinReports);
router.get('/members', ctrl.getMemberReports);
router.get('/revenue', ctrl.getRevenueReports);

module.exports = router;
