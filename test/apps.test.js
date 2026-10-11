/**
 * Apps Tests
 * The applications that hold permissions on a person's account
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, signInAgent } = require('./helpers/stubs');
const { describeAppGrants } = require('../services/appGrants');

const http = stubAxios();
stubMsal();

const app = require('../server');

const SP_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const SP_B = 'aaaaaaaa-0000-0000-0000-000000000002';

let agent;

test.before(async () => {
  agent = request.agent(app);
  await signInAgent(agent);
});
test.after.always(() => agent.get('/auth/logout'));
test.beforeEach(() => {
  http.reset();
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
});

test('apps are grouped from their grants, content-reaching ones first, and this portal is marked', t => {
  const grants = [
    { clientId: SP_A, consentType: 'Principal', scope: 'User.Read Mail.Read' },
    { clientId: SP_A, consentType: 'Principal', scope: 'offline_access' },
    { clientId: SP_B, consentType: 'AllPrincipals', scope: 'User.Read Something.New' },
  ];
  const principals = new Map([
    [SP_A, { appId: 'app-a', displayName: 'Lector de correo', publisherName: 'Acme' }],
    [SP_B, { appId: 'test-client-id', displayName: 'Mi Microsoft 365', verifiedPublisher: { displayName: 'Ayuntamiento' } }],
  ]);

  const apps = describeAppGrants(grants, principals, 'test-client-id');

  t.deepEqual(apps.map(a => a.name), ['Lector de correo', 'Mi Microsoft 365']);
  t.like(apps[0], { publisher: 'Acme', verified: false, forMe: true, forEveryone: false, reachesContent: true, isThisPortal: false });
  t.deepEqual(apps[0].permissions.map(p => p.text), ['Leer tu correo', 'Ver tu perfil', 'Seguir teniendo acceso sin volver a preguntarte']);
  t.like(apps[1], { publisher: 'Ayuntamiento', verified: true, forEveryone: true, forMe: false, isThisPortal: true, reachesContent: false });
  t.deepEqual(apps[1].permissions.find(p => p.scope === 'Something.New'), { scope: 'Something.New', text: 'Something.New', reachesContent: false });
});

test('only a web address is offered as the app\'s link', t => {
  const grant = [{ clientId: SP_A, consentType: 'Principal', scope: 'User.Read' }];
  const describe = (homepage) => describeAppGrants(grant, new Map([[SP_A, { displayName: 'X', homepage }]]), '')[0].homepage;

  t.is(describe('https://acme.example/app'), 'https://acme.example/app');
  t.is(describe('javascript:alert(1)'), null);
  t.is(describe('not a url'), null);
  t.is(describe(undefined), null);
});

test.serial('GET /account/apps names each app, who authorised it, and what it may do', async t => {
  http.on('get', '/me/oauth2PermissionGrants', { value: [
    { clientId: SP_A, consentType: 'Principal', scope: 'User.Read Files.ReadWrite' },
    { clientId: SP_B, consentType: 'AllPrincipals', scope: 'User.Read' },
  ] });
  http.on('get', `/servicePrincipals/${SP_A}`, { id: SP_A, appId: 'app-a', displayName: 'Convertidor PDF', publisherName: 'Acme', homepage: 'https://acme.example' });
  http.on('get', `/servicePrincipals/${SP_B}`, { id: SP_B, appId: 'app-b', displayName: 'Intranet' });

  const res = await agent.get('/account/apps').expect(200);

  t.true(res.text.includes('Convertidor PDF'));
  t.true(res.text.includes('Llega a tu correo o archivos'));
  t.true(res.text.includes('Leer y cambiar tus archivos'));
  t.true(res.text.includes('La autorizaste tú'));
  t.true(res.text.includes('Intranet'));
  t.true(res.text.includes('Autorizada por Informática para todo el Ayuntamiento'));
  t.true(res.text.includes('href="https://myapplications.microsoft.com/"'));
  t.true(res.text.indexOf('Convertidor PDF') < res.text.indexOf('Intranet'));
});

test.serial('GET /account/apps says so when the grants cannot be read, and copes with an unknown app', async t => {
  http.fail('get', '/me/oauth2PermissionGrants', 403);
  const unknown = await agent.get('/account/apps').expect(200);
  t.true(unknown.text.includes('no se puede consultar qué aplicaciones'));

  http.on('get', '/me/oauth2PermissionGrants', { value: [{ clientId: SP_A, consentType: 'Principal', scope: 'User.Read' }] });
  http.fail('get', `/servicePrincipals/${SP_A}`, 404);
  const nameless = await agent.get('/account/apps').expect(200);
  t.true(nameless.text.includes('Aplicación sin nombre'));
  t.true(nameless.text.includes('Editor desconocido'));
});
