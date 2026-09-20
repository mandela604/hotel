const RoomCategory = require('../models/RoomCategory');
const asyncHandler = require('../middleware/asyncHandler');

const SEED_TYPES = [
  { name: 'Standard', rate: 15000, sortOrder: 1 },
  { name: 'Deluxe', rate: 25000, sortOrder: 2 },
  { name: 'Super Deluxe', rate: 35000, sortOrder: 3 },
  { name: 'Premium Gold', rate: 45000, sortOrder: 4 },
  { name: 'Mini Suite', rate: 55000, sortOrder: 5 },
  { name: 'Executive Suite', rate: 75000, sortOrder: 6 },
  { name: 'Apartment', rate: 100000, sortOrder: 7 },
];

async function ensureSeeded() {
  const count = await RoomCategory.countDocuments();
  if (count === 0) {
    try { await RoomCategory.insertMany(SEED_TYPES); } catch (e) { /* another request seeded */ }
  }
}

exports.list = asyncHandler(async (req, res) => {
  await ensureSeeded();
  const categories = await RoomCategory.find().sort({ sortOrder: 1, name: 1 });
  const seen = new Set();
  const unique = categories.filter(c => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) { c.deleteOne(); return false; }
    seen.add(key);
    return true;
  });
  res.json({ success: true, data: unique });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, rate, sortOrder } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }
  const existing = await RoomCategory.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
  if (existing) {
    return res.status(400).json({ success: false, error: 'Category already exists' });
  }
  const category = await RoomCategory.create({
    name: name.trim(),
    rate: Number(rate) || 0,
    sortOrder: Number(sortOrder) || 0,
  });
  res.status(201).json({ success: true, data: category });
});

exports.update = asyncHandler(async (req, res) => {
  const category = await RoomCategory.findOne({ id: req.params.id });
  if (!category) {
    return res.status(404).json({ success: false, error: 'Category not found' });
  }
  const { name, rate, sortOrder, active } = req.body;
  if (name !== undefined) {
    const dup = await RoomCategory.findOne({ name: new RegExp(`^${name.trim()}$`, 'i'), id: { $ne: category.id } });
    if (dup) {
      return res.status(400).json({ success: false, error: 'Category name already exists' });
    }
    category.name = name.trim();
  }
  if (rate !== undefined) category.rate = Number(rate);
  if (sortOrder !== undefined) category.sortOrder = Number(sortOrder);
  if (active !== undefined) category.active = !!active;
  await category.save();
  res.json({ success: true, data: category });
});

exports.remove = asyncHandler(async (req, res) => {
  const category = await RoomCategory.findOne({ id: req.params.id });
  if (!category) {
    return res.status(404).json({ success: false, error: 'Category not found' });
  }
  await category.deleteOne();
  res.json({ success: true, data: { id: req.params.id } });
});
