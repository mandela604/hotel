const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.get('/bootstrap-status', authController.bootstrapStatus);
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/session', auth, authController.session);
router.get('/me', auth, authController.session);
router.post('/logout', auth, authController.logout);

/* Admin-only user management — the only way to create accounts once
   the first (admin) account exists. */
router.get('/users', auth, roleGuard(['admin']), authController.listUsers);
router.post('/users', auth, roleGuard(['admin']), authController.createUser);
router.patch('/users/:id', auth, roleGuard(['admin']), authController.updateUser);

module.exports = router;