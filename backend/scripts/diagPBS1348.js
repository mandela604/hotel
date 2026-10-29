'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const RM = require('../models/RestaurantMovement');
const RS = require('../models/RestaurantStock');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const ms = await RM.find({ reason: /PBS-001348/ }).lean();
  console.log('restaurant movements for PBS-001348:', ms.length);
  ms.forEach(m => console.log(m.date.toISOString(), '|', m.item, '| out', m.qtyOut, '|', m.reason));
  const five = await RS.findOne({ name: /^5 Alive$/i }).lean();
  const nw = await RS.findOne({ name: /^Nestle Water$/i }).lean();
  console.log('RestaurantStock 5 Alive:', five ? five.qty : 'none', '| Nestle Water:', nw ? nw.qty : 'none');
  const any = await RM.find({ date: { $gte: new Date('2026-10-28T16:40:00Z'), $lt: new Date('2026-10-28T17:10:00Z') } }).lean();
  console.log('restaurant movements 16:40-17:10Z:', any.length);
  any.forEach(m => console.log(m.date.toISOString(), '|', m.item, '| out', m.qtyOut, '|', m.reason));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
