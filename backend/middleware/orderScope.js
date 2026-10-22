/**
 * orderScope — restricts open tabs (orders) to their owner.
 *
 * Every order records who opened it (`ownerId` + `createdBy`/`staff` name).
 * Floor staff must only ever see and touch their own tabs; managers,
 * supervisors and admins keep full oversight of the whole department.
 */

const STAFF_ONLY_ROLES = ['staff'];

function isOversight(user) {
  const role = String((user && user.role) || '').toLowerCase();
  if (role === 'admin' || role === 'manager' || role === 'supervisor') return true;
  // anything that isn't the ordinary staff role keeps full visibility so we
  // never lock a newly introduced role out of live orders
  return STAFF_ONLY_ROLES.indexOf(role) === -1;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ownOrdersFilter(req) → Mongo filter, or null when the user may list every order.
 */
function ownOrdersFilter(req) {
  const user = req && req.user;
  if (!user) return { _id: null };
  if (isOversight(user)) return null;

  const uid = String(user.id || '').trim();
  const name = String(user.name || '').trim();
  const or = [];
  if (uid) or.push({ ownerId: uid });
  if (name) {
    const re = new RegExp('^' + escapeRe(name) + '$', 'i');
    or.push({ createdBy: re });
    or.push({ staff: re });
  }
  if (!or.length) return null;
  return { $or: or };
}

/**
 * ownsOrder(req, order) → boolean.
 * Orders that recorded no owner at all (legacy rows) stay accessible so
 * nothing gets frozen; orders owned by somebody else are rejected.
 */
function ownsOrder(req, order) {
  const user = req && req.user;
  if (!user || !order) return false;
  if (isOversight(user)) return true;

  const uid = String(user.id || '').trim();
  if (order.ownerId && uid && String(order.ownerId) === uid) return true;

  const mine = [order.createdBy, order.staff]
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  const name = String(user.name || '').trim().toLowerCase();
  if (mine.length && name) return mine.indexOf(name) !== -1;

  // No owner recorded → legacy order, keep it reachable.
  if (!mine.length && !order.ownerId) return true;

  return false;
}

function denyOrderAccess(res) {
  return res.status(403).json({
    success: false,
    error: 'Access denied. This order belongs to another staff member.',
  });
}

module.exports = { ownOrdersFilter, ownsOrder, denyOrderAccess };
