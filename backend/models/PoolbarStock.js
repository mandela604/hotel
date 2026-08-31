const mongoose = require('mongoose');

const poolbarStockSchema = new mongoose.Schema({
  id:       { type: String, required: true, unique: true },
  name:     { type: String, required: true, unique: true, trim: true },
  category: { type: String, default: 'Beverages', trim: true },
  cat:      { type: String, default: 'Beverages', trim: true },
  unit:     { type: String, default: 'bottle', trim: true },
  storeId:  { type: String, default: '', index: true },
  qty:      { type: Number, default: 0 },
  min:      { type: Number, default: 10 },
  price:    { type: Number, default: 0 },
  cost:     { type: Number, default: 0 },
  batch:    { type: String, default: '—' },
  received: { type: String, default: '—' },
  desc:     { type: String, default: '' },
}, { timestamps: true });

poolbarStockSchema.pre('save', function (next) {
  if (this.category && !this.cat) this.cat = this.category;
  if (this.cat && !this.category) this.category = this.cat;
  if (this.price && !this.cost) this.cost = this.price;
  if (this.cost && !this.price) this.price = this.cost;
  next();
});

module.exports = mongoose.model('PoolbarStock', poolbarStockSchema);