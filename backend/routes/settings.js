const router = require('express').Router();
const auth = require('../middleware/auth');
const { get, update } = require('../controllers/settingsController');
const roleGuard = require('../middleware/roleGuard');

router.use(auth);

router.get('/', get);
router.put('/', roleGuard('admin', 'manager'), update);

module.exports = router;
