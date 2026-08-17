const express = require('express');
const router = express.Router();
const {
  listMenu,
  createMenu,
  updateMenu,
  deleteMenu,
  listSales,
  createSale,
  voidSale,
  listStock,
  createStock,
  updateStock,
  deleteStock,
} = require('../controllers/poolbarController');

router.route('/menu').get(listMenu).post(createMenu);
router.route('/menu/:id').put(updateMenu).delete(deleteMenu);
router.route('/sales').get(listSales).post(createSale);
router.route('/sales/:id/void').post(voidSale);
router.route('/stock').get(listStock).post(createStock);
router.route('/stock/:id').put(updateStock).delete(deleteStock);

module.exports = router;
