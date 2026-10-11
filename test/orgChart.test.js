/**
 * Org Chart Tests
 * How the directory is turned into the tree the org chart page draws
 */

require('./helpers/env');

const test = require('ava').default;
const { buildOrgChart, ORG_NODE_ID } = require('../services/orgChart');

const user = (id, managerId = null, extra = {}) => ({ id, displayName: `Persona ${id}`, mail: `${id}@example.test`, managerId, ...extra });
const ids = (people) => people.map(person => person.id);

test('the tree is the configured person and everybody below, whatever the case of the address', t => {
  const { nodes, unplaced } = buildOrgChart(
    [user('boss'), user('head', 'boss'), user('clerk', 'head'), user('other')],
    { rootEmail: 'BOSS@example.test' },
  );

  t.deepEqual(ids(nodes), ['boss', 'head', 'clerk']);
  t.deepEqual(nodes.map(node => node.parentId), [null, 'boss', 'head']);
  t.deepEqual(ids(unplaced), ['other']);
});

test('the top of the tree has no parent even when the directory gives them a manager', t => {
  // A parent that is not in the tree makes the chart library refuse to draw
  const { nodes, unplaced } = buildOrgChart(
    [user('above'), user('boss', 'above'), user('clerk', 'boss')],
    { rootEmail: 'boss@example.test' },
  );

  t.is(nodes[0].id, 'boss');
  t.is(nodes[0].parentId, null);
  t.deepEqual(ids(unplaced), ['above']);
});

test('people outside the tree are listed with the name of their manager', t => {
  const { unplaced } = buildOrgChart(
    [user('boss'), user('clerk', 'boss'), user('zeta', 'alfa'), user('alfa'), user('gone', 'deleted-id')],
    { rootEmail: 'boss@example.test' },
  );

  t.deepEqual(unplaced.map(person => [person.id, person.managerName]), [
    ['alfa', null],
    ['gone', null],
    ['zeta', 'Persona alfa'],
  ]);
});

test('without the configured person, the only one with people below is the top', t => {
  const { nodes, unplaced } = buildOrgChart(
    [user('clerk', 'boss'), user('boss'), user('mailbox')],
    { rootEmail: 'nobody@example.test' },
  );

  t.deepEqual(ids(nodes), ['boss', 'clerk']);
  t.deepEqual(ids(unplaced), ['mailbox']);
});

test('several people at the top hang from a node named after the organization', t => {
  const { nodes } = buildOrgChart(
    [user('a'), user('a1', 'a'), user('b'), user('b1', 'b')],
    { orgName: 'Ayuntamiento' },
  );

  t.like(nodes[0], { id: ORG_NODE_ID, name: 'Ayuntamiento', parentId: null, virtual: true });
  t.deepEqual(nodes.slice(1).map(node => [node.id, node.parentId]), [['a', ORG_NODE_ID], ['b', ORG_NODE_ID], ['a1', 'a'], ['b1', 'b']]);
});

test('a loop of managers ends and nobody is drawn twice', t => {
  const { nodes, unplaced } = buildOrgChart(
    [user('boss', 'clerk'), user('clerk', 'boss'), user('x', 'y'), user('y', 'x')],
    { rootEmail: 'boss@example.test' },
  );

  t.deepEqual(ids(nodes), ['boss', 'clerk']);
  t.deepEqual(ids(unplaced), ['x', 'y']);
});

test('nobody with a manager means no tree, and everybody is still listed', t => {
  const { nodes, unplaced } = buildOrgChart([user('a'), user('b')], {});

  t.deepEqual(nodes, []);
  t.deepEqual(ids(unplaced), ['a', 'b']);
});

test('a person without a name is shown by their address, and empty fields are null', t => {
  const { nodes } = buildOrgChart(
    [user('boss', null, { displayName: null, jobTitle: '' }), user('clerk', 'boss', { displayName: null, mail: null })],
    { rootEmail: 'boss@example.test' },
  );

  t.like(nodes[0], { name: 'boss@example.test', jobTitle: null, department: null });
  t.like(nodes[1], { name: 'Sin nombre', mail: null });
});
