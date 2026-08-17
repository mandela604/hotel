/**
 * data/booking-demo-seed.js — Booking module demo seed only
 * DEMO_ROOMS | DEMO_BOOKINGS (one per room) | DEMO_GUESTS (stays + charges)
 *
 * CHANGE FROM PREVIOUS VERSION:
 * - Each booking now carries a `payments` array (payment history / ledger)
 *   instead of a single opaque `paid` number. `paid` is still present on
 *   each row for quick reads, but it is always the SUM of `payments` and
 *   is kept in sync by services/booking-service.js. This is what lets a
 *   booking be paid off across multiple visits ("partial, come back later").
 * - Each guest charge now carries the same kind of `payments` array so a
 *   room charge (restaurant/bar/pool bar) can also be settled partially.
 *
 * Payment entry shape: { id, amount, mode, date, by, ts }
 *   by = the staff member who actually took/recorded the payment
 *        (comes from the logged-in demo session, never typed free-hand)
 */
(function (global) {
  'use strict';

  const TODAY = new Date().toISOString().split('T')[0];
  const d = (n) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

  const yesterday = d(-1);
  const twoDaysAgo = d(-2);
  const weekAgo = d(-7);
  const tomorrow = d(1);
  const dayAfter = d(2);
  const threeDays = d(3);
  const fourDays = d(4);
  const fiveDays = d(5);
  const sixDays = d(6);

  let _pid = 1;
  function pay(amount, mode, date, by, tsOffsetMin) {
    return {
      id: 'pmt' + (_pid++),
      amount: amount,
      mode: mode,
      date: date,
      by: by,
      ts: Date.now() - (tsOffsetMin || 0) * 60000,
    };
  }

  const DEMO_ROOMS = [
    { num: '101', type: 'Standard', rate: 35000, notes: 'Garden view' },
    { num: '102', type: 'Standard', rate: 35000, notes: 'Pool view' },
    { num: '103', type: 'Standard', rate: 35000, notes: 'Recently renovated' },
    { num: '104', type: 'Standard', rate: 35000, notes: '' },
    { num: '105', type: 'Standard', rate: 35000, notes: 'Plumbing repair' },
    { num: '106', type: 'Standard', rate: 35000, notes: 'New AC installed' },
    { num: '201', type: 'Deluxe', rate: 60000, notes: 'King bed, city view' },
    { num: '202', type: 'Deluxe', rate: 60000, notes: 'Honeymoon preferred' },
    { num: '203', type: 'Deluxe', rate: 60000, notes: 'Twin beds available' },
    { num: '204', type: 'Deluxe', rate: 60000, notes: 'Corner room, quiet' },
    { num: '301', type: 'Suite', rate: 120000, notes: 'Presidential suite' },
    { num: '302', type: 'Suite', rate: 120000, notes: 'Sea view' },
    { num: '303', type: 'Suite', rate: 120000, notes: 'AC repair in progress' },
    { num: '401', type: 'Conference', rate: 200000, notes: 'Projector & PA system' },
    { num: '402', type: 'Conference', rate: 200000, notes: 'Boardroom setup' },
  ];

  // One row per room — current front-desk state
  // status: checkedin | reserved | checkout | vacant | maintenance
  const DEMO_BOOKINGS = [
    {
      room: '101', type: 'Standard',
      guest: 'Mr. Adeyemi, Tunde', phone: '+234 803 111 2233', email: 'adeyemi.t@gmail.com',
      address: '14 Allen Avenue, Ikeja, Lagos',
      idType: 'NIN', idNum: '12345678901',
      checkin: TODAY, checkout: fourDays,
      rate: 35000, discount: 0,
      payments: [ pay(140000, 'Transfer', TODAY, 'Emeka S.', 600) ],
      paid: 140000,
      payMethod: 'Transfer', payStatus: 'Fully Paid', recordedBy: 'Emeka S.',
      adults: 1, children: 0, status: 'checkedin', notes: '',
    },
    {
      room: '102', type: 'Standard',
      guest: 'Mrs. Okafor, Ngozi', phone: '+234 806 222 4455', email: 'ngozi.o@yahoo.com',
      address: '7 Aba Road, Port Harcourt',
      idType: 'Passport', idNum: 'A12345678',
      checkin: yesterday, checkout: TODAY,
      rate: 35000, discount: 0,
      payments: [ pay(35000, 'Cash', yesterday, 'Amaka O.', 1500) ],
      paid: 35000,
      payMethod: 'Cash', payStatus: 'Fully Paid', recordedBy: 'Amaka O.',
      adults: 2, children: 0, status: 'checkout', notes: '',
    },
    {
      room: '103', type: 'Standard',
      guest: 'Mr. Bello, Ibrahim', phone: '+234 701 333 6677', email: '',
      address: '22 Wuse Zone 2, Abuja',
      idType: 'NIN', idNum: '98765432109',
      checkin: tomorrow, checkout: threeDays,
      rate: 35000, discount: 10,
      payments: [ pay(50000, 'POS', TODAY, 'Emeka S.', 300) ],
      paid: 50000,
      payMethod: 'POS', payStatus: 'Deposit Paid', recordedBy: 'Emeka S.',
      adults: 1, children: 1, status: 'reserved', notes: 'Extra pillow',
    },
    {
      room: '104', type: 'Standard',
      guest: '', phone: '', email: '', address: '',
      idType: 'NIN', idNum: '',
      checkin: '', checkout: '',
      rate: 35000, discount: 0, payments: [], paid: 0,
      payMethod: 'Cash', payStatus: 'Pending', recordedBy: '',
      adults: 1, children: 0, status: 'vacant', notes: '',
    },
    {
      room: '105', type: 'Standard',
      guest: '', phone: '', email: '', address: '',
      idType: 'NIN', idNum: '',
      checkin: '', checkout: '',
      rate: 35000, discount: 0, payments: [], paid: 0,
      payMethod: 'Cash', payStatus: 'Pending', recordedBy: '',
      adults: 1, children: 0, status: 'maintenance', notes: 'Plumbing repair',
    },
    {
      room: '106', type: 'Standard',
      guest: '', phone: '', email: '', address: '',
      idType: 'NIN', idNum: '',
      checkin: '', checkout: '',
      rate: 35000, discount: 0, payments: [], paid: 0,
      payMethod: 'Cash', payStatus: 'Pending', recordedBy: '',
      adults: 1, children: 0, status: 'vacant', notes: '',
    },
    {
      room: '201', type: 'Deluxe',
      guest: 'Dr. Eze, Chukwuemeka', phone: '+234 802 444 8899', email: 'ceze@hospital.ng',
      address: '3 Hospital Road, Enugu',
      idType: 'Passport', idNum: 'B87654321',
      checkin: TODAY, checkout: fourDays,
      rate: 60000, discount: 0,
      payments: [ pay(240000, 'Transfer', TODAY, 'Amaka O.', 500) ],
      paid: 240000,
      payMethod: 'Transfer', payStatus: 'Fully Paid', recordedBy: 'Amaka O.',
      adults: 2, children: 0, status: 'checkedin', notes: '',
    },
    {
      room: '202', type: 'Deluxe',
      guest: 'Ms. Abubakar, Fatima', phone: '+234 805 555 0011', email: 'fatima.a@gmail.com',
      address: '18 Garki Area 11, Abuja',
      idType: "Driver's Licence", idNum: 'ABJ001234',
      checkin: tomorrow, checkout: fiveDays,
      rate: 60000, discount: 5,
      payments: [
        pay(60000, 'Cash', TODAY, 'Emeka S.', 400),
        pay(40000, 'Transfer', TODAY, 'Emeka S.', 200),
      ],
      paid: 100000,
      payMethod: 'Split – Cash + Transfer', payStatus: 'Deposit Paid', recordedBy: 'Emeka S.',
      adults: 1, children: 0, status: 'reserved', notes: 'Honeymoon setup',
    },
    {
      room: '203', type: 'Deluxe',
      guest: 'Mr. Johnson, Segun', phone: '+234 708 666 2233', email: '',
      address: '9 Ring Road, Ibadan',
      idType: 'NIN', idNum: '55566677788',
      checkin: twoDaysAgo, checkout: yesterday,
      rate: 60000, discount: 0,
      payments: [ pay(240000, 'POS', twoDaysAgo, 'Amaka O.', 2800) ],
      paid: 240000,
      payMethod: 'POS', payStatus: 'Fully Paid', recordedBy: 'Amaka O.',
      adults: 2, children: 2, status: 'checkout', notes: '',
    },
    {
      room: '204', type: 'Deluxe',
      guest: 'Prof. Williams, Ada', phone: '+234 803 777 4455', email: 'ada.williams@uni.edu.ng',
      address: '5 University Crescent, Nsukka',
      idType: 'NIN', idNum: '11122233344',
      checkin: TODAY, checkout: sixDays,
      rate: 60000, discount: 15,
      payments: [ pay(200000, 'Transfer', TODAY, 'Emeka S.', 240) ],
      paid: 200000,
      payMethod: 'Transfer', payStatus: 'Deposit Paid', recordedBy: 'Emeka S.',
      adults: 1, children: 0, status: 'checkedin', notes: 'Vegetarian meals',
    },
    {
      room: '301', type: 'Suite',
      guest: 'Chief Dangote, Emeka', phone: '+234 801 888 6677', email: 'emeka.d@corp.ng',
      address: '1 Banana Island, Ikoyi, Lagos',
      idType: 'Passport', idNum: 'C11223344',
      checkin: TODAY, checkout: fiveDays,
      rate: 120000, discount: 0,
      payments: [ pay(600000, 'Transfer', TODAY, 'Amaka O.', 700) ],
      paid: 600000,
      payMethod: 'Transfer', payStatus: 'Fully Paid', recordedBy: 'Amaka O.',
      adults: 2, children: 0, status: 'checkedin', notes: '',
    },
    {
      room: '302', type: 'Suite',
      guest: 'Ms. Okonkwo, Ifeoma', phone: '+234 809 888 3344', email: 'ifeoma.o@gmail.com',
      address: '12 New Haven, Enugu',
      idType: 'NIN', idNum: '99887766554',
      checkin: threeDays, checkout: fiveDays,
      rate: 120000, discount: 0, payments: [], paid: 0,
      payMethod: 'Cash', payStatus: 'Pending', recordedBy: 'Front Desk',
      adults: 1, children: 0, status: 'reserved', notes: '',
    },
    {
      room: '303', type: 'Suite',
      guest: '', phone: '', email: '', address: '',
      idType: 'NIN', idNum: '',
      checkin: '', checkout: '',
      rate: 120000, discount: 0, payments: [], paid: 0,
      payMethod: 'Cash', payStatus: 'Pending', recordedBy: '',
      adults: 1, children: 0, status: 'maintenance', notes: 'AC repair in progress',
    },
    {
      room: '401', type: 'Conference',
      guest: 'Zenith Bank Ltd.', phone: '+234 700 999 8877', email: 'events@zenithbank.com',
      address: 'Plot 84 Ajose Adeogun, Victoria Island, Lagos',
      idType: "Voter's Card", idNum: 'ZB00001',
      checkin: TODAY, checkout: TODAY,
      rate: 200000, discount: 0,
      payments: [ pay(200000, 'Transfer', TODAY, 'Emeka S.', 900) ],
      paid: 200000,
      payMethod: 'Transfer', payStatus: 'Fully Paid', recordedBy: 'Emeka S.',
      adults: 40, children: 0, status: 'checkedin', notes: 'Projector & PA system',
    },
    {
      room: '402', type: 'Conference',
      guest: '', phone: '', email: '', address: '',
      idType: 'NIN', idNum: '',
      checkin: '', checkout: '',
      rate: 200000, discount: 0, payments: [], paid: 0,
      payMethod: 'Cash', payStatus: 'Pending', recordedBy: '',
      adults: 1, children: 0, status: 'vacant', notes: '',
    },
  ];

  // Guests: profile + stay history + room folio (charges from Restaurant / Bar / Pool Bar / etc.)
  // charge.status: Pending | Partially Settled | Settled
  const DEMO_GUESTS = [
    {
      id: 'g001', name: 'Mr. Adeyemi, Tunde',
      phone: '+234 803 111 2233', email: 'adeyemi.t@gmail.com',
      address: '14 Allen Avenue, Ikeja, Lagos',
      idType: 'NIN', idNum: '12345678901', vip: false,
      notes: 'Prefers top floor',
      stays: [
        { room: '101', type: 'Standard', checkin: TODAY, checkout: fourDays, total: 140000, paid: 140000, status: 'checkedin' },
        { room: '105', type: 'Standard', checkin: weekAgo, checkout: twoDaysAgo, total: 105000, paid: 105000, status: 'checkout' },
      ],
      charges: [
        { date: TODAY, source: 'Restaurant', desc: '2x Jollof Rice & Chicken', room: '101', amount: 14725, paid: 0, by: 'Amaka O.', status: 'Pending', payments: [] },
        { date: TODAY, source: 'Pool Bar', desc: '4x Bottled Water', room: '101', amount: 4000, paid: 0, by: 'Emeka S.', status: 'Pending', payments: [] },
      ],
    },
    {
      id: 'g002', name: 'Mrs. Okafor, Ngozi',
      phone: '+234 806 222 4455', email: 'ngozi.o@yahoo.com',
      address: '7 Aba Road, Port Harcourt',
      idType: 'Passport', idNum: 'A12345678', vip: false,
      notes: 'Allergic to shellfish',
      stays: [
        { room: '102', type: 'Standard', checkin: yesterday, checkout: TODAY, total: 35000, paid: 35000, status: 'checkout' },
      ],
      charges: [],
    },
    {
      id: 'g003', name: 'Mr. Bello, Ibrahim',
      phone: '+234 701 333 6677', email: '',
      address: '22 Wuse Zone 2, Abuja',
      idType: 'NIN', idNum: '98765432109', vip: false,
      notes: 'Extra pillow requested',
      stays: [
        { room: '103', type: 'Standard', checkin: tomorrow, checkout: threeDays, total: 94500, paid: 50000, status: 'reserved' },
      ],
      charges: [],
    },
    {
      id: 'g004', name: 'Dr. Eze, Chukwuemeka',
      phone: '+234 802 444 8899', email: 'ceze@hospital.ng',
      address: '3 Hospital Road, Enugu',
      idType: 'Passport', idNum: 'B87654321', vip: false,
      notes: 'Vegetarian meals',
      stays: [
        { room: '201', type: 'Deluxe', checkin: TODAY, checkout: fourDays, total: 240000, paid: 240000, status: 'checkedin' },
        { room: '203', type: 'Deluxe', checkin: weekAgo, checkout: twoDaysAgo, total: 180000, paid: 180000, status: 'checkout' },
      ],
      charges: [
        { date: TODAY, source: 'Restaurant', desc: '1x Vegetable Stir Fry, 1x Spring Rolls', room: '201', amount: 8500, paid: 0, by: 'Tunde A.', status: 'Pending', payments: [] },
        { date: TODAY, source: 'Pool Bar', desc: '2x Fresh Juice, 2x Smoothies', room: '201', amount: 6000, paid: 3000, by: 'Amaka O.', status: 'Partially Settled',
          payments: [ pay(3000, 'Cash', TODAY, 'Amaka O.', 90) ] },
      ],
    },
    {
      id: 'g005', name: 'Ms. Abubakar, Fatima',
      phone: '+234 805 555 0011', email: 'fatima.a@gmail.com',
      address: '18 Garki Area 11, Abuja',
      idType: "Driver's Licence", idNum: 'ABJ001234', vip: false,
      notes: 'Honeymoon setup',
      stays: [
        { room: '202', type: 'Deluxe', checkin: tomorrow, checkout: fiveDays, total: 228000, paid: 100000, status: 'reserved' },
      ],
      charges: [
        { date: tomorrow, source: 'Pool Bar', desc: '2x Passion Fruit Daiquiri', room: '202', amount: 12000, paid: 0, by: 'Emeka S.', status: 'Pending', payments: [] },
      ],
    },
    {
      id: 'g006', name: 'Mr. Johnson, Segun',
      phone: '+234 708 666 2233', email: '',
      address: '9 Ring Road, Ibadan',
      idType: 'NIN', idNum: '55566677788', vip: false,
      notes: 'Late checkout requested',
      stays: [
        { room: '203', type: 'Deluxe', checkin: twoDaysAgo, checkout: yesterday, total: 240000, paid: 240000, status: 'checkout' },
      ],
      charges: [
        { date: twoDaysAgo, source: 'Bar', desc: '3x Heineken, 1x Jameson', room: '203', amount: 12000, paid: 12000, by: 'Emeka S.', status: 'Settled',
          payments: [ pay(12000, 'Cash', twoDaysAgo, 'Emeka S.', 2600) ] },
      ],
    },
    {
      id: 'g007', name: 'Prof. Williams, Ada',
      phone: '+234 803 777 4455', email: 'ada.williams@uni.edu.ng',
      address: '5 University Crescent, Nsukka',
      idType: 'NIN', idNum: '11122233344', vip: true,
      notes: 'Vegetarian meals only. Prefers quiet rooms away from lift.',
      stays: [
        { room: '204', type: 'Deluxe', checkin: TODAY, checkout: sixDays, total: 306000, paid: 200000, status: 'checkedin' },
        { room: '106', type: 'Standard', checkin: weekAgo, checkout: twoDaysAgo, total: 105000, paid: 105000, status: 'checkout' },
      ],
      charges: [
        { date: TODAY, source: 'Restaurant', desc: '2x Jollof Rice & Chicken, 1x Chocolate Fondant', room: '204', amount: 14725, paid: 0, by: 'Amaka O.', status: 'Pending', payments: [] },
        { date: tomorrow, source: 'Restaurant', desc: '1x Prawn Cocktail, 1x Espresso', room: '204', amount: 8300, paid: 0, by: 'Tunde A.', status: 'Pending', payments: [] },
        { date: dayAfter, source: 'Pool Bar', desc: '2x Freshly Squeezed OJ', room: '204', amount: 4000, paid: 4000, by: 'Emeka S.', status: 'Settled',
          payments: [ pay(4000, 'Cash', dayAfter, 'Emeka S.', 60) ] },
      ],
    },
    {
      id: 'g008', name: 'Chief Dangote, Emeka',
      phone: '+234 801 888 6677', email: 'emeka.d@corp.ng',
      address: '1 Banana Island, Ikoyi, Lagos',
      idType: 'Passport', idNum: 'C11223344', vip: true,
      notes: 'Long-standing VIP — always assign Suite 301. Complimentary fruit basket on arrival.',
      stays: [
        { room: '301', type: 'Suite', checkin: TODAY, checkout: fiveDays, total: 600000, paid: 600000, status: 'checkedin' },
        { room: '301', type: 'Suite', checkin: '2025-12-20', checkout: '2025-12-27', total: 840000, paid: 840000, status: 'checkout' },
        { room: '301', type: 'Suite', checkin: '2025-10-14', checkout: '2025-10-16', total: 240000, paid: 240000, status: 'checkout' },
        { room: '302', type: 'Suite', checkin: '2025-08-01', checkout: '2025-08-05', total: 480000, paid: 480000, status: 'checkout' },
        { room: '301', type: 'Suite', checkin: '2025-05-19', checkout: '2025-05-22', total: 360000, paid: 360000, status: 'checkout' },
        { room: '301', type: 'Suite', checkin: '2025-02-10', checkout: '2025-02-13', total: 360000, paid: 360000, status: 'checkout' },
      ],
      charges: [
        { date: TODAY, source: 'Bar', desc: "1x Moët & Chandon, 2x Martell VSOP", room: '301', amount: 64000, paid: 0, by: 'Emeka S.', status: 'Pending', payments: [] },
        { date: tomorrow, source: 'Pool Bar', desc: '1x Moët & Chandon, 2x Pina Colada', room: '301', amount: 60300, paid: 20000, by: 'Amaka O.', status: 'Partially Settled',
          payments: [ pay(20000, 'Cash', tomorrow, 'Amaka O.', 45) ] },
        { date: threeDays, source: 'Restaurant', desc: '1x Chef Special, 1x Asun', room: '301', amount: 14500, paid: 0, by: 'Tunde A.', status: 'Pending', payments: [] },
        { date: '2025-12-22', source: 'Bar', desc: '2x Hennessy VS', room: '301', amount: 8000, paid: 8000, by: 'Emeka S.', status: 'Settled',
          payments: [ pay(8000, 'Transfer', '2025-12-22', 'Emeka S.', 5000) ] },
      ],
    },
    {
      id: 'g009', name: 'Zenith Bank Ltd.',
      phone: '+234 700 999 8877', email: 'events@zenithbank.com',
      address: 'Plot 84 Ajose Adeogun, Victoria Island, Lagos',
      idType: "Voter's Card", idNum: 'ZB00001', vip: false,
      notes: 'Corporate event — projector & PA system required',
      stays: [
        { room: '401', type: 'Conference', checkin: TODAY, checkout: TODAY, total: 200000, paid: 200000, status: 'checkedin' },
      ],
      charges: [
        { date: TODAY, source: 'Restaurant', desc: 'Executive Lunch for 40 pax', room: '401', amount: 120000, paid: 0, by: 'Amaka O.', status: 'Pending', payments: [] },
      ],
    },
    {
      id: 'g010', name: 'Ms. Okonkwo, Ifeoma',
      phone: '+234 809 888 3344', email: 'ifeoma.o@gmail.com',
      address: '12 New Haven, Enugu',
      idType: 'NIN', idNum: '99887766554', vip: false,
      notes: 'Returning guest — booked 3 times in 2025',
      stays: [
        { room: '302', type: 'Suite', checkin: threeDays, checkout: fiveDays, total: 240000, paid: 0, status: 'reserved' },
        { room: '202', type: 'Deluxe', checkin: '2025-12-15', checkout: '2025-12-18', total: 180000, paid: 180000, status: 'checkout' },
        { room: '101', type: 'Standard', checkin: '2025-09-22', checkout: '2025-09-25', total: 105000, paid: 105000, status: 'checkout' },
      ],
      charges: [],
    },
  ];

  global.BookingDemoSeed = { DEMO_ROOMS, DEMO_BOOKINGS, DEMO_GUESTS };
})(window);