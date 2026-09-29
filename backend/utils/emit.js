'use strict';

/**
 * utils/emit.js — central helper for Socket.IO live updates.
 * Usage from any controller:  emit(req, depts, event, payload)
 *   - req: the Express req (to get req.app.get('io'))
 *   - depts: string | string[]  (e.g. 'booking' or ['store','kitchen'])
 *   - event: string  (e.g. 'booking:updated', 'store:requisition')
 *   - payload: any  (will be JSON-serialized)
 *
 * Emits to each dept room + 'global' so LiveService onAny + dept listeners fire.
 * Silently no-ops if io not yet initialized (e.g. during tests / startup).
 */
function emit(req, depts, event, payload) {
  try {
    const io = req && req.app && typeof req.app.get === 'function' ? req.app.get('io') : null;
    if (!io || !event) return;
    const rooms = (Array.isArray(depts) ? depts : [depts]).filter(Boolean);
    // always also notify global listeners
    if (!rooms.includes('global')) rooms.push('global');
    for (const room of rooms) {
      io.to(room).emit(event, payload || {});
    }
  } catch (e) {
    // never block the request on a failed emit
  }
}

module.exports = { emit };
