const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  transferNo:    { type: String, required: true, unique: true },
  productionNo:  { type: String, default: '' },
  meal:          { type: String, required: true },
  quantity:      { type: Number, default: 0 },
  unit:          { type: String, default: 'Plates' },
  kitchen:       { type: String, default: 'Main Kitchen' },
  restaurant:    { type: String, default: 'Main Restaurant / POS' },
  from:          { type: String, default: 'Main Kitchen' },
  to:            { type: String, default: 'Main Restaurant / POS' },
  sentBy:        { type: String, default: 'Head Chef' },
  receivedBy:    { type: String, default: '' },
  dateSent:      { type: String, default: '' },
  dateReceived:  { type: String, default: '' },
  status:        { type: String, enum: ['sent', 'accepted', 'rejected', 'cancelled'], default: 'sent' },
  remarks:       { type: String, default: '' },
  rejectReason:  { type: String, default: '' },
  cancelReason:  { type: String, default: '' },
}, { timestamps: true });

transferSchema.pre('save', function (next) {
  if (this.kitchen && !this.from) this.from = this.kitchen;
  if (this.restaurant && !this.to) this.to = this.restaurant;
  next();
});

module.exports = mongoose.model('Transfer', transferSchema);