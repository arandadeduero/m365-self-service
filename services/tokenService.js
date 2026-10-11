/**
 * Token Service
 *
 * Wraps MSAL: sign-in, silent renewal of the signed-in user's access token,
 * and app-only tokens for operations that run without a user session.
 */

const msal = require('@azure/msal-node');
const { msalConfig, redirectUri, scopes } = require('../config/authConfig');

// Renew the access token when it has less than this left
const RENEWAL_MARGIN_MS = 5 * 60 * 1000;

const APP_SCOPES = ['https://graph.microsoft.com/.default'];

// Shared client for sign-in URLs and app-only tokens. User tokens never go
// through it: each user's token cache lives in their own session instead.
let appClient;

function getAppClient() {
  if (!appClient) {
    appClient = new msal.ConfidentialClientApplication(msalConfig);
  }
  return appClient;
}

/**
 * Pick what the session keeps from an MSAL response, including the client's
 * token cache (it holds the refresh token needed to renew later)
 */
function sessionTokens(client, response) {
  return {
    accessToken: response.accessToken,
    account: response.account,
    idToken: response.idToken,
    expiresOn: response.expiresOn,
    tokenCache: client.getTokenCache().serialize(),
  };
}

/**
 * Get the Microsoft login URL that starts the OAuth flow
 * @returns {Promise<string>}
 */
function getSignInUrl() {
  return getAppClient().getAuthCodeUrl({ scopes, redirectUri });
}

/**
 * Exchange the authorization code from the OAuth callback for tokens
 * @param {string} code - Authorization code
 * @returns {Promise<Object>} Values to store in the session
 */
async function signIn(code) {
  // A client of its own, so that its cache holds this user's tokens only
  const client = new msal.ConfidentialClientApplication(msalConfig);
  const response = await client.acquireTokenByCode({ code, scopes, redirectUri });
  return sessionTokens(client, response);
}

/**
 * Check whether the access token in the session is expired or about to
 * @param {Object} session - Express session
 * @returns {boolean}
 */
function needsRenewal(session) {
  // expiresOn is a string once the session has been read back from disk
  const expiresOn = new Date(session.expiresOn).getTime();
  return Number.isNaN(expiresOn) || expiresOn - Date.now() < RENEWAL_MARGIN_MS;
}

/**
 * Renew the access token in the session using its refresh token.
 * Throws if the session cannot be renewed and the user has to sign in again.
 * @param {Object} session - Express session, updated in place
 * @returns {Promise<void>}
 */
async function renewSession(session) {
  if (!session.tokenCache) {
    throw new Error('Session has no token cache');
  }

  const client = new msal.ConfidentialClientApplication(msalConfig);
  client.getTokenCache().deserialize(session.tokenCache);

  const response = await client.acquireTokenSilent({
    account: session.account,
    scopes,
    forceRefresh: true,
  });
  Object.assign(session, sessionTokens(client, response));
}

/**
 * Get an app-only Graph token (client credentials), for operations that have
 * no signed-in user. MSAL caches it until it expires.
 * @returns {Promise<string>} Access token
 */
async function getAppToken() {
  const response = await getAppClient().acquireTokenByClientCredential({ scopes: APP_SCOPES });
  return response.accessToken;
}

module.exports = {
  getSignInUrl,
  signIn,
  needsRenewal,
  renewSession,
  getAppToken,
};
