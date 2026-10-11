/**
 * Rate Limit Middleware
 *
 * Limits how often one client (IP address) can use the public password reset
 * pages. Counters are kept in memory, per process.
 */

const { rateLimit } = require('express-rate-limit');
const { userError } = require('./errorHandler');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Reset links one client can request per window
const REQUEST_LIMIT = Number(process.env.RESET_RATE_LIMIT) || 5;

function tooManyRequests(req, res, next) {
  next(userError(429, 'Demasiados intentos. Inténtalo de nuevo más tarde.'));
}

/**
 * Limit for asking for a reset link (each one sends an email)
 */
const resetRequestLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: REQUEST_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests,
});

/**
 * Limit for opening a reset link and submitting a new password
 */
const resetLinkLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: REQUEST_LIMIT * 4,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests,
});

module.exports = { resetRequestLimiter, resetLinkLimiter };
