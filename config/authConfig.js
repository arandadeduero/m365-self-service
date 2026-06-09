/**
 * MSAL (Microsoft Authentication Library) Configuration
 * 
 * This file configures the authentication settings for Microsoft 365 login
 * using the Authorization Code Flow with Confidential Client Application.
 */

require('dotenv').config();

const msalConfig = {
  auth: {
    // Client ID from Azure App Registration
    clientId: process.env.CLIENT_ID,
    
    // Authority URL for single tenant authentication
    // Format: https://login.microsoftonline.com/{tenant-id}
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    
    // Client Secret from Azure App Registration
    clientSecret: process.env.CLIENT_SECRET,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (!containsPii) {
          console.log(message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: process.env.NODE_ENV === 'production' ? 3 : 1, // Error in prod, Info in dev
    },
  },
};

// Redirect URI configuration
const redirectUri = process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback';

// Microsoft Graph API scopes (permissions)
// These determine what data the app can access
const scopes = [
  'user.read',              // Basic user profile
  'User.ReadBasic.All',     // Extended user information
  'GroupMember.Read.All',   // User's group memberships
  'Group.Read.All',         // Read all groups in the tenant
  'Directory.Read.All',     // Comprehensive directory data (includes manager)
  'offline_access',         // Refresh tokens for long-lived sessions
];

module.exports = {
  msalConfig,
  redirectUri,
  scopes,
};
