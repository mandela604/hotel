require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const Guest = require('./models/Guest');

function nights(ci, co) {
  if (!ci || !co) return 0;
  const n = (new Date(co) - new Date(ci)) / 86400000;
  return n > 0 ? n : 0;
}
function calcTotal(b) {
  if (!b.checkin || !b.checkout) return 0;
  const rawN = nights(b.checkin, b.checkout);
  const n = rawN || 1;
  const disc = Number(b.discount) || 0;
  const baseRate = Number(b.rate) || 0;
  const extraN = Number(b.extraNights) || 0;
  const extraR = Number(b.extraRate) || 0;
  if (extraN > 0 && extraR > 0) {
    const baseN = Math.max(0, n - extraN);
    return Math.max(0, baseN * (baseRate - disc) + extraN * (extraR - disc));
  }
  return Math.max(0, (baseRate - disc) * n);
}
function calcPaid(b) {
  const raw = (b.payments || []).reduce((s, p) => s + (p.amount || 0), 0) || b.paid || 0;
  return Math.max(0, raw - (Number(b.refunded) || 0));
}
function calcBal(b) {
  return Math.max(0, calcTotal(b) - calcPaid(b) - (Number(b.comped) || 0));
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Find guest
  const guest = await Guest.findOne({ name: /anthony.*ota/i });
  if (!guest) {
    console.log('Guest not found by name. Searching bookings...');
  } else {
    console.log('=== GUEST PROFILE ===');
    console.log(`Name: ${guest.name}`);
    console.log(`Phone: ${guest.phone}`);
    console.log(`GuestId: ${guest.guestId}`);
  }

  // Find all bookings for Anthony Otas
  const bookings = await Booking.find({ guest: /anthony.*ota/i }).sort({ createdAt: -1 });
  console.log(`\nFound ${bookings.length} booking(s) matching "Anthony Otas"\n`);

  for (const b of bookings) {
    const total = calcTotal(b);
    const paid  = calcPaid(b);
    const bal   = calcBal(b);

    console.log(`--- Room ${b.room} | stayId: ${b.stayId} ---`);
    console.log(`  Guest: ${b.guest}`);
    console.log(`  Check-in: ${b.checkin}  Check-out: ${b.checkout}  Nights: ${nights(b.checkin, b.checkout)}`);
    console.log(`  Rate: ₦${b.rate}  Discount: ₦${b.discount}  ExtraNights: ${b.extraNights}  ExtraRate: ₦${b.extraRate}`);
    console.log(`  TOTAL: ₦${total}  PAID: ₦${paid}  BALANCE: ₦${bal}  COMPED: ₦${b.comped || 0}`);
    console.log(`  payStatus: ${b.payStatus}  status: ${b.status}`);
    console.log(`  Payments (${(b.payments||[]).length}):`);
    (b.payments || []).forEach((p, i) => {
      console.log(`    [${i}] ₦${p.amount} | ${p.mode} | ${p.date} | by: ${p.by}`);
    });
    if (b.transferLog && b.transferLog.length) {
      console.log(`  Transfer Log:`);
      b.transferLog.forEach(t => {
        console.log(`    from ${t.from} → ${t.to} | by: ${t.by} | at: ${new Date(t.at).toISOString()} | note: ${t.note}`);
      });
    }
    console.log('');
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
