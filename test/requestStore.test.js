/**
 * Request Store Tests
 */

require('./helpers/env');

const fs = require('fs');
const path = require('path');
const test = require('ava').default;
const store = require('../services/requestStore');

const FILE = path.join(process.env.DATA_DIR, 'group-requests.json');

const ALICE = { id: 'alice-id', name: 'Alice', email: 'alice@example.test' };
const BOB = { id: 'bob-id', name: 'Bob', email: 'bob@example.test' };

test.beforeEach(() => {
  fs.rmSync(FILE, { force: true });
});

test.serial('a new request is pending and saved to the file', t => {
  const { request, created } = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: ALICE });

  t.true(created);
  t.like(request, { groupId: 'g1', groupName: 'Obras', requester: ALICE, status: 'pending', resolvedBy: null });
  t.regex(request.id, /^[0-9a-f-]{36}$/);
  t.deepEqual(JSON.parse(fs.readFileSync(FILE, 'utf8')), [request]);
  t.deepEqual(store.getRequest(request.id), request);
});

test.serial('the same person asking again for the same group gets the pending request back', t => {
  const first = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: ALICE });
  const again = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: ALICE });
  const otherGroup = store.createRequest({ groupId: 'g2', groupName: 'Archivo', requester: ALICE });
  const otherPerson = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: BOB });

  t.false(again.created);
  t.is(again.request.id, first.request.id);
  t.true(otherGroup.created);
  t.true(otherPerson.created);
});

test.serial('requests are listed by group for owners and by requester for users', t => {
  const a1 = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: ALICE }).request;
  const a2 = store.createRequest({ groupId: 'g2', groupName: 'Archivo', requester: ALICE }).request;
  const b1 = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: BOB }).request;

  t.deepEqual(store.listPendingForGroups(['g1']).map(r => r.id), [a1.id, b1.id]);
  t.deepEqual(store.listPendingForGroups(['g3']), []);
  // Newest first
  t.deepEqual(store.listByRequester('alice-id').map(r => r.id), [a2.id, a1.id]);
});

test.serial('resolving closes a request once and records who decided', t => {
  const { request } = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: ALICE });

  const resolved = store.resolveRequest(request.id, 'approved', 'bob@example.test');

  t.like(resolved, { status: 'approved', resolvedBy: 'bob@example.test' });
  t.false(Number.isNaN(Date.parse(resolved.resolvedAt)));
  t.is(store.resolveRequest(request.id, 'rejected', 'bob@example.test'), null);
  t.is(store.resolveRequest('no-such-id', 'approved', 'bob@example.test'), null);
  t.is(store.getRequest(request.id).status, 'approved');
  t.deepEqual(store.listPendingForGroups(['g1']), []);
});

test.serial('after a request is resolved the same person can ask again', t => {
  const first = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: ALICE }).request;
  store.resolveRequest(first.id, 'rejected', 'bob@example.test');

  const second = store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: ALICE });

  t.true(second.created);
  t.not(second.request.id, first.id);
});

test.serial('a damaged file is reported instead of being replaced by an empty one', t => {
  fs.writeFileSync(FILE, '{ not json');

  t.throws(() => store.createRequest({ groupId: 'g1', groupName: 'Obras', requester: ALICE }));
  t.is(fs.readFileSync(FILE, 'utf8'), '{ not json');
});
