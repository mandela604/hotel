const mongoose = require('mongoose');

// Shared persistent category collection used by the STORE, POOLBAR and
// RESTAURANT modules. A category that has no stock/menu items yet still
// exists here, so managers can pre-create categories that survive reload.
// `module` discriminates which module owns the category.
const categorySchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true, maxlength: 60 },
  module: { type: String, enum: ['store', 'poolbar', 'restaurant'], required: true, index: true },
}, { timestamps: true });

// A (module, name) pair must be unique.
categorySchema.index({ module: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
