/**
 * Authentication Middleware
 * 
 * This middleware checks if a user is authenticated before allowing access to protected routes.
 * If not authenticated, it redirects to the login page.
 */

const { getUserAdminRoles } = require('../services/graphService');
const { needsRenewal, renewSession } = require('../services/tokenService');
const { auditRequest } = require('../services/auditService');
const permissions = require('../config/permissions');

/**
 * Build the middleware that guards one route with its list in
 * config/permissions.js. The key is fixed here and never taken from the URL:
 * Express sends /Blog and /blog/ to the same handler as /blog, so a lookup by
 * req.path would find no list for them and let anybody through. A key with
 * no list lets nobody in.
 * @param {string} routeKey - Key in config/permissions.js, e.g. '/blog'
 */
function checkPermission(routeKey) {
  return function (req, res, next) {
    const { path, method } = req;
    const userEmail = req.session.account?.username;
    if (!userEmail) {
      return res.status(403).send('Access Denied');
    }

    const [username, domain] = userEmail.split('@');

    if (domain !== permissions.DOMAIN) {
      console.warn(`Access denied: User domain ${domain} does not match required domain ${permissions.DOMAIN}`);
      auditRequest(req, 'permission.denied', { path, method });
      return res.status(403).send('Access Denied');
    }

    const allowed = permissions[routeKey];
    if (!Array.isArray(allowed) || !allowed.includes(username)) {
      console.warn(`Access denied for user ${username} on ${method} ${path.replace(/[\r\n]/g, '')} (${routeKey})`);
      auditRequest(req, 'permission.denied', { path, method });
      return res.status(403).send('Access Denied');
    }

    next();
  };
}

/**
 * Middleware to keep the access token of signed-in users valid.
 * Renews it shortly before it expires; if that is not possible the session
 * is emptied, so the user is asked to sign in again.
 */
async function refreshAccessToken(req, res, next) {
  if (!req.session || !req.session.accessToken || !needsRenewal(req.session)) {
    return next();
  }

  try {
    await renewSession(req.session);
    next();
  } catch (error) {
    console.warn('Could not renew the access token, signing the user out:', error.message);
    req.session.regenerate(() => next());
  }
}

/**
 * Middleware to check if user is an admin
 */
async function checkAdminStatus(req, res, next) {
  if (req.session && req.session.accessToken) {
    try {
      const adminRoles = await getUserAdminRoles(req.session.accessToken);
      res.locals.isAdmin = adminRoles.length > 0;
      res.locals.adminRoles = adminRoles;
    } catch (error) {
      console.error('Error checking admin status:', error);
      res.locals.isAdmin = false;
      res.locals.adminRoles = [];
    }
  } else {
    res.locals.isAdmin = false;
    res.locals.adminRoles = [];
  }
  next();
}

/**
 * Check if user is authenticated
 * Looks for access token in session
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.accessToken) {
    // User is authenticated
    return next();
  }

  // User is not authenticated - redirect to login
  res.redirect('/login');
}

/**
 * Check if user is already authenticated (for login page)
 * If authenticated, redirect to home page
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.accessToken) {
    // User is already authenticated - redirect to home
    return res.redirect('/');
  }

  // User is not authenticated - continue to login page
  next();
}

module.exports = {
  isAuthenticated,
  redirectIfAuthenticated,
  refreshAccessToken,
  checkAdminStatus,
  checkPermission,
};
