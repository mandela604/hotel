const router = require('express').Router();
const ctrl = require('../controllers/storeController');

router.get('/items', ctrl.listItems);
router.get('/items/:id', ctrl.getItem);
router.post('/items', ctrl.createItem);
router.put('/items/:id', ctrl.updateItem);
router.patch('/items/:id/stock', ctrl.adjustStock);
router.delete('/items/:id', ctrl.deleteItem);

module.exports = router;
