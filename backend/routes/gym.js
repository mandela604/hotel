'use strict';
const express = require('express');
const router = express.Router();
const { departmentGuard, privilegeGuard } = require('../middleware/roleGuard');
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

const inDept  = departmentGuard('Gym');

/* Plans */
router.route('/plans')
  .get(listPlans)
  .post(inDept, privilegeGuard('gym', 'canCreate'), v.validateCreatePlan, createPlan);
router.route('/plans/:id')
  .put(inDept, privilegeGuard('gym', 'canEdit'), v.validateParam('id'), v.validateUpdatePlan, updatePlan)
  .delete(inDept, privilegeGuard('gym', 'canDelete'), v.validateParam('id'), deletePlan);

/* Members */
router.route('/members')
  .get(listMembers)
  .post(inDept, privilegeGuard('gym', 'canCreate'), v.validateCreateMember, createMember);
router.route('/members/:id')
  .put(inDept, privilegeGuard('gym', 'canEdit'), v.validateParam('id'), v.validateUpdateMember, updateMember)
  .delete(inDept, privilegeGuard('gym', 'canDelete'), v.validateParam('id'), deleteMember);

/* Member payments (partial payments, incl. Room Charge) */
router.post('/members/:id/payments', inDept, privilegeGuard('gym', 'canCreate'), v.validateParam('id'), v.validateAddPayment, addMemberPayment);

/* Renew membership */
router.post('/members/:id/renew', inDept, privilegeGuard('gym', 'canCreate'), v.validateParam('id'), v.validateRenewMember, renewMember);

/* Check-ins — createCheckin itself enforces expired/frozen guard */
router.route('/checkins')
  .get(listCheckins)
  .post(inDept, privilegeGuard('gym', 'canCheckin'), v.validateCreateCheckin, createCheckin);

/* Guest passes */
router.route('/guests')
  .get(listGuests)
  .post(inDept, privilegeGuard('gym', 'canCreate'), v.validateCreateGuest, createGuest);
router.delete('/guests/:id', inDept, privilegeGuard('gym', 'canDelete'), v.validateParam('id'), deleteGuest);

/* Revenue report */
router.route('/revenue').get(inDept, privilegeGuard('gym', 'canViewReports'), revenue);

module.exports = router;
