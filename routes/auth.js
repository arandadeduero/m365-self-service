/**
 * Authentication Routes
 * 
 * Handles Microsoft 365 OAuth authentication flow:
 * - /auth/signin - Redirects to Microsoft login
 * - /auth/callback - Handles OAuth callback and exchanges code for token
 * - /auth/logout - Logs out user and clears session
 */

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { redirectUri } = require('../config/authConfig');
const { getSignInUrl, signIn } = require('../services/tokenService');
const { auditRequest } = require('../services/auditService');
const { enforceRegionalSettings } = require('../services/regionalSettings');
const { userError } = require('../middleware/errorHandler');

/**
 * Whether the state Microsoft sent back is the one this session started with.
 * It is removed from the session either way, so a callback is good once.
 */
function takesExpectedState(session, state) {
  const expected = session.oauthState;
  delete session.oauthState;
  if (typeof expected !== 'string' || typeof state !== 'string' || expected.length !== state.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(state));
}

/**
 * GET /auth/signin
 * Initiates the OAuth flow by redirecting to Microsoft login page
 */
router.get('/signin', async (req, res, next) => {
  try {
    // Kept in the session and checked by the callback, so that a callback
    // URL made for one browser (login CSRF) is refused in any other
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;

    res.redirect(await getSignInUrl(state));
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
  if (!takesExpectedState(req.session, req.query.state)) {
    return next(userError(400, 'La solicitud de inicio de sesión no es válida o ha caducado. Vuelve a empezar desde la página de inicio.'));
  }

  try {
    // Get authorization code from query parameters
    const authCode = req.query.code;

    if (!authCode) {
      const error = new Error('No authorization code received');
      error.status = 400;
      throw error;
    }

    const tokens = await signIn(authCode);

    // A new session id for the signed-in user, so whatever session the
    // browser had before signing in (and anybody who knew its id) is left behind
    await new Promise((resolve, reject) => req.session.regenerate(err => (err ? reject(err) : resolve())));

    // Store the tokens in the session, together with the token cache used to
    // renew the access token later
    Object.assign(req.session, tokens);

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
