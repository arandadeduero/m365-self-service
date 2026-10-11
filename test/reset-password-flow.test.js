/**
 * Reset Password Flow Tests
 * Walks the whole self-service reset (request link, open link, set password)
 * with MSAL, Microsoft Graph and AWS SES stubbed.
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, stubSes, waitFor, getCsrfToken, auditEvents } = require('./helpers/stubs');

const http = stubAxios();
const ses = stubSes();
stubMsal();

const app = require('../server');

const EMAIL = 'alice@arandadeduero.es';
const GENERIC_ANSWER = 'Si la dirección corresponde a una cuenta';

// The directory entry of the only user that exists in these tests
let directoryUser;

// A visitor who has opened the reset page, and a POST carrying its CSRF token
let agent;
let csrf;
const post = (path) => agent.post(path).set('X-CSRF-Token', csrf);

test.beforeEach(async () => {
  agent = request.agent(app);
  csrf = await getCsrfToken(agent);

  http.reset();
  ses.sent.length = 0;
  ses.failWith = null;
  directoryUser = { id: 'u1', mail: EMAIL, lastPasswordChangeDateTime: '2026-01-01T00:00:00Z' };

  http.on('get', '/v1.0/users', ({ config }) => ({
    value: config.params.$filter.includes(`'${EMAIL}'`) ? [directoryUser] : [],
  }));
  http.on('get', '/users/u1', () => directoryUser);
});

test.afterEach.always(async () => {
  // Removes the visitor's session file
  await agent.get('/auth/logout');
});

function requestLink(email = EMAIL) {
  return post('/reset-password').type('form').send({ email });
}

/**
 * Request a reset link and return its path, as read from the email sent
 */
async function requestResetPath() {
  await requestLink().expect(200);
  await waitFor(() => ses.sent.length === 1);

  const body = ses.sent[0].Message.Body.Text.Data;
  return new URL(body.match(/https?:\/\/\S+/)[0]).pathname;
}

/**
 * Let the work the app does after answering a link request finish
 */
async function lookupFinished() {
  await waitFor(() => http.callsTo('get', '/v1.0/users').length === 1);
  await new Promise(resolve => setTimeout(resolve, 20));
}

test.serial('POST /reset-password emails a reset link to a known user', async t => {
  const res = await requestLink().expect(200);
  await waitFor(() => ses.sent.length === 1);

  t.true(res.text.includes(GENERIC_ANSWER));
  t.deepEqual(ses.sent[0].Destination.ToAddresses, [EMAIL]);
  t.is(ses.sent[0].Source, 'no-reply@example.test');
  t.regex(ses.sent[0].Message.Body.Text.Data, /\/reset-password\/[\w-]+$/);
  // The user lookup runs with the app-only token, not a user session
  t.is(http.callsTo('get', '/v1.0/users')[0].config.headers.Authorization, 'Bearer app-token');
});

test.serial('the reset link points at the configured address, not at the Host header', async t => {
  await requestLink().set('Host', 'evil.example').expect(200);
  await waitFor(() => ses.sent.length === 1);

  const body = ses.sent[0].Message.Body.Text.Data;
  t.true(body.includes('http://localhost:3000/reset-password/'));
  t.false(body.includes('evil.example'));
});

test.serial('the link goes to the alternate address of the account when it has one', async t => {
  directoryUser = { ...directoryUser, otherMails: ['alice@personal.example'] };

  await requestLink().expect(200);
  await waitFor(() => ses.sent.length === 1);

  t.deepEqual(ses.sent[0].Destination.ToAddresses, ['alice@personal.example']);

  // The form still shows the account being reset, not where the link was sent
  const path = new URL(ses.sent[0].Message.Body.Text.Data.match(/https?:\/\/\S+/)[0]).pathname;
  const page = await agent.get(path).expect(200);
  t.true(page.text.includes(EMAIL));
  t.false(page.text.includes('alice@personal.example'));
});

test.serial('reset requests and password changes are audited, without the link or the password', async t => {
  http.on('patch', '/users/u1', {});
  const path = await requestResetPath();
  await requestLink('nobody@arandadeduero.es').expect(200);
  await waitFor(() => auditEvents('reset.link_requested').some(entry => entry.email === 'nobody@arandadeduero.es'));
  await post(path).type('form').send({ newPassword: 'N3w-Passw0rd', confirmPassword: 'N3w-Passw0rd' }).expect(200);
  await post(path).type('form').send({ newPassword: 'a', confirmPassword: 'b' }).expect(400);

  const log = auditEvents();
  const requests = log.filter(entry => entry.event === 'reset.link_requested');
  t.like(requests.find(entry => entry.email === EMAIL), { sentTo: 'mailbox', actor: null });
  t.like(requests.find(entry => entry.email === 'nobody@arandadeduero.es'), { sentTo: 'nobody' });
  t.like(log.filter(entry => entry.event === 'reset.password_changed').at(-1), { userId: 'u1', email: EMAIL });
  t.like(log.filter(entry => entry.event === 'reset.rejected').at(-1), { reason: 'Las contraseñas no coinciden' });

  const raw = JSON.stringify(log);
  t.false(raw.includes('N3w-Passw0rd'));
  t.false(raw.includes(path.split('/').pop()));
});

test.serial('POST /reset-password rejects addresses of another domain', async t => {
  await requestLink('alice@example.com').expect(400);
  await post('/reset-password').type('form').send({}).expect(400);

  t.is(http.calls.length, 0);
  t.is(ses.sent.length, 0);
});

test.serial('POST /reset-password answers the same for an unknown user, without sending anything', async t => {
  const known = await requestLink().expect(200);
  await waitFor(() => ses.sent.length === 1);
  http.calls.length = 0;
  ses.sent.length = 0;

  const unknown = await requestLink('nobody@arandadeduero.es').expect(200);
  await lookupFinished();

  t.is(unknown.text, known.text);
  t.is(ses.sent.length, 0);
});

test.serial('no link is sent when the directory does not say when the password last changed', async t => {
  // Without that date a link could not be made single use
  delete directoryUser.lastPasswordChangeDateTime;

  const res = await requestLink().expect(200);
  await lookupFinished();

  t.true(res.text.includes(GENERIC_ANSWER));
  t.is(ses.sent.length, 0);
  await waitFor(() => auditEvents('reset.link_failed').some(entry => entry.email === EMAIL));
  t.regex(auditEvents('reset.link_failed').at(-1).reason, /lastPasswordChangeDateTime/);
});

test.serial('POST /reset-password answers the same when the email cannot be sent', async t => {
  ses.failWith = new Error('SES is down');

  const res = await requestLink().expect(200);
  await lookupFinished();

  t.true(res.text.includes(GENERIC_ANSWER));
});

test.serial('GET /reset-password/:token shows the new password form for a valid link', async t => {
  const path = await requestResetPath();

  const res = await agent.get(path).expect(200);

  t.true(res.text.includes(EMAIL));
  t.true(res.text.includes(`action="${path}"`));
});

test.serial('POST /reset-password/:token rejects passwords that do not match or are empty', async t => {
  const path = await requestResetPath();

  const res = await post(path)
    .type('form')
    .send({ newPassword: 'N3w-Passw0rd', confirmPassword: 'different' })
    .expect(400);
  await post(path).type('form').send({ newPassword: '', confirmPassword: '' }).expect(400);

  t.true(res.text.includes('Las contraseñas no coinciden'));
  t.is(http.callsTo('patch', '/users/u1').length, 0);
});

test.serial('POST /reset-password/:token sets the new password for the user in the link', async t => {
  http.on('patch', '/users/u1', {});
  const path = await requestResetPath();

  const res = await post(path)
    .type('form')
    .send({ newPassword: 'N3w-Passw0rd', confirmPassword: 'N3w-Passw0rd' })
    .expect(200);

  t.true(res.text.includes('Contraseña actualizada correctamente'));
  const [patch] = http.callsTo('patch', '/users/u1');
  t.is(patch.data.passwordProfile.password, 'N3w-Passw0rd');
  t.is(patch.config.headers.Authorization, 'Bearer app-token');
});

test.serial('a reset link stops working once the password has been changed', async t => {
  http.on('patch', '/users/u1', () => {
    // What the directory does when a password is set
    directoryUser = { ...directoryUser, lastPasswordChangeDateTime: '2026-10-10T12:00:00Z' };
    return {};
  });
  const path = await requestResetPath();
  const form = { newPassword: 'N3w-Passw0rd', confirmPassword: 'N3w-Passw0rd' };

  await post(path).type('form').send(form).expect(200);

  const page = await agent.get(path).expect(400);
  t.true(page.text.includes('El enlace ya ha sido utilizado'));

  await post(path).type('form').send(form).expect(400);
  t.is(http.callsTo('patch', '/users/u1').length, 1);
});

test.serial('a reset link is rejected when its user no longer exists', async t => {
  const path = await requestResetPath();
  http.fail('get', '/users/u1', 404);

  const page = await agent.get(path).expect(400);

  t.true(page.text.includes('El enlace ya ha sido utilizado'));
});

test.serial('POST /reset-password/:token fails when Graph rejects the new password', async t => {
  http.fail('patch', '/users/u1', 400);
  const path = await requestResetPath();

  const res = await post(path)
    .type('form')
    .send({ newPassword: 'weak', confirmPassword: 'weak' })
    .expect(400);

  t.true(res.text.includes('Error procesando el reseteo'));
});

test.serial('reset links stop working after 15 minutes', async t => {
  http.on('patch', '/users/u1', {});
  const path = await requestResetPath();

  const realNow = Date.now;
  Date.now = () => realNow() + 16 * 60 * 1000;
  t.teardown(() => {
    Date.now = realNow;
  });

  const page = await agent.get(path).expect(400);
  t.true(page.text.includes('El enlace ha caducado'));

  await post(path)
    .type('form')
    .send({ newPassword: 'N3w-Passw0rd', confirmPassword: 'N3w-Passw0rd' })
    .expect(400);
  t.is(http.callsTo('patch', '/users/u1').length, 0);
});

test.serial('a reset link altered in any character is rejected', async t => {
  http.on('patch', '/users/u1', {});
  const path = await requestResetPath();
  const token = path.split('/').pop();

  // Covers the IV, the authentication tag and the encrypted payload
  for (const position of [0, 20, token.length - 2]) {
    const replacement = token[position] === 'A' ? 'B' : 'A';
    const tampered = token.slice(0, position) + replacement + token.slice(position + 1);

    const page = await agent.get(`/reset-password/${tampered}`).expect(400);
    t.true(page.text.includes('Token no válido o corrupto'));

    await post(`/reset-password/${tampered}`)
      .type('form')
      .send({ newPassword: 'N3w-Passw0rd', confirmPassword: 'N3w-Passw0rd' })
      .expect(400);
  }

  t.is(http.callsTo('patch', '/users/u1').length, 0);
});
