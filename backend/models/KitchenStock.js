const mongoose = require('mongoose');

const kitchenStockSchema = new mongoose.Schema({
  id:       { type: String, required: true, unique: true },
  name:     { type: String, required: true, unique: true, trim: true },
  category: { type: String, default: 'Grains', trim: true },
  cat:      { type: String, default: 'Grains', trim: true },
  unit:     { type: String, default: 'kg', trim: true },
  qty:      { type: Number, default: 0 },
  min:      { type: Number, default: 10 },
  price:    { type: Number, default: 0 },
  cost:     { type: Number, default: 0 },
  batch:    { type: String, default: '—' },
  received: { type: String, default: '—' },
  desc:     { type: String, default: '' },
}, { timestamps: true });

kitchenStockSchema.pre('save', function (next) {
  if (this.category && !this.cat) this.cat = this.category;
  if (this.cat && !this.category) this.category = this.cat;
  if (this.price && !this.cost) this.cost = this.price;
  if (this.cost && !this.price) this.price = this.cost;
  next();
});

module.exports = mongoose.model('KitchenStock', kitchenStockSchema);