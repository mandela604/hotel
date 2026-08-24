'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const v = require('../middleware/gymvalidators');
const {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listMembers,
  createMember,
  updateMember,
  deleteMember,
  addMemberPayment,
  renewMember,
  listCheckins,
  createCheckin,
  listGuests,
  createGuest,
  deleteGuest,
  revenue,
} = require('../controllers/gymController');

router.use(auth);

const canManage = roleGuard(['admin', 'manager', 'gym_attendant']);

/* Plans */
router.route('/plans')
  .get(listPlans)
  .post(canManage, v.validateCreatePlan, createPlan);
router.route('/plans/:id')
  .put(canManage, v.validateParam('id'), v.validateUpdatePlan, updatePlan)
  .delete(canManage, v.validateParam('id'), deletePlan);

/* Members */
router.route('/members')
  .get(listMembers)
  .post(canManage, v.validateCreateMember, createMember);
router.route('/members/:id')
  .put(canManage, v.validateParam('id'), v.validateUpdateMember, updateMember)
  .delete(canManage, v.validateParam('id'), deleteMember);

/* Member payments (partial payments, incl. Room Charge) */
router.post('/members/:id/payments', v.validateParam('id'), v.validateAddPayment, addMemberPayment);

/* Renew membership */
router.post('/members/:id/renew', canManage, v.validateParam('id'), v.validateRenewMember, renewMember);

/* Check-ins — createCheckin itself enforces expired/frozen guard */
router.route('/checkins')
  .get(listCheckins)
  .post(v.validateCreateCheckin, createCheckin);

/* Guest passes */
router.route('/guests')
  .get(listGuests)
  .post(canManage, v.validateCreateGuest, createGuest);
router.delete('/guests/:id', canManage, v.validateParam('id'), deleteGuest);

/* Revenue report */
router.route('/revenue').get(revenue);

module.exports = router;