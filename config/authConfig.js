/**
 * MSAL (Microsoft Authentication Library) Configuration
 * 
 * This file configures the authentication settings for Microsoft 365 login
 * using the Authorization Code Flow with Confidential Client Application.
 */

// Tests bring their own environment (test/helpers/env.js) and must never
// read the developer's .env
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

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
  'User.Read',              // Basic user profile
  'User.ReadWrite',         // Update user profile
  'User.ReadBasic.All',     // Extended user information
  'GroupMember.Read.All',   // User's group memberships
  'GroupMember.ReadWrite.All', // Owners adding a member to a group they own
  'UserAuthenticationMethod.Read', // The user's own sign-in methods
  'Group.Read.All',         // Read all groups in the tenant
  'Directory.Read.All',     // Comprehensive directory data (includes manager)
  'MailboxSettings.ReadWrite', // Read and change automatic replies
  'Mail.Send',              // Send emails as the signed-in user
  'Files.Read',             // OneDrive space used (the app reads nothing else from it)
  'User.RevokeSessions.All', // "No fui yo": closing the user's own sessions
  'Calendars.Read',         // Who the calendar is shared with, and whether rooms are free
  'Mail.Read.Shared',       // Checking which shared mailboxes the user can open (no mail is read)
  'Place.Read.All',         // The list of meeting rooms
  'offline_access',         // Refresh tokens for long-lived sessions
  'Team.ReadBasic.All',     // Read teams the user is in
  'Channel.ReadBasic.All',  // Read channels in those teams
];

module.exports = {
  msalConfig,
  redirectUri,
  scopes,
};
