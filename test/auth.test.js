/**
 * Authentication Route Tests
 * The OAuth flow: the sign-in redirect, the state that ties the callback to
 * the browser that started, the new session id on sign-in, and logout.
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const app = require('../server');

const sessionId = (res) => {
  const cookie = (res.headers['set-cookie'] || []).find(value => value.startsWith('connect.sid='));
  return cookie ? cookie.split(';')[0] : null;
};

const stateOf = (res) => new URL(res.header.location).searchParams.get('state');

test.beforeEach(() => {
  http.reset();
  http.on('get', '/v1.0/me', { displayName: 'Alice Example', preferredLanguage: 'es-ES' });
  http.on('get', '/me/mailboxSettings', { timeZone: 'Romance Standard Time', language: { locale: 'es-ES' } });
});

test.serial('GET /auth/signin redirects to Microsoft login with a state kept in the session', async t => {
  const agent = request.agent(app);
  t.teardown(() => agent.get('/auth/logout'));

  const res = await agent.get('/auth/signin').expect(302);

  const login = new URL(res.header.location);
  t.is(login.hostname, 'login.microsoftonline.com');
  t.regex(login.pathname, /\/oauth2\//);
  t.regex(stateOf(res), /^[0-9a-f]{32}$/);
  t.truthy(sessionId(res));
});

test.serial('a callback without the state of the session is refused and signs nobody in', async t => {
  const agent = request.agent(app);
  t.teardown(() => agent.get('/auth/logout'));

  const res = await agent.get('/auth/callback?code=test-code').expect(400);
  t.true(res.text.includes('no es válida'));
  await agent.get('/auth/callback').expect(400);

  const home = await agent.get('/').expect(302);
  t.is(home.header.location, '/login');
});

test.serial('a callback made for another browser is refused (login CSRF)', async t => {
  const attacker = request.agent(app);
  const victim = request.agent(app);
  t.teardown(() => Promise.all([attacker.get('/auth/logout'), victim.get('/auth/logout')]));
  const state = stateOf(await attacker.get('/auth/signin').expect(302));

  // The victim opens the attacker's callback URL
  await victim.get(`/auth/callback?code=test-code&state=${state}`).expect(400);

  const home = await victim.get('/').expect(302);
  t.is(home.header.location, '/login');
});

test.serial('signing in gives the browser a new session id and a callback is good once', async t => {
  const agent = request.agent(app);
  t.teardown(() => agent.get('/auth/logout'));
  const start = await agent.get('/auth/signin').expect(302);
  const callback = `/auth/callback?code=test-code&state=${stateOf(start)}`;

  const res = await agent.get(callback).expect(302);

  t.is(res.header.location, '/');
  t.truthy(sessionId(start));
  t.truthy(sessionId(res));
  t.not(sessionId(res), sessionId(start));
  await agent.get('/').expect(200);

  // Replaying the same callback does nothing more
  await agent.get(callback).expect(400);
  await agent.get('/').expect(200);
});

test.serial('GET /auth/logout clears session and redirects', async t => {
  const res = await request(app)
    .get('/auth/logout')
    .expect(302);

  // Should redirect to Microsoft logout
  t.true(res.header.location.includes('logout'));
});
