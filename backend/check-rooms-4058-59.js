require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

async function checkRooms() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.log('MONGODB_URI not set in .env');
      return;
    }

    await mongoose.connect(uri);
    console.log('Connected to database\n');

    // Search for bookings in rooms 4058 and 4059
    const roomBookings = await Booking.find({
      $or: [
        { room: '4058' },
        { room: '4059' },
        { room: 4058 },
        { room: 4059 }
      ]
    }).lean().sort({ createdAt: -1 });

    console.log(`Found ${roomBookings.length} booking(s) for rooms 4058 and 4059:\n`);

    if (roomBookings.length === 0) {
      console.log('No bookings found for rooms 4058 and 4059 in the database.');
      console.log('\nThe reservation may NOT exist in the system.');
    } else {
      roomBookings.forEach((b, i) => {
        console.log(`Booking ${i + 1}:`);
        console.log(`  Guest: ${b.guest || b._guestName || 'N/A'}`);
        console.log(`  Room: ${b.room}`);
        console.log(`  Type: ${b.type || 'N/A'}`);
        console.log(`  Status: ${b.status}`);
        console.log(`  Check-in: ${b.checkin}`);
        console.log(`  Check-out: ${b.checkout}`);
        console.log(`  Created: ${b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}`);
        console.log(`  Booking No: ${b.bookingNo || b.stayId || 'N/A'}`);
        console.log(`  Recorded by: ${b.recordedBy || 'N/A'}`);
        console.log(`  Payment Status: ${b.payStatus || 'N/A'}`);
        console.log(`  Total: ${b.total || 0}`);
        console.log(`  Paid: ${b.paid || 0}`);
        console.log('');
      });
    }

    // Also check all Apartment reservations
    const apartmentBookings = await Booking.find({
      type: { $regex: 'apartment', $options: 'i' },
      status: 'reserved'
    }).lean().sort({ room: 1 });

    console.log(`\n--- ALL Apartment Reservations ---`);
    console.log(`Found ${apartmentBookings.length} apartment reservation(s):\n`);

    if (apartmentBookings.length > 0) {
      apartmentBookings.forEach((b, i) => {
        console.log(`${i + 1}. Room ${b.room} - ${b.guest || b._guestName || 'N/A'} (${b.checkin} to ${b.checkout}) - Status: ${b.status}`);
      });
    } else {
      console.log('No apartment reservations found.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkRooms();
