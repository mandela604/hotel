const mongoose = require('mongoose');

const BOOKING_STATUSES = ['reserved', 'checkedin', 'checkout', 'cancelled'];
const PAY_STATUSES = ['Pending', 'Deposit Paid', 'Fully Paid'];
const PAY_METHODS = ['Cash', 'POS', 'Transfer', 'Split – Cash + POS', 'Split – Cash + Transfer', 'Complimentary'];
const ID_TYPES = ['NIN', 'Passport', "Driver's Licence", "Voter's Card"];

const bookingSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, index: true },
    roomType: { type: String, required: true },

    guest: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    idType: { type: String, enum: ID_TYPES, default: 'NIN' },
    idNum: { type: String, default: '' },

    checkin: { type: Date, required: true },
    checkout: { type: Date, required: true },

    rate: { type: Number, required: true, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    paid: { type: Number, default: 0, min: 0 },
    payMethod: { type: String, enum: PAY_METHODS, default: 'Cash' },
    payStatus: { type: String, enum: PAY_STATUSES, default: 'Pending' },

    recordedBy: { type: String, default: '' },
    adults: { type: Number, default: 1, min: 1 },
    children: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },

    status: { type: String, enum: BOOKING_STATUSES, default: 'reserved', index: true },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

bookingSchema.index({ guest: 'text', phone: 'text' });
bookingSchema.index({ checkin: 1 });
bookingSchema.index({ room: 1, status: 1 });

// ── Computed financials, matching the exact math used client-side ──
bookingSchema.methods.nights = function () {
  if (!this.checkin || !this.checkout) return 0;
  const n = (new Date(this.checkout) - new Date(this.checkin)) / 86400000;
  return n > 0 ? n : 0;
};
bookingSchema.methods.total = function () {
  const n = this.nights() || 1;
  return this.rate * n * (1 - (this.discount || 0) / 100);
};
bookingSchema.methods.balance = function () {
  return Math.max(0, this.total() - (this.paid || 0));
};

bookingSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.PAY_STATUSES = PAY_STATUSES;
module.exports.PAY_METHODS = PAY_METHODS;
module.exports.ID_TYPES = ID_TYPES;
