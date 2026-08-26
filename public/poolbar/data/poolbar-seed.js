/**
 * data/poolbar-seed.js — Pool Bar module configuration
 *
 * Load order: this file, then services/poolbar-service.js.
 *
 * Every value services/poolbar-service.js and component/orders-workspace.js
 * treat as "no hardcoded default — must be configured" lives here. If a key
 * below is missing, the page fails loudly rather than quietly falling back
 * to a guessed value.
 */
(function (global) {
  'use strict';

  // Payment methods available at the Pool Bar — single source of truth.
  const PAYMENT_METHODS = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];

  // Which PAYMENT_METHODS value means "charge to the guest's room".
  const ROOM_CHARGE_METHOD = 'Room Charge';

  // Order/tab status vocabulary. orders-workspace.js draws its status
  // pills, table chips, and per-row action buttons entirely off this list.
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

  // The sales-record status that means "posted / complete".
  const COMPLETED_SALE_STATUS = 'completed';

  // Display currency.
  const CURRENCY = { symbol: '\u20A6', locale: 'en-NG' };

  // Path to dynamically load the Booking module service for room/guest
  // lookups in the UI picker. demoSeed is not needed in production.
  const BOOKING_MODULE_PATHS = {
    service: '../../booking/services/booking-service.js',
  };

  global.PoolBarSeed = {
    PAYMENT_METHODS,
    MONEY_RECEIVED_METHODS: ['Cash', 'POS', 'Transfer'],
    ROOM_CHARGE_METHOD,
    ORDER_STATUS_OPTIONS,
    COMPLETED_SALE_STATUS,
    CURRENCY,
    BOOKING_MODULE_PATHS,
  };
})(window);
