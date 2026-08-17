/**
 * data/restaurant-seed.js — Restaurant module demo seed only
 * Exposes window.RestaurantSeed
 * Load BEFORE services/restaurant-service.js
 */
(function (global) {
  'use strict';

  const pad2 = (n) => String(n).padStart(2, '0');
  const d = (n) => {
    const x = new Date(Date.now() + n * 86400000);
    return `${pad2(x.getDate())}/${pad2(x.getMonth() + 1)}/${String(x.getFullYear()).slice(-2)}`;
  };
  const stamp = (n, h, m, ap) => `${d(n)} ${pad2(h)}:${pad2(m)} ${ap}`;

  // Catalog + on-hand qty (qty only rises via accepted store transfer / requisition)
  const DEMO_STOCK = [
    { name: 'Jollof Rice', category: 'Mains', unit: 'portion', qty: 42, min: 15, price: 3500, batch: 'RST-104', received: d(0), desc: 'Party jollof' },
    { name: 'Fried Rice', category: 'Mains', unit: 'portion', qty: 28, min: 12, price: 3500, batch: 'RST-104', received: d(0), desc: '' },
    { name: 'Pepper Soup (Goat)', category: 'Soups', unit: 'bowl', qty: 18, min: 8, price: 4500, batch: 'RST-103', received: d(-1), desc: '' },
    { name: 'Grilled Chicken', category: 'Mains', unit: 'portion', qty: 22, min: 10, price: 5500, batch: 'RST-104', received: d(0), desc: 'Half chicken' },
    { name: 'Catfish Pepper Soup', category: 'Soups', unit: 'bowl', qty: 6, min: 8, price: 5000, batch: 'RST-102', received: d(-2), desc: 'Low stock' },
    { name: 'Chapman', category: 'Drinks', unit: 'glass', qty: 55, min: 20, price: 2500, batch: 'RST-101', received: d(-1), desc: '' },
    { name: 'Fresh Orange Juice', category: 'Drinks', unit: 'glass', qty: 30, min: 15, price: 2000, batch: 'RST-104', received: d(0), desc: '' },
    { name: 'Bottled Water', category: 'Drinks', unit: 'bottle', qty: 80, min: 24, price: 500, batch: 'RST-100', received: d(-3), desc: '' },
    { name: 'Plantain (Side)', category: 'Sides', unit: 'portion', qty: 35, min: 12, price: 1500, batch: 'RST-104', received: d(0), desc: '' },
    { name: 'Asun', category: 'Starters', unit: 'portion', qty: 14, min: 8, price: 4000, batch: 'RST-103', received: d(-1), desc: '' },
    { name: 'Chocolate Fondant', category: 'Desserts', unit: 'portion', qty: 9, min: 6, price: 3200, batch: 'RST-103', received: d(-1), desc: '' },
    { name: 'Prawn Cocktail', category: 'Starters', unit: 'portion', qty: 0, min: 5, price: 4500, batch: '—', received: '—', desc: 'Out of stock' },
  ];

  const DEMO_SALES = [
    {
      id: 'RST-1001',
      items: [
        { name: 'Jollof Rice', qty: 2, price: 3500 },
        { name: 'Grilled Chicken', qty: 1, price: 5500 },
        { name: 'Chapman', qty: 2, price: 2500 },
      ],
      subtotal: 17500, discount: 0, total: 17500,
      method: 'POS', staff: 'Tunde A.', table: 'T-04', notes: '',
      date: stamp(0, 1, 15, 'PM'), status: 'completed', source: 'quick',
    },
    {
      id: 'RST-1002',
      items: [
        { name: 'Pepper Soup (Goat)', qty: 2, price: 4500 },
        { name: 'Bottled Water', qty: 2, price: 500 },
      ],
      subtotal: 10000, discount: 5, total: 9500,
      method: 'Cash', staff: 'Amaka O.', table: 'T-12', notes: 'VIP table',
      date: stamp(0, 12, 40, 'PM'), status: 'completed', source: 'tab',
    },
    {
      id: 'RST-1003',
      items: [{ name: 'Fried Rice', qty: 3, price: 3500 }],
      subtotal: 10500, discount: 0, total: 10500,
      method: 'Transfer', staff: 'Tunde A.', table: 'T-07', notes: '',
      date: stamp(-1, 7, 20, 'PM'), status: 'voided', source: 'quick',
      voidReason: 'Wrong order', voidDate: stamp(-1, 7, 35, 'PM'), voidedBy: 'Manager',
    },
  ];

  const DEMO_ORDERS = [
    {
      id: 'RSO-001',
      items: [
        { name: 'Jollof Rice', qty: 4, price: 3500 },
        { name: 'Plantain (Side)', qty: 4, price: 1500 },
        { name: 'Fresh Orange Juice', qty: 4, price: 2000 },
      ],
      subtotal: 28000, discount: 0, total: 28000,
      staff: 'Amaka O.', table: 'T-02', notes: 'Corporate lunch',
      date: stamp(0, 11, 5, 'AM'), status: 'open', source: 'tab',
    },
    {
      id: 'RSO-002',
      items: [
        { name: 'Asun', qty: 2, price: 4000 },
        { name: 'Chapman', qty: 2, price: 2500 },
      ],
      subtotal: 13000, discount: 0, total: 13000,
      staff: 'Tunde A.', table: 'T-09', notes: '',
      date: stamp(0, 12, 10, 'PM'), status: 'served', source: 'tab',
    },
  ];

  // Store → Restaurant pending pushes (accept/reject on transfer history page)
  const DEMO_PENDING = [
    {
      no: 'TR-2401', batchNo: 'B-881',
      source: 'store', from: 'Main Store', restaurant: 'Main Restaurant',
      sentBy: 'Chidi K.', date: stamp(0, 9, 10, 'AM'),
      status: 'pending', remarks: 'Weekly dry + perishables',
      items: [
        { name: 'Jollof Rice', qty: 20, unit: 'portion' },
        { name: 'Bottled Water', qty: 48, unit: 'bottle' },
        { name: 'Plantain (Side)', qty: 15, unit: 'portion' },
      ],
    },
    {
      no: 'TR-2402', batchNo: 'B-882',
      source: 'store', from: 'Main Store', restaurant: 'Main Restaurant',
      sentBy: 'Chidi K.', date: stamp(0, 10, 45, 'AM'),
      status: 'pending', remarks: 'Restock soups',
      items: [
        { name: 'Pepper Soup (Goat)', qty: 12, unit: 'bowl' },
        { name: 'Catfish Pepper Soup', qty: 10, unit: 'bowl' },
      ],
    },
  ];

  // Accepted / rejected history (same shape + action fields)
  const DEMO_HISTORY = [
    {
      no: 'TR-2398', batchNo: 'B-870',
      source: 'store', from: 'Main Store', restaurant: 'Main Restaurant',
      sentBy: 'Chidi K.', date: stamp(-2, 8, 30, 'AM'),
      status: 'accepted', remarks: '',
      receivedBy: 'Amaka O.', actionRemarks: 'All items verified', actionDate: stamp(-2, 9, 5, 'AM'),
      items: [
        { name: 'Grilled Chicken', qty: 15, unit: 'portion' },
        { name: 'Chapman', qty: 24, unit: 'glass' },
      ],
    },
    {
      no: 'TR-2395', batchNo: 'B-865',
      source: 'store', from: 'Main Store', restaurant: 'Main Restaurant',
      sentBy: 'Chidi K.', date: stamp(-4, 2, 15, 'PM'),
      status: 'rejected', remarks: 'Wrong items',
      receivedBy: '', actionRemarks: 'Batch labelled for Pool Bar', actionDate: stamp(-4, 2, 40, 'PM'),
      items: [{ name: 'Moët & Chandon', qty: 6, unit: 'bottle' }],
    },
  ];

  const DEMO_MOVEMENTS = [
    { date: stamp(0, 1, 15, 'PM'), item: 'Jollof Rice', qtyIn: 0, qtyOut: 2, balance: 42, reason: 'Sale (RST-1001)' },
    { date: stamp(0, 1, 15, 'PM'), item: 'Grilled Chicken', qtyIn: 0, qtyOut: 1, balance: 22, reason: 'Sale (RST-1001)' },
    { date: stamp(0, 12, 40, 'PM'), item: 'Pepper Soup (Goat)', qtyIn: 0, qtyOut: 2, balance: 18, reason: 'Tab Payment (RSO-000)' },
    { date: stamp(-2, 9, 5, 'AM'), item: 'Grilled Chicken', qtyIn: 15, qtyOut: 0, balance: 37, reason: 'Store Transfer (TR-2398)' },
  ];

  // Optional: transfers raised *from* restaurant (counter shape)
  const DEMO_TRANSFER_COUNT = [{ date: d(0), count: 1 }];

  global.RestaurantSeed = {
    DEMO_STOCK,
    DEMO_SALES,
    DEMO_ORDERS,
    DEMO_PENDING,
    DEMO_HISTORY,
    DEMO_MOVEMENTS,
    DEMO_TRANSFER_COUNT,
  };
})(window);