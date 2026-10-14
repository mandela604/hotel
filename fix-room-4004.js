require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./backend/models/Booking');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const booking = await Booking.findOne({ room: '4004' });
  if (!booking) {
    console.log('No booking found for room 4004');
    process.exit(1);
  }
  console.log('Before:', JSON.stringify({
    room: booking.room,
    rate: booking.rate,
    paid: booking.paid,
    payStatus: booking.payStatus,
    payments: booking.payments,
  }, null, 2));

  booking.rate = 0;
  booking.paid = 0;
  booking.comped = 0;
  booking.discount = 0;
  booking.payments = [{
    id: 'PMT-COMP-4004',
    amount: 0,
    mode: 'Complimentary',
    date: booking.checkin || '',
    by: 'System',
    ts: Date.now(),
    note: 'Corrected: complimentary stay',
  }];
  booking.payStatus = 'Complimentary';
  await booking.save();

  console.log('After:', JSON.stringify({
    room: booking.room,
    rate: booking.rate,
    paid: booking.paid,
    payStatus: booking.payStatus,
    payments: booking.payments,
  }, null, 2));
  await mongoose.disconnect();
}

fix().catch(console.error);
