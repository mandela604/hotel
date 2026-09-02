require('dotenv').config({path: __dirname+'/../.env'});
const mongoose=require('mongoose');
const StoreStock=require('../models/StoreStock');
const Requisition=require('../models/Requisition');
(async()=>{
 await mongoose.connect(process.env.MONGODB_URI);
 const sid='6a9814c9e716d1c97ea122d8';
 const s=await StoreStock.findOne({id:sid});
 console.log('store stock for sid:', sid, s ? s.name+' '+s.id : 'NOT FOUND');
 const allS=await StoreStock.find({}).select('id name');
 console.log('all store sample:', allS.slice(0,10).map(x=>x.name+':'+x.id));
 const reqs=await Requisition.find({'items.stockId':sid});
 console.log('reqs with sid:', reqs.length);
 reqs.forEach(r=> console.log(r.requisitionNo, r.items.map(i=>i.name+':'+i.stockId)));
 try{
   const cols=await mongoose.connection.db.listCollections().toArray();
   console.log('collections', cols.map(c=>c.name));
   const prs=await mongoose.connection.db.collection('purchaserequests').find({'items.stockId':sid}).toArray();
   console.log('prs with sid:', prs.length);
   prs.forEach(p=> console.log(p.prNo||p.no||p._id, (p.items||[]).map(i=>i.name+':'+i.stockId)));
   const allPrs=await mongoose.connection.db.collection('purchaserequests').find({}).limit(5).toArray();
   console.log('sample prs:', allPrs.map(p=>({id:p._id, prNo:p.prNo||p.no, items:(p.items||[]).map(i=>i.name+':'+i.stockId)})));
   const allReqs2=await mongoose.connection.db.collection('requisitions').find({'items.stockId':sid}).toArray();
   console.log('requisitions col with sid:', allReqs2.length);
 }catch(e){ console.log('err',e.message); }
 await mongoose.disconnect();
})();
