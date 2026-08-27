const router = require('express').Router();
const { get, update } = require('../controllers/settingsController');
const roleGuard = require('../middleware/roleGuard');

// auth is already applied at the mount point in server.js — no router.use(auth) here

router.get('/', get);
router.put('/', roleGuard('admin', 'manager'), update);

module.exports = router;
