/**
 * accounting/accounting-seed.js
 * ─────────────────────────────────────────────────────────────────────
 * Demo/seed data for the Accounting module. This is the ONLY place
 * demo numbers live for accounting-reconciliation.html, profit-loss.html
 * (and any other accounting-*.html page that wants to reuse the same
 * fixtures instead of duplicating them). Classic script, same pattern
 * as accounting-shell.js and shift-reconciliation-detail.js — include
 * it with a plain <script> tag and read off window.AccountingSeed.
 *
 * PRODUCTION NOTE: none of this is fetched from an API — it's local
 * fixture data for demo/dev mode only. When a page wires up a real
 * backend, it should stop reading from here for its live data and only
 * fall back to these constants when explicitly in demo mode (same
 * USE_DEMO pattern as services/booking-data.js and
 * services/poolbar-data.js).
 *
 *   <script src="accounting-seed.js"></script>
 *   <script>
 *     const { DEMO_SHIFTS, DEPARTMENTS, DEMO_INCOME, DEMO_EXPENSES } = AccountingSeed;
 *   </script>
 */
(function (global) {
  'use strict';

  /* ── Departments this module reconciles cash for, and the colour
     each one uses consistently across every Accounting page. ── */
  const DEPARTMENTS = ['Rooms', 'Restaurant', 'Pool Bar'];
  const DEPT_COLOR = { Rooms: 'var(--purple)', Restaurant: 'var(--green)', 'Pool Bar': 'var(--amber)' };

  /* ── Payment methods every transaction can use — single source of
     truth. Was previously hardcoded separately as PAY_METHODS on
     accounting-breakdown.html and paymentMethods on poolbar-orders.html
     / accounting-transactions.html's filter dropdown. ── */
  const PAYMENT_METHODS = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];

  /* ── Underlying transaction ledgers — same shape/values every
     Accounting page agrees on, so totals tie out everywhere. ── */
  const DEMO_ROOM_TX = [
    { id: 'RM-2044', desc: 'Room 312 — Checkout (Dr. Balogun)', amount: 145000, method: 'Room Charge', staff: 'Adewale O.', date: '17/07/26 08:40 AM' },
    { id: 'RM-2043', desc: 'Room 204 — Check-in (Mr. Adeyemi)', amount: 98000, method: 'POS', staff: 'Adewale O.', date: '17/07/26 09:14 AM' },
    { id: 'RM-2042', desc: 'Room 109 — Checkout (Ms. Okafor)', amount: 76000, method: 'Cash', staff: 'Ngozi Eze', date: '17/07/26 08:05 AM' },
    { id: 'RM-2041', desc: 'Room 402 — Check-in (Barr. Musa)', amount: 132000, method: 'Transfer', staff: 'Adewale O.', date: '16/07/26 11:20 PM' },
    { id: 'RM-2040', desc: 'Room 108 — Checkout (Mrs. Bello)', amount: 64000, method: 'Cash', staff: 'Kabiru Aliyu', date: '16/07/26 08:52 AM' },
    { id: 'RM-2039', desc: 'Room 210 — Checkout (Mr. Yusuf)', amount: 52000, method: 'Cash', staff: 'Amaka Okonkwo', date: '15/07/26 09:40 AM' },
  ];

  const DEMO_RESTAURANT_SALES = [
    { id: 'SALE-1043', items: [{ meal: 'Egusi Soup', qty: 2, price: 6000 }], total: 12000, method: 'Cash', staff: 'Amaka O.', table: 'Table 4', date: '17/07/26 11:05 AM', status: 'completed' },
    { id: 'SALE-1042', items: [{ meal: 'Fried Rice', qty: 3, price: 6000 }], total: 18000, method: 'POS', staff: 'Tunde A.', table: 'Table 2', date: '17/07/26 10:40 AM', status: 'completed' },
    { id: 'SALE-1041', items: [{ meal: 'Moi Moi', qty: 1, price: 2500 }], total: 2500, method: 'Transfer', staff: 'Amaka O.', table: 'Takeaway', date: '17/07/26 09:52 AM', status: 'completed' },
    { id: 'SALE-1038', items: [{ meal: 'Suya Platter', qty: 2, price: 5500 }], total: 11000, method: 'Cash', staff: 'Tunde A.', table: 'Table 6', date: '17/07/26 12:20 AM', status: 'completed' },
    { id: 'SALE-1030', items: [{ meal: 'Jollof Rice', qty: 4, price: 5500 }], total: 22000, method: 'Cash', staff: 'Amaka O.', table: 'Table 1', date: '15/07/26 07:10 PM', status: 'completed' },
  ];

  const DEMO_POOLBAR_SALES = [
    { id: 'PBS-1021', item: 'Heineken', qty: 3, total: 4500, method: 'Cash', staff: 'Bola Nwosu', time: '17/07/26 11:15 AM' },
    { id: 'PBS-1020', item: 'Mojito', qty: 2, total: 11000, method: 'POS', staff: 'Bola Nwosu', time: '17/07/26 10:50 AM' },
    { id: 'PBS-1018', item: 'Heineken', qty: 6, total: 9000, method: 'Cash', staff: 'Emeka U.', time: '17/07/26 01:05 AM' },
    { id: 'PBS-1012', item: 'Guinness', qty: 4, total: 6400, method: 'Cash', staff: 'Bola Nwosu', time: '15/07/26 06:30 PM' },
  ];

  /* ── One row per DEPARTMENT per shift day. actualCash:'auto' means
     "compute this from the ledger above at seed time" (openingFloat +
     cash sales for that shift, plus an optional deliberate
     demoVariance) rather than being a hand-typed, possibly-inconsistent
     number. The page resolves 'auto' into a real number once, at seed
     time, and never persists the literal string 'auto'. ── */
  const DEMO_SHIFTS = [
    { key: '2026-07-17', dept: 'Rooms', staff: 'Adewale O. (Front Desk Cashier)', openingFloat: 50000, actualCash: null, status: 'open', notes: '' },
    { key: '2026-07-17', dept: 'Restaurant', staff: 'Amaka O. (Restaurant Cashier)', openingFloat: 20000, actualCash: null, status: 'open', notes: '' },
    { key: '2026-07-17', dept: 'Pool Bar', staff: 'Bola Nwosu (Pool Bar Cashier)', openingFloat: 15000, actualCash: null, status: 'open', notes: '' },

    { key: '2026-07-16', dept: 'Rooms', staff: 'Kabiru Aliyu (Front Desk Cashier)', openingFloat: 50000, actualCash: 'auto', status: 'reconciled', notes: '' },
    { key: '2026-07-16', dept: 'Restaurant', staff: 'Tunde A. (Restaurant Cashier)', openingFloat: 20000, actualCash: 'auto', status: 'reconciled', notes: '' },
    { key: '2026-07-16', dept: 'Pool Bar', staff: 'Emeka U. (Pool Bar Cashier)', openingFloat: 15000, actualCash: 'auto', demoVariance: -1500, status: 'reconciled', notes: 'Till was ₦1,500 short — under investigation.' },

    { key: '2026-07-15', dept: 'Rooms', staff: 'Amaka Okonkwo (Front Desk Cashier)', openingFloat: 50000, actualCash: 'auto', demoVariance: -5000, status: 'reconciled', notes: 'Short by ₦5,000 — under investigation.' },
    { key: '2026-07-15', dept: 'Restaurant', staff: 'Amaka O. (Restaurant Cashier)', openingFloat: 20000, actualCash: 'auto', status: 'reconciled', notes: '' },
    { key: '2026-07-15', dept: 'Pool Bar', staff: 'Bola Nwosu (Pool Bar Cashier)', openingFloat: 15000, actualCash: 'auto', status: 'reconciled', notes: '' },
  ];

  const VARIANCE_TOLERANCE = 500; // ₦ — within this counts as "Reconciled" not "Variance"

  /* ══════════════════════════════════════════════════════════════════
     PROFIT & LOSS — categories + ledger entries for profit-loss.html.
     10 income entries / 9 expense entries on purpose: enough to show
     that page's 7-per-page pagination actually paginating (page 2
     exists) rather than always rendering a single, never-tested page.
  ══════════════════════════════════════════════════════════════════ */
  const INCOME_DEPARTMENTS = ['Rooms & Bookings', 'Restaurant', 'Pool Bar', 'Kitchen / Banquets', 'Other Income'];
  const EXPENSE_CATEGORIES = ['Salaries & Wages', 'Utilities', 'Maintenance & Repairs', 'Marketing & Advertising', 'Supplies & Inventory', 'Insurance', 'Transport & Logistics', 'Miscellaneous'];

  const DEMO_INCOME = [
    { id: 'inc-1', date: '2026-07-01', department: 'Rooms & Bookings', description: 'Room revenue – July Week 1', amount: 2450000, recordedBy: 'Front Desk' },
    { id: 'inc-2', date: '2026-07-01', department: 'Restaurant', description: 'Restaurant sales – July Week 1', amount: 860000, recordedBy: 'Restaurant Manager' },
    { id: 'inc-3', date: '2026-07-01', department: 'Pool Bar', description: 'Pool bar sales – July Week 1', amount: 310000, recordedBy: 'Pool Bar Supervisor' },
    { id: 'inc-4', date: '2026-07-08', department: 'Rooms & Bookings', description: 'Room revenue – July Week 2', amount: 2680000, recordedBy: 'Front Desk' },
    { id: 'inc-5', date: '2026-07-08', department: 'Kitchen / Banquets', description: 'Banquet hall booking – Corporate event', amount: 450000, recordedBy: 'Events Coordinator' },
    { id: 'inc-6', date: '2026-07-15', department: 'Restaurant', description: 'Restaurant sales – July Week 3', amount: 920000, recordedBy: 'Restaurant Manager' },
    { id: 'inc-7', date: '2026-07-15', department: 'Other Income', description: 'Laundry & misc services', amount: 75000, recordedBy: 'Accounts' },
    { id: 'inc-8', date: '2026-07-18', department: 'Restaurant', description: 'Restaurant sales – July Week 3 (weekend)', amount: 480000, recordedBy: 'Restaurant Manager' },
    { id: 'inc-9', date: '2026-07-20', department: 'Pool Bar', description: 'Pool bar sales – July Week 3', amount: 260000, recordedBy: 'Pool Bar Supervisor' },
    { id: 'inc-10', date: '2026-07-22', department: 'Rooms & Bookings', description: 'Room revenue – July Week 4', amount: 2510000, recordedBy: 'Front Desk' },
  ];

  const DEMO_EXPENSES = [
    { id: 'exp-1', date: '2026-07-02', category: 'Salaries & Wages', description: 'Staff salaries – July (first half)', amount: 1350000, recordedBy: 'HR / Accounts' },
    { id: 'exp-2', date: '2026-07-03', category: 'Utilities', description: 'Electricity (NEPA) & generator diesel', amount: 420000, recordedBy: 'Facilities' },
    { id: 'exp-3', date: '2026-07-05', category: 'Maintenance & Repairs', description: 'AC servicing – guest floors', amount: 95000, recordedBy: 'Facilities' },
    { id: 'exp-4', date: '2026-07-10', category: 'Supplies & Inventory', description: 'Kitchen & housekeeping supplies restock', amount: 210000, recordedBy: 'Procurement' },
    { id: 'exp-5', date: '2026-07-12', category: 'Marketing & Advertising', description: 'Social media ads & promo materials', amount: 60000, recordedBy: 'Marketing' },
    { id: 'exp-6', date: '2026-07-18', category: 'Transport & Logistics', description: 'Airport shuttle fuel & vehicle upkeep', amount: 48000, recordedBy: 'Transport' },
    { id: 'exp-7', date: '2026-07-20', category: 'Insurance', description: 'Property insurance premium – quarterly', amount: 150000, recordedBy: 'Accounts' },
    { id: 'exp-8', date: '2026-07-22', category: 'Miscellaneous', description: 'Staff welfare & refreshments', amount: 35000, recordedBy: 'HR' },
    { id: 'exp-9', date: '2026-07-25', category: 'Utilities', description: 'Water supply & borehole maintenance', amount: 65000, recordedBy: 'Facilities' },
  ];

  global.AccountingSeed = {
    DEPARTMENTS,
    DEPT_COLOR,
    PAYMENT_METHODS,
    DEMO_ROOM_TX,
    DEMO_RESTAURANT_SALES,
    DEMO_POOLBAR_SALES,
    DEMO_SHIFTS,
    VARIANCE_TOLERANCE,
    INCOME_DEPARTMENTS,
    EXPENSE_CATEGORIES,
    DEMO_INCOME,
    DEMO_EXPENSES,
  };

})(window);