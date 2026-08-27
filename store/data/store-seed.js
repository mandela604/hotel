/**
 * data/store-seed.js — Demo stock-on-hand + starter requisitions for the
 * Store module. Loaded once by StoreService; after that everything lives
 * in shared storage (req:<no>, req-index, counter:<prefix>, store-stock)
 * so edits persist across sessions and pages.
 *
 * Item catalog (for the item-name picker on New Request) is derived from
 * DEMO_STOCK by StoreService unless a separate DEMO_CATALOG is supplied
 * here — kept as one list so a new stock item automatically becomes
 * pickable without maintaining two lists.
 */
(function (global) {
  'use strict';

  const DEMO_STOCK = [
    { name: 'Rice (Long Grain)', unit: 'kg', qty: 35, cost: 950, min: 10 },
    { name: 'Palm Oil', unit: 'Ltr', qty: 4, cost: 2200, min: 8 },
    { name: 'Chicken (Frozen)', unit: 'kg', qty: 20, cost: 2600, min: 10 },
    { name: 'Tomatoes', unit: 'kg', qty: 15, cost: 600, min: 10 },
    { name: 'Onions', unit: 'kg', qty: 20, cost: 500, min: 10 },
    { name: 'Star Lager', unit: 'Bottles', qty: 240, cost: 700, min: 48 },
    { name: 'Heineken', unit: 'Bottles', qty: 180, cost: 900, min: 48 },
    { name: 'Hennessy VS', unit: 'Bottles', qty: 6, cost: 65000, min: 3 },
    { name: 'Bottled Water 1.5L', unit: 'Cartons', qty: 60, cost: 2400, min: 15 },
    { name: 'Ice Cream Tubs', unit: 'Pieces', qty: 12, cost: 3500, min: 5 },
    { name: 'Bleach 5L', unit: 'Ltr', qty: 18, cost: 3200, min: 5 },
    { name: 'Floor Cleaner 5L', unit: 'Ltr', qty: 9, cost: 3600, min: 5 },
    { name: 'Industrial Detergent 10kg', unit: 'Bags', qty: 5, cost: 12000, min: 3 },
    { name: 'Glass Cleaner 1L', unit: 'Ltr', qty: 14, cost: 1500, min: 5 },
    { name: 'King Duvet Set', unit: 'Pieces', qty: 22, cost: 18000, min: 8 },
    { name: 'Pillow Cases (pair)', unit: 'Pieces', qty: 40, cost: 4500, min: 15 },
    { name: 'Guest Shampoo 250ml', unit: 'Pieces', qty: 300, cost: 350, min: 50 },
    { name: 'Commercial Dishwasher', unit: 'Pieces', qty: 1, cost: 850000, min: 1 },
    { name: 'POS Terminal', unit: 'Pieces', qty: 2, cost: 120000, min: 1 },
    { name: 'Branded Envelopes', unit: 'Packs', qty: 8, cost: 4000, min: 3 },
  ];

  const todayISO = new Date().toISOString().split('T')[0];
  const todayDisplay = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const in2Days = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  const DEMO_REQUESTS = [
    {
      no: 'KREQ-2025-00046',
      mode: 'store_issue',
      by: 'Chidi Okafor',
      dept: 'Kitchen',
      needed: in2Days,
      priority: 'Urgent',
      remark: 'Weekend banquet prep — expecting 80 covers Saturday.',
      fulfillStore: 'Central Store',
      supplier: null,
      linked: null,
      items: [
        { name: 'Rice (Long Grain)', unit: 'kg', qty: 25, cost: 950, remark: '', issuedQty: 0 },
        { name: 'Chicken (Frozen)', unit: 'kg', qty: 15, cost: 2600, remark: '', issuedQty: 0 },
        { name: 'Tomatoes', unit: 'kg', qty: 10, cost: 600, remark: '', issuedQty: 0 },
        { name: 'Onions', unit: 'kg', qty: 10, cost: 500, remark: '', issuedQty: 0 },
      ],
      status: 'Pending',
      dateRaised: todayISO,
      dateRaisedDisplay: todayDisplay,
    },
    {
      no: 'PR-2025-00047',
      mode: 'purchase',
      by: 'Amaka Bello',
      dept: 'Store',
      needed: in2Days,
      priority: 'Normal',
      remark: 'Palm oil running low — restock before next kitchen cycle.',
      fulfillStore: null,
      supplier: 'Zenith Foods Ltd.',
      linked: null,
      items: [
        { name: 'Palm Oil', unit: 'Ltr', qty: 40, cost: 2200, remark: '', issuedQty: 0 },
      ],
      status: 'Pending',
      dateRaised: todayISO,
      dateRaisedDisplay: todayDisplay,
    },
  ];

  global.StoreSeed = { DEMO_STOCK, DEMO_REQUESTS };
})(window);