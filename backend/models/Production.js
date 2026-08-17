const mongoose = require('mongoose');

const productionSchema = new mongoose.Schema({
  productionNo: { type: String, required: true, unique: true },
  batchNo:      { type: String, default: '' },
  dish:         { type: String, required: true },
  outputQty:    { type: Number, default: 0 },
  outputUnit:   { type: String, default: 'plates' },
  meals:        [{ name: String, qty: Number, unit: String }],
  ingredients:  [{ name: String, qty: Number, unit: String }],
  cost:         { type: Number, default: 0 },
  chef:         { type: String, default: '' },
  notes:        { type: String, default: '' },
  date:         { type: Date, default: Date.now },
  time:         { type: String, default: '' },
  status:       { type: String, enum: ['planned','in_progress','completed','voided'], default: 'planned' },
  department:   { type: String, default: 'Restaurant' },
  destination:  { type: String, default: '' },
  transferNo:   { type: String, default: '' },
  voidReason:   { type: String, default: '' },
  voidDate:     { type: Date },
  voidedBy:     { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Production', productionSchema);
