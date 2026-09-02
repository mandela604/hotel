#!/usr/bin/env node
// One-time patch: Requisition.items[].stockId '' or s123 demo -> StoreStock.id uuidv4
// Uses name lookup ONLY for this migration, then future code is uuid-only.
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const StoreStock = require('../models/StoreStock');
const Requisition = require('../models/Requisition');

async function run(){
  const uri = process.env.MONGODB_URI;
  if(!uri){ console.error('MONGODB_URI missing'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('[patch] connected');

  const stocks = await StoreStock.find({});
  const byName = new Map();
  stocks.forEach(s=> byName.set((s.name||'').toLowerCase(), s.id));

  const reqs = await Requisition.find({});
  let patchedReqs=0, patchedItems=0, createdStocks=0;

  for(const r of reqs){
    let changed=false;
    for(const it of r.items){
      const sid=(it.stockId||'').trim();
      // already valid uuid that exists in StoreStock
      if(sid && byName.has((it.name||'').toLowerCase()) && sid===byName.get((it.name||'').toLowerCase())) continue;
      // sid is demo s123, empty, or mismatched -> fix via name
      const hit = byName.get((it.name||'').toLowerCase());
      if(hit){
        if(it.stockId!==hit){ it.stockId=hit; changed=true; patchedItems++; }
      } else {
        // name not in Store -> create StoreStock with uuid for future uuid-only
        const { v4:uuidv4 } = require('uuid');
        const newId=uuidv4();
        const created=await StoreStock.create({ id:newId, name:it.name.trim(), cat:'Other', unit:it.unit||'unit', qty:0, cost:Number(it.cost)||0, min:0 });
        byName.set((created.name||'').toLowerCase(), created.id);
        it.stockId=created.id;
        changed=true; patchedItems++; createdStocks++;
        console.log(`[patch] created StoreStock ${created.name} -> ${created.id}`);
      }
    }
    if(changed){ await r.save(); patchedReqs++; }
  }

  console.log(`[patch] done: ${patchedReqs} requisitions, ${patchedItems} items, ${createdStocks} new StoreStock`);
  await mongoose.disconnect();
}
run().catch(e=>{ console.error(e); process.exit(1); });
