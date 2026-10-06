const FoodMenu = require('../models/FoodMenu');
const FoodCategory = require('../models/FoodCategory');
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

/* ── Categories (full CRUD, id-based) ── */
exports.listCategories = asyncHandler(async (req, res) => {
  const derived = await FoodMenu.distinct('category');
  const saved = await FoodCategory.find().lean();
  const set = new Set(derived.filter(Boolean));
  saved.forEach(function (c) { set.add(c.name); });
  if (!set.size) set.add('Main');
  res.json({ success: true, data: Array.from(set).sort(function (a, b) { return a.localeCompare(b); }) });
});

exports.addCategory = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, error: 'Category name is required' });
  const existing = await FoodCategory.findOne({ name: new RegExp(`^${name}$`, 'i') });
  if (existing) return res.status(409).json({ success: false, error: `Category "${name}" already exists.` });
  const cat = await FoodCategory.create({ name });
  emit(req, ['restaurant', 'poolbar'], 'foodmenu:updated', { action: 'addCategory', data: { id: cat.id, name: cat.name } });
  res.status(201).json({ success: true, data: { id: cat.id, name: cat.name } });
});

exports.renameCategory = asyncHandler(async (req, res) => {
  const cat = await FoodCategory.findOne({ id: req.params.id }) || await FoodCategory.findOne({ name: req.params.id });
  const newName = String(req.body.name || '').trim();
  if (!newName) return res.status(400).json({ success: false, error: 'Category name is required' });
  const dup = await FoodCategory.findOne({ name: new RegExp(`^${newName}$`, 'i'), id: { $ne: req.params.id } });
  if (dup) return res.status(409).json({ success: false, error: `Category "${newName}" already exists.` });
  if (cat) {
    const r = await FoodMenu.updateMany({ category: cat.name }, { $set: { category: newName } });
    cat.name = newName;
    await cat.save();
    emit(req, ['restaurant', 'poolbar'], 'foodmenu:updated', { action: 'renameCategory', data: { id: cat.id, name: newName, itemsUpdated: r.modifiedCount || 0 } });
  } else {
    // Ad-hoc category (from items only) — rename items directly
    const oldName = String(req.params.id || '');
    await FoodMenu.updateMany({ category: oldName }, { $set: { category: newName } });
    await FoodCategory.create({ name: newName });
    emit(req, ['restaurant', 'poolbar'], 'foodmenu:updated', { action: 'renameCategory', data: { name: newName } });
  }
  res.json({ success: true, data: { name: newName } });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const reassignTo = String((req.body && req.body.reassignTo) || 'Main');
  const cat = await FoodCategory.findOne({ id: req.params.id }) || await FoodCategory.findOne({ name: req.params.id });
  const name = cat ? cat.name : String(req.params.id || '');
  if (name === reassignTo) return res.status(400).json({ success: false, error: `Cannot delete "${name}" — it is the fallback category.` });
  const r = await FoodMenu.updateMany({ category: name }, { $set: { category: reassignTo } });
  await FoodCategory.deleteMany({ name });
  emit(req, ['restaurant', 'poolbar'], 'foodmenu:updated', { action: 'deleteCategory', data: { name, reassignedTo: reassignTo, itemsUpdated: r.modifiedCount || 0 } });
  res.json({ success: true, data: { reassignedTo } });
});

exports.deleteFoodMenuItem = asyncHandler(async (req, res) => {
  const item = await FoodMenu.findOneAndDelete({ id: req.params.id });
  if (!item) return res.status(404).json({ success: false, error: 'Food menu item not found' });
  emit(req, ['restaurant', 'poolbar'], 'foodmenu:updated', { action: 'delete', data: { id: item.id } });
  res.json({ success: true, message: `"${item.name}" removed from the food menu` });
});
