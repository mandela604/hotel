const mongoose = require('mongoose');

const paymentEntrySchema = new mongoose.Schema({
  id:     { type: String, required: true },
  amount: { type: Number, required: true },
  mode:   { type: String, default: 'Cash' },
  date:   { type: String, default: '' },
  by:     { type: String, default: '' },
  ts:     { type: Number, default: 0 },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  room:       { type: String, required: true, unique: true },
  type:       { type: String, enum: ['Standard','Deluxe','Suite','Conference'], default: 'Standard' },
  guest:      { type: String, default: '' },
  guestId:    { type: String, default: '' },
  phone:      { type: String, default: '' },
  email:      { type: String, default: '' },
  address:    { type: String, default: '' },
  idType:     { type: String, default: 'NIN' },
  idNum:      { type: String, default: '' },
  checkin:    { type: String, default: '' },
  checkout:   { type: String, default: '' },
  rate:       { type: Number, default: 0 },
  discount:   { type: Number, default: 0 },
  payments:   { type: [paymentEntrySchema], default: [] },
  paid:       { type: Number, default: 0 },
  payMethod:  { type: String, default: 'Cash' },
  payStatus:  { type: String, enum: ['Pending','Deposit Paid','Fully Paid'], default: 'Pending' },
  recordedBy: { type: String, default: '' },
  adults:     { type: Number, default: 1 },
  children:   { type: Number, default: 0 },
  status:     { type: String, enum: ['vacant','reserved','checkedin','checkout','cleaning','maintenance','no-show'], default: 'vacant' },
  notes:      { type: String, default: '' },
  createdAt:  { type: Number, default: 0 },
  updatedAt:  { type: Number, default: 0 },
}, { timestamps: false });

module.exports = mongoose.model('Booking', bookingSchema);
