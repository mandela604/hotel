const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const cooItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, default: 0 },
}, { _id: false });

const cooSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true, index: true },
  table: { type: String, default: '' },
  covers: { type: Number, default: 1 },
  items: { type: [cooItemSchema], default: [] },
  notes: { type: String, default: '' },
  staff: { type: String, default: '' },
  status: { type: String, enum: ['pending','accepted','rejected','completed'], default: 'pending' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('KitchenCooOrder', cooSchema);
