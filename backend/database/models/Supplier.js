/**
 * Grace Hotel — Supplier Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: String,
  contactName: String,
  phone: String,
  email: String,
  address: String,
  rating: { type: Number, default: 3, min: 1, max: 5 },
  status: { type: String, default: 'active', enum: ['active','inactive'] },
});

basePlugin(supplierSchema);

module.exports = mongoose.model('Supplier', supplierSchema);