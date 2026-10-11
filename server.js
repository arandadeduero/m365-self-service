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
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');

// Import routes
const appConfig = require('./config/appConfig');
const permissions = require('./config/permissions');
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const blogRoutes = require('./routes/blog');
const accountRoutes = require('./routes/account');
const groupRequestRoutes = require('./routes/groupRequests');
const adminRoutes = require('./routes/admin');
const ownedGroupRoutes = require('./routes/ownedGroups');
const helpRoutes = require('./routes/help');
const roomRoutes = require('./routes/rooms');
const directoryRoutes = require('./routes/directory');
const signatureRoutes = require('./routes/signature');
const activityRoutes = require('./routes/activity');

// Import middleware
const { expiredSessionHandler, errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { refreshAccessToken, checkAdminStatus } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');
const { securityHeaders } = require('./middleware/securityHeaders');
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

// Names and links every page uses
app.locals.appName = appConfig.APP_NAME;
app.locals.orgName = appConfig.ORG_NAME;
app.locals.intranetUrl = appConfig.INTRANET_URL;

// The session cookie is signed with this. Without it the app must not run
// in production; elsewhere a secret for this process only keeps a known
// value out of the code, at the cost of sessions ending on restart
if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set. Add it to the environment before starting in production.');
  }
  console.warn('SESSION_SECRET is not set: using a secret for this process only, so sessions end when it restarts');
}
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Middleware setup
app.use(securityHeaders);

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
    secret: sessionSecret,
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

// What the menu needs: who is signed in, which entries apply to them, and
// the path, to mark the current page
app.use((req, res, next) => {
  const account = req.session && req.session.account;
  const [username, domain] = (account?.username || '').split('@');
  res.locals.currentUser = account ? { name: account.name || account.username, username: account.username } : null;
  res.locals.currentPath = req.path;
  // Read at request time: config/local.js and the tests change the list
  res.locals.canPublish = Boolean(account) && domain === permissions.DOMAIN && (permissions['/blog'] || []).includes(username);
  res.locals.hasSharedMailboxes = appConfig.SHARED_MAILBOXES.length > 0;
  next();
});

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
app.use('/', adminRoutes);
app.use('/', ownedGroupRoutes);
app.use('/', helpRoutes);
app.use('/', roomRoutes);
app.use('/', directoryRoutes);
app.use('/', signatureRoutes);
app.use('/', activityRoutes);

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
