const KitchenCooOrder = require('../models/KitchenCooOrder');
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

exports.editCoo = asyncHandler(async (req, res) => {
  const order = await KitchenCooOrder.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({success:false, error:'COO order not found'});
  const { items, notes, table, covers } = req.body;
  if (items && items.length) {
    order.items = items.map(i=>({id:i.id||uuidv4(), name:i.name.trim(), qty:Number(i.qty), price:Number(i.price)||0, recipeId: i.recipeId||''}));
    order.total = order.items.reduce((s,i)=> s + Number(i.price||0)*Number(i.qty||0),0);
  }
  if (notes !== undefined) order.notes = notes;
  if (table !== undefined) order.table = table;
  if (covers !== undefined) order.covers = Number(covers)||1;
  await order.save();
  res.json({success:true, data:order});
});

exports.payCoo = asyncHandler(async (req, res) => {
  const order = await KitchenCooOrder.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({success:false, error:'COO order not found'});
  if (order.paid) return res.status(400).json({success:false, error:'Already paid'});
  const { paymentMethod, amount } = req.body;
  if (!paymentMethod) return res.status(400).json({success:false, error:'Payment method required'});
  const payAmt = Number(amount) || order.total;
  if (payAmt <= 0) return res.status(400).json({success:false, error:'Invalid amount'});

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB');

  const sale = await Sale.create({
    id: uuidv4(),
    source: 'Kitchen COO',
    department: 'restaurant',
    items: order.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, stockId: '', procurementId: '' })),
    subtotal: order.total,
    discount: 0,
    total: payAmt,
    method: paymentMethod,
    staff: order.staff || '',
    table: order.table || '',
    notes: 'COO — ' + (order.table || ''),
    date: now,
    status: 'completed',
    roomNumber: order.roomNumber || null,
    guestName: order.guestName || null,
    guestPhone: order.guestPhone || null,
  });

  order.paid = true;
  order.paymentMethod = paymentMethod;
  order.paymentAmount = payAmt;
  order.paidAt = dateStr;
  order.saleId = sale.id;
  await order.save();

  res.json({success:true, data:order, sale});
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
