'use strict';
/* Builds the schema-declared indexes once, for NODE_ENV=production where
   mongoose autoIndex is disabled (backend/config/db.js).
   Safe to re-run: createIndexes() only ADDS declared indexes — it never
   drops or modifies anything already in the database.

   Run:  node scripts/buildIndexes.js                              */
require('dotenv').config();
const mongoose = require('mongoose');

const MODELS = [
  ['Sale', require('../models/Sale')],
  ['Order', require('../models/Order')],
  ['PoolbarMovement', require('../models/PoolbarMovement')],
  ['RestaurantMovement', require('../models/RestaurantMovement')],
  ['KitchenMovement', require('../models/KitchenMovement')],
  ['Booking', require('../models/Booking')],
  ['Activity', require('../models/Activity')],
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const [name, model] of MODELS) {
    try {
      const res = await model.createIndexes();
      const built = (res && res.numIndexesBefore !== undefined)
        ? (res.numIndexesAfter - res.numIndexesBefore)
        : 0;
      console.log(`[indexes] ${name}: ok (${built} new, ${res ? res.numIndexesAfter : '?'} total)`);
    } catch (e) {
      console.error(`[indexes] ${name}: FAILED — ${e.message}`);
    }
  }
  await mongoose.disconnect();
  console.log('[indexes] done');
})().catch(e => { console.error(e); process.exit(1); });
