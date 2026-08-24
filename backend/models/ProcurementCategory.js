const mongoose = require('mongoose');

// Supplier categories are tracked as their own collection rather than
// derived from Supplier.category on the fly — an empty category (zero
// suppliers currently in it) still counts as existing, matching
// suppliers.html's "Categories Tracked" KPI, which is about categories
// DEFINED in the system, not just ones currently in use.
const procurementCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('ProcurementCategory', procurementCategorySchema);