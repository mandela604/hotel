const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const storeStockSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, default: () => uuidv4() },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    cat: { type: String, required: true, trim: true, maxlength: 60, default: 'Other' },
    unit: { type: String, required: true, trim: true, maxlength: 40, default: 'unit' },
    baseUnit: { type: String, trim: true, maxlength: 40, default: '' },
    packSize: { type: Number, default: 0, min: 0 },
    qty: { type: Number, required: true, default: 0, min: 0 },
    cost: { type: Number, required: true, default: 0, min: 0 },
    min: { type: Number, required: true, default: 0, min: 0 },
    procurementId: { type: String, default: '' },
  },
  { timestamps: true }
);

storeStockSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('StoreStock', storeStockSchema);