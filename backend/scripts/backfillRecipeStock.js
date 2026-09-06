require('dotenv').config({path: __dirname+'/../.env'});
const mongoose=require('mongoose');
const Recipe=require('../models/Recipe');
const RestaurantStock=require('../models/RestaurantStock');
(async()=>{
 await mongoose.connect(process.env.MONGODB_URI);
 const recipes=await Recipe.find({});
 console.log('recipes', recipes.length);
 let created=0;
 for(const r of recipes){
   const exists=await RestaurantStock.findOne({ name: new RegExp('^'+r.dish.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$', 'i') });
   if(!exists){
     await RestaurantStock.create({
       id: r.id,
       name: r.dish.trim(),
       category: 'Mains',
       unit: r.expectedYieldUnit || 'portion',
       storeId: r.id,
       qty: 0, min:0, price:0, desc: r.notes||'',
     });
     console.log(`created RestaurantStock for ${r.dish} -> ${r.id}`);
     created++;
   } else if(!exists.storeId){
     exists.storeId=r.id;
     await exists.save();
     console.log(`linked ${r.dish} storeId ${r.id}`);
   }
 }
 console.log(`done created ${created}`);
 await mongoose.disconnect();
})();
