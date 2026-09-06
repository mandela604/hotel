const KitchenCooOrder = require('../models/KitchenCooOrder');
const Production = require('../models/Production');
const KitchenStock = require('../models/KitchenStock');
const Recipe = require('../models/Recipe');
const Sale = require('../models/Sale');
const asyncHandler = require('../middleware/asyncHandler');
const { v4: uuidv4 } = require('uuid');

exports.listCoo = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const list = await KitchenCooOrder.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: list });
});

exports.createCoo = asyncHandler(async (req, res) => {
  const { table, covers, items, notes, staff, method, roomNumber, guestName, guestId, guestPhone } = req.body;
  if (!items || !items.length) throw new Error('Add at least one item');
  const total = items.reduce((s,i)=> s + Number(i.price||0)*Number(i.qty||0),0);
  const doc = await KitchenCooOrder.create({
    table: table || '',
    covers: Number(covers)||1,
    items: items.map(i=>({name:i.name.trim(), qty:Number(i.qty), price:Number(i.price)||0})),
    notes: notes||'',
    staff: staff|| (req.user?req.user.name:''),
    method: method||'Cash',
    roomNumber: roomNumber||'',
    guestName: guestName||'',
    guestId: guestId||'',
    guestPhone: guestPhone||'',
    total,
    createdBy: req.user?req.user.name:'',
    status: 'pending',
  });
  // Room Charge -> also folio + booking like poolbar
  if ((method==='Room Charge' || doc.method==='Room Charge') && roomNumber) {
    const Guest = require('../models/Guest');
    const Booking = require('../models/Booking');
    const gId = guestId || '';
    let guest=null;
    if(gId) guest=await Guest.findOne({id:gId});
    if(!guest && guestName) guest=await Guest.findOne({name:guestName});
    if(guest){
      guest.charges.push({ date: new Date().toLocaleDateString('en-GB'), source:'Restaurant', desc: items.map(i=>`${i.qty}x ${i.name}`).join(', '), room:String(roomNumber), amount:total, paid:0, by:staff||(req.user?req.user.name:''), status:'Pending', payments:[] });
      await guest.save();
    }
    const booking=await Booking.findOne({room:String(roomNumber).trim(), status:'checkedin'});
    if(booking){
      booking.payments.push({ id:uuidv4(), amount:total, mode:'Room Charge (Restaurant)', date: new Date().toLocaleDateString('en-GB'), by:staff||(req.user?req.user.name:''), ts:Date.now() });
      booking.paid=(booking.paid||0)+total;
      await booking.save();
    }
  }
  res.status(201).json({ success:true, data:doc });
});

exports.acceptCoo = asyncHandler(async (req, res) => {
  const order = await KitchenCooOrder.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({success:false, error:'COO order not found'});
  if (order.status!=='pending') return res.status(400).json({success:false, error:'Only pending can be accepted'});
  // check KitchenStock via Recipe — block if insufficient (no Store lookup)
  for (const meal of order.items) {
    const recipe = await Recipe.findOne({ dish: meal.name });
    if (!recipe || !recipe.ingredients || !recipe.ingredients.length) continue;
    for (const ing of recipe.ingredients) {
      const stock = await KitchenStock.findOne({ name: new RegExp('^'+ing.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$', 'i') });
      if (!stock) throw new Error(`Ingredient "${ing.name}" not in Kitchen Stock — requisition from Store first`);
      const need = (Number(ing.qty)||0) / (Number(recipe.baseQty)||1) * Number(meal.qty||0);
      if ((Number(stock.qty)||0) < need) throw new Error(`Insufficient "${ing.name}" — need ${need} ${ing.unit||''}, have ${stock.qty} ${stock.unit||''}`);
    }
  }
  // deduct after all checks pass
  for (const meal of order.items) {
    const recipe = await Recipe.findOne({ dish: meal.name });
    if (!recipe || !recipe.ingredients || !recipe.ingredients.length) continue;
    for (const ing of recipe.ingredients) {
      const stock = await KitchenStock.findOne({ name: new RegExp('^'+ing.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$', 'i') });
      if (!stock) continue;
      const need = (Number(ing.qty)||0) / (Number(recipe.baseQty)||1) * Number(meal.qty||0);
      stock.qty = Math.max(0, (Number(stock.qty)||0) - need);
      await stock.save();
    }
  }
  // create Production batch immediately (uuid) — appears in kitchen-production-history
  const batchNo='BATCH-'+String(Date.now()).slice(-6);
  const prodId='PROD-'+uuidv4().slice(0,8);
  const dishName = order.items.map(i=>i.name).join(', ').slice(0,120) || 'COO Order';
  await Production.create({
    id: prodId,
    batchNo, no: prodId,
    dish: dishName,
    meals: order.items.map(i=>({name:i.name, qty:i.qty, unit:'portion'})),
    ingredients: [],
    type:'coo', mode:'coo',
    status:'sent',
    outputQty: order.items.reduce((s,i)=>s+Number(i.qty||0),0),
    outputUnit: 'portions',
    linkedOrder: order.id,
    destination: 'Main Restaurant / POS',
    kitchen: 'Main Kitchen',
    sentBy: req.user?req.user.name:'',
    staff: req.user?req.user.name:'',
    by: req.user?req.user.name:'',
  });
  // create Sale so it appears in restaurant sales/reports and can be voided/edited (id:uuid)
  const saleId='RST-'+String(Date.now()).slice(-6)+'-'+String(Math.floor(Math.random()*1000)).padStart(3,'0');
  await Sale.create({
    id: saleId,
    source: 'COO:'+order.id,
    department: 'restaurant',
    items: order.items.map(i=>({name:i.name, qty:i.qty, price:i.price})),
    subtotal: order.total||0,
    discount: 0,
    total: order.total||0,
    method: order.method||'Cash',
    staff: order.staff||'',
    table: order.table||'',
    notes: order.notes||'',
    date: new Date(),
    status: 'completed',
    roomNumber: order.roomNumber||null,
    guestName: order.guestName||null,
    guestPhone: order.guestPhone||null,
  });
  order.status='accepted';
  await order.save();
  res.json({ success:true, data:order });
});

exports.rejectCoo = asyncHandler(async (req, res) => {
  const order = await KitchenCooOrder.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({success:false, error:'Not found'});
  order.status='rejected';
  await order.save();
  res.json({success:true, data:order});
});
