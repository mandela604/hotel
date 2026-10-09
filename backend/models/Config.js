const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  hotelName:            { type: String, default: 'Boston Leisure Hotel and Apartments' },
  hotelAddress:         { type: String, default: 'Idi Close, Km 75, Auchi-Benin Expressway, Ujoelen, Ekpoma, Edo State' },
  hotelPhone:           { type: String, default: '09039391464' },
  hotelEmail:           { type: String, default: 'hr.bostonleisurehotel@gmail.com' },
  currency:             { type: String, default: '₦' },
  currencyCode:         { type: String, default: 'NGN' },
  locale:               { type: String, default: 'en-NG' },
  dateFormat:           { type: String, default: 'dd MMM yyyy' },
  timeFormat:           { type: String, default: 'HH:mm' },
  mdApprovalThreshold:  { type: Number, default: 100000 },
  shiftStartHour:       { type: Number, default: 9 },
  shiftEndHour:         { type: Number, default: 8 },
  paymentMethods:       { type: [String], default: ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'] },
  disabledDepartments:  { type: [String], default: [] },
  accentColor:          { type: String, default: '#2f6fed' },
  departments:          { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
