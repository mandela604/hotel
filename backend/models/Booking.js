const mongoose = require('mongoose');

const paymentEntrySchema = new mongoose.Schema({
  id:     { type: String, required: true },
  amount: { type: Number, required: true },
  mode:   { type: String, default: 'Cash' },
  date:   { type: String, default: '' },
  by:     { type: String, default: '' },
  ts:     { type: Number, default: 0 },
  note:   { type: String, default: '' },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  room:       { type: String, required: true, index: true },
  stayId:     { type: String, default: '', unique: true, sparse: true },
  bookingNo:  { type: String, default: '', index: true },
  type:       { type: String, default: 'Standard' },
  guest:      { type: String, default: '' },
  guestId:    { type: String, default: '' },
  phone:      { type: String, default: '' },
  email:      { type: String, default: '' },
  address:    { type: String, default: '' },
  idType:     { type: String, default: 'NIN' },
  idNum:      { type: String, default: '' },
  checkin:    { type: String, default: '' },
  checkout:   { type: String, default: '' },
  rate:       { type: Number, default: 0 },
  discount:   { type: Number, default: 0 },
  payments:   { type: [paymentEntrySchema], default: [] },
  paid:       { type: Number, default: 0 },
  payMethod:  { type: String, default: 'Cash' },
  payStatus:  { type: String, enum: ['Pending','Deposit Paid','Fully Paid','Complimentary','Refunded','Partial Refund'], default: 'Pending' },
  comped:       { type: Number, default: 0 },
  recordedBy: { type: String, default: '' },
  adults:     { type: Number, default: 1 },
  children:   { type: Number, default: 0 },
  status:     { type: String, enum: ['vacant','reserved','checkedin','checkout','cleaning','maintenance','no-show','cancelled'], default: 'vacant' },
  notes:      { type: String, default: '' },
  refunded:       { type: Number, default: 0 },
  refundDate:     { type: String, default: '' },
  refundBy:       { type: String, default: '' },
  refundReason:   { type: String, default: '' },
  _guestName:     { type: String, default: '' },
  extraNights: { type: Number, default: 0 },
  extraRate:   { type: Number, default: 0 },
  createdAt:  { type: Number, default: 0 },
  updatedAt:  { type: Number, default: 0 },
  transferLog: { type: [{ from: String, to: String, by: String, at: Number, note: String }], default: [] },
  history:     { type: [{ date: String, action: String, by: String, note: String, stage: String }], default: [] },
}, { timestamps: false, toJSON: { virtuals: true }, toObject: { virtuals: true } });

bookingSchema.pre('save', function(next) {
  if (this.payStatus === 'Complimentary') {
    const hasCompPayment = (this.payments || []).some(function(p){ return String(p.mode || '').toLowerCase() === 'complimentary'; });
    if (!hasCompPayment && (this.payments || []).length) {
      const firstPayment = this.payments[0];
      if (firstPayment && String(firstPayment.mode || '').toLowerCase() !== 'complimentary') {
        const note = (firstPayment.note || '').trim() || 'Corrected: complimentary stay';
        this.payments = [{
          id: firstPayment.id || 'PMT-COMP',
          amount: 0,
          mode: 'Complimentary',
          date: firstPayment.date || '',
          by: firstPayment.by || 'System',
          ts: Date.now(),
          note: note.slice(0, 300),
        }];
      }
    }
    if (hasCompPayment) {
      this.rate = 0;
      this.discount = 0;
      this.paid = 0;
      this.comped = 0;
    }
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
