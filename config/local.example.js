/**
 * Local Configuration Overrides
 * 
 * Copy this file to 'local.js' in the same directory to customize the configuration
 * for your local environment.
 * 
 * WARNING: 'local.js' contains sensitive credentials and configuration,
 * and should NEVER be committed to the repository.
 */

module.exports = {
  permissions: {
    // The domain allowed to access the application
    DOMAIN: 'arandadeduero.es',

    // Allowed usernames (prefix of email) for specific routes (applies to all HTTP methods)
    '/blog': ['username1', 'username2', 'username3']
  }
};
