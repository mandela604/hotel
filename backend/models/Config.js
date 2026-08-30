const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  hotelName:            { type: String, default: 'Aurum Hotel' },
  currency:             { type: String, default: '₦' },
  currencyCode:         { type: String, default: 'NGN' },
  locale:               { type: String, default: 'en-NG' },
  dateFormat:           { type: String, default: 'dd MMM yyyy' },
  timeFormat:           { type: String, default: 'HH:mm' },
  mdApprovalThreshold:  { type: Number, default: 100000 },
  shiftStartHour:       { type: Number, default: 9 },
  accentColor:          { type: String, default: '#2f6fed' },
  departments:          { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
