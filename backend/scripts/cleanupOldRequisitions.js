#!/usr/bin/env node
// Delete requisitions that have MongoDB _id (24 hex chars) as stockId
// instead of uuidv4. These are broken and cannot be approved.
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Requisition = require('../models/Requisition');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONGO_ID_RE = /^[0-9a-f]{24}$/i;

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const all = await Requisition.find({});
  const toDelete = all.filter(r => r.items.some(it => it.stockId && MONGO_ID_RE.test(it.stockId) && !UUID_RE.test(it.stockId)));

  console.log(`Found ${all.length} total requisitions, ${toDelete.length} with bad stockId`);
  for (const r of toDelete) {
    console.log(`  Deleting ${r.requisitionNo} (items: ${r.items.map(i => i.stockId).join(', ')})`);
  }

  if (toDelete.length > 0) {
    const ids = toDelete.map(r => r._id);
    await Requisition.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${toDelete.length} old requisitions.`);
  } else {
    console.log('Nothing to clean up.');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
