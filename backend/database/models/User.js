/**
 * Grace Hotel — User Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, required: true, index: true },
  initials: String,
  phone: String,
  avatar: String,
  status: { type: String, default: 'active', enum: ['active','inactive','suspended'] },
});

basePlugin(userSchema);

module.exports = mongoose.model('User', userSchema);