/**
 * Regional Settings Tests
 * At every sign-in the mailbox and account are put back on Madrid time and
 * Spanish.
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, auditEvents, signInAgent } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const app = require('../server');

const SETTINGS = '/me/mailboxSettings';
const MADRID = 'Romance Standard Time';
const EVENT = 'account.regional_settings_corrected';

const RIGHT = {
  timeZone: MADRID,
  language: { locale: 'es-ES', displayName: 'español (España)' },
  workingHours: {
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    startTime: '08:00:00.0000000',
    endTime: '15:00:00.0000000',
    timeZone: { name: MADRID },
  },
};

test.beforeEach(() => {
  http.reset();
  http.on('get', SETTINGS, RIGHT);
  http.on('get', '/v1.0/me', { preferredLanguage: 'es-ES' });
  http.on('patch', SETTINGS, {});
  http.on('patch', '/v1.0/me', {});
});

async function signIn(t) {
  const agent = request.agent(app);
  const res = await signInAgent(agent);
  t.is(res.header.location, '/');
  t.teardown(() => agent.get('/auth/logout'));
  return agent;
}

const mailboxChange = () => http.callsTo('patch', SETTINGS).map(call => call.data);
const accountChange = () => http.callsTo('patch', '/v1.0/me').map(call => call.data);

test.serial('an account already on Madrid time and Spanish is left alone', async t => {
  const before = auditEvents(EVENT).length;

  await signIn(t);

  t.deepEqual(mailboxChange(), []);
  t.deepEqual(accountChange(), []);
  t.is(auditEvents(EVENT).length, before);
});

test.serial('time zone, language and working hours zone are corrected, keeping the user\'s hours', async t => {
  http.on('get', SETTINGS, {
    timeZone: 'Pacific Standard Time',
    language: { locale: 'en-US' },
    workingHours: {
      daysOfWeek: ['monday', 'wednesday'],
      startTime: '09:30:00.0000000',
      endTime: '13:00:00.0000000',
      timeZone: { name: 'Pacific Standard Time' },
    },
  });
  http.on('get', '/v1.0/me', { preferredLanguage: 'en-US' });

  await signIn(t);

  t.deepEqual(mailboxChange(), [{
    timeZone: MADRID,
    language: { locale: 'es-ES' },
    workingHours: {
      daysOfWeek: ['monday', 'wednesday'],
      startTime: '09:30:00.0000000',
      endTime: '13:00:00.0000000',
      timeZone: { name: MADRID },
    },
  }]);
  t.deepEqual(accountChange(), [{ preferredLanguage: 'es-ES' }]);
  t.like(auditEvents(EVENT).at(-1), { actor: 'alice@arandadeduero.es' });
  t.deepEqual([...auditEvents(EVENT).at(-1).settings].sort(), ['language', 'preferredLanguage', 'timeZone', 'workingHours']);
});

test.serial('only what differs is changed', async t => {
  http.on('get', SETTINGS, { ...RIGHT, timeZone: 'GMT Standard Time' });

  await signIn(t);

  t.deepEqual(mailboxChange(), [{ timeZone: MADRID }]);
  t.deepEqual(accountChange(), []);
  t.deepEqual(auditEvents(EVENT).at(-1).settings, ['timeZone']);
});

test.serial('a mailbox that has never been set up gets its zone and language', async t => {
  http.on('get', SETTINGS, {});
  http.on('get', '/v1.0/me', {});

  await signIn(t);

  // No working hours to correct, so none are invented
  t.deepEqual(mailboxChange(), [{ timeZone: MADRID, language: { locale: 'es-ES' } }]);
  t.deepEqual(accountChange(), [{ preferredLanguage: 'es-ES' }]);
});

test.serial('it is corrected again at the next sign-in if the user changed it back', async t => {
  http.on('get', SETTINGS, { ...RIGHT, timeZone: 'GMT Standard Time' });

  await signIn(t);
  await signIn(t);

  t.is(mailboxChange().length, 2);
});

test.serial('signing in works when the settings cannot be read or changed', async t => {
  http.fail('get', SETTINGS, 404);
  http.on('get', '/v1.0/me', { preferredLanguage: 'en-US' });
  http.fail('patch', '/v1.0/me', 403);
  const before = auditEvents(EVENT).length;

  const agent = await signIn(t);

  t.is(auditEvents(EVENT).length, before);
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  await agent.get('/').expect(200);
});

test.serial('one setting being refused does not stop the other', async t => {
  http.on('get', SETTINGS, { ...RIGHT, timeZone: 'GMT Standard Time' });
  http.on('get', '/v1.0/me', { preferredLanguage: 'en-US' });
  http.fail('patch', '/v1.0/me', 403);

  await signIn(t);

  t.deepEqual(mailboxChange(), [{ timeZone: MADRID }]);
  t.deepEqual(auditEvents(EVENT).at(-1).settings, ['timeZone']);
});
