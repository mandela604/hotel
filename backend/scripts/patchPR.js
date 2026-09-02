require('dotenv').config({path: __dirname+'/../.env'});
const mongoose=require('mongoose');
const StoreStock=require('../models/StoreStock');
(async()=>{
 await mongoose.connect(process.env.MONGODB_URI);
 const stocks=await StoreStock.find({});
 const byName=new Map(stocks.map(s=>[(s.name||'').toLowerCase(), s.id]));
 const col=mongoose.connection.db.collection('purchaserequests');
 const prs=await col.find({}).toArray();
 let patched=0;
 for(const pr of prs){
   let changed=false;
   for(const it of pr.items||[]){
     const sid=(it.stockId||'').trim();
     const name=(it.name||'').toLowerCase();
     const curId=byName.get(name);
     if(!curId) continue;
     if(sid!==curId){
       console.log(`patch PR ${pr.prNo||pr._id} item ${it.name}: ${sid||'empty'} -> ${curId}`);
       it.stockId=curId;
       changed=true;
     }
   }
   if(changed){
     await col.updateOne({_id:pr._id}, {$set:{items:pr.items}});
     patched++;
   }
 }
 console.log(`patched ${patched} PRs`);
 await mongoose.disconnect();
})();
