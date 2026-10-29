'use strict';
/* Read-only: which pool bar sales from yesterday have NO stock deduction? */
require('dotenv').config();
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const PoolbarMovement = require('../models/PoolbarMovement');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const start = new Date(); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const inWin = { $gte: start, $lt: end };

  const sales = await Sale.find({ department: 'poolbar', $or: [{ date: inWin }, { createdAt: inWin }] }).lean();
  const movs = await PoolbarMovement.find({ $or: [{ date: inWin }, { createdAt: inWin }] }).lean();

  const byReason = {};
  movs.forEach(m => { (byReason[m.reason] = byReason[m.reason] || []).push(m); });

  let bad = 0;
  for (const s of sales) {
    const reasons = Object.keys(byReason).filter(r => r.includes(s.id));
    const outByItem = {};
    reasons.forEach(r => byReason[r].forEach(m => { outByItem[m.item.toLowerCase()] = (outByItem[m.item.toLowerCase()] || 0) + m.qtyOut; }));
    const missing = (s.items || []).filter(it => {
      const lower = String(it.name).trim().toLowerCase();
      const got = outByItem[lower] || 0;
      return got < (Number(it.qty) || 0);
    });
    const status = missing.length ? 'MISSING ' + missing.map(m => m.name + ' need ' + m.qty).join(', ') : 'OK';
    if (missing.length) bad++;
    console.log(s.id, '|', (s.date || s.createdAt).toISOString().slice(0, 16), '| ₦' + s.total, '|', s.status, '|', status);
  }
  console.log('\nSales with missing deductions:', bad, '/', sales.length);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
