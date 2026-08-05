/**
 * Grace Hotel — Rate Limiter
 * Uses express-rate-limit under the hood.
 */

const rateLimit = require('express-rate-limit');

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
  const max = options.max || parseInt(process.env.RATE_LIMIT_MAX) || 100;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  });
}

module.exports = { createRateLimiter };