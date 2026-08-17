/**
 * services/booking-service.js — Demo Booking API (window.BookingData)
 * ─────────────────────────────────────────────────────────────────
 * DEMO ONLY. UI calls these methods and only renders.
 * Reads/writes a live store (localStorage) seeded once from
 * data/booking-demo-seed.js (window.BookingDemoSeed).
 *
 * When going live: replace this file with a real API client that keeps
 * the SAME function names and return shapes.
 *
 * WHAT'S NEW IN THIS VERSION
 * ─────────────────────────
 * Both a booking's room charge and a guest's outlet charge (restaurant /
 * bar / pool bar) can now be paid off in more than one visit:
 *   - booking.payments[]  — ledger of every payment taken against the stay
 *   - charge.payments[]   — ledger of every payment taken against a folio charge
 * `paid` on either object is always kept as the SUM of that ledger, so
 * any existing UI that only reads `.paid` keeps working unchanged.
 * Every entry in a ledger records `by` = the name of whoever is logged
 * into the demo session at the moment the payment is taken — never a
 * free-typed name — exactly like a hotel PMS audit trail should.
 *
 * FIX: every room already has a placeholder row (even vacant ones), so
 * making a new booking always REPLACES a row in place instead of moving
 * it — the list therefore rendered in static room-number order and a
 * brand-new booking could land anywhere. Bookings are now stamped with
 * `createdAt` / `updatedAt` on every save so the UI can reliably sort by
 * "most recently created/updated" instead of relying on array position.
 *
 * Scripts (order):
 *   services/permissions.js   (optional — if missing, writes are open)
 *   data/booking-demo-seed.js
 *   services/booking-service.js
 */
(function (global) {
  'use strict';

  const KEY_ROOMS    = 'booking-rooms';
  const KEY_BOOKINGS = 'booking-bookings';
  const KEY_GUESTS   = 'booking-guests';
  const KEY_SESSION  = 'booking-session';

  const STATUS_CONFIG = [
  { value: 'checkedin',  label: 'Occupied',   tone: 'completed', color: '#12b76a' },
  { value: 'checkout',   label: 'Check Out',  tone: 'voided',    color: '#f04438' },
  { value: 'cleaning',   label: 'Cleaning',   tone: 'open',      color: '#3b82f6' },
  { value: 'vacant',     label: 'Available',  tone: 'all',       color: '#6b7280' },
  { value: 'reserved',   label: 'Reserved',   tone: 'pending',   color: '#f79009' },
  { value: 'maintenance',label: 'Maintenance', tone: 'open',      color: '#2f6fed' }
];

  const CONFIG = {
    USE_DEMO: true,
    API_BASE: '',
    DEMO_SESSION: {
      name: 'Front Desk Staff',
      initials: 'FD',
      role: 'staff',
      privilege: 'front_desk',
    },
 /*   DEMO_SESSION: {
  name: 'Admin',
  initials: 'AD',
  role: 'admin',
  privilege: null,
}, */
  };

  function lsGet(key) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? null : JSON.parse(v);
    } catch (e) {
      return null;
    }
  }
  function lsSet(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms || 120));
  }
  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }
  function makePaymentId() {
    return 'pmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function ensureSeeded() {
    const seed = global.BookingDemoSeed;
    if (!seed || !seed.DEMO_ROOMS) {
      console.error('[BookingData] Load data/booking-demo-seed.js first');
      return;
    }
    if (!lsGet(KEY_ROOMS) || !Array.isArray(lsGet(KEY_ROOMS)) || !lsGet(KEY_ROOMS).length) {
      lsSet(KEY_ROOMS, seed.DEMO_ROOMS);
    }
    if (!lsGet(KEY_BOOKINGS) || !Array.isArray(lsGet(KEY_BOOKINGS)) || !lsGet(KEY_BOOKINGS).length) {
      lsSet(KEY_BOOKINGS, seed.DEMO_BOOKINGS);
    }
    if (!lsGet(KEY_GUESTS) || !Array.isArray(lsGet(KEY_GUESTS)) || !lsGet(KEY_GUESTS).length) {
      lsSet(KEY_GUESTS, seed.DEMO_GUESTS);
    }
    if (!lsGet(KEY_SESSION)) {
      lsSet(KEY_SESSION, CONFIG.DEMO_SESSION);
    }
  }

  function getRooms()    { ensureSeeded(); return lsGet(KEY_ROOMS)    || []; }
  function getBookings() { ensureSeeded(); return lsGet(KEY_BOOKINGS) || []; }
  function getGuests()   { ensureSeeded(); return lsGet(KEY_GUESTS)   || []; }
  function getSession()  { ensureSeeded(); return lsGet(KEY_SESSION)  || CONFIG.DEMO_SESSION; }

  function setRooms(v)    { lsSet(KEY_ROOMS, v); }
  function setBookings(v) { lsSet(KEY_BOOKINGS, v); }
  function setGuests(v)   { lsSet(KEY_GUESTS, v); }

  function perm() {
    return global.Permissions || null;
  }
  function requirePerm(session, action, module, entity) {
    const P = perm();
    if (!P) return true;
    if (action === 'canEdit')   return P.canEdit(session, module, entity);
    if (action === 'canDelete') return P.canDelete(session, module, entity);
    if (action === 'canGiveDiscount') return P.canGiveDiscount(session, module);
    return P.hasPermission(session, action, module);
  }
  function deny(msg) {
    const err = new Error(msg || 'Permission denied');
    err.code = 'PERMISSION_DENIED';
    throw err;
  }

  function nights(ci, co) {
    if (!ci || !co) return 0;
    const n = (new Date(co) - new Date(ci)) / 86400000;
    return n > 0 ? n : 0;
  }
  function calcTotal(b) {
    const n = nights(b.checkin, b.checkout) || 1;
    return (b.rate || 0) * n * (1 - (b.discount || 0) / 100);
  }
  // Sum of the payment ledger. Falls back to the legacy `.paid` number for
  // any row that predates the ledger (keeps old demo data readable).
  function calcPaid(b) {
    if (Array.isArray(b.payments) && b.payments.length) {
      return b.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    }
    return Number(b.paid) || 0;
  }
  function calcBal(b) {
    return Math.max(0, calcTotal(b) - calcPaid(b));
  }
  function derivePayStatus(paid, total) {
    if (paid <= 0) return 'Pending';
    if (paid >= total) return 'Fully Paid';
    return 'Deposit Paid';
  }
  function deriveChargeStatus(paid, amount) {
    if (paid <= 0) return 'Pending';
    if (paid >= amount) return 'Settled';
    return 'Partially Settled';
  }
  function vacantRow(room) {
    return {
      room: room.num,
      type: room.type,
      guest: '', phone: '', email: '', address: '',
      idType: 'NIN', idNum: '',
      checkin: '', checkout: '',
      rate: room.rate, discount: 0,
      payments: [], paid: 0,
      payMethod: 'Cash', payStatus: 'Pending', recordedBy: '',
      adults: 1, children: 0, status: 'vacant', notes: room.notes || '',
      createdAt: 0, updatedAt: 0,
    };
  }

  async function getBookingData() {
    await delay(80);
    ensureSeeded();
    return {
      rooms:    clone(getRooms()),
      bookings: clone(getBookings()),
      guests:   clone(getGuests()),
      session:  clone(getSession()),
    };
  }

  // Fetch a single booking (by room number) for a View modal, a refresh
  // after adding a payment, etc. — avoids shipping the whole dataset back.
  async function getBooking(roomNum) {
    await delay(60);
    const b = getBookings().find((x) => x.room === roomNum);
    return b ? clone(b) : null;
  }

  async function saveBookingData(rooms, bookings, guests) {
    await delay(100);
    const session = getSession();
    if (!requirePerm(session, 'canEdit', 'booking')) {
      deny("You don't have permission to save booking data.");
    }
    if (Array.isArray(rooms))    setRooms(rooms);
    if (Array.isArray(bookings)) setBookings(bookings);
    if (Array.isArray(guests))   setGuests(guests);
    return getBookingData();
  }

  async function saveBooking(entry) {
    await delay(150);
    const session = getSession();
    const bookings = getBookings();
    const idx = bookings.findIndex((b) => b.room === entry.room);
    const existing = idx >= 0 ? bookings[idx] : null;

    // A row is only a "real" existing booking if it actually has a guest on
    // it. Every room starts with a vacant placeholder row, so `existing`
    // being found in the array does NOT mean this is an edit of a real stay.
    const isNewStay = !existing || !existing.guest;

    if (!isNewStay) {
      if (!requirePerm(session, 'canEdit', 'booking', existing)) {
        deny("You don't have permission to edit this booking.");
      }
    } else {
      if (!requirePerm(session, 'canCreate', 'booking')) {
        deny("You don't have permission to create bookings.");
      }
    }

    if ((entry.discount || 0) > 0 && !requirePerm(session, 'canGiveDiscount', 'booking')) {
      deny('Only admin can apply discounts.');
    }

    // Payments are never edited through the general save — they're only ever
    // appended via addBookingPayment() so the ledger stays a true audit trail.
    // Carry the existing ledger over untouched.
    const existingPayments = existing && Array.isArray(existing.payments) ? existing.payments : [];
    const paid = calcPaid({ payments: existingPayments, paid: existing ? existing.paid : 0 });
    const total = calcTotal({ rate: Number(entry.rate) || 0, discount: Number(entry.discount) || 0, checkin: entry.checkin, checkout: entry.checkout });

    const now = Date.now();

    const row = {
      room: entry.room,
      type: entry.type || '',
      guest: entry.guest || '',
      phone: entry.phone || '',
      email: entry.email || '',
      address: entry.address || '',
      idType: entry.idType || 'NIN',
      idNum: entry.idNum || '',
      checkin: entry.checkin || '',
      checkout: entry.checkout || '',
      rate: Number(entry.rate) || 0,
      discount: Number(entry.discount) || 0,
      payments: existingPayments,
      paid: paid,
      payMethod: existing ? existing.payMethod : (entry.payMethod || 'Cash'),
      payStatus: derivePayStatus(paid, total),
      recordedBy: entry.recordedBy || (existing && existing.recordedBy) || session.name || '',
      adults: Number(entry.adults) || 1,
      children: Number(entry.children) || 0,
      status: entry.status || (existing && existing.status) || 'reserved',
      notes: entry.notes || '',
      // Stamp so the UI can always tell which booking is newest, regardless
      // of where its row happens to sit in the array (fixes "new booking
      // doesn't show up first").
      createdAt: isNewStay ? now : (existing && existing.createdAt) || now,
      updatedAt: now,
    };

    if (idx >= 0) bookings[idx] = row;
    else bookings.push(row);
    setBookings(bookings);

    if (row.guest) upsertGuestFromBooking(row);

    return clone(row);
  }

  // Append a payment to a booking's ledger — the ONLY way `paid` changes.
  // `by` always comes from the current session, never from a form field,
  // so "who settled this" is trustworthy.
  async function addBookingPayment(roomNum, payment) {
    await delay(120);
    const session = getSession();
    const bookings = getBookings();
    const idx = bookings.findIndex((b) => b.room === roomNum);
    if (idx < 0) throw new Error('Booking not found');
    const row = bookings[idx];

    if (!requirePerm(session, 'canEdit', 'booking', row)) {
      deny("You don't have permission to record a payment on this booking.");
    }
    const amount = Number(payment && payment.amount) || 0;
    if (amount <= 0) throw new Error('Enter a payment amount greater than zero.');

    const total = calcTotal(row);
    const currentPaid = calcPaid(row);
    const remaining = Math.max(0, total - currentPaid);
    if (remaining <= 0) throw new Error('This booking is already fully paid.');
    if (amount > remaining + 0.01) {
      throw new Error('Amount exceeds the outstanding balance of ' + remaining.toLocaleString('en-NG') + '.');
    }

    const entryPmt = {
      id: makePaymentId(),
      amount: amount,
      mode: (payment && payment.mode) || 'Cash',
      date: (payment && payment.date) || todayStr(),
      by: session.name || 'Front Desk',
      ts: Date.now(),
    };

    row.payments = Array.isArray(row.payments) ? row.payments : [];
    row.payments.push(entryPmt);
    row.paid = calcPaid(row);
    row.payMethod = entryPmt.mode;
    row.payStatus = derivePayStatus(row.paid, total);
    row.updatedAt = Date.now();

    bookings[idx] = row;
    setBookings(bookings);

    // keep the guest's stay record (used on the Guests page) in sync too
    const guests = getGuests();
    const g = guests.find((x) => x.name === row.guest || (row.phone && x.phone === row.phone));
    if (g && Array.isArray(g.stays)) {
      const si = g.stays.findIndex((s) => s.room === row.room && s.checkin === row.checkin);
      if (si >= 0) g.stays[si].paid = row.paid;
      setGuests(guests);
    }

    return clone(row);
  }

  async function deleteBooking(roomNum) {
    await delay(120);
    const session = getSession();
    const bookings = getBookings();
    const idx = bookings.findIndex((b) => b.room === roomNum);
    if (idx < 0) throw new Error('Booking not found');
    if (!requirePerm(session, 'canDelete', 'booking', bookings[idx])) {
      deny("You don't have permission to delete this booking.");
    }
    const rooms = getRooms();
    const room = rooms.find((r) => r.num === roomNum) || {
      num: roomNum, type: bookings[idx].type, rate: bookings[idx].rate, notes: '',
    };
    bookings[idx] = vacantRow(room);
    setBookings(bookings);
    return clone(bookings[idx]);
  }

  async function setRoomStatus(roomNum, status, patch) {
    await delay(100);
    const session = getSession();
    if (!requirePerm(session, 'canEdit', 'booking')) {
      deny("You don't have permission to change room status.");
    }
    const bookings = getBookings();
    const idx = bookings.findIndex((b) => b.room === roomNum);
    if (idx < 0) throw new Error('Room not found in bookings');
    const row = Object.assign({}, bookings[idx], patch || {}, { status });
    if (status === 'vacant' || status === 'maintenance') {
      row.guest = ''; row.phone = ''; row.email = ''; row.address = '';
      row.checkin = ''; row.checkout = ''; row.payments = []; row.paid = 0;
      row.discount = 0; row.payStatus = 'Pending'; row.recordedBy = '';
      row.notes = (patch && patch.notes != null) ? patch.notes : row.notes;
      row.createdAt = 0; row.updatedAt = 0;
    } else {
      row.updatedAt = Date.now();
    }
    bookings[idx] = row;
    setBookings(bookings);
    return clone(row);
  }

  async function saveRoom(room) {
    await delay(100);
    const session = getSession();
    if (!requirePerm(session, 'canEdit', 'booking')) {
      deny("You don't have permission to manage rooms.");
    }
    const rooms = getRooms();
    const idx = rooms.findIndex((r) => r.num === room.num);
    const row = {
      num: String(room.num),
      type: room.type || 'Standard',
      rate: Number(room.rate) || 0,
      notes: room.notes || '',
    };
    if (idx >= 0) rooms[idx] = row;
    else {
      rooms.push(row);
      const bookings = getBookings();
      if (!bookings.find((b) => b.room === row.num)) {
        bookings.push(vacantRow(row));
        setBookings(bookings);
      }
    }
    setRooms(rooms);
    return clone(row);
  }

  function upsertGuestFromBooking(b) {
    const guests = getGuests();
    let g = guests.find((x) => x.name === b.guest || (b.phone && x.phone === b.phone));
    if (!g) {
      g = {
        id: 'g_' + Date.now(),
        name: b.guest,
        phone: b.phone || '',
        email: b.email || '',
        address: b.address || '',
        idType: b.idType || 'NIN',
        idNum: b.idNum || '',
        vip: false,
        notes: '',
        stays: [],
        charges: [],
      };
      guests.push(g);
    } else {
      g.phone = b.phone || g.phone;
      g.email = b.email || g.email;
      g.address = b.address || g.address;
      g.idType = b.idType || g.idType;
      g.idNum = b.idNum || g.idNum;
    }
    if (b.checkin) {
      const stay = {
        room: b.room, type: b.type,
        checkin: b.checkin, checkout: b.checkout,
        total: calcTotal(b), paid: calcPaid(b), status: b.status,
      };
      const si = g.stays.findIndex((s) => s.room === b.room && s.checkin === b.checkin);
      if (si >= 0) g.stays[si] = stay;
      else g.stays.unshift(stay);
    }
    setGuests(guests);
    return g;
  }

  async function getGuest(idOrName) {
    await delay(60);
    const guests = getGuests();
    return clone(
      guests.find((g) => g.id === idOrName || g.name === idOrName) || null
    );
  }

  async function saveGuest(patch) {
    await delay(100);
    const session = getSession();
    if (!requirePerm(session, 'canEdit', 'booking')) {
      deny("You don't have permission to edit guests.");
    }
    const guests = getGuests();
    const idx = guests.findIndex((g) => g.id === patch.id || g.name === patch.name);
    if (idx < 0) throw new Error('Guest not found');
    ['name', 'phone', 'email', 'address', 'idType', 'idNum', 'vip', 'notes'].forEach((k) => {
      if (patch[k] !== undefined) guests[idx][k] = patch[k];
    });
    setGuests(guests);
    return clone(guests[idx]);
  }

  async function addRoomCharge(guestId, charge) {
    await delay(100);
    const session = getSession();
    if (!requirePerm(session, 'canCreate', 'booking')) {
      deny("You don't have permission to add room charges.");
    }
    const guests = getGuests();
    const g = guests.find((x) => x.id === guestId || x.name === guestId);
    if (!g) throw new Error('Guest not found');
    const row = {
      date: charge.date || todayStr(),
      source: charge.source || 'Other',
      desc: charge.desc || '',
      room: charge.room || '',
      amount: Number(charge.amount) || 0,
      paid: 0,
      by: charge.by || session.name || 'Front Desk',
      status: 'Pending',
      payments: [],
    };
    if (!row.desc || !row.amount) throw new Error('Description and amount are required');
    g.charges = g.charges || [];
    g.charges.unshift(row);
    setGuests(guests);
    return clone(row);
  }

  // Record a (possibly partial) payment against a single folio charge.
  // Same audit-trail principle as addBookingPayment: `by` = current session.
  async function addChargePayment(guestId, chargeIndex, payment) {
    await delay(100);
    const session = getSession();
    if (!requirePerm(session, 'canEdit', 'booking')) {
      deny("You don't have permission to settle charges.");
    }
    const guests = getGuests();
    const g = guests.find((x) => x.id === guestId || x.name === guestId);
    if (!g || !g.charges || !g.charges[chargeIndex]) throw new Error('Charge not found');
    const c = g.charges[chargeIndex];

    const amount = Number(payment && payment.amount) || 0;
    if (amount <= 0) throw new Error('Enter an amount greater than zero.');

    c.payments = Array.isArray(c.payments) ? c.payments : [];
    const currentPaid = c.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) || Number(c.paid) || 0;
    const remaining = Math.max(0, (Number(c.amount) || 0) - currentPaid);
    if (remaining <= 0) throw new Error('This charge is already fully settled.');
    if (amount > remaining + 0.01) {
      throw new Error('Amount exceeds the outstanding balance of ' + remaining.toLocaleString('en-NG') + '.');
    }

    c.payments.push({
      id: makePaymentId(),
      amount: amount,
      mode: (payment && payment.mode) || 'Cash',
      date: (payment && payment.date) || todayStr(),
      by: session.name || 'Front Desk',
      ts: Date.now(),
    });
    c.paid = c.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    c.status = deriveChargeStatus(c.paid, c.amount);

    setGuests(guests);
    return clone(c);
  }

  // Legacy helpers kept for back-compat: mark a charge fully settled in
  // one shot (internally just records a payment for the full remaining balance).
  async function settleCharge(guestId, chargeIndex) {
    const guests = getGuests();
    const g = guests.find((x) => x.id === guestId || x.name === guestId);
    if (!g || !g.charges[chargeIndex]) throw new Error('Charge not found');
    const c = g.charges[chargeIndex];
    const currentPaid = (c.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0) || Number(c.paid) || 0;
    const remaining = Math.max(0, (Number(c.amount) || 0) - currentPaid);
    if (remaining <= 0) return clone(c);
    return addChargePayment(guestId, chargeIndex, { amount: remaining, mode: 'Cash' });
  }

  async function settleAllCharges(guestId) {
    await delay(100);
    const session = getSession();
    if (!requirePerm(session, 'canEdit', 'booking')) {
      deny("You don't have permission to settle charges.");
    }
    const guests = getGuests();
    const g = guests.find((x) => x.id === guestId || x.name === guestId);
    if (!g) throw new Error('Guest not found');
    for (let i = 0; i < (g.charges || []).length; i++) {
      const c = g.charges[i];
      const currentPaid = (c.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0) || Number(c.paid) || 0;
      const remaining = Math.max(0, (Number(c.amount) || 0) - currentPaid);
      if (remaining > 0) {
        c.payments = Array.isArray(c.payments) ? c.payments : [];
        c.payments.push({
          id: makePaymentId(), amount: remaining, mode: 'Cash',
          date: todayStr(), by: session.name || 'Front Desk', ts: Date.now(),
        });
        c.paid = c.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        c.status = deriveChargeStatus(c.paid, c.amount);
      }
    }
    setGuests(guests);
    return clone(g);
  }

  async function resetDemo() {
    await delay(50);
    localStorage.removeItem(KEY_ROOMS);
    localStorage.removeItem(KEY_BOOKINGS);
    localStorage.removeItem(KEY_GUESTS);
    ensureSeeded();
    return getBookingData();
  }

  global.BookingData = {
    CONFIG,
    getBookingData,
    getBooking,
    saveBookingData,
    saveBooking,
    addBookingPayment,
    deleteBooking,
    setRoomStatus,
    saveRoom,
    getGuest,
    saveGuest,
    addRoomCharge,
    addChargePayment,
    settleCharge,
    settleAllCharges,
    resetDemo,
    nights,
    calcTotal,
    calcPaid,
    calcBal,
      getStatusConfig: () => JSON.parse(JSON.stringify(STATUS_CONFIG)),
  };
})(window);