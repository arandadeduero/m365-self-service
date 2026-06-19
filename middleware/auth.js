/**
 * Authentication Middleware
 * 
 * This middleware checks if a user is authenticated before allowing access to protected routes.
 * If not authenticated, it redirects to the login page.
 */

const { isUserAdmin, getUserAdminRoles } = require('../services/graphService');
const permissions = require('../config/permissions');

/**
 * Middleware to check user permissions for routes/actions
 */
function checkPermission(req, res, next) {
  const userEmail = req.session.account?.username;
  if (!userEmail) {
      return res.status(403).send('Access Denied');
  }
  
  const [username, domain] = userEmail.split('@');
  
  if (domain !== permissions.DOMAIN) {
      console.warn(`Access denied: User domain ${domain} does not match required domain ${permissions.DOMAIN}`);
      return res.status(403).send('Access Denied');
  }
  
  const path = req.path;
  const method = req.method;

  // Check if route has defined permissions
  const routePermissions = permissions[path];

  if (Array.isArray(routePermissions)) {
    if (!routePermissions.includes(username)) {
      console.warn(`Access denied for user ${username} on ${method} ${path}`);
      return res.status(403).send('Access Denied');
    }
  }
  
  next();
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
  checkAdminStatus,
  checkPermission,
};
