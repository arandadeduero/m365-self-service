/**
 * Error Handler Middleware
 * 
 * This middleware handles all errors in the application.
 * It provides detailed error information in development mode,
 * and simple, user-friendly messages in production mode.
 * Errors marked with `expose` carry a message written for the user,
 * which is shown in both modes.
 */

/**
 * Build an error whose message is written for the user, so it is shown in
 * production too
 */
function userError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

/**
 * Sends the user back to login when Microsoft Graph rejected their token
 * (revoked, or expired without the possibility of renewing it)
 */
function expiredSessionHandler(err, req, res, next) {
  if (err.graphStatus !== 401 || !req.session || !req.session.accessToken) {
    return next(err);
  }

  console.warn('Microsoft Graph rejected the access token, signing the user out');
  req.session.regenerate(() => res.redirect('/login'));
}

/**
 * Error handler middleware
 * Differentiates between development and production environments
 */
function errorHandler(err, req, res, next) {
  // Determine if we're in development or production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Log the error to console (always log errors)
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Ha ocurrido un error inesperado';

  // Always show the nice error page
  res.status(statusCode).render('error', {
    title: `Error ${statusCode}`,
    statusCode: statusCode,
    message: isDevelopment || err.expose ? message : 'Lo sentimos, ha ocurrido un error. Por favor, intenta de nuevo más tarde.',
  });
}

/**
 * 404 Not Found handler
 * This should be the last route handler
 */
function notFoundHandler(req, res, next) {
  const err = new Error('Page Not Found');
  err.status = 404;
  next(err);
}

module.exports = {
  userError,
  expiredSessionHandler,
  errorHandler,
  notFoundHandler,
};
