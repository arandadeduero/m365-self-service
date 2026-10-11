/**
 * Token Renewal Tests
 * What happens to a signed-in user when their access token expires or is
 * rejected by Microsoft Graph.
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal } = require('./helpers/stubs');

const http = stubAxios();
const msal = stubMsal();

const app = require('../server');

test.beforeEach(() => {
  http.reset();
  msal.silentCalls = 0;
  msal.failSilent = false;
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
});

/**
 * Sign in with an access token that lasts the given time
 */
async function signIn(t, expiresInMs) {
  msal.expiresInMs = expiresInMs;
  const agent = request.agent(app);
  await agent.get('/auth/callback?code=test-code').expect(302);
  // Signing in talks to Graph too; these tests look at what comes after
  http.calls.length = 0;
  // Logging out removes the session file
  t.teardown(() => agent.get('/auth/logout'));
  return agent;
}

function tokensSentToGraph() {
  return [...new Set(http.calls
    .filter(call => !call.url.includes('/serviceAnnouncement/'))
    .map(call => call.config.headers.Authorization))];
}

test.serial('a token that is still valid is used as it is', async t => {
  const agent = await signIn(t, 60 * 60 * 1000);

  await agent.get('/').expect(200);

  t.is(msal.silentCalls, 0);
  t.deepEqual(tokensSentToGraph(), ['Bearer user-token']);
});

test.serial('a token about to expire is renewed before Graph is called', async t => {
  const agent = await signIn(t, 60 * 1000);

  await agent.get('/').expect(200);

  t.is(msal.silentCalls, 1);
  t.deepEqual(tokensSentToGraph(), ['Bearer renewed-token']);
});

test.serial('the renewed token is kept in the session for later requests', async t => {
  const agent = await signIn(t, -1000);

  await agent.get('/').expect(200);
  await agent.get('/').expect(200);

  t.is(msal.silentCalls, 1);
  t.deepEqual(tokensSentToGraph(), ['Bearer renewed-token']);
});

test.serial('the user is signed out when the token cannot be renewed', async t => {
  const agent = await signIn(t, -1000);
  msal.failSilent = true;

  const res = await agent.get('/').expect(302);

  t.is(res.header.location, '/login');
  t.is(http.calls.length, 0);

  // The session is gone for good, not retried on every request
  msal.failSilent = false;
  const again = await agent.get('/').expect(302);
  t.is(again.header.location, '/login');
  t.is(msal.silentCalls, 1);
});

test.serial('public pages still work when the token cannot be renewed', async t => {
  const agent = await signIn(t, -1000);
  msal.failSilent = true;

  await agent.get('/reset-password').expect(200);
  await agent.get('/login').expect(200);
  t.pass();
});

test.serial('the user is sent to login when Graph rejects a token that looked valid', async t => {
  const agent = await signIn(t, 60 * 60 * 1000);
  http.fail('get', '/v1.0/me', 401);

  const res = await agent.get('/').expect(302);
  t.is(res.header.location, '/login');

  // Signed out: the next request does not reach Graph with the rejected token
  http.reset();
  const again = await agent.get('/').expect(302);
  t.is(again.header.location, '/login');
  t.is(http.calls.length, 0);
});

test.serial('other Graph failures do not sign the user out', async t => {
  const agent = await signIn(t, 60 * 60 * 1000);
  http.fail('get', '/v1.0/me', 503);

  await agent.get('/').expect(500);

  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  await agent.get('/').expect(200);
  t.pass();
});
