/**
 * data/platform-settings-seed.js
 * ─────────────────────────────────────────────────────────────────────
 * Default values for platform-wide settings: payment methods, shift
 * config, department list. This is the ONE place these defaults live.
 * Every module (Accounting, Kitchen, Restaurant, Pool Bar, Store...)
 * that currently hardcodes its own copy of PAYMENT_METHODS or a shift
 * start hour should read from PlatformSettings (services/platform-
 * settings-service.js) instead, which seeds itself from here the first
 * time shared storage is empty — same pattern as accounting-seed.js.
 *
 *   <script src="data/platform-settings-seed.js"></script>
 *   <script src="services/platform-settings-service.js"></script>
 */
(function (global) {
  'use strict';

  const DEFAULT_PAYMENT_METHODS = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];

  // Hour of day (0–23) a business "shift day" rolls over at — e.g. 9
  // means a sale at 8:59 AM still counts as belonging to yesterday's
  // shift. Used across Accounting for shift keys/reconciliation.
  const DEFAULT_SHIFT_START_HOUR = 9;

  const DEFAULT_DEPARTMENTS = ['Rooms', 'Restaurant', 'Pool Bar', 'Kitchen'];

  const DEFAULT_SETTINGS = {
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    shiftStartHour: DEFAULT_SHIFT_START_HOUR,
    departments: DEFAULT_DEPARTMENTS,
  };

  global.PlatformSettingsSeed = {
    DEFAULT_PAYMENT_METHODS,
    DEFAULT_SHIFT_START_HOUR,
    DEFAULT_DEPARTMENTS,
    DEFAULT_SETTINGS,
  };
})(window);