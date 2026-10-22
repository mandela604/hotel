/**
 * tokenRevoke — server-side revocation for logged-out sessions.
 *
 * The auth cookie is a stateless JWT, so clearing the cookie only ends the
 * session on that device. A copy of the token taken before logout would
 * still verify until it expired (7 days by default), which means "log out"
 * was not really ending the session everywhere it was used.
 *
 * This keeps a small in-memory list of revoked tokens so logging out kills
 * that token for good. Entries are pruned against the token's own `exp`, so
 * the list cannot grow without bound. A server restart empties it, which is
 * acceptable — by then the cookie on the device is already gone.
 */

const crypto = require('crypto');

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
 * revoke(token, expiresAt) — blacklist a token.
 * `expiresAt` is the token's own expiry (ms epoch); it defaults to 7 days
 * out, matching the default token lifetime.
 */
function revoke(token, expiresAt) {
  if (!token) return;
  prune();
  const exp = Number(expiresAt) || (Date.now() + 7 * 24 * 60 * 60 * 1000);
  revoked.set(hash(token), exp);
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

module.exports = { revoke, isRevoked };
