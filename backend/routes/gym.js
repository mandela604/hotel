const express = require('express');
const router = express.Router();
const {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listMembers,
  createMember,
  updateMember,
  deleteMember,
  listCheckins,
  createCheckin,
  revenue,
} = require('../controllers/gymController');

router.route('/plans').get(listPlans).post(createPlan);
router.route('/plans/:id').put(updatePlan).delete(deletePlan);
router.route('/members').get(listMembers).post(createMember);
router.route('/members/:id').put(updateMember).delete(deleteMember);
router.route('/checkins').get(listCheckins).post(createCheckin);
router.route('/revenue').get(revenue);

module.exports = router;
