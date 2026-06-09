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
const msal = require('@azure/msal-node');
const { msalConfig, redirectUri, scopes } = require('../config/authConfig');

// Create MSAL confidential client application
const confidentialClientApplication = new msal.ConfidentialClientApplication(msalConfig);

/**
 * GET /auth/signin
 * Initiates the OAuth flow by redirecting to Microsoft login page
 */
router.get('/signin', async (req, res, next) => {
  try {
    // Create authorization URL request
    const authCodeUrlParameters = {
      scopes: scopes,
      redirectUri: redirectUri,
    };

    // Get authorization URL
    const authUrl = await confidentialClientApplication.getAuthCodeUrl(authCodeUrlParameters);

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

    // Exchange authorization code for access token
    const tokenRequest = {
      code: authCode,
      scopes: scopes,
      redirectUri: redirectUri,
    };

    const response = await confidentialClientApplication.acquireTokenByCode(tokenRequest);

    // Store access token and account info in session
    req.session.accessToken = response.accessToken;
    req.session.account = response.account;
    req.session.idToken = response.idToken;

    // Optional: Store token expiration time
    req.session.expiresOn = response.expiresOn;

    console.log('User authenticated successfully:', response.account.username);

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
    const postLogoutRedirectUri = process.env.REDIRECT_URI.replace('/auth/callback', '/login');

    // Redirect to Microsoft logout, then back to our login page
    res.redirect(`${logoutUri}?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`);
  });
});

module.exports = router;
