/**
 * Grace Hotel — Role Model
 * Flexible — add new roles in seed without schema changes.
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  permissions: [String],
});

basePlugin(roleSchema);

module.exports = mongoose.model('Role', roleSchema);