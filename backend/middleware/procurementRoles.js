/**
 * middleware/procurementRoles.js — the ONLY place procurement role names
 * are spelled out. Routes and the controller both import from here, so
 * renaming/adding/removing a role means changing it in exactly one spot.
 *
 * Four roles, matching what's actually in use: admin, manager,
 * procurement_officer, accountant. There is no separate 'gm' or 'md'
 * role — those were the old approval-stage KEYS (still are, unchanged,
 * since po-form.html / procurement-dashboard.html / the PurchaseRequest
 * schema enum all key off them), but the PERSON performing that stage's
 * approval is just 'manager' (covers the old GM step) or 'admin' (covers
 * the old MD step). roleGuard.js already treats 'admin' as an automatic
 * pass on every check, so admin never needs to be listed explicitly.
 */

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  PROCUREMENT_OFFICER: 'procurement_officer',
  ACCOUNTANT: 'accountant',
};

// Coarse route-level gates (used with roleGuard(...)).
const CAN_MANAGE_PR = [ROLES.ADMIN, ROLES.MANAGER, ROLES.PROCUREMENT_OFFICER];
const CAN_APPROVE = [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT];

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

module.exports = { ROLES, CAN_MANAGE_PR, CAN_APPROVE, STAGE_APPROVER_ROLE };