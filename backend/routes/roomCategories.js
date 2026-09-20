const router = require('express').Router();
const ctrl = require('../controllers/roomCategoryController');
const { roleGuard } = require('../middleware/roleGuard');

// auth is already applied at the mount point in server.js

router.get('/', ctrl.list);
router.post('/', roleGuard('admin', 'manager'), ctrl.create);
router.put('/:id', roleGuard('admin', 'manager'), ctrl.update);
router.delete('/:id', roleGuard('admin'), ctrl.remove);

module.exports = router;
