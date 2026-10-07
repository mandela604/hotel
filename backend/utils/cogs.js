'use strict';

/**
 * Auto-COGS kill switch.
 * When cost prices aren't tracked (cost defaults to selling price),
 * auto-posted COGS just mirrors income, so it stays OFF and daily
 * expenses are entered manually instead.
 * Set AUTO_COGS=true to re-enable once real unit costs exist.
 */
const AUTO_COGS = process.env.AUTO_COGS === 'true';

module.exports = { AUTO_COGS };
