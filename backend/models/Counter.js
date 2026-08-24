const mongoose = require('mongoose');

/**
 * Shared sequence counter, keyed by an arbitrary string (e.g. 'req:KREQ',
 * 'req:PR'). findOneAndUpdate with $inc + upsert makes incrementing
 * atomic even under concurrent requests — two requisitions submitted at
 * the same instant still get two different numbers.
 */
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 45 },
});

module.exports = mongoose.model('Counter', counterSchema);