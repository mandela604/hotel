// These mirror the client-side math in the booking-*.html files exactly,
// so totals/balances computed here always agree with what the UI shows.

function nights(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const n = (new Date(checkout) - new Date(checkin)) / 86400000;
  return n > 0 ? n : 0;
}

function total(booking) {
  const n = nights(booking.checkin, booking.checkout) || 1;
  return booking.rate * n * (1 - (booking.discount || 0) / 100);
}

function balance(booking) {
  return Math.max(0, total(booking) - (booking.paid || 0));
}

// Serializes a Booking document into the exact flat shape the frontend
// booking-*.html pages already expect (one record, keyed by `room`).
function toFrontendBooking(bookingDoc) {
  if (!bookingDoc) return null;
  const b = typeof bookingDoc.toObject === 'function' ? bookingDoc.toObject() : bookingDoc;
  return {
    _id: String(b._id || b.id || ''),
    room: b.room,
    type: b.roomType,
    guest: b.guest || '',
    phone: b.phone || '',
    email: b.email || '',
    idType: b.idType || 'NIN',
    idNum: b.idNum || '',
    checkin: b.checkin ? new Date(b.checkin).toISOString().split('T')[0] : '',
    checkout: b.checkout ? new Date(b.checkout).toISOString().split('T')[0] : '',
    rate: b.rate || 0,
    discount: b.discount || 0,
    paid: b.paid || 0,
    payMethod: b.payMethod || 'Cash',
    payStatus: b.payStatus || 'Pending',
    recordedBy: b.recordedBy || '',
    adults: b.adults || 1,
    children: b.children || 0,
    notes: b.notes || '',
    status: b.status === 'checkout' ? 'checkout' : b.status, // 'reserved'|'checkedin'|'checkout'
  };
}

// The "vacant" placeholder shape used by the frontend for rooms with no
// active booking — same field set, all blank.
function vacantRecord(room) {
  return {
    _id: null,
    room: room.num,
    type: room.type,
    guest: '',
    phone: '',
    email: '',
    idType: 'NIN',
    idNum: '',
    checkin: '',
    checkout: '',
    rate: room.rate,
    discount: 0,
    paid: 0,
    payMethod: 'Cash',
    payStatus: 'Pending',
    recordedBy: '',
    adults: 1,
    children: 0,
    notes: room.status === 'maintenance' ? room.notes || '' : '',
    status: room.status === 'maintenance' ? 'maintenance' : 'vacant',
  };
}

module.exports = { nights, total, balance, toFrontendBooking, vacantRecord };
