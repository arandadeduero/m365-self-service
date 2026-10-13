/**
 * Security Headers
 *
 * Set on every response. Everything the pages load is served by the app
 * itself (public/vendor), so the policy allows nothing from other servers
 * (except the organization's own signature generator, framed in /firma),
 * and scripts only run from files under public/js: no inline <script> and no
 * onclick= attributes (test/routes.test.js checks the views). Inline styles
 * stay allowed because the org chart draws its cards with them.
 */

const appConfig = require('../config/appConfig');

// The one page shown inside the portal: the organization's signature generator
const generatorOrigin = (() => {
  try {
    return appConfig.SIGNATURE_GENERATOR_URL ? new URL(appConfig.SIGNATURE_GENERATOR_URL).origin : null;
  } catch (error) {
    return null;
  }
})();

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // The profile photo is a data: URI, and so are Bootstrap's own icons
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  // Signing in is a redirect to Microsoft; listed in case a browser applies
  // form-action to the redirect that follows a form
  "form-action 'self' https://login.microsoftonline.com",
  `frame-src ${generatorOrigin || "'none'"}`,
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

module.exports = { securityHeaders };
