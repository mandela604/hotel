const router = require('express').Router();
const ctrl = require('../controllers/authController');

router.post('/login', ctrl.login);
router.post('/logout', ctrl.logout);
router.post('/register', ctrl.register);
router.get('/me', ctrl.me);
router.get('/users', ctrl.listUsers);

module.exports = router;
