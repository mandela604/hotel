const mongoose = require('mongoose');

/* RevokedToken — logged-out JWTs, kept in the database.
 *
 * Only the token hash is stored, never the token itself, and it carries its
 * own expiry so an entry deletes itself once the token it stands for would
 * have expired anyway. */
const revokedTokenSchema = new mongoose.Schema({
  h:   { type: String, required: true, unique: true },
  exp: { type: Number, required: true },
}, { timestamps: false, versionKey: false });

// TTL index on the token's own expiry: Mongo drops the entry when it expires.
revokedTokenSchema.index({ exp: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RevokedToken', revokedTokenSchema);
