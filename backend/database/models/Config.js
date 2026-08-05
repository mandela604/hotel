/**
 * Grace Hotel — Config Model
 * Key-value store for hotel settings.
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed,
});

basePlugin(configSchema);

module.exports = mongoose.model('Config', configSchema);