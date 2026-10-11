/**
 * Owned Group Tests
 * What the owner of a group sees and can change
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

const BOB = { username: 'bob@arandadeduero.es', name: 'Bob Owner', localAccountId: 'bob-id' };

const TEAM = '11111111-1111-4111-8111-111111111111';
const LIST = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GUEST = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NEW = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const OWNED = [
  { id: TEAM, displayName: 'Equipo Obras', groupTypes: ['Unified'], mailEnabled: true, securityEnabled: false, mail: 'obras@arandadeduero.es' },
  { id: LIST, displayName: 'DIST Avisos', groupTypes: [], mailEnabled: true, securityEnabled: false, mail: 'avisos@arandadeduero.es' },
];

// The stub cannot tell users apart: tests set what "groups I own" answers
let ownedGroups;

test.beforeEach(() => {
  ownedGroups = OWNED;
  http.reset();
  http.on('get', '/me/ownedObjects/microsoft.graph.group', () => ({ value: ownedGroups }));
  http.on('get', `/groups/${TEAM}/owners`, { value: [{ id: 'bob-id', displayName: 'Bob Owner', mail: BOB.username }] });
  http.on('get', `/groups/${LIST}/owners`, { value: [{ id: 'bob-id', displayName: 'Bob Owner' }, { id: 'x', displayName: 'Zoe Second' }] });
  http.on('get', `/groups/${TEAM}/members/microsoft.graph.user`, {
    value: [
      { id: GUEST, displayName: 'Proveedor Externo', mail: 'contacto@proveedor.example', userType: 'Guest' },
      { id: ANA, displayName: 'Ana García', mail: 'ana@arandadeduero.es', userType: 'Member' },
    ],
  });
  http.on('get', `/groups/${LIST}/members/microsoft.graph.user`, { value: [{ id: ANA, displayName: 'Ana García', mail: 'ana@arandadeduero.es' }] });
  http.on('get', '/v1.0/users', {
    value: [
      { id: ANA, displayName: 'Ana García', mail: 'ana@arandadeduero.es' },
      { id: NEW, displayName: 'Nuevo Compañero', mail: 'nuevo@arandadeduero.es' },
    ],
  });
  http.on('post', `/groups/${TEAM}/members/$ref`, {});
  http.on('delete', `/groups/${TEAM}/members/${ANA}/$ref`, {});
});

const changes = () => http.calls.filter(call => call.method !== 'get');

test.serial('the owner sees their groups, and which one depends on them alone', async t => {
  const bob = await signIn(t, BOB);

  const res = await bob.get('/groups/owned').expect(200);

  t.true(res.text.includes('Equipo Obras'));
  t.true(res.text.includes('DIST Avisos'));
  t.true(res.text.includes(`href="/groups/owned/${TEAM}"`));
  // Only the team has a single owner
  t.is(res.text.split('Eres el único propietario').length - 1, 1);
});

test.serial('an owner list that cannot be read is not reported as a single owner', async t => {
  http.fail('get', `/groups/${TEAM}/owners`, 500);
  const bob = await signIn(t, BOB);

  const res = await bob.get('/groups/owned').expect(200);

  t.false(res.text.includes('Eres el único propietario'));
});

test.serial('somebody who owns nothing is told so', async t => {
  ownedGroups = [];
  const alice = await signIn(t);

  const res = await alice.get('/groups/owned').expect(200);

  t.true(res.text.includes('No eres propietario de ningún grupo'));
});

test.serial('the group page lists members, points out guests and offers who can be added', async t => {
  const bob = await signIn(t, BOB);

  const res = await bob.get(`/groups/owned/${TEAM}`).expect(200);

  t.true(res.text.includes('Miembros (2)'));
  t.true(res.text.includes('Invitado externo'));
  t.regex(res.text, /hay <strong>1<\/strong> persona de fuera del Ayuntamiento/);
  t.true(res.text.includes('Este grupo solo tiene un propietario'));
  // Sorted by name, whatever order Graph answers in
  t.true(res.text.indexOf('Ana García') < res.text.indexOf('Proveedor Externo'));
  // Somebody already in the group is not offered again
  t.true(res.text.includes(`<option value="${NEW}">Nuevo Compañero (nuevo@arandadeduero.es)</option>`));
  t.false(res.text.includes(`<option value="${ANA}">`));
});

test.serial('the owner adds a member with their own token', async t => {
  const bob = await signIn(t, BOB);

  const res = await bob.post(`/groups/owned/${TEAM}/members`).type('form').send({ userId: NEW }).expect(302);

  t.is(res.header.location, `/groups/owned/${TEAM}?changed=added`);
  const [call] = http.callsTo('post', `/groups/${TEAM}/members/$ref`);
  t.true(call.data['@odata.id'].endsWith(`/directoryObjects/${NEW}`));
  t.is(call.config.headers.Authorization, 'Bearer user-token');
  t.like(auditEvents('group.member_added').at(-1), { actor: BOB.username, groupId: TEAM, member: NEW });

  const page = await bob.get(res.header.location).expect(200);
  t.true(page.text.includes('Persona añadida al grupo'));
});

test.serial('the owner removes a member', async t => {
  const bob = await signIn(t, BOB);

  const res = await bob.post(`/groups/owned/${TEAM}/members/${ANA}/remove`).expect(302);

  t.is(res.header.location, `/groups/owned/${TEAM}?changed=removed`);
  const [call] = http.callsTo('delete', `/groups/${TEAM}/members/${ANA}/$ref`);
  t.is(call.config.headers.Authorization, 'Bearer user-token');
  t.like(auditEvents('group.member_removed').at(-1), { actor: BOB.username, groupId: TEAM, member: ANA });
});

test.serial('removing somebody who is no longer a member is not an error', async t => {
  http.fail('delete', `/groups/${TEAM}/members/${ANA}/$ref`, 404);
  const bob = await signIn(t, BOB);

  await bob.post(`/groups/owned/${TEAM}/members/${ANA}/remove`).expect(302);
  t.pass();
});

test.serial('somebody who does not own the group can neither see nor change it', async t => {
  ownedGroups = [];
  const alice = await signIn(t);
  const before = auditEvents('group.member_added').length;

  const page = await alice.get(`/groups/owned/${TEAM}`).expect(403);
  await alice.post(`/groups/owned/${TEAM}/members`).type('form').send({ userId: NEW }).expect(403);
  await alice.post(`/groups/owned/${TEAM}/members/${ANA}/remove`).expect(403);
  // A group the owner of another one does not own
  ownedGroups = OWNED;
  await alice.post(`/groups/owned/${OTHER}/members`).type('form').send({ userId: NEW }).expect(403);

  t.true(page.text.includes('Solo los propietarios del grupo pueden gestionarlo'));
  t.false(page.text.includes('Ana García'));
  t.is(changes().length, 0);
  t.is(auditEvents('group.member_added').length, before);
  t.like(auditEvents('permission.denied').at(-1), { actor: ALICE.username });
});

test.serial('a distribution list is shown but cannot be changed here', async t => {
  const bob = await signIn(t, BOB);

  const page = await bob.get(`/groups/owned/${LIST}`).expect(200);
  const add = await bob.post(`/groups/owned/${LIST}/members`).type('form').send({ userId: NEW }).expect(400);
  await bob.post(`/groups/owned/${LIST}/members/${ANA}/remove`).expect(400);

  t.true(page.text.includes('se gestionan en Exchange'));
  t.false(page.text.includes('>Quitar</button>'));
  t.false(page.text.includes('name="userId"'));
  t.true(add.text.includes('se gestionan en Exchange'));
  t.is(changes().length, 0);
});

test.serial('only a directory ID is accepted as the person to add or remove', async t => {
  const bob = await signIn(t, BOB);

  for (const userId of ['', 'ana@arandadeduero.es', `${NEW}/../../x`, ['a', 'b']]) {
    await bob.post(`/groups/owned/${TEAM}/members`).type('form').send({ userId }).expect(400);
  }
  await bob.post(`/groups/owned/${TEAM}/members/not-an-id/remove`).expect(400);

  t.is(changes().length, 0);
});

test.serial('a refusal by Microsoft is an error, not a silent success', async t => {
  http.on('post', `/groups/${TEAM}/members/$ref`, () => { throw httpError(403); });
  const bob = await signIn(t, BOB);
  const before = auditEvents('group.member_added').length;

  await bob.post(`/groups/owned/${TEAM}/members`).type('form').send({ userId: NEW }).expect(500);

  t.is(auditEvents('group.member_added').length, before);
});

test.serial('changes need the CSRF token, and the pages a signed-in user', async t => {
  const bob = await signIn(t, BOB);

  await bob.postWithoutToken(`/groups/owned/${TEAM}/members`).type('form').send({ userId: NEW }).expect(403);
  await bob.postWithoutToken(`/groups/owned/${TEAM}/members/${ANA}/remove`).expect(403);
  t.is(changes().length, 0);

  for (const path of ['/groups/owned', `/groups/owned/${TEAM}`]) {
    const res = await request(app).get(path).expect(302);
    t.is(res.header.location, '/login', path);
  }
  t.truthy(appConfig.ADMIN_EMAIL);
});
