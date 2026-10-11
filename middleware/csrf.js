/**
 * CSRF Protection Middleware
 *
 * Synchronizer token: each session gets a random token, every form and
 * client-side request sends it back, and a request that changes something is
 * refused without it. Another site can make a signed-in browser send a
 * request, but it cannot read the token to include.
 */

const crypto = require('crypto');
const { userError } = require('./errorHandler');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// The body of a multipart form can only be read once the route's upload
// middleware has run, so these routes call verifyCsrfToken themselves after it
const MULTIPART_ROUTES = new Set(['/blog', '/profile/me/photo']);

function sessionToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function hasValidToken(req) {
  const expected = req.session && req.session.csrfToken;
  const received = (req.body && req.body._csrf) || req.get('x-csrf-token');

  if (!expected || typeof received !== 'string') {
    return false;
  }

  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && crypto.timingSafeEqual(expectedBytes, receivedBytes);
}

/**
 * Refuse the request unless it carries the session's token, in the `_csrf`
 * form field or the `X-CSRF-Token` header
 */
function verifyCsrfToken(req, res, next) {
  if (hasValidToken(req)) {
    return next();
  }
  next(userError(403, 'El formulario ha caducado. Vuelve a cargar la página e inténtalo de nuevo.'));
}

/**
 * Give views a csrfToken() helper and check every request that is not a read
 */
function csrfProtection(req, res, next) {
  // Created on first use, so pages without a form do not start a session
  res.locals.csrfToken = () => sessionToken(req);

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (MULTIPART_ROUTES.has(req.path) && req.is('multipart/form-data')) {
    return next();
  }

  verifyCsrfToken(req, res, next);
}

module.exports = { csrfProtection, verifyCsrfToken };
