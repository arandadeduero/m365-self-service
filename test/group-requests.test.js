/**
 * Group Request Tests
 * Asking to join a group, and its owners approving or rejecting, with
 * several users signed in against a stubbed Microsoft Graph.
 */

require('./helpers/env');

const fs = require('fs');
const path = require('path');
const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, getCsrfToken, auditEvents, httpError } = require('./helpers/stubs');

const http = stubAxios();
const msal = stubMsal();

const app = require('../server');

const ALICE = { username: 'alice@arandadeduero.es', name: 'Alice Example', localAccountId: 'alice-id' };
const BOB = { username: 'bob@arandadeduero.es', name: 'Bob Owner', localAccountId: 'bob-id' };
const CAROL = { username: 'carol@arandadeduero.es', name: 'Carol Other', localAccountId: 'carol-id' };

const GROUPS = [
  { id: 'g-team', displayName: 'Equipo Obras', groupTypes: ['Unified'], mailEnabled: true, securityEnabled: false },
  { id: 'g-sec', displayName: 'Acceso Archivo', groupTypes: [], mailEnabled: false, securityEnabled: true },
  { id: 'g-dist', displayName: 'DIST Todos', groupTypes: [], mailEnabled: true, securityEnabled: false },
  { id: 'g-orphan', displayName: 'Sin Propietario', groupTypes: ['Unified'], mailEnabled: true, securityEnabled: false },
];

const ADD_MEMBER = '/groups/g-team/members/$ref';

// What Graph answers for "groups I own" and "groups I belong to". The stub
// cannot tell users apart, so tests set these before acting as each user.
let ownedGroups;
let memberOf;

test.beforeEach(() => {
  fs.rmSync(path.join(process.env.DATA_DIR, 'group-requests.json'), { force: true });
  ownedGroups = [];
  memberOf = [];

  http.reset();
  http.on('get', '/v1.0/groups', { value: GROUPS });
  http.on('get', '/me/memberOf', () => ({ value: memberOf }));
  http.on('get', '/me/ownedObjects/microsoft.graph.group', () => ({ value: ownedGroups }));
  http.on('get', '/groups/g-team/owners', { value: [{ id: 'bob-id', mail: BOB.username }] });
  http.on('get', '/groups/g-sec/owners', { value: [{ id: 'bob-id', userPrincipalName: 'bob.upn@arandadeduero.es' }] });
  http.on('get', '/groups/g-orphan/owners', { value: [] });
  http.on('post', '/me/sendMail', {});
  http.on('post', ADD_MEMBER, {});
});

/**
 * Sign in as a user and return an agent with helpers for that session
 */
async function signInAs(t, account) {
  msal.account = account;
  const agent = request.agent(app);
  await agent.get('/auth/callback?code=test-code').expect(302);
  const csrf = await getCsrfToken(agent);
  t.teardown(() => agent.get('/auth/logout'));

  return {
    get: (url) => agent.get(url),
    post: (url) => agent.post(url).set('X-CSRF-Token', csrf),
    postWithoutToken: (url) => agent.post(url),
    ask: (groups) => agent.post('/api/group-access-request').set('X-CSRF-Token', csrf).send({ selectedGroups: groups }),
  };
}

const emails = () => http.callsTo('post', '/me/sendMail').map(call => call.data.message);
const recipients = (message) => message.toRecipients.map(r => r.emailAddress.address);

/**
 * As an owner, find the ID of the only pending request on the page
 */
async function pendingRequestId(owner) {
  const page = await owner.get('/groups/requests').expect(200);
  return page.text.match(/\/groups\/requests\/([0-9a-f-]+)\/approve/)[1];
}

// ------------------------------------------------------------------- asking

test.serial('a request for a group with owners goes to its owners', async t => {
  const alice = await signInAs(t, ALICE);

  const res = await alice.ask(['g-team']).expect(200);

  t.like(res.body, { success: true, sentToOwners: 1, sentToAdmin: 0 });
  t.is(emails().length, 1);
  t.deepEqual(recipients(emails()[0]), [BOB.username]);
  t.true(emails()[0].subject.includes('Equipo Obras'));
  t.true(emails()[0].body.content.includes('Alice Example (alice@arandadeduero.es)'));
  t.true(emails()[0].body.content.includes('http://localhost:3000/groups/requests'));

  const mine = await alice.get('/groups/requests').expect(200);
  t.true(mine.text.includes('Equipo Obras'));
  t.true(mine.text.includes('>Pendiente</span>'));
});

test.serial('groups without owners, and lists Graph cannot manage, still go to the admin mailbox', async t => {
  const alice = await signInAs(t, ALICE);

  const res = await alice.ask(['g-team', 'g-dist', 'g-orphan']).expect(200);

  t.like(res.body, { sentToOwners: 1, sentToAdmin: 2 });
  const toAdmin = emails().find(message => recipients(message)[0] === 'admin@example.test');
  t.true(toAdmin.body.content.includes('DIST Todos (ID: g-dist)'));
  t.true(toAdmin.body.content.includes('Sin Propietario (ID: g-orphan)'));
  t.false(toAdmin.body.content.includes('Equipo Obras'));
  // Owners of a distribution list could not approve it here, so they are not asked
  t.is(http.callsTo('get', '/groups/g-dist/owners').length, 0);
});

test.serial('an owner known only by user principal name is written to there', async t => {
  const alice = await signInAs(t, ALICE);

  await alice.ask(['g-sec']).expect(200);

  t.deepEqual(recipients(emails()[0]), ['bob.upn@arandadeduero.es']);
});

test.serial('asking twice keeps one request and writes to the owners once', async t => {
  const alice = await signInAs(t, ALICE);

  await alice.ask(['g-team']).expect(200);
  await alice.ask(['g-team']).expect(200);

  t.is(emails().length, 1);
  const mine = await alice.get('/groups/requests').expect(200);
  t.is(mine.text.split('>Pendiente</span>').length - 1, 1);
});

test.serial('groups the user already belongs to are ignored', async t => {
  memberOf = [{ id: 'g-team' }];
  const alice = await signInAs(t, ALICE);

  const res = await alice.ask(['g-team']).expect(200);

  t.like(res.body, { sentToOwners: 0, sentToAdmin: 0 });
  t.is(emails().length, 0);
});

test.serial('a request needs at least one group', async t => {
  const alice = await signInAs(t, ALICE);

  await alice.ask([]).expect(400);
  await alice.ask('g-team').expect(400);
  t.is(emails().length, 0);
});

// ----------------------------------------------------------------- deciding

test.serial('an owner approves: the requester is added with the owner\'s token and told', async t => {
  const alice = await signInAs(t, ALICE);
  await alice.ask(['g-team']).expect(200);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  const bob = await signInAs(t, BOB);
  const page = await bob.get('/groups/requests').expect(200);
  t.true(page.text.includes('Alice Example'));
  t.true(page.text.includes('Equipo Obras'));

  const id = await pendingRequestId(bob);
  const res = await bob.post(`/groups/requests/${id}/approve`).expect(302);

  t.is(res.header.location, '/groups/requests');
  const [added] = http.callsTo('post', ADD_MEMBER);
  t.is(added.data['@odata.id'], 'https://graph.microsoft.com/v1.0/directoryObjects/alice-id');
  t.is(added.config.headers.Authorization, 'Bearer user-token');
  t.deepEqual(recipients(emails().at(-1)), [ALICE.username]);
  t.true(emails().at(-1).subject.includes('Ya formas parte de Equipo Obras'));

  const after = await bob.get('/groups/requests').expect(200);
  t.false(after.text.includes('Alice Example'));

  ownedGroups = [];
  const mine = await alice.get('/groups/requests').expect(200);
  t.true(mine.text.includes('Aprobada'));

  t.like(auditEvents('group_request.created').at(-1), { actor: ALICE.username, groupId: 'g-team', requestId: id });
  t.like(auditEvents('group_request.approved').at(-1), { actor: BOB.username, member: ALICE.username, requestId: id });
});

test.serial('an owner rejects: nobody is added and the requester is told', async t => {
  const alice = await signInAs(t, ALICE);
  await alice.ask(['g-team']).expect(200);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  const bob = await signInAs(t, BOB);
  const id = await pendingRequestId(bob);
  await bob.post(`/groups/requests/${id}/reject`).expect(302);

  t.is(http.callsTo('post', ADD_MEMBER).length, 0);
  t.deepEqual(recipients(emails().at(-1)), [ALICE.username]);
  t.like(auditEvents('group_request.rejected').at(-1), { actor: BOB.username, requestId: id });

  ownedGroups = [];
  const mine = await alice.get('/groups/requests').expect(200);
  t.true(mine.text.includes('Rechazada'));
});

test.serial('someone who does not own the group cannot decide, or even see, its requests', async t => {
  const alice = await signInAs(t, ALICE);
  await alice.ask(['g-team']).expect(200);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  const bob = await signInAs(t, BOB);
  const id = await pendingRequestId(bob);

  ownedGroups = [];
  const carol = await signInAs(t, CAROL);
  const page = await carol.get('/groups/requests').expect(200);
  t.false(page.text.includes('Alice Example'));

  const approve = await carol.post(`/groups/requests/${id}/approve`).expect(403);
  await carol.post(`/groups/requests/${id}/reject`).expect(403);
  // Not even the requester can approve their own request
  await alice.post(`/groups/requests/${id}/approve`).expect(403);

  t.true(approve.text.includes('Solo los propietarios'));
  t.is(http.callsTo('post', ADD_MEMBER).length, 0);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  t.is(await pendingRequestId(bob), id);
});

test.serial('a request can be decided once', async t => {
  const alice = await signInAs(t, ALICE);
  await alice.ask(['g-team']).expect(200);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  const bob = await signInAs(t, BOB);
  const id = await pendingRequestId(bob);

  await bob.post(`/groups/requests/${id}/reject`).expect(302);
  await bob.post(`/groups/requests/${id}/approve`).expect(404);
  await bob.post('/groups/requests/no-such-request/approve').expect(404);

  t.is(http.callsTo('post', ADD_MEMBER).length, 0);
});

test.serial('approving someone who is already a member succeeds', async t => {
  const alice = await signInAs(t, ALICE);
  await alice.ask(['g-team']).expect(200);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  const bob = await signInAs(t, BOB);
  const id = await pendingRequestId(bob);
  http.on('post', ADD_MEMBER, () => {
    const error = httpError(400);
    error.response.data.error.message = "One or more added object references already exist for the following modified properties: 'members'.";
    throw error;
  });

  await bob.post(`/groups/requests/${id}/approve`).expect(302);

  const after = await bob.get('/groups/requests').expect(200);
  t.false(after.text.includes('Alice Example'));
});

test.serial('a request stays pending when Graph refuses to add the member', async t => {
  const alice = await signInAs(t, ALICE);
  await alice.ask(['g-team']).expect(200);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  const bob = await signInAs(t, BOB);
  const id = await pendingRequestId(bob);
  http.fail('post', ADD_MEMBER, 403);

  await bob.post(`/groups/requests/${id}/approve`).expect(500);

  t.is(await pendingRequestId(bob), id);
  t.is(auditEvents('group_request.approved').filter(entry => entry.requestId === id).length, 0);
});

test.serial('a decision still stands when the requester cannot be emailed', async t => {
  const alice = await signInAs(t, ALICE);
  await alice.ask(['g-team']).expect(200);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  const bob = await signInAs(t, BOB);
  const id = await pendingRequestId(bob);
  http.fail('post', '/me/sendMail', 500);

  await bob.post(`/groups/requests/${id}/approve`).expect(302);

  t.is(http.callsTo('post', ADD_MEMBER).length, 1);
});

test.serial('deciding needs the CSRF token, and the pages need a signed-in user', async t => {
  const alice = await signInAs(t, ALICE);
  await alice.ask(['g-team']).expect(200);

  ownedGroups = [{ id: 'g-team', displayName: 'Equipo Obras' }];
  const bob = await signInAs(t, BOB);
  const id = await pendingRequestId(bob);

  await bob.postWithoutToken(`/groups/requests/${id}/approve`).expect(403);
  t.is(http.callsTo('post', ADD_MEMBER).length, 0);

  const anonymous = await request(app).get('/groups/requests').expect(302);
  t.is(anonymous.header.location, '/login');
});
