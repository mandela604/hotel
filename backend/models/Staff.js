const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  staffCode:  { type: String, unique: true, sparse: true },
  name:       { type: String, required: true, trim: true },
  email:      { type: String, lowercase: true, trim: true },
  phone:      { type: String, default: '' },
  role:       { type: String, required: true, trim: true },
  department: { type: String, default: 'General' },
  dept:       { type: String, default: 'General' },
  shift:      { type: String, enum: ['Morning', 'Evening', 'Night', 'Flexible'], default: 'Morning' },
  status:     { type: String, enum: ['on_duty', 'off_duty', 'on_leave', 'terminated'], default: 'on_duty' },
  salary:     { type: Number, default: 0 },
  hireDate:   { type: String, default: '' },
  privileges: { type: mongoose.Schema.Types.Mixed, default: {} },
  userRef:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

staffSchema.pre('save', function (next) {
  if (this.department && !this.dept) this.dept = this.department;
  if (this.dept && !this.department) this.department = this.dept;
  next();
});

module.exports = mongoose.model('Staff', staffSchema);
