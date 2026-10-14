require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);

  const bookings = await Booking.find({ payStatus: 'Complimentary' });
  console.log(`Found ${bookings.length} complimentary bookings`);

  let fixed = 0;
  for (const b of bookings) {
    const hasCompPayment = (b.payments || []).some(function(p){ return String(p.mode || '').toLowerCase() === 'complimentary'; });
    const hasStalePayment = (b.payments || []).some(function(p){ return String(p.mode || '').toLowerCase() !== 'complimentary' && Number(p.amount) > 0; });

    if (!hasCompPayment || hasStalePayment || Number(b.rate) > 0) {
      console.log(`Fixing room ${b.room} (${b.guest}): rate=${b.rate}, payStatus=${b.payStatus}, payments=${JSON.stringify(b.payments)}`);

      const existingNote = (b.payments || []).find(function(p){ return String(p.mode || '').toLowerCase() === 'complimentary'; });
      const note = (existingNote && existingNote.note || '').trim() || 'Corrected: complimentary stay';

      b.rate = 0;
      b.discount = 0;
      b.paid = 0;
      b.comped = 0;
      b.payments = [{
        id: 'PMT-COMP-' + b.room,
        amount: 0,
        mode: 'Complimentary',
        date: b.checkin || '',
        by: 'System',
        ts: Date.now(),
        note: note.slice(0, 300),
      }];

      await b.save();
      fixed++;
      console.log(`  -> Fixed: rate=0, paid=0, mode=Complimentary, amount=0`);
    }
  }

  console.log(`\nFixed ${fixed} bookings`);
  await mongoose.disconnect();
}

fix().catch(console.error);
