require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

async function checkNov26to28() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.log('MONGODB_URI not set in .env');
      return;
    }

    await mongoose.connect(uri);
    console.log('Connected to database\n');

    // Search for reservations Nov 26-28 for rooms 4058 and 4059
    const targetBookings = await Booking.find({
      $or: [
        { room: '4058' },
        { room: '4059' },
        { room: 4058 },
        { room: 4059 }
      ],
      checkin: '2026-11-26',
      checkout: '2026-11-28'
    }).lean();

    console.log(`Found ${targetBookings.length} booking(s) for rooms 4058/4059 for Nov 26-28:\n`);

    if (targetBookings.length === 0) {
      console.log('❌ NO RESERVATIONS FOUND for rooms 4058/4059 for Nov 26-28 in the database!');
      console.log('\nThis explains the problem:');
      console.log('- The receipt was printed BUT the reservation was NOT saved to the database');
      console.log('- This means the system had a failure during booking creation');
      console.log('- Room 4058 was then available to be booked by Miss Rosemary Okwe');
      console.log('- Room 4059 remains free because no reservation exists for it\n');
    } else {
      targetBookings.forEach((b, i) => {
        console.log(`Booking ${i + 1}:`);
        console.log(`  Guest: ${b.guest || b._guestName || 'N/A'}`);
        console.log(`  Room: ${b.room}`);
        console.log(`  Status: ${b.status}`);
        console.log(`  Check-in: ${b.checkin}`);
        console.log(`  Check-out: ${b.checkout}`);
        console.log(`  Created: ${b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}`);
        console.log(`  Booking No: ${b.bookingNo || b.stayId || 'N/A'}`);
        console.log(`  Recorded by: ${b.recordedBy || 'N/A'}`);
        console.log(`  Payment Status: ${b.payStatus || 'N/A'}`);
        console.log(`  Paid: ${b.paid || 0}`);
        console.log('');
      });
    }

    // Check ALL bookings for Nov 26 for these rooms (in case dates don't match exactly)
    const allNov26 = await Booking.find({
      $or: [
        { room: '4058' },
        { room: '4059' },
        { room: 4058 },
        { room: 4059 }
      ],
      checkin: '2026-11-26'
    }).lean();

    console.log(`\n--- ALL bookings for Nov 26 check-in (rooms 4058/4059) ---`);
    console.log(`Found ${allNov26.length} booking(s):\n`);

    if (allNov26.length > 0) {
      allNov26.forEach((b, i) => {
        console.log(`${i + 1}. Room ${b.room} - ${b.guest || b._guestName || 'N/A'} (${b.checkin} to ${b.checkout}) - Status: ${b.status} - Created: ${b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}`);
      });
    } else {
      console.log('No bookings found for Nov 26 check-in for these rooms.');
    }

    // Check if Miss Rosemary Okwe's booking overlaps
    const rosemary = await Booking.findOne({
      room: '4058',
      guest: { $regex: 'Rosemary', $options: 'i' }
    }).lean();

    if (rosemary) {
      console.log(`\n--- Current booking for Room 4058 ---`);
      console.log(`Guest: ${rosemary.guest || rosemary._guestName}`);
      console.log(`Check-in: ${rosemary.checkin}`);
      console.log(`Check-out: ${rosemary.checkout}`);
      console.log(`Status: ${rosemary.status}`);
      console.log(`Created: ${rosemary.createdAt ? new Date(rosemary.createdAt).toLocaleString() : 'N/A'}`);
      console.log(`Booking No: ${rosemary.bookingNo || rosemary.stayId}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkNov26to28();
