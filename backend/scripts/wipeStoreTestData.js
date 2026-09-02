require('dotenv').config({path: __dirname+'/../.env'});
const mongoose=require('mongoose');
const StoreStock=require('../models/StoreStock');
const Requisition=require('../models/Requisition');
const Category=require('../models/Category');
const Counter=require('../models/Counter');
(async()=>{
 await mongoose.connect(process.env.MONGODB_URI);
 console.log('connected');
 const delStock=await StoreStock.deleteMany({});
 console.log(`storestocks deleted: ${delStock.deletedCount}`);
 const delReq=await Requisition.deleteMany({});
 console.log(`requisitions deleted: ${delReq.deletedCount}`);
 try{
   const delPR=await mongoose.connection.db.collection('purchaserequests').deleteMany({});
   console.log(`purchaserequests deleted: ${delPR.deletedCount}`);
 }catch(e){ console.log('pr delete err',e.message); }
 try{
   const delCat=await Category.deleteMany({module:'store'});
   console.log(`store categories deleted: ${delCat.deletedCount}`);
 }catch(e){ console.log('cat err',e.message); }
 // reset counters for store+req
 const counters=await Counter.deleteMany({key:/^req:/});
 console.log(`counters req deleted: ${counters.deletedCount}`);
 // also delete PR counters? Keep but reset
 await mongoose.disconnect();
 console.log('wipe done');
})();
