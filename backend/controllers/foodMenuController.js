const FoodMenu = require('../models/FoodMenu');
const asyncHandler = require('../middleware/asyncHandler');
const { emit } = require('../utils/emit');

exports.listFoodMenu = asyncHandler(async (req, res) => {
  const items = await FoodMenu.find().sort({ category: 1, name: 1 });
  res.json({ success: true, count: items.length, data: items });
});

exports.addFoodMenuItem = asyncHandler(async (req, res) => {
  const { name, price, category, available, recipeId } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ success: false, error: 'Name is required' });
  if (price === undefined || Number.isNaN(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ success: false, error: 'Valid price is required' });
  }
  const existing = await FoodMenu.findOne({ name: new RegExp(`^${String(name).trim()}$`, 'i') });
  if (existing) return res.status(409).json({ success: false, error: `"${name.trim()}" is already on the food menu` });
  const item = await FoodMenu.create({
    name: String(name).trim(),
    price: Number(price),
    category: category || 'Main',
    available: available !== undefined ? !!available : true,
    recipeId: recipeId || '',
  });
  emit(req, ['restaurant', 'poolbar'], 'foodmenu:updated', { action: 'add', data: item });
  res.status(201).json({ success: true, data: item });
});

exports.updateFoodMenuItem = asyncHandler(async (req, res) => {
  const item = await FoodMenu.findOne({ id: req.params.id });
  if (!item) return res.status(404).json({ success: false, error: 'Food menu item not found' });
  const { name, price, category, available, recipeId } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ success: false, error: 'Name cannot be empty' });
    const dup = await FoodMenu.findOne({ name: new RegExp(`^${String(name).trim()}$`, 'i'), id: { $ne: item.id } });
    if (dup) return res.status(409).json({ success: false, error: `"${String(name).trim()}" is already on the food menu` });
    item.name = String(name).trim();
  }
  if (price !== undefined) {
    if (Number.isNaN(Number(price)) || Number(price) < 0) return res.status(400).json({ success: false, error: 'Valid price is required' });
    item.price = Number(price);
  }
  if (category !== undefined) item.category = category;
  if (available !== undefined) item.available = !!available;
  if (recipeId !== undefined) item.recipeId = recipeId || '';
  await item.save();
  emit(req, ['restaurant', 'poolbar'], 'foodmenu:updated', { action: 'update', data: item });
  res.json({ success: true, data: item });
});

exports.deleteFoodMenuItem = asyncHandler(async (req, res) => {
  const item = await FoodMenu.findOneAndDelete({ id: req.params.id });
  if (!item) return res.status(404).json({ success: false, error: 'Food menu item not found' });
  emit(req, ['restaurant', 'poolbar'], 'foodmenu:updated', { action: 'delete', data: { id: item.id } });
  res.json({ success: true, message: `"${item.name}" removed from the food menu` });
});
