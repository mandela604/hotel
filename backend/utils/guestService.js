const Guest = require('../models/Guest');

/**
 * Ensure a Guest directory record exists for this booking's contact info.
 * Never overwrites vip/notes (those are managed explicitly via the Guests
 * page) — only keeps name/email/idType/idNum reasonably fresh.
 */
async function ensureGuest({ guest, phone, email, idType, idNum }) {
  if (!phone) return null; // can't key a guest record without a phone number
  const update = {
    $set: {
      name: guest,
      ...(email ? { email } : {}),
      ...(idType ? { idType } : {}),
      ...(idNum ? { idNum } : {}),
    },
    $setOnInsert: { vip: false, notes: '' },
  };
  return Guest.findOneAndUpdate({ phone }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
}

module.exports = { ensureGuest };
