require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./backend/models/Booking');
const Room = require('./backend/models/Room');

// Copy of backend calculation functions
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

async function investigate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('===== INVESTIGATING ROOMS 4003, 4004, 4005 =====\n');
    
    const roomNums = ['4003', '4004', '4005'];
    
    for (const roomNum of roomNums) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`ROOM ${roomNum}`);
      console.log('='.repeat(60));
      
      const room = await Room.findOne({ num: roomNum });
      if (!room) {
        console.log('❌ Room not found in Room collection');
        continue;
      }
      console.log('✓ Room found');
      console.log(`  - Type: ${room.type}`);
      console.log(`  - Rate: ₦${room.rate}`);
      console.log(`  - Status: ${room.status}`);
      
      const booking = await Booking.findOne({ room: roomNum });
      if (!booking) {
        console.log('❌ No booking found for this room');
        continue;
      }
      
      console.log('\n📋 BOOKING DATA:');
      console.log(`  - Stay ID: ${booking.stayId || 'none'}`);
      console.log(`  - Guest: ${booking.guest || 'NONE LISTED'}`);
      console.log(`  - Phone: ${booking.phone || 'none'}`);
      console.log(`  - Check-in: ${booking.checkin || 'none'}`);
      console.log(`  - Check-out: ${booking.checkout || 'none'}`);
      
      const nightsCount = nights(booking.checkin, booking.checkout);
      console.log(`  - Nights: ${nightsCount}`);
      
      console.log('\n💰 RATE INFO:');
      console.log(`  - Rate field: ₦${booking.rate || 0}`);
      console.log(`  - Discount: ₦${booking.discount || 0}`);
      console.log(`  - Extra nights: ${booking.extraNights || 0}`);
      console.log(`  - Extra rate: ₦${booking.extraRate || 0}`);
      
      const totalAmount = calcTotal(booking);
      const paidAmount = calcPaid(booking);
      const balanceAmount = calcBal(booking);
      
      console.log('\n📊 CALCULATED AMOUNTS (backend math):');
      console.log(`  - Total: ₦${totalAmount}`);
      console.log(`  - Paid: ₦${paidAmount}`);
      console.log(`  - Balance: ₦${balanceAmount}`);
      console.log(`  - Comped: ₦${booking.comped || 0}`);
      
      console.log('\n💳 PAYMENTS:');
      if (!booking.payments || booking.payments.length === 0) {
        console.log('  - No payment records');
      } else {
        booking.payments.forEach((p, i) => {
          console.log(`  [${i}] ₦${p.amount} - ${p.mode} - ${p.date || 'no date'}`);
          console.log(`      by: ${p.by || 'system'}, note: ${p.note || 'none'}`);
        });
      }
      
      console.log('\n📌 STATUS & OTHER FIELDS:');
      console.log(`  - Pay Status: ${booking.payStatus}`);
      console.log(`  - Room Status: ${booking.status}`);
      console.log(`  - Paid field (legacy): ₦${booking.paid || 0}`);
      console.log(`  - Refunded: ₦${booking.refunded || 0}`);
      
      // Check for mismatch
      if (booking.guest && !booking.checkin) {
        console.log('\n⚠️  WARNING: Guest listed but no check-in date! This explains "Nobody yet" message');
      }
      
      if (roomNum === '4003' && totalAmount === 80000 && balanceAmount === 10000) {
        console.log('\n🔍 ANALYSIS for ₦70k rate showing ₦80k total with ₦10k balance:');
        console.log(`  - Rate shown: 70000, Actual rate in DB: ${booking.rate}`);
        console.log(`  - If rate is 80000 (not 70000), then total = ₦80000 is correct`);
        console.log(`  - Balance = Total - Paid - Comped = ${totalAmount} - ${paidAmount} - ${booking.comped || 0} = ${balanceAmount}`);
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✓ Investigation complete');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

investigate();
