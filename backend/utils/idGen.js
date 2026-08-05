/**
 * Grace Hotel — Human-readable ID Generator
 *
 * Requisition.reqNo is required+unique but nothing generates it — this
 * does, in the same "REQ-2025-00045" style your frontend demo data uses.
 *
 * NOTE: this counts existing docs for the year rather than using an
 * atomic counter, so it's not airtight under heavy concurrent writes
 * (two requests in the same instant could theoretically compute the
 * same seq). Fine for current volume; if that ever becomes a real risk,
 * swap this for an atomic findOneAndUpdate($inc) against the Config
 * model instead.
 */

const Requisition = require('../models/Requisition');

async function nextReqNo() {
  const year = new Date().getFullYear();
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const count = await Requisition.countDocuments({ dateRaised: { $gte: start } });
  const seq = String(count + 1).padStart(5, '0');
  return `REQ-${year}-${seq}`;
}

module.exports = { nextReqNo };