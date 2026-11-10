/**
 * Stay-conflict report — READ ONLY.
 *
 * Prints the rows that the new clash rules care about, so the desk can
 * decide what to clean up. This script never writes to the database.
 *
 *   node scripts/report-stay-conflicts.js
 *   node scripts/report-stay-conflicts.js --json
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Booking = require('../models/Booking');

const ACTIVE = ['reserved', 'checkedin'];

function digits(p) { return String(p || '').replace(/\D/g, ''); }
function normName(n) { return String(n || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function money(n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG'); }
function paid(b) {
  const sum = (b.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return sum || Number(b.paid) || 0;
}
function fmt(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

(async () => {
  const asJson = process.argv.includes('--json');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });

  const active = await Booking.find({ status: { $in: ACTIVE } }).lean();
  await mongoose.disconnect();

  /* 1. Rooms holding more than one live stay */
  const byRoom = new Map();
  for (const b of active) {
    if (!byRoom.has(b.room)) byRoom.set(b.room, []);
    byRoom.get(b.room).push(b);
  }
  const multiStayRooms = [...byRoom.entries()]
    .filter(([, list]) => list.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  /* 2. Same guest holding live stays in more than one room */
  const byGuest = new Map();
  for (const b of active) {
    const ph = digits(b.phone);
    const key = ph.length >= 7 ? 'phone:' + ph : 'name:' + normName(b.guest);
    if (key === 'name:' && !normName(b.guest)) continue;
    if (!byGuest.has(key)) byGuest.set(key, []);
    byGuest.get(key).push(b);
  }
  const multiRoomGuests = [...byGuest.entries()]
    .filter(([, list]) => new Set(list.map((b) => b.room)).size > 1)
    .sort((a, b) => b[1].length - a[1].length);

  /* 3. A checked-in guest sharing the room with other live stays */
  const occupiedWithOthers = multiStayRooms.filter(([, list]) => list.some((b) => b.status === 'checkedin'));

  if (asJson) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      activeStays: active.length,
      multiStayRooms: multiStayRooms.map(([room, list]) => ({
        room,
        stays: list.map((b) => ({
          stayId: b.stayId, bookingNo: b.bookingNo, guest: b.guest, phone: b.phone,
          status: b.status, checkin: b.checkin, checkout: b.checkout, paid: paid(b),
        })),
      })),
      multiRoomGuests: multiRoomGuests.map(([key, list]) => ({
        key,
        stays: list.map((b) => ({
          room: b.room, stayId: b.stayId, bookingNo: b.bookingNo, guest: b.guest, phone: b.phone,
          status: b.status, checkin: b.checkin, checkout: b.checkout, paid: paid(b),
        })),
      })),
    }, null, 2));
    return;
  }

  const line = '─'.repeat(78);
  console.log('\n' + line);
  console.log('STAY CONFLICT REPORT (read only — nothing was changed)');
  console.log(line);
  console.log('Active stays (reserved + checked in): ' + active.length);

  console.log('\n1) ROOMS WITH MORE THAN ONE LIVE STAY — ' + multiStayRooms.length);
  console.log(line);
  for (const [room, list] of multiStayRooms) {
    const hasChecked = list.some((b) => b.status === 'checkedin');
    console.log('Room ' + room + (hasChecked ? '  ← a guest is checked in here' : ''));
    for (const b of list) {
      console.log('   ' + (b.status === 'checkedin' ? '●' : '○') + ' ' + (b.guest || 'Guest') +
        '  ' + (b.phone ? '(' + b.phone + ')' : '(no phone)') +
        '  ' + fmt(b.checkin) + ' → ' + fmt(b.checkout) +
        '  ' + (b.bookingNo || b.stayId || '' ) +
        '  paid ' + money(paid(b)));
    }
  }
  if (!multiStayRooms.length) console.log('   none');

  console.log('\n2) SAME GUEST WITH LIVE STAYS IN MORE THAN ONE ROOM — ' + multiRoomGuests.length);
  console.log(line);
  for (const [key, list] of multiRoomGuests) {
    const total = list.reduce((s, b) => s + paid(b), 0);
    console.log((key.startsWith('phone:') ? 'Phone ' + key.slice(6) : 'Name "' + key.slice(5) + '"') +
      '  — ' + list.length + ' stays, ' + money(total) + ' collected');
    for (const b of list) {
      console.log('   Room ' + b.room + '  ' + (b.status === 'checkedin' ? '●' : '○') + ' ' + (b.guest || 'Guest') +
        '  ' + fmt(b.checkin) + ' → ' + fmt(b.checkout) +
        '  ' + (b.bookingNo || b.stayId || '') +
        '  paid ' + money(paid(b)));
    }
  }
  if (!multiRoomGuests.length) console.log('   none');

  console.log('\n3) ROOMS WHERE A CHECKED-IN GUEST SHARES WITH OTHER STAYS — ' + occupiedWithOthers.length);
  console.log(line);
  for (const [room, list] of occupiedWithOthers) {
    console.log('Room ' + room + ': ' + list.map((b) => (b.guest || 'Guest') + ' [' + b.status + ']').join('  |  '));
  }
  if (!occupiedWithOthers.length) console.log('   none');

  console.log('\n' + line);
  console.log('Nothing was modified. Pick what to clean up, then remove it by hand.');
  console.log(line + '\n');
})().catch((e) => { console.error('Report failed:', e); process.exit(1); });
