/**
 * Error Handler Middleware
 * 
 * This middleware handles all errors in the application.
 * It provides detailed error information in development mode,
 * and simple, user-friendly messages in production mode.
 */

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

  if (isDevelopment) {
    // DEVELOPMENT MODE: Show detailed error information
    res.status(statusCode).render('error-dev', {
      title: 'Error',
      error: {
        message: err.message,
        status: statusCode,
        stack: err.stack,
        details: err.details || {},
        timestamp: new Date().toISOString(),
        url: req.originalUrl,
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query,
        params: req.params,
        session: req.session ? {
          hasAccessToken: !!req.session.accessToken,
          hasAccount: !!req.session.account,
        } : null,
      },
    });
  } else {
    // PRODUCTION MODE: Show simple, user-friendly error message
    res.status(statusCode).render('error-prod', {
      title: 'Error',
      statusCode: statusCode,
    });
  }
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
  errorHandler,
  notFoundHandler,
};
