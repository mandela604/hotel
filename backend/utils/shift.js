'use strict';

/**
 * Shared shift-window math (single source of truth, mirrors
 * public/accounting/services/accounting-service.js).
 *
 * A business "shift day" runs [startHour, endHour). When endHour is less
 * than or equal to startHour the window runs overnight into the next day
 * (e.g. 9 -> 8 means 9:00 AM to 8:00 AM next day). endHour equal to
 * startHour means a full 24 hours.
 *
 * Anything outside a window (only possible when endHour > startHour,
 * e.g. 9 -> 20 leaves 20:00-09:00 open) attaches to the most recently
 * ended window — night hours count toward the previous business day.
 */

function lagosParts(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }).format(dt), 10);
  const date = dt.toLocaleDateString('sv-SE', { timeZone: 'Africa/Lagos' });
  return { hour, date };
}

function windowLen(start, end) {
  const s = Number(start) || 0;
  const e = (typeof end === 'number' ? end : s);
  return (((e - s) % 24) + 24) % 24 || 24;
}

// Lagos 'YYYY-MM-DD' of the shift start-day containing dt.
function shiftKeyFor(dt, start, end) {
  const d = new Date(dt);
  if (isNaN(d.getTime())) return null;
  const s = Number(start) || 0;
  const e = (typeof end === 'number' ? end : s);
  const h = lagosParts(d).hour;
  const inWindow = (e <= s) ? (h >= s || h < e) : (h >= s && h < e);
  if (inWindow) {
    if (e <= s && h < e) {
      return lagosParts(new Date(d.getTime() - 86400000)).date;
    }
    return lagosParts(d).date;
  }
  if (h < s) {
    return lagosParts(new Date(d.getTime() - 86400000)).date;
  }
  return lagosParts(d).date;
}

// [start, end) Date bounds (Lagos wall time) of the shift containing `at`.
function shiftRange(at, start, end) {
  const base = new Date(at instanceof Date ? at.getTime() : Date.now());
  const key = shiftKeyFor(base, start, end);
  const s = Number(start) || 0;
  const len = windowLen(start, end);
  const shiftStart = new Date(key + `T${String(s).padStart(2, '0')}:00:00+01:00`);
  const shiftEnd = new Date(shiftStart.getTime() + len * 3600000 - 1);
  return { shiftStart, shiftEnd, shiftDateStr: key };
}

async function shiftHoursFromConfig() {
  let start = 9, end = 8;
  try {
    const Config = require('../models/Config');
    const cfg = await Config.findOne().sort({ createdAt: -1 });
    if (cfg && typeof cfg.shiftStartHour === 'number') start = cfg.shiftStartHour;
    if (cfg && typeof cfg.shiftEndHour === 'number') end = cfg.shiftEndHour;
  } catch (e) {}
  return { start, end };
}

module.exports = { lagosParts, windowLen, shiftKeyFor, shiftRange, shiftHoursFromConfig };
