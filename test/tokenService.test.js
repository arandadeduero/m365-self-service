/**
 * Token Service Tests
 * Runs the real MSAL library against a fake Entra ID token endpoint, to check
 * that a session read back from disk can renew its access token.
 */

require('./helpers/env');

const test = require('ava').default;
const { msalConfig } = require('../config/authConfig');

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * A stand-in for the Entra ID endpoints MSAL talks to
 */
function fakeEntra() {
  const state = { tokenRequests: [], issued: 0, rejectWith: null };
  const authority = msalConfig.auth.authority;

  const idToken = [
    base64url({ alg: 'none' }),
    base64url({ oid: 'oid-1', tid: 'tid-1', preferred_username: 'alice@arandadeduero.es', name: 'Alice Example' }),
    'signature',
  ].join('.');

  state.networkClient = {
    async sendGetRequestAsync() {
      return {
        status: 200,
        headers: {},
        body: {
          token_endpoint: `${authority}/oauth2/v2.0/token`,
          authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
          issuer: `${authority}/v2.0`,
          end_session_endpoint: `${authority}/oauth2/v2.0/logout`,
          jwks_uri: `${authority}/discovery/v2.0/keys`,
        },
      };
    },
    async sendPostRequestAsync(url, options) {
      const params = Object.fromEntries(new URLSearchParams(options.body));
      state.tokenRequests.push(params);

      if (state.rejectWith) {
        return { status: 400, headers: {}, body: { error: state.rejectWith, error_description: 'rejected' } };
      }

      state.issued += 1;
      const body = { token_type: 'Bearer', expires_in: 3600, access_token: `access-${state.issued}` };
      if (params.grant_type === 'client_credentials') {
        return { status: 200, headers: {}, body };
      }
      return {
        status: 200,
        headers: {},
        body: {
          ...body,
          scope: 'User.Read openid profile offline_access',
          refresh_token: `refresh-${state.issued}`,
          id_token: idToken,
          client_info: base64url({ uid: 'oid-1', utid: 'tid-1' }),
        },
      };
    },
  };

  return state;
}

const entra = fakeEntra();
msalConfig.system.networkClient = entra.networkClient;

const tokenService = require('../services/tokenService');

// What a session looks like after being written to and read from its file
const fromDisk = (session) => JSON.parse(JSON.stringify(session));

test.beforeEach(() => {
  entra.tokenRequests.length = 0;
  entra.rejectWith = null;
});

test.serial('signIn exchanges the code and returns what the session needs', async t => {
  const session = await tokenService.signIn('the-code');

  t.is(entra.tokenRequests[0].grant_type, 'authorization_code');
  t.is(entra.tokenRequests[0].code, 'the-code');
  t.regex(session.accessToken, /^access-/);
  t.is(session.account.username, 'alice@arandadeduero.es');
  t.true(new Date(session.expiresOn) > new Date());
  // The cache carries the refresh token, which is what makes renewal possible
  t.true(session.tokenCache.includes('refresh-'));
});

test.serial('renewSession gets a new access token for a session read back from disk', async t => {
  const session = fromDisk(await tokenService.signIn('the-code'));
  const [firstRefreshToken] = session.tokenCache.match(/refresh-\d+/);
  const firstAccessToken = session.accessToken;
  entra.tokenRequests.length = 0;

  await tokenService.renewSession(session);

  t.is(entra.tokenRequests.length, 1);
  t.is(entra.tokenRequests[0].grant_type, 'refresh_token');
  t.is(entra.tokenRequests[0].refresh_token, firstRefreshToken);
  t.not(session.accessToken, firstAccessToken);
  t.regex(session.accessToken, /^access-/);
  t.is(session.account.username, 'alice@arandadeduero.es');
  t.false(tokenService.needsRenewal(session));
});

test.serial('a renewed session can be renewed again with its new refresh token', async t => {
  const session = fromDisk(await tokenService.signIn('the-code'));
  await tokenService.renewSession(session);
  const [secondRefreshToken] = session.tokenCache.match(/refresh-\d+/);
  entra.tokenRequests.length = 0;

  await tokenService.renewSession(fromDisk(session));

  t.is(entra.tokenRequests[0].refresh_token, secondRefreshToken);
});

test.serial('renewSession fails when Entra ID rejects the refresh token', async t => {
  const session = fromDisk(await tokenService.signIn('the-code'));
  const accessToken = session.accessToken;
  entra.rejectWith = 'invalid_grant';

  await t.throwsAsync(() => tokenService.renewSession(session));
  t.is(session.accessToken, accessToken);
});

test.serial('renewSession fails for a session without a token cache', async t => {
  const session = fromDisk(await tokenService.signIn('the-code'));
  delete session.tokenCache;
  entra.tokenRequests.length = 0;

  await t.throwsAsync(() => tokenService.renewSession(session), { message: 'Session has no token cache' });
  t.is(entra.tokenRequests.length, 0);
});

test('needsRenewal is true shortly before, at and after expiry', t => {
  const inMinutes = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

  t.false(tokenService.needsRenewal({ expiresOn: inMinutes(30) }));
  t.false(tokenService.needsRenewal({ expiresOn: inMinutes(30).toISOString() }));
  t.true(tokenService.needsRenewal({ expiresOn: inMinutes(2) }));
  t.true(tokenService.needsRenewal({ expiresOn: inMinutes(-10).toISOString() }));
  // Sessions created before the expiry time was stored
  t.true(tokenService.needsRenewal({}));
});

test.serial('getAppToken uses client credentials and reuses the token while it is valid', async t => {
  const first = await tokenService.getAppToken();
  const second = await tokenService.getAppToken();

  t.is(first, second);
  t.is(entra.tokenRequests.length, 1);
  t.is(entra.tokenRequests[0].grant_type, 'client_credentials');
  t.is(entra.tokenRequests[0].scope, 'https://graph.microsoft.com/.default');
});
