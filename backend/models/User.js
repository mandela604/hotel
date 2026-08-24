const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, default: '' },
  role:       { type: String, default: 'staff', trim: true },
  privilege:  { type: String, default: 'Standard' },
  department: { type: String, default: 'General' },
  phone:      { type: String, default: '' },
  initials:   { type: String, default: '' },
  avatar:     { type: String, default: '' },
  status:     { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastLogin:  { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.name && !this.initials) {
    this.initials = this.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return true;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
