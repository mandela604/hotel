const router = require('express').Router();
const { overview } = require('../controllers/dashboardController');

router.get('/overview', overview);

module.exports = router;
