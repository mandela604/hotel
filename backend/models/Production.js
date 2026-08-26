const mongoose = require('mongoose');

const productionSchema = new mongoose.Schema({
  id:                { type: String, required: true, unique: true },
  no:                { type: String, required: true, unique: true },
  productionNo:      { type: String },
  batchNo:           { type: String, default: '' },
  dish:              { type: String, required: true },
  recipeId:          { type: String, default: '' },
  type:              { type: String, enum: ['rts', 'coo'], default: 'rts' },
  expectedYield:     { type: Number, default: 0 },
  expectedYieldUnit: { type: String, default: 'plates' },
  outputQty:         { type: Number, default: 0 },
  outputUnit:        { type: String, default: 'plates' },
  yieldVariancePct:  { type: Number, default: 0 },
  costPerUnit:       { type: Number, default: 0 },
  meals:             [{ name: String, qty: Number, unit: String }],
  ingredients:       [{ name: String, qty: Number, unit: String }],
  cost:              { type: Number, default: 0 },
  staff:             { type: String, default: 'Head Chef' },
  by:                { type: String, default: 'Head Chef' },
  notes:             { type: String, default: '' },
  remarks:           { type: String, default: '' },
  date:              { type: String, default: '' },
  time:              { type: String, default: '' },
  status:            { type: String, enum: ['draft', 'sent', 'accepted', 'in-progress', 'completed', 'voided'], default: 'in-progress' },
  destination:       { type: String, default: 'Main Restaurant / POS' },
  transferNo:        { type: String, default: '' },
  voidReason:        { type: String, default: '' },
  voidDate:          { type: Date },
  voidedBy:          { type: String, default: '' },
}, { timestamps: true });

productionSchema.pre('save', function (next) {
  if (this.no && !this.productionNo) this.productionNo = this.no;
  if (this.productionNo && !this.no) this.no = this.productionNo;
  if (this.staff && !this.by) this.by = this.staff;
  if (this.by && !this.staff) this.staff = this.by;
  if (this.notes && !this.remarks) this.remarks = this.notes;
  if (this.remarks && !this.notes) this.notes = this.remarks;
  next();
});

module.exports = mongoose.model('Production', productionSchema);