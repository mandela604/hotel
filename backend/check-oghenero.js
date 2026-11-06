require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

async function checkOghenero() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.log('MONGODB_URI not set in .env');
      return;
    }

    await mongoose.connect(uri);
    console.log('Connected to database\n');

    // Search for bookings with "Oghenero" in guest name (case insensitive)
    const ogheneroBookings = await Booking.find({
      $or: [
        { guest: { $regex: 'Oghenero', $options: 'i' } },
        { _guestName: { $regex: 'Oghenero', $options: 'i' } }
      ]
    }).lean();

    console.log(`Found ${ogheneroBookings.length} booking(s) for Mr Oghenero:\n`);

    if (ogheneroBookings.length === 0) {
      console.log('No bookings found for Mr Oghenero in the database.');
      console.log('\nThe workers may NOT have actually made the reservation.');
    } else {
      ogheneroBookings.forEach((b, i) => {
        console.log(`Booking ${i + 1}:`);
        console.log(`  Guest: ${b.guest || b._guestName || 'N/A'}`);
        console.log(`  Room: ${b.room}`);
        console.log(`  Status: ${b.status}`);
        console.log(`  Check-in: ${b.checkin}`);
        console.log(`  Check-out: ${b.checkout}`);
        console.log(`  Created: ${b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}`);
        console.log(`  Booking No: ${b.bookingNo || b.stayId || 'N/A'}`);
        console.log(`  Recorded by: ${b.recordedBy || 'N/A'}`);
        console.log('');
      });
    }

    // Also check for any reservations created on the 5th (assuming November 5th, 2026 based on system date)
    const nov5 = new Date('2026-11-05');
    const nov6 = new Date('2026-11-06');
    const reservationsOn5th = await Booking.find({
      createdAt: { $gte: nov5.getTime(), $lt: nov6.getTime() },
      status: 'reserved'
    }).lean();

    console.log(`\n--- Reservations created on November 5th, 2026 ---`);
    console.log(`Found ${reservationsOn5th.length} reservation(s) created on Nov 5th:\n`);

    if (reservationsOn5th.length > 0) {
      reservationsOn5th.forEach((b, i) => {
        console.log(`Reservation ${i + 1}:`);
        console.log(`  Guest: ${b.guest || b._guestName || 'N/A'}`);
        console.log(`  Room: ${b.room}`);
        console.log(`  Check-in: ${b.checkin}`);
        console.log(`  Check-out: ${b.checkout}`);
        console.log(`  Created: ${b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}`);
        console.log(`  Recorded by: ${b.recordedBy || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('No reservations found created on November 5th, 2026.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkOghenero();
