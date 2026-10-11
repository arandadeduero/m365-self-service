/**
 * Sharing Tests
 * What a person's OneDrive shares outside the organization, and taking it back
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, signInAgent, getCsrfToken, auditEvents } = require('./helpers/stubs');
const { describePermission, describeSharing } = require('../services/sharing');

const http = stubAxios();
stubMsal();

const app = require('../server');

const DOMAIN = 'arandadeduero.es';
const owner = { id: 'own', roles: ['owner'], grantedToV2: { user: { email: 'alice@arandadeduero.es' } } };
const anyone = { id: 'anon', roles: ['read'], link: { scope: 'anonymous', type: 'view' }, expirationDateTime: '2026-12-31T00:00:00Z' };
const org = { id: 'org', roles: ['write'], link: { scope: 'organization', type: 'edit' } };
const colleague = { id: 'col', roles: ['read'], grantedToV2: { user: { email: 'bob@arandadeduero.es' } } };
const guest = { id: 'ext', roles: ['write'], grantedToIdentitiesV2: [{ user: { email: 'carol@gmail.com' } }, { user: { email: 'bob@arandadeduero.es' } }] };
const b2bGuest = { id: 'b2b', roles: ['read'], grantedToV2: { user: { email: 'dave_gmail.com#EXT#@arandadeduero.onmicrosoft.com' } } };
const nameless = { id: 'none', roles: ['read'], grantedToV2: { user: { displayName: 'Alguien' } } };

test('each permission says who can reach the item and whether that is outside', t => {
  t.is(describePermission(owner, DOMAIN), null);
  t.like(describePermission(anyone, DOMAIN), { kind: 'anyone', outside: true, roles: ['puede ver'], expires: '2026-12-31T00:00:00Z' });
  t.like(describePermission(org, DOMAIN), { kind: 'organization', outside: false });
  t.like(describePermission(colleague, DOMAIN), { kind: 'people', outside: false, emails: ['bob@arandadeduero.es'] });
  t.like(describePermission(guest, DOMAIN), { kind: 'people', outside: true, outsiders: ['carol@gmail.com'] });
  t.like(describePermission(b2bGuest, DOMAIN), { outside: true });
  // No address: not called an outsider
  t.like(describePermission(nameless, DOMAIN), { outside: false, who: 'Personas concretas' });
});

test('the listing keeps only what reaches outside, counts the rest, and tells unchecked apart', t => {
  const result = describeSharing([
    { item: { id: 'i1', name: 'Presupuesto.xlsx', webUrl: 'https://x/1', parentReference: { path: '/drive/root:/Obras' } }, permissions: [owner, anyone, colleague] },
    { item: { id: 'i2', name: 'Fotos', folder: {}, parentReference: { path: '/drive/root:' } }, permissions: [owner, org] },
    { item: { id: 'i3', name: 'Acta.docx' }, permissions: null },
  ], DOMAIN);

  t.is(result.insideCount, 1);
  t.is(result.uncheckedCount, 1);
  t.deepEqual(result.outside.map(item => [item.name, item.path, item.shares.map(share => share.kind)]), [['Presupuesto.xlsx', '/Obras', ['anyone']]]);
});

let agent;
let csrf;
test.before(async () => {
  agent = request.agent(app);
  await signInAgent(agent);
  csrf = await getCsrfToken(agent);
});
test.after.always(() => agent.get('/auth/logout'));
test.beforeEach(() => {
  http.reset();
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
});

const ITEM = '01BYE5RZ6QN3ZWBTUFOFD3GSPGOHDJDOO4';

test.serial('GET /account/sharing walks the drive and lists what reaches outside, with a way to stop it', async t => {
  // Two pages: the stub matches the end of the URL, and the next link carries its token
  http.on('get', '/me/drive/root/delta', { value: [{ id: ITEM, name: 'Presupuesto.xlsx', shared: { scope: 'anonymous' }, webUrl: 'https://x/1', parentReference: { path: '/drive/root:/Obras' } }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=2' });
  http.on('get', '/me/drive/root/delta?token=2', { value: [{ id: 'plain', name: 'Nota.txt' }, { id: 'gone', name: 'Vieja.docx', shared: {}, deleted: {} }] });
  http.on('get', `/items/${ITEM}/permissions`, { value: [owner, anyone] });

  const res = await agent.get('/account/sharing').expect(200);

  t.true(res.text.includes('Presupuesto.xlsx'));
  t.true(res.text.includes('Cualquiera con el enlace'));
  t.true(res.text.includes(`action="/account/sharing/${ITEM}/permissions/anon/remove"`));
  t.false(res.text.includes('Vieja.docx'));
  t.is(http.callsTo('get', '/me/drive/root/delta')[0].config.params.$select, 'id,name,webUrl,shared,file,folder,deleted,parentReference');
  // Only the shared item's permissions were asked for
  t.is(http.calls.filter(call => call.url.includes('/permissions')).length, 1);
});

test.serial('GET /account/sharing tells "nothing outside" apart from "could not look"', async t => {
  http.on('get', '/me/drive/root/delta', { value: [{ id: ITEM, name: 'Acta.docx', shared: {} }] });
  http.on('get', `/items/${ITEM}/permissions`, { value: [owner, colleague] });
  const inside = await agent.get('/account/sharing').expect(200);
  t.true(inside.text.includes('Nada de tu OneDrive llega a nadie de fuera del Ayuntamiento. Compartes 1 elemento con compañeros.'));

  http.fail('get', '/me/drive/root/delta', 403);
  const unknown = await agent.get('/account/sharing').expect(200);
  t.true(unknown.text.includes('no se puede consultar tu OneDrive'));
  t.false(unknown.text.includes('Nada de tu OneDrive'));
});

test.serial('a share is removed only if the item still has it, and the audit log says what kind it was', async t => {
  http.on('get', `/items/${ITEM}/permissions`, { value: [owner, guest] });
  http.on('delete', `/items/${ITEM}/permissions/ext`, {});
  const post = (path) => agent.post(path).set('X-CSRF-Token', csrf);

  await post(`/account/sharing/${ITEM}/permissions/nope/remove`).expect(404);
  await post('/account/sharing/..%2F..%2Fx/permissions/ext/remove').expect(404);
  t.is(http.calls.filter(call => call.method === 'delete').length, 0);

  const res = await post(`/account/sharing/${ITEM}/permissions/ext/remove`).expect(302);
  t.is(res.header.location, '/account/sharing');
  t.is(http.callsTo('delete', `/items/${ITEM}/permissions/ext`).length, 1);
  t.like(auditEvents('files.unshared').at(-1), { item: ITEM, kind: 'people', with: ['carol@gmail.com', 'bob@arandadeduero.es'] });

  http.on('get', '/me/drive/root/delta', { value: [] });
  const page = await agent.get('/account/sharing').expect(200);
  t.true(page.text.includes('carol@gmail.com, bob@arandadeduero.es ya no tiene acceso.'));
});
