/**
 * Grace Hotel — API Routes
 * Mounted at root in server.js, so endpoints are:
 *   POST /auth/login
 *   GET  /data/rooms
 *   POST /data/sales
 *   etc.
 */

const express = require('express');
const auth = require('../middleware/auth');
const { login, signup, getUsers } = require('../services/authService');
const { getAll, getByKey, createOne, updateOne, deleteOne } = require('../services/dataService');
const { ActivityLog } = require('../database/models');

const router = express.Router();

/* ═══ AUTH ═══ */
router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }
    const result = await login({ email, password });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Route] POST /auth/login error:', err);
    next(err);
  }
});

router.post('/auth/signup', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, initials } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required.' });
    }
    const result = await signup({ name, email, password, role, phone, initials });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('[Route] POST /auth/signup error:', err);
    next(err);
  }
});

router.get('/auth/users', auth(['gm','md','owner']), async (req, res, next) => {
  try {
    const users = await getUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('[Route] GET /auth/users error:', err);
    next(err);
  }
});

/* ═══ GENERIC DATA CRUD ═══
 * GET    /data/:model         -> list all
 * GET    /data/:model/:key/:value -> find one by field
 * POST   /data/:model         -> create
 * PATCH  /data/:model/:id     -> update
 * DELETE /data/:model/:id     -> delete
 */

router.get('/data/:model', auth(), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) {
      const d = new Date(req.query.date);
      filter.date = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }
    const data = await getAll(req.params.model, filter);
    res.json({ success: true, data });
  } catch (err) {
    console.error(`[Route] GET /data/${req.params.model} error:`, err);
    next(err);
  }
});

router.get('/data/:model/:key/:value', auth(), async (req, res, next) => {
  try {
    const { model, key, value } = req.params;
    const doc = await getByKey(model, key, value);
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error(`[Route] GET /data/${req.params.model}/${req.params.key}/${req.params.value} error:`, err);
    next(err);
  }
});

router.post('/data/:model', auth(), async (req, res, next) => {
  try {
    const doc = await createOne(req.params.model, req.body);
    // Log activity
    try {
      await ActivityLog.create({
        id: require('uuid').v4(),
        department: req.body.department || 'system',
        action: 'create',
        description: `Created ${req.params.model}`,
        userId: req.user.id,
        userName: req.user.name,
      });
    } catch (_) {}
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error(`[Route] POST /data/${req.params.model} error:`, err);
    next(err);
  }
});

router.patch('/data/:model/:id', auth(), async (req, res, next) => {
  try {
    const doc = await updateOne(req.params.model, req.params.id, req.body);
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error(`[Route] PATCH /data/${req.params.model}/${req.params.id} error:`, err);
    next(err);
  }
});

router.delete('/data/:model/:id', auth(), async (req, res, next) => {
  try {
    const doc = await deleteOne(req.params.model, req.params.id);
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error(`[Route] DELETE /data/${req.params.model}/${req.params.id} error:`, err);
    next(err);
  }
});

/* ═══ DASHBOARD SUMMARY ═══ */
router.get('/dashboard/summary', auth(), async (req, res, next) => {
  try {
    const [rooms, bookings, sales, reqs, lowStock, gymCheckins, staffOnDuty] = await Promise.all([
      models.Room.countDocuments(),
      models.Booking.countDocuments({ status: 'checked_in' }),
      models.Sale.countDocuments({ status: 'completed', date: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      models.Requisition.countDocuments({ status: 'Pending' }),
      models.KitchenInventory.countDocuments({ $expr: { $lte: ['$qty', '$reorder'] } }),
      models.GymCheckin.countDocuments({ date: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      models.Staff.countDocuments({ status: 'on_duty' }),
    ]);

    const revenue = await models.Sale.aggregate([
      { $match: { status: 'completed', date: { $gte: new Date(new Date().setHours(0,0,0,0)) } } },
      { $group: { _id: '$department', total: { $sum: '$total' } } },
    ]);

    const revMap = Object.fromEntries(revenue.map(r => [r._id, r.total]));
    const totalRev = Object.values(revMap).reduce((a,b) => a+b, 0);

    res.json({
      success: true,
      data: {
        totalRooms: rooms,
        occupiedRooms: bookings,
        vacantRooms: Math.max(rooms - bookings, 0),
        totalRevenue: totalRev,
        roomRevenue: revMap['booking'] || 0,
        restaurantRevenue: revMap['restaurant'] || 0,
        poolbarRevenue: revMap['poolbar'] || 0,
        gymRevenue: revMap['gym'] || 0,
        storeRevenue: revMap['store'] || 0,
        pendingRequisitions: reqs,
        lowStockAlerts: lowStock,
        gymActiveToday: gymCheckins,
        staffOnDuty,
      },
    });
  } catch (err) {
    console.error('[Route] GET /dashboard/summary error:', err);
    next(err);
  }
});

module.exports = router;