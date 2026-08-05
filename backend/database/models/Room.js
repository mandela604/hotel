const mongoose = require('mongoose');

const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Conference'];
const ROOM_STATUSES = ['available', 'reserved', 'checkedin', 'checkout', 'maintenance'];

const roomSchema = new mongoose.Schema(
  {
    num: { type: String, required: true, unique: true, trim: true, index: true },
    type: { type: String, required: true, enum: ROOM_TYPES },
    rate: { type: Number, required: true, default: 0, min: 0 },
    // Denormalized current status, kept in sync by bookingService whenever a
    // booking is created / checked-in / checked-out / cancelled, or when the
    // room is put on/off maintenance directly. This keeps room-grid reads O(1)
    // instead of joining against Booking on every request.
    status: { type: String, enum: ROOM_STATUSES, default: 'available' },
    // Reference to the booking currently occupying/holding this room, if any.
    currentBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    notes: { type: String, default: '' }, // e.g. maintenance reason
  },
  { timestamps: true }
);

roomSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Room', roomSchema);
module.exports.ROOM_TYPES = ROOM_TYPES;
module.exports.ROOM_STATUSES = ROOM_STATUSES;
