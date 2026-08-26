/**
 * accounting-seed.js — Configuration constants only. Demo data removed for production.
 * Pages import: DEPARTMENTS, DEPT_COLOR, VARIANCE_TOLERANCE, INCOME_DEPARTMENTS, EXPENSE_CATEGORIES
 */
(function (global) {
  'use strict';

  const DEPARTMENTS = ['Rooms', 'Restaurant', 'Pool Bar'];
  const DEPT_COLOR = { Rooms: 'var(--purple)', Restaurant: 'var(--green)', 'Pool Bar': 'var(--amber)' };
  const VARIANCE_TOLERANCE = 500;
  const INCOME_DEPARTMENTS = ['Rooms & Bookings', 'Restaurant', 'Pool Bar', 'Kitchen / Banquets', 'Other Income'];
  const EXPENSE_CATEGORIES = ['Salaries & Wages', 'Utilities', 'Maintenance & Repairs', 'Marketing & Advertising', 'Supplies & Inventory', 'Insurance', 'Transport & Logistics', 'Miscellaneous'];

  global.AccountingSeed = {
    DEPARTMENTS,
    DEPT_COLOR,
    VARIANCE_TOLERANCE,
    INCOME_DEPARTMENTS,
    EXPENSE_CATEGORIES,
  };

})(window);
