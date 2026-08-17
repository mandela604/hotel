const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  dept:  { type: String, default: '' },
  color: { type: String, default: 'gold' },
  text:  { type: String, default: '' },
  time:  { type: String, default: '' },
  href:  { type: String, default: '#' },
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
