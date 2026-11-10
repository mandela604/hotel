const mongoose = require('mongoose');

/* AuditLog — full, immutable trail for every booking action.
 *
 * createdBy: who created it originally (never changes after creation).
 * recordedBy / updatedBy / deletedBy: who submitted each write operation.
 * We log every booking write with the session author at that instant,
 * plus the original author when available. Disputes can be resolved from
 * this table even if someone else's account was logged in on the tablet.
 */
const auditLogSchema = new mongoose.Schema({
  bookingId: { type: String, required: true }, // room number or stayId
  action:    { type: String, enum: ['create', 'update', 'delete', 'checkin', 'checkout', 'transfer', 'addPayment', 'cancelRefund', 'noShow', 'conflict'], required: true },
  createdAt: { type: Number, default: Date.now },
  createdBy: { type: String, default: '' },   // original author from server side when available
  recordedBy:{ type: String, default: '' },   // whoever wrote the document (submitter)
  updatedBy: { type: String, null: true },    // alias for recordedBy on update
  deletedBy: { type: String, null: true },    // same on delete
  by:        { type: String, default: '' },   // short name used in activity toast
  meta:      { type: mongoose.Schema.Types.Mixed, default: {} }, // optional details (room change, payment amounts, etc.)
}, { timestamps: false });

auditLogSchema.index({ bookingId: 1, createdAt: -1 });
auditLogSchema.index({ recordedBy: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
