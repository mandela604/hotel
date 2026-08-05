/**
 * Recursively sanitizes req.body / req.query / req.params:
 * - Strips Mongo operator keys ($gt, $where, etc.) and dots from object
 *   keys, so a crafted payload like { "$where": "..." } or
 *   { "guest.$ne": null } can't reach a Mongoose query unexpectedly.
 * - Trims strings and strips angle brackets, closing off the simplest
 *   HTML/script-injection vector for any field that gets rendered
 *   back into the frontend's innerHTML (guest names, notes, etc.)
 * - Caps string length defensively (10k chars) so a huge payload can't
 *   be used to bloat storage or hang a regex.
 */
const MAX_STRING_LEN = 10000;

function stripKey(key) {
  return String(key).replace(/^\$+/, '').replace(/\./g, '_');
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value;
    const out = {};
    for (const key of Object.keys(value)) {
      out[stripKey(key)] = sanitizeValue(value[key]);
    }
    return out;
  }
  if (typeof value === 'string') {
    let s = value.trim().replace(/[<>]/g, '');
    if (s.length > MAX_STRING_LEN) s = s.slice(0, MAX_STRING_LEN);
    return s;
  }
  return value;
}

module.exports = function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.query && typeof req.query === 'object') req.query = sanitizeValue(req.query);
  if (req.params && typeof req.params === 'object') req.params = sanitizeValue(req.params);
  next();
};