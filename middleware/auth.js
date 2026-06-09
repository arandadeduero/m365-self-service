/**
 * Authentication Middleware
 * 
 * This middleware checks if a user is authenticated before allowing access to protected routes.
 * If not authenticated, it redirects to the login page.
 */

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
};
