require('dotenv').config({path: __dirname+'/../.env'});
const mongoose=require('mongoose');
const KitchenCooOrder=require('../models/KitchenCooOrder');
const Production=require('../models/Production');
(async()=>{
 await mongoose.connect(process.env.MONGODB_URI);
 const coos=await KitchenCooOrder.find({status:'accepted'});
 console.log('accepted coos', coos.length);
 for(const coo of coos){
   const prod=await Production.findOne({linkedOrder:coo.id});
   if(!prod){
     console.log(`resetting stuck ${coo.id} ${coo.table} — no production`);
     coo.status='pending';
     await coo.save();
     console.log('reset to pending');
   } else {
     console.log(`ok ${coo.id} has production ${prod.id}`);
   }
 }
 await mongoose.disconnect();
})();
