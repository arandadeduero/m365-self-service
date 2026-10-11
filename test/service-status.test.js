/**
 * Service Status Tests
 * The banner that tells signed-in users about open Microsoft 365 incidents.
 * These tests share one cache and move the clock forward, so order matters.
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const app = require('../server');

const ISSUES = '/admin/serviceAnnouncement/issues';
const BANNER = 'Incidencia en Microsoft 365';
const MINUTE = 60 * 1000;

const INCIDENT = { id: 'TM1', title: 'No se pueden enviar mensajes', service: 'Microsoft Teams', classification: 'incident' };
const ADVISORY = { id: 'EX1', title: 'Aviso menor', service: 'Exchange Online', classification: 'advisory' };

// A clock the tests can move forward
const realNow = Date.now;
let elapsed = 0;
Date.now = () => realNow() + elapsed;
const advance = (ms) => {
  elapsed += ms;
};

const agent = request.agent(app);
const lookups = () => http.callsTo('get', ISSUES).length;

test.before(async () => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  http.on('get', '/v1.0/users', { value: [] });
  await agent.get('/auth/callback?code=test-code').expect(302);
});

test.after.always(async () => {
  await agent.get('/auth/logout');
});

test.serial('open incidents are shown to signed-in users, advisories are not', async t => {
  http.on('get', ISSUES, { value: [INCIDENT, ADVISORY] });

  const res = await agent.get('/').expect(200);

  t.true(res.text.includes(BANNER));
  t.true(res.text.includes('Microsoft Teams: No se pueden enviar mensajes'));
  t.false(res.text.includes('Aviso menor'));

  const [call] = http.callsTo('get', ISSUES);
  t.is(call.config.headers.Authorization, 'Bearer app-token');
  t.is(call.config.params.$filter, 'isResolved eq false');
});

test.serial('the banner is on every page and the answer is reused for five minutes', async t => {
  http.on('get', ISSUES, { value: [] });

  const res = await agent.get('/directorio').expect(200);

  t.true(res.text.includes(BANNER));
  t.is(lookups(), 1);
});

test.serial('after five minutes the incidents are read again', async t => {
  advance(6 * MINUTE);

  const res = await agent.get('/').expect(200);

  t.false(res.text.includes(BANNER));
  t.is(lookups(), 2);
});

test.serial('anonymous pages show no banner and do not look incidents up', async t => {
  advance(6 * MINUTE);
  http.on('get', ISSUES, { value: [INCIDENT] });

  const res = await request(app).get('/login').expect(200);

  t.false(res.text.includes(BANNER));
  t.is(lookups(), 2);
});

test.serial('pages work without a banner when incidents cannot be read', async t => {
  http.fail('get', ISSUES, 403);

  const res = await agent.get('/').expect(200);

  t.false(res.text.includes(BANNER));
  t.is(lookups(), 3);
});

test.serial('after a failure the lookup is retried an hour later, not on every page', async t => {
  http.on('get', ISSUES, { value: [INCIDENT] });

  advance(10 * MINUTE);
  const soon = await agent.get('/').expect(200);
  t.false(soon.text.includes(BANNER));
  t.is(lookups(), 3);

  advance(60 * MINUTE);
  const later = await agent.get('/').expect(200);
  t.true(later.text.includes(BANNER));
  t.is(lookups(), 4);
});
