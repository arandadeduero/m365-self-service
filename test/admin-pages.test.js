/**
 * Admin Pages Tests
 * Licenses, accounts to look at, Microsoft's messages, pending requests,
 * settings and the audit export, for administrators only
 */

require('./helpers/env');

const fs = require('fs');
const path = require('path');
const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, signInAgent, getCsrfToken, auditEvents } = require('./helpers/stubs');
const { reviewAccounts, describeLicenseStock } = require('../services/accountReview');
const { resetMessageCache } = require('../services/messageCenterService');

const http = stubAxios();
const msal = stubMsal();

const permissions = require('../config/permissions');
const appConfig = require('../config/appConfig');
const requestStore = require('../services/requestStore');
const app = require('../server');

const ROLES = '/me/memberOf/microsoft.graph.directoryRole';
const ADMIN = { username: 'admin@arandadeduero.es', name: 'Ada Admin', localAccountId: 'admin-id' };
const USER = { username: 'alice@arandadeduero.es', name: 'Alice Example', localAccountId: 'alice-id' };

async function signInAs(t, account, { admin }) {
  msal.account = account;
  const agent = request.agent(app);
  await signInAgent(agent);
  t.teardown(() => agent.get('/auth/logout'));
  http.on('get', ROLES, { value: admin ? [{ displayName: 'Global Administrator' }] : [] });
  return agent;
}

test.beforeEach(() => {
  http.reset();
  resetMessageCache();
  http.on('get', '/v1.0/me', { displayName: 'Someone' });
  permissions.DOMAIN = 'arandadeduero.es';
});

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString();

test('the review finds idle, unprotected, expired and mis-licensed accounts, and says what it cannot know', t => {
  const users = [
    { id: 'a', displayName: 'Ana', userPrincipalName: 'ana@x', accountEnabled: true, assignedLicenses: [{}], lastPasswordChangeDateTime: day(100), signInActivity: { lastSignInDateTime: day(120) } },
    { id: 'b', displayName: 'Bea', userPrincipalName: 'bea@x', accountEnabled: true, assignedLicenses: [{}], lastPasswordChangeDateTime: day(10), signInActivity: { lastSignInDateTime: day(200), lastNonInteractiveSignInDateTime: day(1) } },
    { id: 'c', displayName: 'Carl', userPrincipalName: 'carl@x', accountEnabled: false, assignedLicenses: [{}] },
    { id: 'd', displayName: 'Dani', userPrincipalName: 'dani@x', accountEnabled: true, assignedLicenses: [] },
    { id: 'g', displayName: 'Guest', userPrincipalName: 'g#EXT#@x', userType: 'Guest', accountEnabled: true, assignedLicenses: [] },
    { id: 'n', displayName: 'Nuevo', userPrincipalName: 'nuevo@x', accountEnabled: true, assignedLicenses: [{}], createdDateTime: day(200) },
  ];
  const mfa = [{ id: 'a', isMfaRegistered: false }, { id: 'b', isMfaRegistered: true }, { id: 'c', isMfaRegistered: false }];

  const review = reviewAccounts(users, { signInsKnown: true, mfa, passwordMaxAgeDays: 90 });

  t.is(review.total, 5);
  t.is(review.guests, 1);
  t.deepEqual(review.idle.map(p => [p.name, p.note]), [['Ana', 'Último inicio de sesión hace 120 días'], ['Nuevo', 'Nunca ha iniciado sesión']]);
  t.deepEqual(review.withoutMfa.map(p => p.name), ['Ana']);
  t.deepEqual(review.expiredPassword.map(p => p.name), ['Ana']);
  t.deepEqual(review.disabledWithLicense.map(p => p.name), ['Carl']);
  t.deepEqual(review.enabledWithoutLicense.map(p => p.name), ['Dani']);

  const blind = reviewAccounts(users, { signInsKnown: false, mfa: null, passwordMaxAgeDays: null });
  t.is(blind.idle, null);
  t.is(blind.withoutMfa, null);
  t.is(blind.expiredPassword, null);
});

test('license stock says what is running out, named from the catalog', t => {
  const stock = describeLicenseStock([
    { skuPartNumber: 'O365_BUSINESS_PREMIUM', prepaidUnits: { enabled: 100 }, consumedUnits: 95 },
    { skuPartNumber: 'FLOW_FREE', prepaidUnits: { enabled: 10000 }, consumedUnits: 3 },
    { skuPartNumber: 'MYSTERY', prepaidUnits: { enabled: 5 }, consumedUnits: 5 },
    { skuPartNumber: 'NONE', prepaidUnits: { enabled: 0 }, consumedUnits: 0 },
  ], { O365_BUSINESS_PREMIUM: 'Microsoft 365 Empresa Estándar' });

  t.deepEqual(stock.map(s => [s.name, s.left, s.low]), [['MYSTERY', 0, true], ['Microsoft 365 Empresa Estándar', 5, true], ['FLOW_FREE', 9997, false]]);
});

test.serial('the admin pages are for administrators only', async t => {
  const user = await signInAs(t, USER, { admin: false });
  for (const path of ['/admin/cuentas', '/admin/licencias', '/admin/avisos', '/admin/solicitudes', '/admin/ajustes', '/admin/audit.csv']) {
    await user.get(path).expect(403);
  }
  t.pass();
});

test.serial('GET /admin/licencias and /admin/cuentas read Graph and show the lists', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });
  http.on('get', '/v1.0/subscribedSkus', { value: [{ skuPartNumber: 'O365_BUSINESS_PREMIUM', prepaidUnits: { enabled: 50 }, consumedUnits: 49 }] });
  http.on('get', '/v1.0/users', ({ config }) => (config.params.$select.includes('signInActivity')
    ? { value: [{ id: 'a', displayName: 'Ana Idle', userPrincipalName: 'ana@arandadeduero.es', accountEnabled: true, assignedLicenses: [{}], signInActivity: { lastSignInDateTime: day(300) } }] }
    : { value: [] }));
  http.fail('get', '/userRegistrationDetails', 403);

  const licenses = await admin.get('/admin/licencias').expect(200);
  t.true(licenses.text.includes('Microsoft 365 Empresa Estándar'));
  t.true(licenses.text.includes('Se agotan'));

  const accounts = await admin.get('/admin/cuentas').expect(200);
  t.true(accounts.text.includes('Ana Idle'));
  t.true(accounts.text.includes('hace 300 días'));
  t.true(accounts.text.includes('informe de métodos de autenticación necesita'));
  // Read with the app's token, not the administrator's
  t.is(http.callsTo('get', '/v1.0/users')[0].config.headers.Authorization, 'Bearer app-token');
});

test.serial('GET /admin/avisos lists the message center, or says the permission is missing', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });
  http.on('get', '/serviceAnnouncement/messages', { value: [{ id: 'MC1', title: 'Cambio en Outlook', category: 'planForChange', services: ['Exchange Online'], isMajorChange: true, actionRequiredByDateTime: '2026-12-01T00:00:00Z', lastModifiedDateTime: '2026-10-01T00:00:00Z' }] });

  const res = await admin.get('/admin/avisos').expect(200);
  t.true(res.text.includes('Cambio en Outlook'));
  t.true(res.text.includes('Cambio importante'));
  t.true(res.text.includes('href="https://admin.microsoft.com/#/MessageCenter/:/messages/MC1"'));

  resetMessageCache();
  http.fail('get', '/serviceAnnouncement/messages', 403);
  const missing = await admin.get('/admin/avisos').expect(200);
  t.true(missing.text.includes('ServiceMessage.Read.All'));
});

test.serial('GET /admin/solicitudes shows every request still waiting, oldest first', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });
  requestStore.createRequest({ groupId: 'g1', groupName: 'Obras', requester: { id: 'u1', name: 'Bob', email: 'bob@arandadeduero.es' } });

  const res = await admin.get('/admin/solicitudes').expect(200);
  t.true(res.text.includes('Obras'));
  t.true(res.text.includes('Bob'));
  t.true(res.text.includes('<td>hoy</td>'));
});

test.serial('settings saved from the web take effect at once and are audited', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });
  const csrf = await getCsrfToken(admin);
  permissions['/blog'] = ['someone'];
  appConfig.SHARED_MAILBOXES = [];

  await admin.post('/admin/ajustes').set('X-CSRF-Token', csrf).type('form').send({ blogUsers: 'Alice\nbob@arandadeduero.es\n', sharedMailboxes: 'Registro@arandadeduero.es\nobras@gmail.com' }).expect(400);
  t.deepEqual(permissions['/blog'], ['someone']);

  const res = await admin.post('/admin/ajustes').set('X-CSRF-Token', csrf).type('form').send({ blogUsers: 'Alice\nbob@arandadeduero.es\n', sharedMailboxes: 'Registro@arandadeduero.es' }).expect(302);
  t.is(res.header.location, '/admin/ajustes');
  t.deepEqual(permissions['/blog'], ['alice', 'bob']);
  t.deepEqual(appConfig.SHARED_MAILBOXES, ['registro@arandadeduero.es']);
  t.true(fs.existsSync(path.join(process.env.DATA_DIR, 'settings.json')));
  t.like(auditEvents('admin.settings_updated').at(-1), { blogUsers: 2, sharedMailboxes: 1 });

  const page = await admin.get('/admin/ajustes').expect(200);
  t.true(page.text.includes('Guardado. Ya está en vigor.'));
  t.true(page.text.includes('>alice\nbob</textarea>'));
});

test.serial('GET /admin/audit.csv exports the filtered log', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });
  fs.appendFileSync(path.join(process.env.AUDIT_DIR, `${day(0).slice(0, 10)}.log`), JSON.stringify({ time: day(0), event: 'blog.post', actor: 'carol@arandadeduero.es', ip: '203.0.113.9', title: 'Corte' }) + '\n');

  const res = await admin.get('/admin/audit.csv?event=blog.post').expect(200).expect('Content-Type', /text\/csv/);
  t.true(res.text.startsWith('﻿"Fecha";"Evento";"Usuario";"IP";"Detalles"'));
  t.true(res.text.includes('"blog.post";"carol@arandadeduero.es";"203.0.113.9";"{""title"":""Corte""}"'));
  t.false(res.text.includes('auth.sign_in'));
});
