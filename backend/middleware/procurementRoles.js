/**
 * middleware/procurementRoles.js — Stage-level approval roles for
 * procurementController.js.  Route-level access is now handled by
 * departmentGuard('Procurement') + privilegeGuard('procurement', action)
 * in routes/procurement.js.
 *
 * Four roles, matching what's actually in use: admin, manager,
 * procurement_officer, accountant. 'admin' can always act regardless of
 * this map — enforced in the controller, same rule roleGuard.js applies.
 */

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  PROCUREMENT_OFFICER: 'procurement_officer',
  ACCOUNTANT: 'accountant',
};

/**
 * Fine-grained gate used inside the controller: which role is allowed to
 * approve/reject a PR that is CURRENTLY SITTING at a given approvalStage.
 * (The action they take moves it to the NEXT stage — e.g. approving
 * while approvalStage:'pending' is "the Accountant approved", and pushes
 * it to 'accountant'.) 'admin' can always act regardless of this map —
 * enforced in the controller, same rule roleGuard.js already applies.
 */
const STAGE_APPROVER_ROLE = {
  pending: ROLES.ACCOUNTANT,   // Accountant approval -> moves to 'accountant'
  accountant: ROLES.MANAGER,   // Manager (old "GM") approval -> moves to 'gm'
  gm: ROLES.MANAGER,           // Manager decides: forward to admin, or finalize
  md: ROLES.ADMIN,             // Admin (old "MD") approval -> moves to 'approved'
};

module.exports = { ROLES, STAGE_APPROVER_ROLE };