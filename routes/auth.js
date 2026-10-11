/**
 * Authentication Routes
 * 
 * Handles Microsoft 365 OAuth authentication flow:
 * - /auth/signin - Redirects to Microsoft login
 * - /auth/callback - Handles OAuth callback and exchanges code for token
 * - /auth/logout - Logs out user and clears session
 */

const express = require('express');
const router = express.Router();
const { redirectUri } = require('../config/authConfig');
const { getSignInUrl, signIn } = require('../services/tokenService');
const { auditRequest } = require('../services/auditService');
const { enforceRegionalSettings } = require('../services/regionalSettings');

/**
 * GET /auth/signin
 * Initiates the OAuth flow by redirecting to Microsoft login page
 */
router.get('/signin', async (req, res, next) => {
  try {
    // Get authorization URL
    const authUrl = await getSignInUrl();

    // Redirect user to Microsoft login page
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    next(error);
  }
});

/**
 * GET /auth/callback
 * Handles the OAuth callback from Microsoft
 * Exchanges authorization code for access token
 */
router.get('/callback', async (req, res, next) => {
  try {
    // Get authorization code from query parameters
    const authCode = req.query.code;

    if (!authCode) {
      const error = new Error('No authorization code received');
      error.status = 400;
      throw error;
    }

    // Exchange authorization code for tokens and store them in session,
    // together with the token cache used to renew the access token later
    Object.assign(req.session, await signIn(authCode));

    console.log('User authenticated successfully:', req.session.account.username);
    auditRequest(req, 'auth.sign_in');

    // Every account is kept on the organization's time zone and language
    const corrected = await enforceRegionalSettings(req.session.accessToken);
    if (corrected.length > 0) {
      auditRequest(req, 'account.regional_settings_corrected', { settings: corrected });
    }

    // Redirect to home page
    res.redirect('/');
  } catch (error) {
    console.error('Error during authentication callback:', error);
    error.status = 401;
    next(error);
  }
});

/**
 * GET /auth/logout
 * Logs out the user by clearing session and redirecting to Microsoft logout
 */
router.get('/logout', (req, res) => {
  // Get account info before destroying session
  const account = req.session.account;
  if (account) {
    auditRequest(req, 'auth.sign_out');
  }

  // Clear session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }

    // Clear cookie
    res.clearCookie('connect.sid');

    // Construct Microsoft logout URL
    // This logs the user out of their Microsoft account
    const logoutUri = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/logout`;
    const postLogoutRedirectUri = redirectUri.replace('/auth/callback', '/login');

    // Redirect to Microsoft logout, then back to our login page
    res.redirect(`${logoutUri}?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`);
  });
});

module.exports = router;
