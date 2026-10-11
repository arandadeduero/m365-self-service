/**
 * Main Server Application
 * 
 * Express server with Microsoft 365 authentication
 * and modern Bootstrap 5 design.
 */

// Tests bring their own environment (test/helpers/env.js) and must never
// read the developer's .env
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const blogRoutes = require('./routes/blog');
const accountRoutes = require('./routes/account');
const groupRequestRoutes = require('./routes/groupRequests');

// Import middleware
const { expiredSessionHandler, errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { refreshAccessToken, checkAdminStatus } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');
const { getServiceIssues } = require('./services/serviceHealthService');

// Create Express app
const app = express();

// Port configuration
const PORT = process.env.PORT || 3000;

// Behind a reverse proxy, TRUST_PROXY (usually 1, the number of proxies) lets
// Express see the real client address and protocol
if (process.env.TRUST_PROXY) {
  const trustProxy = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

// View engine setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware setup
// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(
  session({
    store: new FileStore({
      path: path.join(__dirname, 'sessions'),
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax', // CSRF protection
    },
  })
);

// Refuse requests that change something unless they carry the session's CSRF token
app.use(csrfProtection);

// Renew the access token of signed-in users before it expires
app.use(refreshAccessToken);

// Check admin status for all requests
app.use(checkAdminStatus);

// Tell signed-in users about open Microsoft 365 incidents on every page
app.use(async (req, res, next) => {
  const showsPage = req.method === 'GET' && req.session && req.session.accessToken;
  res.locals.serviceIssues = showsPage ? await getServiceIssues() : [];
  next();
});

// Log requests in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// Mount routes
app.use('/auth', authRoutes);
app.use('/', indexRoutes);
app.use('/', blogRoutes);
app.use('/', accountRoutes);
app.use('/', groupRequestRoutes);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Send users whose token was rejected by Microsoft Graph back to login
app.use(expiredSessionHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('=================================');
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log('=================================');
    
    // Warn if required environment variables are missing
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.TENANT_ID) {
      console.warn('⚠️  WARNING: Missing required environment variables!');
      console.warn('   Please copy .env.example to .env and fill in your Azure credentials.');
    }
    if (!process.env.TOKEN_SECRET) {
      console.warn('⚠️  WARNING: TOKEN_SECRET is not set, password reset will not work.');
    }
  });
}

// Export for testing
module.exports = app;
