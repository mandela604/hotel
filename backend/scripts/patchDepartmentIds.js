#!/usr/bin/env node
// Patch: set department stock id = storeId where id is a MongoDB ObjectId
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const RestaurantStock = require('../models/RestaurantStock');
const PoolbarStock = require('../models/PoolbarStock');
const KitchenStock = require('../models/KitchenStock');
const Requisition = require('../models/Requisition');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONGO_ID_RE = /^[0-9a-f]{24}$/i;

async function patchCollection(Model, name) {
  const items = await Model.find({});
  let patched = 0;
  for (const item of items) {
    if (item.storeId && (!item.id || !UUID_RE.test(item.id))) {
      console.log(`  ${name}: patching "${item.name}" id=${item.id} → ${item.storeId}`);
      await Model.updateOne({ _id: item._id }, { $set: { id: item.storeId } });
      patched++;
    }
  }
  console.log(`  ${name}: ${patched}/${items.length} patched`);
}

async function patchRequisitions() {
  const reqs = await Requisition.find({});
  let patched = 0;
  for (const r of reqs) {
    let changed = false;
    for (const it of r.items) {
      if (it.stockId && !UUID_RE.test(it.stockId)) {
        // Try to find matching StoreStock by name
        const StoreStock = require('../models/StoreStock');
        const match = await StoreStock.findOne({ name: new RegExp('^' + it.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
        if (match) {
          console.log(`  Requisition ${r.requisitionNo}: patching "${it.name}" stockId=${it.stockId} → ${match.id}`);
          it.stockId = match.id;
          changed = true;
        } else {
          console.log(`  Requisition ${r.requisitionNo}: "${it.name}" has no StoreStock match — cannot patch`);
        }
      }
    }
    if (changed) {
      await r.save();
      patched++;
    }
  }
  console.log(`  Requisitions: ${patched}/${reqs.length} patched`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  await patchCollection(RestaurantStock, 'RestaurantStock');
  await patchCollection(PoolbarStock, 'PoolbarStock');
  await patchCollection(KitchenStock, 'KitchenStock');
  await patchRequisitions();

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
