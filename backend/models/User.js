const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DEPARTMENTS = [
  'Management', 'Front Desk', 'Housekeeping', 'Restaurant',
  'Kitchen', 'Pool Bar', 'Gym', 'Store', 'Procurement', 'Accounts',
];

const userSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4(), unique: true },
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, default: '' },
  role:       { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff', trim: true },
  privileges: {
    type:      { type: String, enum: ['front_desk','accountant','procurement_manager','sales_rep','store_keeper','chef','gym_attendant','pool_bar_staff','restaurant_staff','waiter', null], default: null },
    overrides: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  department: { type: String, enum: DEPARTMENTS, default: 'Management', trim: true },
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
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
