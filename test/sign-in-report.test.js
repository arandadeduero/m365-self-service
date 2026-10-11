/**
 * Sign-in Report Tests
 * "No fui yo": telling IT about a sign-in and closing every session
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, httpError, getCsrfToken, auditEvents } = require('./helpers/stubs');

const http = stubAxios();
const msal = stubMsal();

const appConfig = require('../config/appConfig');
const app = require('../server');

const ALICE = { username: 'alice@arandadeduero.es', name: 'Alice Example', localAccountId: 'alice-id' };

/**
 * Sign in and return an agent with helpers for that session
 */
async function signIn(t, account = ALICE) {
  msal.account = account;
  const agent = request.agent(app);
  await agent.get('/auth/callback?code=test-code').expect(302);
  const csrf = await getCsrfToken(agent);
  t.teardown(() => agent.get('/auth/logout'));

  return {
    get: (url) => agent.get(url),
    post: (url) => agent.post(url).set('X-CSRF-Token', csrf),
    postWithoutToken: (url) => agent.post(url),
  };
}

const SIGN_INS = '/auditLogs/signIns';
const REVOKE = '/me/revokeSignInSessions';
const SEND = '/me/sendMail';
const EVENT = 'account.sign_in_reported';

const STRANGE = {
  id: 'signin-2',
  createdDateTime: '2026-10-09T23:40:00Z',
  appDisplayName: 'Outlook',
  ipAddress: '198.51.100.20',
  location: { city: 'Lagos', countryOrRegion: 'NG' },
  deviceDetail: { operatingSystem: 'Android', browser: 'Chrome 129' },
  status: { errorCode: 0 },
};

test.beforeEach(() => {
  http.reset();
  appConfig.ADMIN_EMAIL = 'informatica@arandadeduero.es';
  http.on('get', SIGN_INS, { value: [{ id: 'signin-1', createdDateTime: '2026-10-10T08:15:00Z', status: { errorCode: 0 } }, STRANGE] });
  http.on('post', SEND, {});
  http.on('post', REVOKE, { value: true });
});

const report = (user, signInId) => user.post('/account/sign-ins/report').type('form').send({ signInId });
const sentMessage = () => http.callsTo('post', SEND)[0]?.data.message;

test.serial('every sign-in in the list has its own "No fui yo" button', async t => {
  const user = await signIn(t);

  const res = await user.get('/account/sign-ins').expect(200);

  t.is(res.text.split('action="/account/sign-ins/report"').length - 1, 2);
  t.true(res.text.includes('name="signInId" value="signin-2"'));
});

test.serial('reporting a sign-in tells IT, closes every session and ends this one', async t => {
  const user = await signIn(t);

  const res = await report(user, 'signin-2').expect(200);

  t.true(res.text.includes('Se han cerrado todas las sesiones de tu cuenta'));
  t.true(res.text.includes('Informática ha recibido los datos'));
  t.true(res.text.includes('Cambiar la contraseña'));

  // The details come from the log
  const message = sentMessage();
  t.deepEqual(message.toRecipients.map(r => r.emailAddress.address), ['informatica@arandadeduero.es']);
  t.true(message.subject.includes('alice@arandadeduero.es'));
  for (const text of ['198.51.100.20', 'Lagos, NG', 'Android · Chrome 129', 'signin-2', '2026-10-09T23:40:00Z']) {
    t.true(message.body.content.includes(text), text);
  }

  // The email goes out before the sessions are closed, with the user's token
  const order = http.calls.filter(call => call.method === 'post').map(call => call.url.split('/').pop());
  t.deepEqual(order, ['sendMail', 'revokeSignInSessions']);
  t.is(http.callsTo('post', REVOKE)[0].config.headers.Authorization, 'Bearer user-token');

  t.like(auditEvents(EVENT).at(-1), { actor: 'alice@arandadeduero.es', signInId: 'signin-2', ip: '198.51.100.20', notified: true, revoked: true });

  const after = await user.get('/account').expect(302);
  t.is(after.header.location, '/login');
});

test.serial('the log is read for the signed-in user, whatever the form says', async t => {
  const user = await signIn(t);

  await user.post('/account/sign-ins/report').type('form').send({ signInId: 'signin-2', userId: 'bob-id' }).expect(200);

  const [call] = http.callsTo('get', SIGN_INS);
  t.is(call.config.headers.Authorization, 'Bearer app-token');
  t.is(call.config.params.$filter, "userId eq 'alice-id'");
});

test.serial('a sign-in that is not in the user\'s log cannot be reported', async t => {
  const user = await signIn(t);
  const before = auditEvents(EVENT).length;

  for (const signInId of ['signin-of-somebody-else', '', undefined]) {
    await report(user, signInId).expect(404);
  }

  t.is(http.callsTo('post', REVOKE).length, 0);
  t.is(http.callsTo('post', SEND).length, 0);
  t.is(auditEvents(EVENT).length, before);
  // Nothing happened, so the session is still there
  await user.get('/account/sign-ins').expect(200);
});

test.serial('the sessions are closed even when IT cannot be told, and the page says so', async t => {
  http.fail('post', SEND, 500);
  const user = await signIn(t);

  const res = await report(user, 'signin-2').expect(200);

  t.true(res.text.includes('Se han cerrado todas las sesiones'));
  t.true(res.text.includes('No se ha podido avisar a Informática'));
  t.true(res.text.includes('informatica@arandadeduero.es'));
  t.is(http.callsTo('post', REVOKE).length, 1);
  t.like(auditEvents(EVENT).at(-1), { notified: false, revoked: true });
});

test.serial('when the sessions cannot be closed the page says so instead of claiming it', async t => {
  http.fail('post', REVOKE, 403);
  const user = await signIn(t);

  const res = await report(user, 'signin-2').expect(200);

  t.false(res.text.includes('Se han cerrado todas las sesiones'));
  t.true(res.text.includes('No se han podido cerrar las sesiones'));
  t.true(res.text.includes('Informática ha recibido los datos'));
  t.like(auditEvents(EVENT).at(-1), { notified: true, revoked: false });
});

test.serial('nothing is done when the log cannot be read', async t => {
  http.fail('get', SIGN_INS, 403);
  const user = await signIn(t);

  const res = await report(user, 'signin-2').expect(503);

  t.true(res.text.includes('Cambia tu contraseña y avisa a Informática'));
  t.is(http.callsTo('post', REVOKE).length, 0);
});

test.serial('reporting needs the CSRF token and a signed-in user', async t => {
  const user = await signIn(t);

  await user.postWithoutToken('/account/sign-ins/report').type('form').send({ signInId: 'signin-2' }).expect(403);
  t.is(http.callsTo('post', REVOKE).length, 0);

  const anonymous = request.agent(app);
  const csrf = await getCsrfToken(anonymous);
  t.teardown(() => anonymous.get('/auth/logout'));
  const res = await anonymous.post('/account/sign-ins/report').set('X-CSRF-Token', csrf).send({ signInId: 'signin-2' }).expect(302);
  t.is(res.header.location, '/login');
  t.is(http.callsTo('post', REVOKE).length, 0);
});

test.serial('httpError is what a refusing Graph looks like', t => {
  t.is(httpError(403).response.status, 403);
});
