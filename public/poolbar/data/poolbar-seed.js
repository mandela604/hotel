/**
 * data/poolbar-seed.js — Pool Bar module demo seed only
 * DEMO_STOCK | DEMO_SALES | DEMO_ORDERS | DEMO_PENDING | DEMO_MOVEMENTS | DEMO_STORE_TRANSFERS
 * PAYMENT_METHODS | ORDER_STATUS_OPTIONS | COMPLETED_SALE_STATUS | ROOM_CHARGE_METHOD
 * CURRENCY | BOOKING_MODULE_PATHS
 *
 * Load order: this file, then services/poolbar-service.js.
 *
 * Every value services/poolbar-service.js and component/orders-workspace.js
 * treat as "no hardcoded default — must be configured" lives here. If a key
 * below is missing, the page fails loudly (see orders-workspace.js's
 * CONFIG_ERRORS check) rather than quietly falling back to a guessed value.
 */
(function (global) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  // "DD/MM/YY hh:mm AM/PM" — the stamp format every Pool Bar page parses
  function fmtStamp(date) {
    let h = date.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad2(h)}:${pad2(date.getMinutes())} ${ampm}`;
  }
  function hoursAgo(h) { return fmtStamp(new Date(Date.now() - h * 3600000)); }
  function stampDaysAgo(daysAgo, hour, minute) {
    const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, minute || 0, 0, 0);
    return fmtStamp(d);
  }
  function dateOnlyDaysAgo(daysAgo) {
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  }
  function isoDaysAgo(daysAgo) {
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  // ── Payment methods available at the Pool Bar — single source of
  // truth. Add/rename/remove a method in ONE place and every page picks
  // it up (poolbar-orders.html no longer hardcodes this list).
  const PAYMENT_METHODS = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];

  // ── Which PAYMENT_METHODS value means "charge to the guest's room".
  // Must exactly match one of the strings in PAYMENT_METHODS above.
  // A standalone bar deployment with no room ledger would simply omit
  // this key — orders-workspace.js then disables the Room Charge UI
  // entirely rather than guessing a string.
  const ROOM_CHARGE_METHOD = 'Room Charge';

  // ── Order/tab status vocabulary. orders-workspace.js draws its status
  // pills, table chips, and per-row action buttons ENTIRELY off this list
  // — it has no idea what "open" or "served" means on its own. `actions`
  // on each entry maps to handlers in ORDER_ACTION_HANDLERS
  // (markServed/pay/cancel are the three built-in ones the component
  // ships with; options.orderActionHandlers can add more).
  // Colors reference the component's own CSS custom properties
  // (--ow-blue etc., defined on .ow-root) so status colors stay visually
  // consistent with the rest of the UI without duplicating hex values here.
  const ORDER_STATUS_OPTIONS = [
    {
      value: 'open', label: 'Open',
      color: 'var(--ow-blue)', colorBg: 'var(--ow-blue-bg)',
      isActive: true, isCancelled: false,
      actions: [
        { action: 'markServed', label: 'Served', icon: 'fa-bell-concierge' },
        { action: 'cancel', label: 'Cancel', icon: 'fa-ban' },
      ],
    },
    {
      value: 'served', label: 'Served',
      color: 'var(--ow-green)', colorBg: 'var(--ow-green-bg)',
      isActive: true, isCancelled: false,
      actions: [
        { action: 'pay', label: 'Pay', icon: 'fa-naira-sign' },
        { action: 'cancel', label: 'Cancel', icon: 'fa-ban' },
      ],
    },
    {
      value: 'paid', label: 'Paid',
      color: 'var(--ow-purple)', colorBg: 'var(--ow-purple-bg)',
      isActive: false, isCancelled: false,
      actions: [],
    },
    {
      value: 'cancelled', label: 'Cancelled',
      color: 'var(--ow-red)', colorBg: 'var(--ow-red-bg)',
      isActive: false, isCancelled: true,
      actions: [],
    },
  ];

  // ── The sales-record status that means "posted / complete". Must match
  // the `status` value poolbar-service.js writes on recordSale()/payOrder()
  // (see STATUS_VALUES.SALE_COMPLETED there — keep the two in sync).
  const COMPLETED_SALE_STATUS = 'completed';

  // ── Display currency. If omitted, PoolBarService.fmtN() and
  // OrdersWorkspace both degrade to a bare unformatted number rather than
  // failing outright — but a real deployment should always set this.
  const CURRENCY = { symbol: '₦', locale: 'en-NG' };

  // ── Where to dynamically load the Booking module's demo-data + service
  // scripts from, IF a page hasn't already loaded window.BookingData
  // itself. Paths are resolved relative to THIS service file's own
  // <script src>, i.e. relative to poolbar/services/poolbar-service.js —
  // not relative to whatever page happens to load it. Given the layout
  //   /data/booking-demo-seed.js
  //   /services/booking-service.js
  //   /poolbar/services/poolbar-service.js
  //   /poolbar/poolbar-orders.html
  // that's two levels up from poolbar/services/ to reach the shared
  // /data/ and /services/ folders.
  const BOOKING_MODULE_PATHS = {
    demoSeed: '../../data/booking-demo-seed.js',
    service: '../../services/booking-service.js',
  };

  // ── Catalog: every sellable item — drinks & snacks. `qty` is the ONLY
  // field that ever changes outside this seed (via sales, deductions,
  // or an accepted requisition) — everything else is set once here.
  const DEMO_STOCK = [
    { name: 'Heineken',        category: 'Beers',       unit: 'Bottles', qty: 48, min: 12, batch: 'REQ-00031', received: dateOnlyDaysAgo(0), price: 1500,  desc: '33cl chilled beer' },
    { name: 'Guinness',        category: 'Beers',       unit: 'Bottles', qty: 36, min: 12, batch: 'REQ-00031', received: dateOnlyDaysAgo(0), price: 1600,  desc: 'Stout, 33cl' },
    { name: 'Star Lager',      category: 'Beers',       unit: 'Bottles', qty: 8,  min: 12, batch: 'REQ-00029', received: dateOnlyDaysAgo(2), price: 1200,  desc: '33cl chilled beer' },
    { name: 'Hennessy VS',     category: 'Spirits',     unit: 'Bottles', qty: 5,  min: 3,  batch: 'REQ-00027', received: dateOnlyDaysAgo(3), price: 4000,  desc: 'Premium cognac, per shot billed' },
    { name: 'Johnnie Walker',  category: 'Spirits',     unit: 'Bottles', qty: 3,  min: 3,  batch: 'REQ-00026', received: dateOnlyDaysAgo(4), price: 4500,  desc: 'Blended scotch whisky' },
    { name: 'Baileys',         category: 'Spirits',     unit: 'Bottles', qty: 4,  min: 2,  batch: 'REQ-00025', received: dateOnlyDaysAgo(5), price: 3500,  desc: 'Irish cream liqueur' },
    { name: 'Moët & Chandon',  category: 'Wines',       unit: 'Bottles', qty: 6,  min: 3,  batch: 'REQ-00024', received: dateOnlyDaysAgo(6), price: 55000, desc: '750ml champagne' },
    { name: 'Chapman Mix',     category: 'Soft Drinks', unit: 'Litres',  qty: 10, min: 5,  batch: 'REQ-00031', received: dateOnlyDaysAgo(0), price: 2500,  desc: 'Classic Nigerian mocktail mix' },
    { name: 'Maltina',         category: 'Soft Drinks', unit: 'Cans',    qty: 5,  min: 12, batch: 'REQ-00030', received: dateOnlyDaysAgo(1), price: 800,   desc: 'Malt drink' },
    { name: 'Bottled Water',   category: 'Water',       unit: 'Bottles', qty: 72, min: 24, batch: 'REQ-00031', received: dateOnlyDaysAgo(0), price: 500,   desc: '750ml still water' },
    { name: 'Mojito Mix',      category: 'Cocktails',   unit: 'Litres',  qty: 3,  min: 2,  batch: 'REQ-00028', received: dateOnlyDaysAgo(3), price: 5500,  desc: 'Rum, mint, lime, soda' },
    { name: 'Pina Colada Mix', category: 'Cocktails',   unit: 'Litres',  qty: 2,  min: 2,  batch: 'REQ-00028', received: dateOnlyDaysAgo(3), price: 6000,  desc: 'Rum, coconut, pineapple' },
    { name: 'Pringles',        category: 'Snacks',      unit: 'Packs',   qty: 20, min: 10, batch: 'REQ-00029', received: dateOnlyDaysAgo(2), price: 2000,  desc: 'Assorted flavours' },
    { name: 'Chin Chin',       category: 'Snacks',      unit: 'Packs',   qty: 15, min: 10, batch: 'REQ-00029', received: dateOnlyDaysAgo(2), price: 1500,  desc: 'Nigerian fried snack' },
    { name: 'Ice Cream Tubs',  category: 'Ice Cream',   unit: 'Pieces',  qty: 0,  min: 4,  batch: 'REQ-00022', received: dateOnlyDaysAgo(8), price: 2500,  desc: 'Assorted scoops' },
  ];

  // ── Completed / voided sales. Item names MUST match DEMO_STOCK names
  // exactly — every page decrements/restores stock by looking up
  // stock.find(i => i.name === item.name).
  const DEMO_SALES = [
    { id: 'PBS-1021', items: [{ name: 'Heineken', qty: 3, price: 1500 }],                                          subtotal: 4500, discount: 0,  total: 4500, method: 'Cash',        staff: 'Bola Nwosu', table: 'Pool Deck 2', notes: '', date: hoursAgo(1), status: 'completed' },
    { id: 'PBS-1020', items: [{ name: 'Mojito Mix', qty: 2, price: 5500 }],                                        subtotal: 11000, discount: 0, total: 11000, method: 'POS',        staff: 'Emeka U.',   table: 'Pool Lounge', notes: '', date: hoursAgo(3), status: 'completed' },
    { id: 'PBS-1019', items: [{ name: 'Chapman Mix', qty: 1, price: 2500 }],                                       subtotal: 2500, discount: 0,  total: 2500, method: 'Transfer',   staff: 'Bola Nwosu', table: 'Pool Deck 1', notes: '', date: hoursAgo(5), status: 'completed' },
    { id: 'PBS-1016', items: [{ name: 'Baileys', qty: 1, price: 3500 }], subtotal: 3500, discount: 0, total: 3500, method: 'Cash', staff: 'Emeka U.', table: 'Pool Deck 2', notes: '', date: stampDaysAgo(2, 16, 10), status: 'completed' },
    { id: 'PBS-1015', items: [{ name: 'Pringles', qty: 2, price: 2000 }], subtotal: 4000, discount: 0, total: 4000, method: 'POS', staff: 'Bola Nwosu', table: 'Pool Deck 3', notes: '', date: stampDaysAgo(3, 11, 0), status: 'completed' },
    { id: 'PBS-1018', items: [{ name: 'Heineken', qty: 4, price: 1500 }, { name: 'Chapman Mix', qty: 1, price: 2500 }], subtotal: 8500, discount: 10, total: 7650, method: 'Room Charge', staff: 'Emeka U.',   table: 'Pool Deck 4', notes: '', date: stampDaysAgo(1, 19, 30), status: 'completed' },
    { id: 'PBS-1017', items: [{ name: 'Guinness', qty: 2, price: 1600 }],                                          subtotal: 3200, discount: 0,  total: 3200, method: 'Cash',        staff: 'Bola Nwosu', table: 'Pool Deck 1', notes: 'Wrong order', date: stampDaysAgo(1, 13, 15), status: 'voided',
      voidReason: 'Customer changed mind before it was served', voidDate: stampDaysAgo(1, 13, 20), voidedBy: 'Adaeze Nwankwo (Duty Manager)' },
  ];

  // ── Open tabs — not yet paid, so no stock has been deducted for these.
  const DEMO_ORDERS = [
    { id: 'PBO-001', items: [{ name: 'Star Lager', qty: 2, price: 1200 }],                                         subtotal: 2400, discount: 0, total: 2400, staff: 'Bola Nwosu', table: 'Pool Deck 3', notes: '',            date: hoursAgo(2), status: 'open',   source: 'tab' },
    { id: 'PBO-002', items: [{ name: 'Heineken', qty: 2, price: 1500 }, { name: 'Pringles', qty: 1, price: 2000 }], subtotal: 5000, discount: 0, total: 5000, staff: 'Emeka U.',   table: 'Pool Lounge', notes: 'Group of 4', date: hoursAgo(4), status: 'served', source: 'tab' },
  ];

  // ── Sent by Store, awaiting Pool Bar's "Accept" (adds qty on accept).
  const DEMO_PENDING = [
    { no: 'REQ-00034', item: 'Moët & Chandon', qty: 6,  unit: 'Bottles', from: 'Central Store', sentBy: 'Store Keeper', date: hoursAgo(2), prodNo: 'STK-00512' },
    { no: 'REQ-00035', item: 'Bottled Water',  qty: 48, unit: 'Bottles', from: 'Central Store', sentBy: 'Store Keeper', date: hoursAgo(1), prodNo: 'STK-00518' },
  ];

  // ── Stock ledger — mirrors the sales/receipts above.
  const DEMO_MOVEMENTS = [
    { date: hoursAgo(1), item: 'Heineken',    qtyIn: 0,  qtyOut: 3, balance: 48, reason: 'Sale (PBS-1021)' },
    { date: hoursAgo(3), item: 'Mojito Mix',  qtyIn: 0,  qtyOut: 2, balance: 3,  reason: 'Sale (PBS-1020)' },
    { date: hoursAgo(5), item: 'Chapman Mix', qtyIn: 0,  qtyOut: 1, balance: 10, reason: 'Sale (PBS-1019)' },
    { date: stampDaysAgo(2, 10, 0), item: 'Star Lager', qtyIn: 24, qtyOut: 0, balance: 8, reason: 'Requisition Received (REQ-00029)' },
  ];

  // ── Store pushed stock WITHOUT a Pool Bar requisition (unsolicited
  // restock / surplus transfer) — shown on Requisition History.
  const DEMO_STORE_TRANSFERS = [
    {
      no: 'STX-00041', source: 'store_push', from: 'Central Store', sentBy: 'Store Keeper',
      date: isoDaysAgo(0), dateDisplay: hoursAgo(2), status: 'Received',
      remark: 'Unsolicited restock — weekend rush prep.',
      items: [{ name: 'Heineken', unit: 'Bottles', qty: 24 }, { name: 'Bottled Water', unit: 'Bottles', qty: 48 }],
    },
    {
      no: 'STX-00038', source: 'store_push', from: 'Central Store', sentBy: 'Store Keeper',
      date: isoDaysAgo(5), dateDisplay: stampDaysAgo(5, 14, 40), status: 'Received',
      remark: 'Surplus spirits moved to Pool Bar.',
      items: [{ name: 'Hennessy VS', unit: 'Bottles', qty: 3 }, { name: 'Johnnie Walker', unit: 'Bottles', qty: 2 }],
    },
  ];

  global.PoolBarSeed = {
    PAYMENT_METHODS,
    MONEY_RECEIVED_METHODS: ['Cash', 'POS', 'Transfer'],
    ROOM_CHARGE_METHOD,
    ORDER_STATUS_OPTIONS,
    COMPLETED_SALE_STATUS,
    CURRENCY,
    BOOKING_MODULE_PATHS,
    DEMO_STOCK,
    DEMO_SALES,
    DEMO_ORDERS,
    DEMO_PENDING,
    DEMO_MOVEMENTS,
    DEMO_STORE_TRANSFERS,
  };
})(window);