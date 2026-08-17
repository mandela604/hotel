const router = require('express').Router();
const { get, update } = require('../controllers/settingsController');

router.get('/', get);
router.put('/', update);

module.exports = router;
