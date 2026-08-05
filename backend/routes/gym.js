/**
 * Grace Hotel — Gym Routes
 * Centralized routing module for Gym features.
 * Connects all Gym endpoints (members, plans, checkins, payments, dashboard, reports)
 * directly to gymController.js.
 */

const express = require('express');
const ctrl = require('../controllers/gymController');

const router = express.Router();

/* ── 1. MEMBERS ── */
router.get('/members', ctrl.listMembers);
router.get('/members/:id', ctrl.getMember);
router.post('/members', ctrl.createMember);
router.put('/members/:id', ctrl.updateMember);
router.delete('/members/:id', ctrl.deleteMember);
router.post('/members/:id/renew', ctrl.renewMember);
router.post('/members/:id/checkin', ctrl.checkinMember);
router.put('/members/:id/status', ctrl.updateMemberStatus);

/* ── 2. PLANS ── */
router.get('/plans', ctrl.listPlans);
router.get('/plans/:id', ctrl.getPlan);
router.post('/plans', ctrl.createPlan);
router.put('/plans/:id', ctrl.updatePlan);
router.delete('/plans/:id', ctrl.deletePlan);

/* ── 3. CHECK-INS ── */
router.get('/checkins', ctrl.listCheckins);
router.post('/checkins', ctrl.createCheckin);
router.get('/checkins/member/:memberId', ctrl.getMemberCheckins);

/* ── 4. PAYMENTS ── */
router.post('/payments', ctrl.createPayment);
router.get('/payments/member/:memberId', ctrl.getMemberPayments);
router.get('/payments/plan/:planId', ctrl.getPlanPayments);

/* ── 5. DASHBOARD & STATS ── */
router.get('/dashboard/stats', ctrl.getDashboardStats);
router.get('/dashboard/revenue', ctrl.getDashboardRevenue);

/* ── 6. REPORTS ── */
router.get('/reports/checkins', ctrl.getCheckinReports);
router.get('/reports/members', ctrl.getMemberReports);
router.get('/reports/revenue', ctrl.getRevenueReports);

module.exports = router;
