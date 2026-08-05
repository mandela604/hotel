/**
 * Grace Hotel — Staff Model
 * Employment record; auth is handled via User model, but staff can also login directly.
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  department: String,
  shift: { type: String, enum: ['Morning','Evening','Night','Rotating'] },
  status: { type: String, default: 'on_duty', enum: ['on_duty','off_duty','leave','terminated'] },
  baseSalary: { type: Number, default: 0 },
  phone: String,
  email: String,
  password: String,
  userId: String,
});

basePlugin(staffSchema);

module.exports = mongoose.model('Staff', staffSchema);