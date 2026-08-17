const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  transferNo:    { type: String, required: true, unique: true },
  productionNo:  { type: String, default: '' },
  meal:          { type: String, required: true },
  quantity:      { type: Number, default: 0 },
  unit:          { type: String, default: 'plates' },
  from:          { type: String, default: 'Kitchen' },
  to:            { type: String, required: true },
  sentBy:        { type: String, default: '' },
  receivedBy:    { type: String, default: '' },
  dateSent:      { type: Date, default: Date.now },
  dateReceived:  { type: Date },
  status:        { type: String, enum: ['sent','accepted','rejected','cancelled'], default: 'sent' },
  remarks:       { type: String, default: '' },
  rejectReason:  { type: String, default: '' },
  cancelReason:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Transfer', transferSchema);
