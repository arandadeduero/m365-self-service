/**
 * Security Headers
 *
 * Set on every response. Everything the pages load is served by the app
 * itself (public/vendor), so the policy allows nothing from other servers.
 * Inline scripts and styles stay allowed because the views still carry
 * inline <script> blocks and onclick= attributes; moving those to /js would
 * let script-src drop 'unsafe-inline'.
 */

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // The profile photo is a data: URI, and so are Bootstrap's own icons
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  // Signing in is a redirect to Microsoft; listed in case a browser applies
  // form-action to the redirect that follows a form
  "form-action 'self' https://login.microsoftonline.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  // Only where HTTPS is certain: a browser that gets this over HTTP in
  // development would refuse plain http://localhost for a year
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
}

module.exports = { securityHeaders, CONTENT_SECURITY_POLICY };
