/**
 * Fill the remaining "Room X -> cleaning" activity rows.
 *
 * The cleaning line is written right after the checkout line for the same
 * room, so the checkout row's actor is the cleaner. The checkout row already
 * carries its own 'by' (or can be resolved from the guest's stay record).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const Guest = require('../models/Guest');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const dryRun = process.argv.includes('--dry-run');

  const acts = await Activity.find({ dept: 'Booking' }).sort({ createdAt: 1 }).lean();

  // Index checkout rows per room, newest last.
  const checkoutByRoom = new Map();
  for (const a of acts) {
    const t = String(a.text || '');
    if (!/checked out/i.test(t)) continue;
    const rm = t.match(/Room\s+([0-9A-Za-z][0-9A-Za-z\-]*)/);
    if (!rm) continue;
    const list = checkoutByRoom.get(rm[1]) || [];
    list.push(a);
    checkoutByRoom.set(rm[1], list);
  }

  const guests = await Guest.find({}).lean();
  const guestByName = new Map();
  for (const g of guests) {
    const k = String(g.name || '').trim().toUpperCase();
    if (!k) continue;
    if (!guestByName.has(k)) guestByName.set(k, []);
    guestByName.get(k).push(g);
  }

  const targets = acts.filter(a => /→ cleaning|-> cleaning/i.test(String(a.text || '')) && !a.by);
  console.log('cleaning rows still blank:', targets.length);

  // Checkout rows still blank: the guest profile holds who closed the stay.
  const blankCheckouts = acts.filter(a => /checked out/i.test(String(a.text || '')) && !a.by);
  let coFilled = 0;
  for (const act of blankCheckouts) {
    const t = String(act.text || '');
    const rm = t.match(/Room\s+([0-9A-Za-z][0-9A-Za-z\-]*)/);
    const nm = t.match(/^([A-Za-z][A-Za-z .'\-]{1,60}?)\s+checked out/i);
    if (!rm || !nm) continue;
    const room = rm[1];
    const name = nm[1].trim().toUpperCase();
    let who = '';
    for (const g of (guestByName.get(name) || [])) {
      for (const s of g.stays || []) {
        if (String(s.room) === String(room) && s.checkedOutBy) { who = s.checkedOutBy; break; }
      }
      if (who) break;
    }
    if (!who) continue;
    coFilled++;
    if (!dryRun) await Activity.updateOne({ _id: act._id }, { $set: { by: who } });
  }
  console.log(dryRun ? 'DRY RUN — checkout rows would fill:' : 'checkout rows filled:', coFilled);

  let filled = 0;
  for (const act of targets) {
    const t = String(act.text || '');
    const rm = t.match(/Room\s+([0-9A-Za-z][0-9A-Za-z\-]*)/);
    if (!rm) continue;
    const room = rm[1];
    const at = new Date(act.createdAt).getTime();
    const list = (checkoutByRoom.get(room) || []).filter(o => Math.abs(new Date(o.createdAt).getTime() - at) < 120000);
    if (!list.length) continue;
    const co = list[list.length - 1];
    let who = co.by || '';
    if (!who) {
      const nm = String(co.text || '').match(/^([A-Za-z][A-Za-z .'\-]{1,60}?)\s+checked out/i);
      const name = nm ? nm[1].trim().toUpperCase() : '';
      for (const g of (guestByName.get(name) || [])) {
        for (const s of g.stays || []) {
          if (String(s.room) === String(room) && s.checkedOutBy) { who = s.checkedOutBy; break; }
        }
        if (who) break;
      }
    }
    if (!who) continue;
    filled++;
    if (!dryRun) await Activity.updateOne({ _id: act._id }, { $set: { by: who } });
  }
  console.log(dryRun ? 'DRY RUN — would fill:' : 'filled:', filled);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
