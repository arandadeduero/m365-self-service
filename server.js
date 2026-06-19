/**
 * Main Server Application
 * 
 * Express server with Microsoft 365 authentication
 * and modern Bootstrap 5 design.
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const blogRoutes = require('./routes/blog');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { checkAdminStatus } = require('./middleware/auth');

// Create Express app
const app = express();

// Port configuration
const PORT = process.env.PORT || 3000;

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

// Check admin status for all requests
app.use(checkAdminStatus);

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

// 404 handler (must be after all routes)
app.use(notFoundHandler);

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
  });
}

// Export for testing
module.exports = app;
