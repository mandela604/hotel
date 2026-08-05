const mongoose = require('mongoose');

const CHARGE_SOURCES = ['Restaurant', 'Bar', 'Pool Bar', 'Spa', 'Laundry', 'Other'];
const CHARGE_STATUSES = ['Pending', 'Settled'];

const roomChargeSchema = new mongoose.Schema(
  {
    guestPhone: { type: String, required: true, index: true },
    guestName: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: CHARGE_SOURCES, required: true },
    desc: { type: String, required: true },
    room: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    by: { type: String, default: '' },
    status: { type: String, enum: CHARGE_STATUSES, default: 'Pending' },
  },
  { timestamps: true }
);

roomChargeSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('RoomCharge', roomChargeSchema);
module.exports.CHARGE_SOURCES = CHARGE_SOURCES;
module.exports.CHARGE_STATUSES = CHARGE_STATUSES;
