/* ═══════════════════════════════════════════════════════════════
   Gym Seed — Demo data for the Gym module.
   Automatically seeded when GymService.loadAll() is called
   without existing data in storage.

   WHAT CHANGED
   ────────────
   Every demo member now carries a `payments[]` array — the same
   shape GymService.addMemberPayment() writes ({amount, mode, date,
   by, ts, roomNumber}) — with dates spread across the last few
   months. This is what makes the Revenue Report show real numbers:
   GymService.getRevenueReport() sums payments by date, not by a
   member's join date, so the report needs actual dated payment
   records to have anything to add up.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  // ── Helper to generate date strings ──
  function isoAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }
  function isoIn(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  function isoAgoHours(hours) {
    const d = new Date();
    d.setHours(d.getHours() - hours);
    return d.toISOString();
  }
  function tsAgo(days) {
    return Date.now() - days * 86400000;
  }

  // ── Demo plans ──
  const DEMO_PLANS = [
    { id: 'pl01', name: 'Basic',    price: 15000, durationDays: 30, notes: 'Full gym floor access. Locker included.', color: 'blue' },
    { id: 'pl02', name: 'Premium',  price: 35000, durationDays: 30, notes: 'Everything in Basic, plus classes, sauna & PT consult.', color: 'gold' },
    { id: 'pl03', name: 'Day Pass', price: 5000,  durationDays: 1,  notes: 'Single-day access for hotel guests.', color: 'purple' },
    { id: 'pl04', name: 'Annual',   price: 120000,durationDays: 365,notes: 'Full year unlimited access. Best value.', color: 'green' },
    { id: 'pl05', name: 'Student',  price: 8000,  durationDays: 30, notes: 'Discounted plan for students with valid ID.', color: 'amber' },
  ];

  // ── Demo members (with dated payment history) ──
  const DEMO_MEMBERS = [
    {
      id: 'gm01', name: 'Chidi Nwankwo', planId: 'pl02', room: 'Room 204', phone: '+234 801 234 5671',
      joined: isoAgo(120), expiry: isoIn(18), checkins: 34, lastCheckin: isoAgoHours(5), status: 'active',
      notes: '', amountPaid: 35000, totalDue: 35000,
      payments: [
        { amount: 35000, mode: 'Cash', date: isoAgo(3), by: 'Front Desk', ts: tsAgo(3), roomNumber: null },
      ],
    },
    {
      id: 'gm02', name: 'Fatima Bello', planId: 'pl01', room: 'Room 118', phone: '+234 802 345 6782',
      joined: isoAgo(60), expiry: isoIn(4), checkins: 12, lastCheckin: isoAgoHours(30), status: 'active',
      notes: '', amountPaid: 15000, totalDue: 15000,
      payments: [
        { amount: 15000, mode: 'Room Charge', date: isoAgo(4), by: 'Gym Attendant', ts: tsAgo(4), roomNumber: '118' },
      ],
    },
    {
      id: 'gm03', name: 'Segun Johnson', planId: 'pl03', room: 'Walk-in', phone: '+234 803 456 7893',
      joined: isoAgo(1), expiry: isoAgo(0), checkins: 1, lastCheckin: isoAgoHours(1), status: 'active',
      notes: '', amountPaid: 5000, totalDue: 5000,
      payments: [
        { amount: 5000, mode: 'Cash', date: isoAgo(0), by: 'Front Desk', ts: tsAgo(0), roomNumber: null },
      ],
    },
    {
      id: 'gm04', name: 'Ada Williams', planId: 'pl02', room: 'Room 204 (Suite)', phone: '+234 804 567 8904',
      joined: isoAgo(200), expiry: isoAgo(10), checkins: 88, lastCheckin: isoAgo(10), status: 'active',
      notes: 'VIP guest', amountPaid: 20000, totalDue: 35000,
      payments: [
        { amount: 20000, mode: 'Room Charge', date: isoAgo(15), by: 'Gym Attendant', ts: tsAgo(15), roomNumber: '204' },
      ],
    },
    {
      id: 'gm05', name: 'Ibrahim Musa', planId: 'pl01', room: 'Staff', phone: '+234 805 678 9015',
      joined: isoAgo(300), expiry: isoIn(90), checkins: 150, lastCheckin: isoAgo(45), status: 'frozen',
      notes: 'On medical leave', amountPaid: 15000, totalDue: 15000,
      payments: [
        { amount: 15000, mode: 'Cash', date: isoAgo(60), by: 'Front Desk', ts: tsAgo(60), roomNumber: null },
      ],
    },
    {
      id: 'gm06', name: 'Ngozi Okafor', planId: 'pl04', room: 'Room 301', phone: '+234 806 789 0126',
      joined: isoAgo(10), expiry: isoIn(50), checkins: 6, lastCheckin: isoAgoHours(20), status: 'active',
      notes: '', amountPaid: 60000, totalDue: 120000,
      payments: [
        { amount: 40000, mode: 'Room Charge', date: isoAgo(10), by: 'Gym Attendant', ts: tsAgo(10), roomNumber: '301' },
        { amount: 20000, mode: 'Cash', date: isoAgo(2), by: 'Front Desk', ts: tsAgo(2), roomNumber: null },
      ],
    },
    {
      id: 'gm07', name: 'Emeka Obi', planId: 'pl02', room: 'Room 105', phone: '+234 807 890 1234',
      joined: isoAgo(90), expiry: isoAgo(5), checkins: 45, lastCheckin: isoAgo(6), status: 'active',
      notes: 'Expired plan', amountPaid: 0, totalDue: 35000,
      payments: [],
    },
  ];

  // ── Demo check-ins ──
  const DEMO_CHECKINS = [
    { id: 'ci01', memberId: 'gm03', memberName: 'Segun Johnson', time: isoAgoHours(1) },
    { id: 'ci02', memberId: 'gm01', memberName: 'Chidi Nwankwo', time: isoAgoHours(5) },
    { id: 'ci03', memberId: 'gm06', memberName: 'Ngozi Okafor',  time: isoAgoHours(20) },
    { id: 'ci04', memberId: 'gm02', memberName: 'Fatima Bello',  time: isoAgoHours(30) },
    { id: 'ci05', memberId: 'gm01', memberName: 'Chidi Nwankwo', time: isoAgoHours(48) },
  ];

  // ── Demo hotel guests (for room charge) ──
  const DEMO_GUESTS = [
    { id: 'g01', name: 'Mr. Adeyemi, Tunde',   room: '101', phone: '+234 803 111 2233' },
    { id: 'g02', name: 'Mrs. Okafor, Ngozi',   room: '102', phone: '+234 806 222 4455' },
    { id: 'g03', name: 'Mr. Bello, Ibrahim',   room: '103', phone: '+234 701 333 6677' },
    { id: 'g04', name: 'Dr. Eze, Chukwuemeka', room: '201', phone: '+234 802 444 8899' },
    { id: 'g05', name: 'Ms. Abubakar, Fatima', room: '202', phone: '+234 805 555 0011' },
    { id: 'g06', name: 'Mr. Johnson, Segun',   room: '203', phone: '+234 708 666 2233' },
    { id: 'g07', name: 'Prof. Williams, Ada',  room: '204', phone: '+234 803 777 4455' },
  ];

  // ── Seed function (optional) ──
  async function seedGymData(storage) {
    // If you want to force seeding, you can call this.
    // The service's loadAll(seedData) will do it automatically.
  }

  // Expose globally
  const GymSeed = {
    DEMO_PLANS,
    DEMO_MEMBERS,
    DEMO_CHECKINS,
    DEMO_GUESTS,
    seedGymData,
  };

  global.GymSeed = GymSeed;

})(window);