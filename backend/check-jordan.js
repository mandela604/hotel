require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const Guest = require('./models/Guest');

async function checkJordan() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.log('MONGODB_URI not set in .env');
      return;
    }

    await mongoose.connect(uri);
    console.log('Connected to database\n');

    // Search for Jordan in bookings
    const jordanBookings = await Booking.find({
      $or: [
        { guest: { $regex: 'Jordan', $options: 'i' } },
        { _guestName: { $regex: 'Jordan', $options: 'i' } }
      ]
    }).lean().sort({ createdAt: -1 });

    console.log(`Found ${jordanBookings.length} booking(s) with "Jordan" in guest name:\n`);

    if (jordanBookings.length === 0) {
      console.log('❌ NO BOOKINGS found for Jordan in the database.');
    } else {
      jordanBookings.forEach((b, i) => {
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

    // Search for Jordan in Guest collection
    const jordanGuests = await Guest.find({
      name: { $regex: 'Jordan', $options: 'i' }
    }).lean().sort({ updatedAt: -1 });

    console.log(`\n--- Guest Collection ---`);
    console.log(`Found ${jordanGuests.length} guest(s) with "Jordan" in name:\n`);

    if (jordanGuests.length === 0) {
      console.log('❌ NO GUESTS found for Jordan in the Guest collection.');
    } else {
      jordanGuests.forEach((g, i) => {
        console.log(`Guest ${i + 1}:`);
        console.log(`  Name: ${g.name}`);
        console.log(`  Guest ID: ${g.guestId}`);
        console.log(`  Phone: ${g.phone || 'N/A'}`);
        console.log(`  Email: ${g.email || 'N/A'}`);
        console.log(`  Updated: ${g.updatedAt ? new Date(g.updatedAt).toLocaleString() : 'N/A'}`);
        console.log(`  Number of stays: ${(g.stays || []).length}`);
        if (g.stays && g.stays.length > 0) {
          console.log(`  Stays:`);
          g.stays.forEach((s, idx) => {
            console.log(`    ${idx + 1}. Room ${s.room} (${s.checkin} to ${s.checkout})`);
          });
        }
        console.log('');
      });
    }

    // Check if there are any bookings with empty guest names (that might be Jordan)
    const emptyGuestBookings = await Booking.find({
      $or: [
        { guest: '' },
        { guest: null },
        { guest: { $exists: false } }
      ]
    }).lean().limit(20);

    console.log(`\n--- Bookings with empty/missing guest names (first 20) ---`);
    console.log(`Found ${emptyGuestBookings.length} booking(s) with no guest name:\n`);

    if (emptyGuestBookings.length > 0) {
      emptyGuestBookings.forEach((b, i) => {
        console.log(`${i + 1}. Room ${b.room} - Status: ${b.status} - Check-in: ${b.checkin} - Created: ${b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}`);
      });
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkJordan();
