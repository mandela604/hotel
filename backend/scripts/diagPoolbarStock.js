'use strict';
/* Read-only diagnostic: why didn't pool bar stock move with yesterday's sales?
   Run:  node scripts/diagPoolbarStock.js          */
require('dotenv').config();
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const PoolbarMovement = require('../models/PoolbarMovement');
const PoolbarStock = require('../models/PoolbarStock');
const FoodMenu = require('../models/FoodMenu');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const inWin = { $gte: start, $lt: end };
  const sales = await Sale.find({
    department: 'poolbar',
    $or: [{ date: inWin }, { createdAt: inWin }],
  }).lean();
  const movs = await PoolbarMovement.find({
    $or: [{ date: inWin }, { createdAt: inWin }],
    reason: /Sale|Tab Payment/,
  }).lean();
  const stock = await PoolbarStock.find({}).lean();
  const food = await FoodMenu.find({ available: { $ne: false } }).lean();

  console.log('Window:', start.toString(), '->', end.toString());
  console.log('Pool bar sales yesterday :', sales.length,
    '| total ₦' + sales.reduce((s, x) => s + (x.total || 0), 0));
  console.log('Stock movements (sale-linked) yesterday:', movs.length);
  console.log('PoolbarStock records:', stock.length, '| FoodMenu items (skip list):', food.length);

  const foodSet = new Set(food.map(f => String(f.name || '').trim().toLowerCase()));
  const byLower = {};
  stock.forEach(s => { byLower[String(s.name || '').trim().toLowerCase()] = s; });

  const stats = {};
  sales.forEach(s => (s.items || []).forEach(it => {
    const key = String(it.name || '');
    const lower = key.trim().toLowerCase();
    if (!stats[key]) stats[key] = {
      qty: 0,
      inFood: foodSet.has(lower),
      match: byLower[lower] || null,
      partial: stock.filter(x => String(x.name).toLowerCase().includes(lower) || lower.includes(String(x.name).toLowerCase())).map(x => x.name),
    };
    stats[key].qty += Number(it.qty) || 0;
  }));

  console.log('\n--- item by item: sold | in food menu (skipped by design) | stock match ---');
  Object.keys(stats).sort().forEach(k => {
    const v = stats[k];
    const verdict = v.inFood ? 'SKIPPED (food menu)'
      : v.match ? 'should deduct -> ' + v.match.name + ' (on hand ' + v.match.qty + ')'
      : 'SKIPPED (no exact stock name match)' + (v.partial.length ? ' | similar: ' + v.partial.join(', ') : '');
    console.log(' * ' + k + ' x' + v.qty + ' | ' + verdict);
  });

  console.log('\nSample sale-linked movements:');
  movs.slice(-10).forEach(m => console.log('  ', m.date, '|', m.item, '| out', m.qtyOut, '|', m.reason));
  if (!movs.length) console.log('   (none)');

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
