/**
 * Backfill Activity.by for historical rows.
 *
 * The 'by' column (who did it) was only stamped on activity rows written after
 * the Activity.by field existed. This walks the old rows and recovers the name
 * from the source record that produced the entry:
 *
 *   "<guest> booked into Room X"        -> Booking.recordedBy (guest + room match)
 *   "Payment of N recorded for Room X"   -> the matching payment entry's 'by'
 *   "<guest> checked out - Room X"      -> Guest.stays[].checkedOutBy
 *   "Room X -> cleaning"                 -> the checkout row for that room
 *
 * Only rows we can attribute with a confident source are written; anything
 * ambiguous is left untouched rather than guessing a name.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const Guest = require('../models/Guest');
const Sale = require('../models/Sale');
const Order = require('../models/Order');

const ROOM_RE = /Room\s+([0-9A-Za-z][0-9A-Za-z\-]*)/;
const NAME_RE = /^([A-Za-z][A-Za-z .'\-]{1,60}?)\s+(?:booked into|checked out|checked in)/;
const PAY_RE = /Payment of (\d+)/;
const CLOSE_MS = 6 * 60 * 60 * 1000;

function pickClosest(payments, amount, at) {
  let best = null, bestDiff = Infinity;
  for (const p of payments || []) {
    if (Number(p.amount) !== Number(amount)) continue;
    const ts = Number(p.ts) || 0;
    const diff = ts ? Math.abs(ts - at) : Infinity;
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  if (!best) return '';
  if (bestDiff !== Infinity && bestDiff > CLOSE_MS) return '';
  return best.by || '';
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });

  const dryRun = process.argv.includes('--dry-run');
  const acts = await Activity.find({}).sort({ createdAt: 1 }).lean();

  console.log('activity rows scanned:', acts.length);

  const bookings = await Booking.find({}).lean();
  const guests = await Guest.find({}).lean();
  const audits = await AuditLog.find({}).lean();
  const sales = await Sale.find({}).lean();
  const orders = await Order.find({}).lean();
  const saleById = new Map(sales.map(s => [s.id, s]));
  const orderById = new Map(orders.map(o => [o.id, o]));

  const byRoom = new Map();
  for (const b of bookings) {
    if (!byRoom.has(b.room)) byRoom.set(b.room, []);
    byRoom.get(b.room).push(b);
  }
  const guestByName = new Map();
  for (const g of guests) {
    const k = String(g.name || '').trim().toUpperCase();
    if (!k) continue;
    if (!guestByName.has(k)) guestByName.set(k, []);
    guestByName.get(k).push(g);
  }
  const auditByRoom = new Map();
  for (const a of audits) {
    const k = String(a.bookingId || '');
    if (!k) continue;
    if (!auditByRoom.has(k)) auditByRoom.set(k, []);
    auditByRoom.get(k).push(a);
  }

  let filled = 0, skipped = 0;
  const changes = [];

  for (const act of acts) {
    if (act.by) { skipped++; continue; }
    const text = String(act.text || '');
    const at = new Date(act.createdAt).getTime();
    const rm = text.match(ROOM_RE);
    const room = rm ? rm[1] : '';
    let who = '';

    if (act.dept !== 'Booking') {
      // Restaurant / other modules: the sale or tab record names its staff.
      const sm = text.match(/\b(RST-\d+)\b/);
      const om = text.match(/\b(RSO-\d+)\b/);
      if (sm && saleById.has(sm[1])) who = (saleById.get(sm[1]).staff || '').trim();
      else if (om && orderById.has(om[1])) {
        const o = orderById.get(om[1]);
        who = (o.staff || o.createdBy || '').trim();
      }
    } else if (/booked into/i.test(text)) {
      const nm = text.match(NAME_RE);
      const name = nm ? nm[1].trim().toUpperCase() : '';
      const cands = (byRoom.get(room) || []);
      const match = cands.find(b => !name || String(b.guest || '').trim().toUpperCase() === name);
      if (match && match.recordedBy) who = match.recordedBy;
    } else if (PAY_RE.test(text)) {
      const amount = PAY_RE.exec(text)[1];
      const cands = byRoom.get(room) || [];
      let candidates = [];
      for (const b of cands) candidates = candidates.concat(b.payments || []);
      for (const g of guests) {
        for (const s of g.stays || []) {
          if (String(s.room) === String(room)) candidates = candidates.concat(s.payments || []);
        }
      }
      who = pickClosest(candidates, amount, at);
    } else if (/checked out/i.test(text)) {
      const nm = text.match(NAME_RE);
      const name = nm ? nm[1].trim().toUpperCase() : '';
      const gset = guestByName.get(name) || [];
      for (const g of gset) {
        for (const s of g.stays || []) {
          if (String(s.room) === String(room) && s.checkedOutBy) { who = s.checkedOutBy; break; }
        }
        if (who) break;
      }
    } else if (/→ cleaning|-> cleaning/i.test(text)) {
      // The cleaning line is emitted right after the checkout line for that room.
      const near = acts.find(o => o !== act &&
        Math.abs(new Date(o.createdAt).getTime() - at) < 120000 &&
        /checked out/i.test(String(o.text || '')) && String(o.text || '').includes(room));
      if (near) {
        const nm2 = String(near.text || '').match(NAME_RE);
        const name2 = nm2 ? nm2[1].trim().toUpperCase() : '';
        for (const g of (guestByName.get(name2) || [])) {
          for (const s of g.stays || []) {
            if (String(s.room) === String(room) && s.checkedOutBy) { who = s.checkedOutBy; break; }
          }
          if (who) break;
        }
        if (!who) who = near.by || '';
      }
    } else {
      const als = (auditByRoom.get(room) || []).filter(a => Math.abs(new Date(a.createdAt).getTime() - at) < CLOSE_MS);
      if (als.length) who = als[als.length - 1].recordedBy || '';
    }

    if (!who) { skipped++; continue; }
    filled++;
    changes.push({ at: act.createdAt, text, who });
    if (!dryRun) {
      await Activity.updateOne({ _id: act._id }, { $set: { by: who } });
    }
  }

  console.log(dryRun ? 'DRY RUN — would fill:' : 'filled:', filled, '| skipped (no confident source):', skipped);
  changes.slice(-25).forEach(c => console.log(' ', new Date(c.at).toISOString(), '->', c.who, '|', c.text));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
