/**
 * Application Permission Mapping
 * 
 * Defines which users have access to specific routes/actions.
 */

const DOMAIN = 'arandadeduero.es';

// By default, no users are allowed until configured in local.js (not committed)
const ALLOWED_USERS = [];

let config = {
  DOMAIN,
  // Routes and allowed user emails (prefix of email) for all methods
  '/blog': [...ALLOWED_USERS]
};

// Apply local overrides if they exist
try {
  const localConfig = require('./local');
  if (localConfig.permissions) {
    if (localConfig.permissions.DOMAIN) {
      config.DOMAIN = localConfig.permissions.DOMAIN;
    }
    
    // Merge route permissions
    for (const route in localConfig.permissions) {
      if (route !== 'DOMAIN') {
        if (Array.isArray(localConfig.permissions[route])) {
          config[route] = [...localConfig.permissions[route]];
        }
      }
    }
  }
} catch (error) {
  // If the file doesn't exist or is not found, ignore the error
  if (error.code !== 'MODULE_NOT_FOUND') {
    console.error('Error loading config/local.js:', error);
  }
}

module.exports = config;
