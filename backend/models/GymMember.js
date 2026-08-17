const mongoose = require('mongoose');

const gymMemberSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  phone:         { type: String, default: '' },
  room:          { type: String, default: 'N/A' },
  plan:          { type: mongoose.Schema.Types.ObjectId, ref: 'GymPlan' },
  planName:      { type: String, default: '' },
  startDate:     { type: Date, default: Date.now },
  endDate:       { type: Date },
  status:        { type: String, enum: ['active','expired'], default: 'active' },
  totalCheckins: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('GymMember', gymMemberSchema);
