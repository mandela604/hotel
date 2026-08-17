const router = require('express').Router();
const ctrl = require('../controllers/staffController');

router.get('/',          ctrl.list);
router.post('/',         ctrl.create);
router.put('/:id',       ctrl.update);
router.delete('/:id',    ctrl.remove);
router.put('/:id/permissions', ctrl.updatePermissions);

module.exports = router;
