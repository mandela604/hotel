const mongoose = require('mongoose');

// A "Guest" record stores the things that AREN'T derivable from booking
// history: VIP flag and free-text notes/preferences. Stay history, spend,
// and outstanding balance are all computed on read from Booking + RoomCharge.
// Guests are keyed by phone number (the closest thing to a natural key we
// have from the walk-in booking form).
const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true, index: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    idType: { type: String, default: 'NIN' },
    idNum: { type: String, default: '' },
    vip: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

guestSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Guest', guestSchema);
