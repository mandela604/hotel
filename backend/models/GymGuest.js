const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const gymGuestSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    name: { type: String, required: true, trim: true },
    room: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
  },
  { timestamps: true, _id: false }
);

module.exports = mongoose.model('GymGuest', gymGuestSchema);