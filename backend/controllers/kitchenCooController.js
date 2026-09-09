const KitchenCooOrder = require('../models/KitchenCooOrder');
const asyncHandler = require('../middleware/asyncHandler');
const { v4: uuidv4 } = require('uuid');

exports.listCoo = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const list = await KitchenCooOrder.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: list });
});

exports.getCooOrder = asyncHandler(async (req, res) => {
  const order = await KitchenCooOrder.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ success: false, error: 'COO order not found' });
  res.json({ success: true, data: order });
});

exports.createCoo = asyncHandler(async (req, res) => {
  const { table, covers, items, notes, staff, method, roomNumber, guestName, guestId, guestPhone } = req.body;
  if (!items || !items.length) throw new Error('Add at least one item');
  const total = items.reduce((s,i)=> s + Number(i.price||0)*Number(i.qty||0),0);
  const doc = await KitchenCooOrder.create({
    table: table || '',
    covers: Number(covers)||1,
    items: items.map(i=>({id:uuidv4(), name:i.name.trim(), qty:Number(i.qty), price:Number(i.price)||0, recipeId: i.recipeId||''})),
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

exports.addExtraIngredient = asyncHandler(async (req, res) => {
  const order = await KitchenCooOrder.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({success:false, error:'Not found'});
  if (order.status!=='pending') return res.status(400).json({success:false, error:'Only pending can be edited'});
  const { name, qty, unit } = req.body;
  if (!name || !qty) return res.status(400).json({success:false, error:'Name and qty required'});
  const KitchenStock = require('../models/KitchenStock');
  const stock = await KitchenStock.findOne({ name: new RegExp('^'+String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$', 'i') });
  if (!stock) return res.status(404).json({success:false, error:'Ingredient not in Kitchen Stock — add to Kitchen Stock first (pick from Store)'});
  order.extraIngredients.push({ name: stock.name, qty: Number(qty), unit: unit||stock.unit });
  await order.save();
  res.json({success:true, data:order});
});

exports.removeExtraIngredient = asyncHandler(async (req, res) => {
  const order = await KitchenCooOrder.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({success:false, error:'Not found'});
  const idx = parseInt(req.params.idx,10);
  if (isNaN(idx) || idx<0 || idx>=order.extraIngredients.length) return res.status(400).json({success:false, error:'Invalid index'});
  order.extraIngredients.splice(idx,1);
  await order.save();
  res.json({success:true, data:order});
});
