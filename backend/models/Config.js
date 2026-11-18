const mongoose = require('mongoose');

/* Configurable room-discount rules. Weekdays use JS numbering: 0=Sun … 6=Sat.
   rooms: [] means every room. from/to are optional YYYY-MM-DD bounds. */
const discountRuleSchema = new mongoose.Schema({
  name:     { type: String, default: 'Discount rule' },
  rooms:    { type: [String], default: [] },
  weekdays: { type: [Number], default: [] },
  amount:   { type: Number, default: 0 },
  from:     { type: String, default: '' },
  to:       { type: String, default: '' },
  active:   { type: Boolean, default: true },
}, { _id: true });

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
  /* Idle auto-logout for shared devices: minutes without user activity
     before the session is ended. 0 disables it. */
  sessionTimeoutMinutes:{ type: Number, default: 60 },
  paymentMethods:      { type: [String], default: ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'] },
  disabledDepartments:  { type: [String], default: [] },
  accentColor:          { type: String, default: '#2f6fed' },
  departments:          { type: mongoose.Schema.Types.Mixed, default: {} },
  bookingDiscountRules: { type: [discountRuleSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
