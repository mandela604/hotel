/**
 * Grace Hotel — SaleItem Model
 *
 * NOTE: Sale.js already embeds items as subdocuments (saleItemSchema),
 * which remains the source of truth for a sale's line items — the
 * restaurant controller below reads/writes through that embedded array,
 * not this collection. This standalone model exists only because
 * models/index.js already requires './SaleItem' and it didn't exist yet.
 * It's here for future cross-sale item reporting/analytics (e.g. "top
 * selling items this month" without loading full Sale docs) — nothing
 * currently dual-writes into it. Wire it up later if/when that's needed.
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const saleItemDocSchema = new mongoose.Schema({
  saleId: { type: String, required: true, index: true }, // Sale.id (uuid), not Mongo _id
  name: { type: String, required: true },
  qty: { type: Number, default: 1 },
  price: { type: Number, required: true },
  total: { type: Number, required: true },
});

basePlugin(saleItemDocSchema);

module.exports = mongoose.model('SaleItem', saleItemDocSchema);