/**
 * CSRF Protection Tests
 * Requests that change something need the token of the session they use.
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, getCsrfToken } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const permissions = require('../config/permissions');
const app = require('../server');

test.beforeEach(() => {
  http.reset();
  http.on('get', '/v1.0/me', { displayName: 'Alice Example', preferredLanguage: 'es-ES' });
  // Regional settings already right, so signing in changes nothing by itself
  http.on('get', '/me/mailboxSettings', { timeZone: 'Romance Standard Time', language: { locale: 'es-ES' } });
  http.on('patch', '/v1.0/me', {});
  http.on('post', '/me/sendMail', {});
  permissions.DOMAIN = 'arandadeduero.es';
  permissions['/blog'] = ['alice'];
});

async function signIn(t) {
  const agent = request.agent(app);
  await agent.get('/auth/callback?code=test-code').expect(302);
  t.teardown(() => agent.get('/auth/logout'));
  return agent;
}

const changes = () => http.calls.filter(call => call.method !== 'get');

test.serial('a form posted without the token is refused and changes nothing', async t => {
  const agent = await signIn(t);

  const res = await agent.post('/profile/me/edit').type('form').send({ jobTitle: 'Hacked' }).expect(403);

  t.true(res.text.includes('El formulario ha caducado'));
  t.is(changes().length, 0);
});

test.serial('a made-up token is refused', async t => {
  const agent = await signIn(t);
  await getCsrfToken(agent);

  await agent.post('/profile/me/edit').type('form').send({ _csrf: '0'.repeat(64), jobTitle: 'Hacked' }).expect(403);
  await agent.post('/profile/me/edit').type('form').send({ _csrf: ['a', 'b'], jobTitle: 'Hacked' }).expect(403);

  t.is(changes().length, 0);
});

test.serial('the token of another session is refused', async t => {
  const victim = await signIn(t);
  await getCsrfToken(victim);
  const attacker = await signIn(t);
  const attackerToken = await getCsrfToken(attacker);

  await victim.post('/profile/me/edit').type('form').send({ _csrf: attackerToken, jobTitle: 'Hacked' }).expect(403);

  t.is(changes().length, 0);
});

test.serial('the token is accepted as a form field', async t => {
  const agent = await signIn(t);
  const csrf = await getCsrfToken(agent);

  await agent.post('/profile/me/edit').type('form').send({ _csrf: csrf, jobTitle: 'Dev' }).expect(302);

  t.is(http.callsTo('patch', '/v1.0/me').length, 1);
});

test.serial('the token is accepted as a header on JSON requests, and required', async t => {
  const agent = await signIn(t);
  const csrf = await getCsrfToken(agent);
  const body = { selectedManagerId: 'm1', selectedManagerName: 'Boss' };

  await agent.post('/api/manager-correction').send(body).expect(403);
  t.is(changes().length, 0);

  await agent.post('/api/manager-correction').set('X-CSRF-Token', csrf).send(body).expect(200);
  t.is(http.callsTo('post', '/me/sendMail').length, 1);
});

test.serial('an upload form without the token is refused', async t => {
  const agent = await signIn(t);
  await getCsrfToken(agent);

  await agent
    .post('/blog')
    .field('title', 'Aviso')
    .field('content', 'Texto')
    .field('status', 'publish')
    .expect(403);

  t.is(changes().length, 0);
});

test.serial('a multipart request to a page that takes a plain form is refused', async t => {
  const agent = await signIn(t);
  const csrf = await getCsrfToken(agent);

  // Its body is never parsed there, so it would reach the page as an empty update
  await agent.post('/profile/me/edit').field('_csrf', csrf).field('jobTitle', 'Hacked').expect(403);

  t.is(changes().length, 0);
});

test.serial('the public reset form needs the token too', async t => {
  const agent = request.agent(app);
  t.teardown(() => agent.get('/auth/logout'));
  await getCsrfToken(agent);

  await agent.post('/reset-password').type('form').send({ email: 'alice@arandadeduero.es' }).expect(403);

  t.is(http.calls.length, 0);
});

test.serial('every form carries the token of the session', async t => {
  const agent = await signIn(t);
  const csrf = await getCsrfToken(agent);

  const page = await agent.get('/profile/me/edit').expect(200);

  // Profile details and photo upload
  t.is(page.text.split(`name="_csrf" value="${csrf}"`).length - 1, 2);
});

test.serial('reading pages needs no token', async t => {
  const agent = await signIn(t);

  await agent.get('/').expect(200);
  t.pass();
});

test.serial('pages without a form do not start a session', async t => {
  const res = await request(app).get('/login').expect(200);

  t.is(res.headers['set-cookie'], undefined);
});
