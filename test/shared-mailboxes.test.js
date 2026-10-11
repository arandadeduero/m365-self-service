/**
 * Shared Mailbox Tests
 * Which of the organization's shared mailboxes the user can open
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, httpError, getCsrfToken, auditEvents, signInAgent } = require('./helpers/stubs');

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
  await signInAgent(agent);
  const csrf = await getCsrfToken(agent);
  t.teardown(() => agent.get('/auth/logout'));

  return {
    get: (url) => agent.get(url),
    post: (url) => agent.post(url).set('X-CSRF-Token', csrf),
    postWithoutToken: (url) => agent.post(url),
  };
}

// What Graph answers when the user asks for the inbox of each mailbox
let access;

test.beforeEach(() => {
  appConfig.SHARED_MAILBOXES = ['registro@arandadeduero.es', 'obras@arandadeduero.es', 'alcaldia@arandadeduero.es'];
  access = { registro: 200, obras: 403, alcaldia: 404 };

  http.reset();
  http.on('get', '/mailFolders/inbox', (call) => {
    const mailbox = decodeURIComponent(call.url).match(/users\/([^@]+)@/)[1];
    if (access[mailbox] !== 200) throw httpError(access[mailbox]);
    return { id: 'inbox-id' };
  });
});

test.serial('the user sees the shared mailboxes they can open, and only those', async t => {
  const user = await signIn(t);

  const res = await user.get('/account/mailboxes').expect(200);

  t.true(res.text.includes('<strong>registro@arandadeduero.es</strong>'));
  t.true(res.text.includes('href="https://outlook.office.com/mail/registro%40arandadeduero.es/"'));
  // Not even the names of the ones they cannot open
  t.false(res.text.includes('obras@arandadeduero.es'));
  t.false(res.text.includes('alcaldia@arandadeduero.es'));

  // Checked with the user's own token, without reading any mail
  const calls = http.callsTo('get', '/mailFolders/inbox');
  t.is(calls.length, 3);
  t.true(calls.every(call => call.config.headers.Authorization === 'Bearer user-token'));
  t.true(calls.every(call => call.config.params.$select === 'id'));
});

test.serial('having access to none is said plainly', async t => {
  access = { registro: 403, obras: 403, alcaldia: 404 };
  const user = await signIn(t);

  const res = await user.get('/account/mailboxes').expect(200);

  t.true(res.text.includes('No se ha encontrado ningún buzón compartido que puedas abrir'));
});

test.serial('a mailbox Graph did not answer for is "not checked", not "no access"', async t => {
  access = { registro: 403, obras: 503, alcaldia: 404 };
  const user = await signIn(t);

  const res = await user.get('/account/mailboxes').expect(200);

  t.true(res.text.includes('No se ha podido comprobar el acceso a: obras@arandadeduero.es'));
  t.false(res.text.includes('No se ha encontrado ningún buzón compartido'));
});

test.serial('without a list from IT the page says so and asks Microsoft nothing', async t => {
  appConfig.SHARED_MAILBOXES = [];
  const user = await signIn(t);

  const res = await user.get('/account/mailboxes').expect(200);
  const account = await user.get('/account');

  t.true(res.text.includes('Informática todavía no ha indicado'));
  t.is(http.callsTo('get', '/mailFolders/inbox').length, 0);
  t.false(account.text.includes('href="/account/mailboxes"'));
});

test.serial('the page needs a signed-in user', async t => {
  const res = await request(app).get('/account/mailboxes').expect(302);

  t.is(res.header.location, '/login');
  t.truthy(auditEvents);
});
