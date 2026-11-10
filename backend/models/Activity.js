const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  dept:  { type: String, default: '' },
  color: { type: String, default: 'gold' },
  text:  { type: String, default: '' },
  time:  { type: String, default: '' },
  href:  { type: String, default: '#' },
  by:    { type: String, default: '' },
}, { timestamps: true });

/* Dashboard "recent activity": find().sort({createdAt:-1}).limit(10). */
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
