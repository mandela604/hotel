const mongoose = require('mongoose');

const grItemSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  qty:      { type: Number, default: 0 },
  unit:     { type: String, default: 'Pieces' },
  cost:     { type: Number, default: 0 },
}, { _id: false });

const goodsReceiptSchema = new mongoose.Schema({
  poNo:         { type: String, default: '' },
  prNo:         { type: String, default: '' },
  supplier:     { type: String, default: '' },
  items:        [grItemSchema],
  receivedBy:   { type: String, default: '' },
  dateReceived: { type: Date, default: Date.now },
  status:       { type: String, enum: ['received','partial'], default: 'received' },
}, { timestamps: true });

module.exports = mongoose.model('GoodsReceipt', goodsReceiptSchema);
