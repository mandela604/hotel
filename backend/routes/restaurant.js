const express = require('express');
const router = express.Router();
const {
  listMenu,
  createMenu,
  updateMenu,
  deleteMenu,
  listTables,
  updateTable,
  listSales,
  createSale,
  voidSale,
  listInventory,
  createInventory,
  updateInventory,
  deleteInventory,
  listTransfers,
} = require('../controllers/restaurantController');

router.route('/menu').get(listMenu).post(createMenu);
router.route('/menu/:id').put(updateMenu).delete(deleteMenu);
router.route('/tables').get(listTables);
router.route('/tables/:id').put(updateTable);
router.route('/sales').get(listSales).post(createSale);
router.route('/sales/:id/void').post(voidSale);
router.route('/inventory').get(listInventory).post(createInventory);
router.route('/inventory/:id').put(updateInventory).delete(deleteInventory);
router.route('/transfers').get(listTransfers);

module.exports = router;
