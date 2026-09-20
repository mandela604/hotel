const mongoose = require('mongoose');

const roomCategorySchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 60, unique: true },
  rate:      { type: Number, default: 0 },
  sortOrder: { type: Number, default: 0 },
  active:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('RoomCategory', roomCategorySchema);
