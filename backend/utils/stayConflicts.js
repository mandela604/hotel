/**
 * Stay-conflict rules for the booking module.
 *
 * The confusion this exists to stop: a reservation is moved into a room
 * that already has a guest checked in. The room card then shows the
 * reserved name while the checked-in guest is still living there, so the
 * desk sees "occupied by someone else" on a room they believe is theirs.
 *
 * Two independent questions:
 *   1. roomOccupantConflict — is the target room physically taken?
 *   2. guestStayNotice      — does this guest already have a live stay?
 *
 * Rule 2 NEVER blocks. One guest may legitimately hold several rooms, so
 * the other stays are surfaced and the desk confirms — they are not
 * refused.
 */
const Booking = require('../models/Booking');

const ACTIVE_STATUSES = ['reserved', 'checkedin'];

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(v) {
  const d = toDate(v);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* [aStart,aEnd) overlaps [bStart,bEnd) — false when a date is missing */
function datesOverlap(aStart, aEnd, bStart, bEnd) {
  const aS = toDate(aStart), aE = toDate(aEnd), bS = toDate(bStart), bE = toDate(bEnd);
  if (!aS || !aE || !bS || !bE) return false;
  return aS < bE && aE > bS;
}

/* "08031234567" must match a stored "+2348031234567", so try the local
   and international spellings of the same number. */
function phoneVariants(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const out = [];
  const add = (v) => { if (v && v.length >= 7 && out.indexOf(v) === -1) out.push(v); };
  add(d);
  if (d.length === 11 && d.charAt(0) === '0') add('234' + d.slice(1));
  else if (d.length === 12 && d.indexOf('234') === 0) add(d.slice(3));
  else if (d.length === 10 && d.charAt(0) === '0') add('234' + d.slice(1));
  return out;
}

function staySummary(b) {
  return {
    room: b.room || '',
    guest: b.guest || '',
    status: b.status || '',
    checkin: b.checkin || '',
    checkout: b.checkout || '',
    bookingNo: b.bookingNo || '',
    stayId: b.stayId || '',
  };
}

function roomList(rooms) {
  const r = rooms.filter(Boolean);
  if (!r.length) return '';
  if (r.length === 1) return 'Room ' + r[0];
  if (r.length <= 4) return 'Rooms ' + r.slice(0, -1).join(', ') + ' and ' + r[r.length - 1];
  // A group booking can hold a lot of rooms — keep the message readable.
  const head = r.slice(0, 3).join(', ');
  const rest = r.length - 3;
  return 'Rooms ' + head + ' and ' + rest + ' more';
}

/**
 * Rule 1 — the target room has a guest checked in.
 *
 * The stay may only join the room from the occupant's checkout date
 * onwards (same-day turnover is allowed — the guest leaves in the
 * morning). When either date is missing we refuse rather than guess.
 *
 * @returns {null|{code,error,conflicts}}
 */
async function roomOccupantConflict(room, targetCheckin, excludeStay) {
  const roomNum = String(room || '').trim();
  if (!roomNum) return null;

  const occupant = await Booking.findOne({ room: roomNum, status: 'checkedin' });
  if (!occupant) return null;
  if (excludeStay && (
    String(occupant.stayId || '') === String(excludeStay.stayId || '') ||
    String(occupant._id) === String(excludeStay._id)
  )) return null;

  const co = toDate(occupant.checkout);
  const ci = toDate(targetCheckin);
  if (co && ci && ci.getTime() >= co.getTime()) return null;

  const who = occupant.guest || 'another guest';
  let error;
  if (!co) {
    error = 'Room ' + roomNum + ' is occupied by ' + who + ' and no checkout date is set — set a checkout date or check that guest out before booking this room.';
  } else if (!ci) {
    error = 'Room ' + roomNum + ' is occupied by ' + who + ' until ' + fmtDate(co) + ' — set a check-in date on or after that date.';
  } else {
    error = 'Room ' + roomNum + ' is occupied by ' + who + ' until ' + fmtDate(co) + '.';
  }

  return {
    code: 'roomOccupied',
    error,
    conflicts: [staySummary(occupant)],
  };
}

/**
 * Rule 2 — the same guest already has another live stay.
 *
 * Matched by phone when the booking has one (that is a real identity
 * link), otherwise by exact name — and a name match only is not enough
 * to be sure it is the same person, so we ask for a phone number.
 *
 * Never blocks: the desk is shown the other rooms and confirms.
 *
 * @returns {null|{code,error,conflicts,needsConfirm,needsPhone}}
 */
async function guestStayNotice({ guest, phone, checkin, checkout, excludeStay, targetRoom, destRoom }) {
  const gname = String(guest || '').trim();
  const variants = phoneVariants(phone);
  const where = destRoom || targetRoom || '';

  const q = { status: { $in: ACTIVE_STATUSES } };
  if (excludeStay && excludeStay._id) q._id = { $ne: excludeStay._id };

  let matchedBy = 'none';
  if (variants.length) {
    q.$or = variants.map((v) => ({ phone: new RegExp(escapeRe(v)) }));
    matchedBy = 'phone';
  } else if (gname) {
    q.guest = new RegExp('^\\s*' + escapeRe(gname) + '\\s*$', 'i');
    matchedBy = 'name';
  } else {
    return null;
  }

  const matches = await Booking.find(q).sort({ updatedAt: -1 }).limit(25);
  const others = matches.filter((m) => !targetRoom || String(m.room) !== String(targetRoom));
  if (!others.length) return null;

  // Only the stays that clash in time matter. A guest holding a room for
  // next month while another room is free today is a normal booking.
  const today = new Date();
  const clashing = others.filter((m) => {
    if (datesOverlap(checkin, checkout, m.checkin, m.checkout)) return true;
    // A guest checked in now plus a stay starting now is two live rooms
    // for one person — worth a confirmation even when dates are absent.
    if (m.status === 'checkedin') {
      const ci = toDate(checkin);
      if (!ci) return true;
      return ci.getTime() <= today.getTime();
    }
    return false;
  });

  if (!clashing.length) return null;

  const rooms = clashing.map((m) => m.room);
  const checkedIn = clashing.filter((m) => m.status === 'checkedin');

  let error;
  const into = where ? ' for Room ' + where : '';
  if (matchedBy === 'name') {
    error = gname + ' already has a live stay in ' + roomList(rooms) +
      ' — no phone on file to confirm it is the same guest.';
  } else if (checkedIn.length) {
    error = gname + ' is already checked in to ' + roomList(checkedIn.map((m) => m.room)) +
      '. Save this booking' + into + ' anyway?';
  } else {
    error = gname + ' already has a live stay in ' + roomList(rooms) +
      '. Save this booking' + into + ' anyway?';
  }

  return {
    code: 'duplicateStay',
    error,
    conflicts: clashing.map(staySummary),
    needsConfirm: true,
    needsPhone: matchedBy === 'name',
  };
}

module.exports = {
  ACTIVE_STATUSES,
  datesOverlap,
  phoneVariants,
  fmtDate,
  roomOccupantConflict,
  guestStayNotice,
};
