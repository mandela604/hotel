const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const gymCheckinSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    memberId: { type: String, ref: 'GymMember', required: true },
    memberName: { type: String, required: true },
    time: { type: String, required: true },
  },
  { timestamps: true, _id: false }
);

module.exports = mongoose.model('GymCheckin', gymCheckinSchema);