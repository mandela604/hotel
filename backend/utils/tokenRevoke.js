/**
 * tokenRevoke — server-side revocation for logged-out sessions.
 *
 * The auth cookie is a stateless JWT, so clearing the cookie only ends the
 * session on that device. A copy of the token taken before logout would
 * still verify until it expired (7 days by default), which means "log out"
 * was not really ending the session everywhere it was used.
 *
 * The hot path (isRevoked, called on every authenticated request) is a
 * synchronous in-memory Map so no request pays for a database round-trip.
 * Mongo holds the same set: the Map alone was emptied by every restart, which
 * silently brought back to life every token logged out since the last deploy.
 */

const crypto = require('crypto');
const RevokedToken = require('../models/RevokedToken');

// sha256(token) -> expiry (ms epoch)
const revoked = new Map();

function hash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function prune(now) {
  const t = now || Date.now();
  for (const [key, exp] of revoked) {
    if (exp <= t) revoked.delete(key);
  }
}

/**
 * hydrate() — reload still-valid revocations once the database is open.
 * Never awaited by boot: an unreachable collection must not stop the server,
 * and the consequence (a revived token) is logged loudly instead.
 */
async function hydrate() {
  try {
    await RevokedToken.syncIndexes();
    const docs = await RevokedToken.find({ exp: { $gt: Date.now() } }).lean();
    for (const d of docs) revoked.set(d.h, d.exp);
    console.log(`[tokenRevoke] ${docs.length} revoked token(s) loaded - logged-out sessions stay dead across restarts`);
    return docs.length;
  } catch (err) {
    console.error('[tokenRevoke] hydrate FAILED - tokens logged out before a restart would verify again:', err.message);
    return -1;
  }
}

/**
 * revoke(token, expiresAt) — blacklist a token.
 * `expiresAt` is the token's own expiry (ms epoch); it defaults to 7 days
 * out, matching the default token lifetime.
 */
function revoke(token, expiresAt) {
  if (!token) return;
  prune();
  const exp = Number(expiresAt) || (Date.now() + 7 * 24 * 60 * 60 * 1000);
  const h = hash(token);
  revoked.set(h, exp);
  // Write-through, fire-and-forget: the request that logged out must not
  // wait on Mongo, and the in-memory entry already blocks this process.
  RevokedToken.updateOne({ h }, { $set: { h, exp } }, { upsert: true })
    .catch((err) => console.error('[tokenRevoke] persist FAILED for one token:', err.message));
}

/**
 * isRevoked(token) — true when the token was logged out.
 */
function isRevoked(token) {
  if (!token) return false;
  const key = hash(token);
  const exp = revoked.get(key);
  if (exp == null) return false;
  if (exp <= Date.now()) {
    revoked.delete(key);
    return false;
  }
  return true;
}

module.exports = { revoke, isRevoked, hydrate };
