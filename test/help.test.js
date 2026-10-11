/**
 * Help Page Tests
 * The usual questions, and writing to IT with the account's state attached
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

const SEND = '/me/sendMail';

test.beforeEach(() => {
  http.reset();
  appConfig.ADMIN_EMAIL = 'informatica@arandadeduero.es';
  http.on('post', SEND, {});
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: '2026-09-01T10:00:00Z', otherMails: ['ana@personal.example'] });
  http.on('get', '/me/licenseDetails', { value: [{ skuPartNumber: 'O365_BUSINESS_PREMIUM' }] });
  http.on('get', '/me/authentication/methods', { value: [{ '@odata.type': '#microsoft.graph.passwordAuthenticationMethod' }, { '@odata.type': '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod' }] });
});

const sentMessage = () => http.callsTo('post', SEND)[0]?.data.message;
const contact = (user, body) => user.post('/ayuda/contacto').type('form').send(body);

test.serial('the help page answers the usual questions and is in the menu', async t => {
  const user = await signIn(t);

  const res = await user.get('/ayuda').expect(200);

  for (const text of ['He olvidado mi contraseña', 'He cambiado de móvil', 'Mi buzón está lleno', 'Escribir a Informática', 'informatica@arandadeduero.es']) {
    t.true(res.text.includes(text), text);
  }
  t.true(res.text.includes('href="/ayuda" class="nav-link active"'));
  // Links out of the portal open apart; links inside it do not
  t.regex(res.text, /href="https:\/\/mysignins\.microsoft\.com\/security-info" class="[^"]*" target="_blank"/);
  t.regex(res.text, /href="\/groups" class="[^"]*" >/);
});

test.serial('a message goes to IT from the user\'s mailbox with the account\'s state', async t => {
  const user = await signIn(t);

  const res = await contact(user, { subject: '  No me abre\n Teams ', message: 'Se queda en blanco al entrar.', includeAccount: 'on' })
    .set('User-Agent', 'TestBrowser/1.0')
    .expect(302);

  t.is(res.header.location, '/ayuda?sent=1');
  const message = sentMessage();
  t.deepEqual(message.toRecipients.map(r => r.emailAddress.address), ['informatica@arandadeduero.es']);
  t.is(message.subject, '[m365-ayuda] No me abre Teams');
  for (const text of [
    'Se queda en blanco al entrar.',
    'Cuenta: Alice Example <alice@arandadeduero.es>',
    'Licencias: Microsoft 365 Empresa Estándar',
    'Último cambio de contraseña: 2026-09-01T10:00:00Z',
    'Correo de recuperación: sí',
    'Métodos de inicio de sesión registrados: 2',
    'Navegador: TestBrowser/1.0',
  ]) {
    t.true(message.body.content.includes(text), text);
  }
  // The recovery address itself is not sent
  t.false(message.body.content.includes('ana@personal.example'));

  // The log says a message was sent, not what it said
  const entry = auditEvents('help.contact').at(-1);
  t.like(entry, { actor: 'alice@arandadeduero.es', includeAccount: true });
  t.false(JSON.stringify(entry).includes('blanco'));

  const page = await user.get(res.header.location).expect(200);
  t.true(page.text.includes('Mensaje enviado a Informática'));
});

test.serial('the account\'s state is left out when the user unticks it', async t => {
  const user = await signIn(t);

  await contact(user, { subject: 'Duda', message: 'Solo una pregunta.' }).expect(302);

  t.is(sentMessage().body.content, 'Solo una pregunta.');
  t.is(http.callsTo('get', '/me/licenseDetails').length, 0);
  t.like(auditEvents('help.contact').at(-1), { includeAccount: false });
});

test.serial('the message is still sent when the account cannot be read', async t => {
  http.fail('get', '/v1.0/me', 500);
  http.fail('get', '/me/licenseDetails', 500);
  http.fail('get', '/me/authentication/methods', 403);
  const user = await signIn(t);

  await contact(user, { subject: 'Duda', message: 'Hola', includeAccount: 'on' }).expect(302);

  const { content } = sentMessage().body;
  t.true(content.includes('Cuenta: Alice Example'));
  t.false(content.includes('Licencias:'));
  t.false(content.includes('Métodos de inicio'));
});

test.serial('a message needs a subject and a text of reasonable length', async t => {
  const user = await signIn(t);

  await contact(user, { subject: '', message: 'Hola' }).expect(400);
  await contact(user, { subject: 'Duda', message: '   ' }).expect(400);
  await contact(user, { subject: 'a'.repeat(151), message: 'Hola' }).expect(400);
  await contact(user, { subject: 'Duda', message: 'a'.repeat(5001) }).expect(400);

  t.is(http.callsTo('post', SEND).length, 0);
});

test.serial('a message that could not be sent says how to reach IT', async t => {
  http.fail('post', SEND, 500);
  const user = await signIn(t);
  const before = auditEvents('help.contact').length;

  const res = await contact(user, { subject: 'Duda', message: 'Hola' }).expect(502);

  t.true(res.text.includes('Escribe directamente a informatica@arandadeduero.es'));
  t.is(auditEvents('help.contact').length, before);
});

test.serial('writing needs the CSRF token, and the page a signed-in user', async t => {
  const user = await signIn(t);

  await user.postWithoutToken('/ayuda/contacto').type('form').send({ subject: 'Duda', message: 'Hola' }).expect(403);
  t.is(http.callsTo('post', SEND).length, 0);

  const res = await request(app).get('/ayuda').expect(302);
  t.is(res.header.location, '/login');
  t.is(httpError(500).response.status, 500);
});

test.serial('the help page explains what Microsoft 365 is and what there is in it', async t => {
  const user = await signIn(t);

  const res = await user.get('/ayuda').expect(200);

  for (const text of ['Qué es Microsoft 365', 'Cómo se entra', 'Qué tenemos y para qué sirve', 'Dónde guardo cada cosa', 'Qué puedes hacer en este portal']) {
    t.true(res.text.includes(text), text);
  }
  for (const tool of ['Outlook', 'Teams', 'OneDrive', 'SharePoint', 'Word, Excel y PowerPoint', 'Forms', 'Planner y To Do']) {
    t.true(res.text.includes(`<h4 class="h6 mb-1">${tool}</h4>`), tool);
  }
  t.true(res.text.includes('href="https://teams.microsoft.com"'));
  // What each person has is on their account page, not claimed here
  t.true(res.text.includes('depende de tu licencia'));
  t.true(res.text.includes('href="https://aytoarandaduero.sharepoint.com"'));
  // Explained before the questions
  t.true(res.text.indexOf('Qué es Microsoft 365') < res.text.indexOf('Preguntas habituales'));
});
