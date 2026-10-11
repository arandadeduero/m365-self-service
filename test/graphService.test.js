/**
 * Microsoft Graph Service Tests
 * Unit tests for services/graphService.js with axios stubbed out
 */

require('./helpers/env');

const test = require('ava').default;
const { stubAxios } = require('./helpers/stubs');

const http = stubAxios();
const graph = require('../services/graphService');

test.beforeEach(() => {
  http.reset();
});

test.serial('getUserProfile sends the bearer token and returns the profile', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice' });

  const profile = await graph.getUserProfile('token-123');

  t.deepEqual(profile, { displayName: 'Alice' });
  t.is(http.calls[0].config.headers.Authorization, 'Bearer token-123');
});

test.serial('getUserProfile throws a generic error that keeps the Graph status', async t => {
  http.fail('get', '/v1.0/me', 401);

  const error = await t.throwsAsync(() => graph.getUserProfile('token'), { message: 'Failed to fetch user profile' });
  t.is(error.graphStatus, 401);
});

test.serial('getUserPhoto returns a buffer when the user has a photo', async t => {
  http.on('get', '/me/photo/$value', Buffer.from('jpeg-bytes'));

  const photo = await graph.getUserPhoto('token');

  t.true(Buffer.isBuffer(photo));
  t.is(photo.toString(), 'jpeg-bytes');
  t.is(http.calls[0].config.responseType, 'arraybuffer');
});

test.serial('getUserPhoto returns null when there is no photo or Graph fails', async t => {
  t.is(await graph.getUserPhoto('token'), null);

  http.fail('get', '/me/photo/$value', 500);
  t.is(await graph.getUserPhoto('token'), null);
});

test.serial('getUserManager returns null when no manager is assigned', async t => {
  t.is(await graph.getUserManager('token'), null);

  http.on('get', '/me/manager', { id: 'm1', displayName: 'Boss' });
  t.deepEqual(await graph.getUserManager('token'), { id: 'm1', displayName: 'Boss' });
});

test.serial('getUserGroups returns an empty list when Graph fails', async t => {
  http.fail('get', '/me/memberOf', 403);

  t.deepEqual(await graph.getUserGroups('token'), []);
});

test.serial('getAllUsers requests a sorted page of users and returns [] on failure', async t => {
  http.on('get', '/v1.0/users', { value: [{ id: 'u1' }] });

  t.deepEqual(await graph.getAllUsers('token'), [{ id: 'u1' }]);
  t.is(http.calls[0].config.params.$orderby, 'displayName');
  t.is(http.calls[0].config.params.$top, 999);

  http.fail('get', '/v1.0/users', 500);
  t.deepEqual(await graph.getAllUsers('token'), []);
});

test.serial('getAllUsers follows @odata.nextLink until the last page', async t => {
  http.on('get', '/v1.0/users', {
    value: [{ id: 'u1' }],
    '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?$skiptoken=page2',
  });
  http.on('get', '$skiptoken=page2', {
    value: [{ id: 'u2' }],
    '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?$skiptoken=page3',
  });
  http.on('get', '$skiptoken=page3', { value: [{ id: 'u3' }] });

  t.deepEqual(await graph.getAllUsers('token'), [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
  t.is(http.calls.length, 3);
  // Later pages are requested with the token but without repeating the query
  t.deepEqual(http.calls[2].config, { headers: { Authorization: 'Bearer token' } });
});

test.serial('getUserGroups and getAllTenantGroups read every page', async t => {
  http.on('get', '/me/memberOf', { value: [{ id: 'g1' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/memberOf?$skiptoken=m2' });
  http.on('get', '$skiptoken=m2', { value: [{ id: 'g2' }] });
  http.on('get', '/v1.0/groups', { value: [{ id: 'g1' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/groups?$skiptoken=t2' });
  http.on('get', '$skiptoken=t2', { value: [{ id: 'g2' }, { id: 'g3' }] });

  t.deepEqual(await graph.getUserGroups('token'), [{ id: 'g1' }, { id: 'g2' }]);
  t.deepEqual(await graph.getAllTenantGroups('token'), [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }]);
});

test.serial('getUsersWithManager expands the manager in the same request and sorts by name', async t => {
  http.on('get', '/v1.0/users', {
    value: [
      { id: 'u2', displayName: 'Boss' },
      { id: 'u1', displayName: 'Alice', manager: { '@odata.type': '#microsoft.graph.user', id: 'u2' } },
    ],
  });

  t.deepEqual(await graph.getUsersWithManager('token'), [
    { id: 'u1', displayName: 'Alice', managerId: 'u2' },
    { id: 'u2', displayName: 'Boss', managerId: null },
  ]);
  t.is(http.calls.length, 1);
  t.is(http.calls[0].config.params.$expand, 'manager($select=id)');
});

test.serial('getUsersWithManager throws when Graph fails', async t => {
  http.fail('get', '/v1.0/users', 403);

  await t.throwsAsync(() => graph.getUsersWithManager('token'), { message: 'Failed to fetch users' });
});

test.serial('findUserByEmail filters by mail or user principal name', async t => {
  http.on('get', '/v1.0/users', { value: [{ id: 'u1', mail: 'alice@example.test' }] });

  t.deepEqual(await graph.findUserByEmail('token', 'alice@example.test'), { id: 'u1', mail: 'alice@example.test' });
  t.is(
    http.calls[0].config.params.$filter,
    "mail eq 'alice@example.test' or userPrincipalName eq 'alice@example.test'"
  );
  t.true(http.calls[0].config.params.$select.includes('lastPasswordChangeDateTime'));
});

test.serial('findUserByEmail escapes quotes and returns null when nobody matches', async t => {
  http.on('get', '/v1.0/users', { value: [] });

  t.is(await graph.findUserByEmail('token', "o'brien@example.test"), null);
  t.true(http.calls[0].config.params.$filter.startsWith("mail eq 'o''brien@example.test' or "));
});

test.serial('findUserByEmail throws when Graph fails', async t => {
  http.fail('get', '/v1.0/users', 500);

  await t.throwsAsync(() => graph.findUserByEmail('token', 'alice@example.test'), { message: 'Failed to look up user' });
});

test.serial('getUserForReset returns the user, or null when it no longer exists', async t => {
  http.on('get', '/users/u1', { id: 'u1', lastPasswordChangeDateTime: '2026-01-01T00:00:00Z' });

  t.deepEqual(await graph.getUserForReset('token', 'u1'), { id: 'u1', lastPasswordChangeDateTime: '2026-01-01T00:00:00Z' });
  t.is(await graph.getUserForReset('token', 'gone'), null);

  http.fail('get', '/users/u1', 500);
  await t.throwsAsync(() => graph.getUserForReset('token', 'u1'), { message: 'Failed to fetch user' });
});

test.serial('getGroupsWithMembership flags the groups the user belongs to', async t => {
  http.on('get', '/v1.0/groups', { value: [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }] });
  http.on('get', '/me/memberOf', { value: [{ id: 'g2' }] });

  const result = await graph.getGroupsWithMembership('token');

  t.deepEqual(result.allGroups, [
    { id: 'g1', isMember: false },
    { id: 'g2', isMember: true },
    { id: 'g3', isMember: false },
  ]);
  t.is(result.memberCount, 1);
  t.is(result.totalCount, 3);
});

test.serial('getGroupsWithMembership fails when the tenant groups cannot be read', async t => {
  http.fail('get', '/v1.0/groups', 403);
  http.on('get', '/me/memberOf', { value: [] });

  await t.throwsAsync(() => graph.getGroupsWithMembership('token'), { message: 'Failed to fetch tenant groups' });
});

test.serial('getAllUserData combines profile, photo, groups and manager', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice' });
  http.on('get', '/me/memberOf', { value: [{ id: 'g1' }] });

  t.deepEqual(await graph.getAllUserData('token'), {
    profile: { displayName: 'Alice' },
    photo: null,
    groups: [{ id: 'g1' }],
    manager: null,
  });
});

test.serial('sendEmail posts a plain text message to /me/sendMail', async t => {
  http.on('post', '/me/sendMail', {});

  await graph.sendEmail('token', { to: 'bob@example.test', subject: 'Hi', body: 'Hello' });

  const { message } = http.calls[0].data;
  t.is(message.subject, 'Hi');
  t.deepEqual(message.body, { contentType: 'Text', content: 'Hello' });
  t.deepEqual(message.toRecipients, [{ emailAddress: { address: 'bob@example.test' } }]);
  t.false('attachments' in message);
});

test.serial('sendEmail maps attachments to Graph file attachments', async t => {
  http.on('post', '/me/sendMail', {});

  await graph.sendEmail('token', {
    to: 'bob@example.test',
    subject: 'Hi',
    body: 'Hello',
    attachments: [{ name: 'a.pdf', contentType: 'application/pdf', contentBytes: 'QUJD' }],
  });

  const { message } = http.calls[0].data;
  t.true(message.hasAttachments);
  t.deepEqual(message.attachments, [{
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: 'a.pdf',
    contentType: 'application/pdf',
    contentBytes: 'QUJD',
  }]);
});

test.serial('sendEmail accepts several recipients', async t => {
  http.on('post', '/me/sendMail', {});

  await graph.sendEmail('token', { to: ['a@example.test', 'b@example.test'], subject: 'Hi', body: 'Hello' });

  t.deepEqual(http.calls[0].data.message.toRecipients, [
    { emailAddress: { address: 'a@example.test' } },
    { emailAddress: { address: 'b@example.test' } },
  ]);
});

test.serial('getGroupOwners returns the owners, or [] when they cannot be read', async t => {
  http.on('get', '/groups/g1/owners', { value: [{ id: 'u1', mail: 'a@example.test' }] });

  t.deepEqual(await graph.getGroupOwners('token', 'g1'), [{ id: 'u1', mail: 'a@example.test' }]);
  t.deepEqual(await graph.getGroupOwners('token', 'g2'), []);
});

test.serial('getOwnedGroups asks only for groups and throws on failure', async t => {
  http.on('get', '/me/ownedObjects/microsoft.graph.group', { value: [{ id: 'g1' }] });
  t.deepEqual(await graph.getOwnedGroups('token'), [{ id: 'g1' }]);

  http.fail('get', '/me/ownedObjects/microsoft.graph.group', 500);
  await t.throwsAsync(() => graph.getOwnedGroups('token'), { message: 'Failed to fetch owned groups' });
});

test.serial('addGroupMember posts a reference to the user and tolerates existing members', async t => {
  http.on('post', '/groups/g1/members/$ref', {});

  await graph.addGroupMember('owner-token', 'g1', 'u1');

  t.deepEqual(http.calls[0].data, { '@odata.id': 'https://graph.microsoft.com/v1.0/directoryObjects/u1' });
  t.is(http.calls[0].config.headers.Authorization, 'Bearer owner-token');

  http.on('post', '/groups/g1/members/$ref', () => {
    const error = new Error('Bad Request');
    error.response = { status: 400, data: { error: { message: 'One or more added object references already exist' } } };
    throw error;
  });
  await t.notThrowsAsync(() => graph.addGroupMember('owner-token', 'g1', 'u1'));

  http.fail('post', '/groups/g1/members/$ref', 403);
  const error = await t.throwsAsync(() => graph.addGroupMember('owner-token', 'g1', 'u1'), { message: 'Failed to add group member' });
  t.is(error.graphStatus, 403);
});

test.serial('getAuthenticationMethods returns null, not an empty list, when it cannot read them', async t => {
  http.on('get', '/me/authentication/methods', { value: [{ id: 'm1' }] });
  t.deepEqual(await graph.getAuthenticationMethods('token'), [{ id: 'm1' }]);

  http.fail('get', '/me/authentication/methods', 403);
  t.is(await graph.getAuthenticationMethods('token'), null);
});

test.serial('getUserDevices merges registered and owned devices', async t => {
  http.on('get', '/me/registeredDevices/microsoft.graph.device', { value: [{ id: 'd1' }, { id: 'd2' }] });
  http.on('get', '/me/ownedDevices/microsoft.graph.device', { value: [{ id: 'd2' }, { id: 'd3' }] });

  t.deepEqual((await graph.getUserDevices('token')).map(d => d.id), ['d1', 'd2', 'd3']);

  http.fail('get', '/me/ownedDevices/microsoft.graph.device', 500);
  t.deepEqual(await graph.getUserDevices('token'), []);
});

test.serial('sendEmail throws when Graph rejects the message', async t => {
  http.fail('post', '/me/sendMail', 403);

  await t.throwsAsync(
    () => graph.sendEmail('token', { to: 'bob@example.test', subject: 'Hi', body: 'Hello' }),
    { message: 'Failed to send email' }
  );
});

test.serial('updateUserProfile patches /me and throws on failure', async t => {
  http.on('patch', '/v1.0/me', {});

  await graph.updateUserProfile('token', { jobTitle: 'Dev' });
  t.deepEqual(http.calls[0].data, { jobTitle: 'Dev' });

  http.fail('patch', '/v1.0/me', 400);
  await t.throwsAsync(() => graph.updateUserProfile('token', {}), { message: 'Failed to update user profile' });
});

test.serial('getJoinedTeamsAndChannels keeps a team whose channels cannot be read', async t => {
  http.on('get', '/me/joinedTeams', { value: [{ id: 't1', displayName: 'One' }, { id: 't2', displayName: 'Two' }] });
  http.on('get', '/teams/t1/channels', { value: [{ id: 'c1', displayName: 'General' }] });
  http.fail('get', '/teams/t2/channels', 403);

  t.deepEqual(await graph.getJoinedTeamsAndChannels('token'), [
    { id: 't1', displayName: 'One', channels: [{ id: 'c1', displayName: 'General' }] },
    { id: 't2', displayName: 'Two', channels: [] },
  ]);
});

test.serial('getJoinedTeamsAndChannels throws when the teams cannot be read', async t => {
  http.fail('get', '/me/joinedTeams', 500);

  await t.throwsAsync(() => graph.getJoinedTeamsAndChannels('token'), { message: 'Failed to fetch teams' });
});

test.serial('getUserAdminRoles returns the role names', async t => {
  http.on('get', '/me/memberOf/microsoft.graph.directoryRole', {
    value: [{ displayName: 'Global Administrator' }, { displayName: 'User Administrator' }],
  });

  t.deepEqual(await graph.getUserAdminRoles('token'), ['Global Administrator', 'User Administrator']);
});

test.serial('getUserAdminRoles treats a Graph failure as no roles', async t => {
  http.fail('get', '/me/memberOf/microsoft.graph.directoryRole', 500);

  t.deepEqual(await graph.getUserAdminRoles('token'), []);
});

test.serial('resetUserPassword patches the password profile of the given user', async t => {
  http.on('patch', '/users/u1', {});

  await graph.resetUserPassword('app-token', 'u1', 'N3w-Passw0rd');

  t.deepEqual(http.calls[0].data, {
    passwordProfile: { password: 'N3w-Passw0rd', forceChangePasswordNextSignIn: false },
  });
  t.is(http.calls[0].config.headers.Authorization, 'Bearer app-token');
});

test.serial('resetUserPassword throws when Graph rejects the change', async t => {
  http.fail('patch', '/users/u1', 403);

  await t.throwsAsync(() => graph.resetUserPassword('app-token', 'u1', 'x'), { message: 'Failed to reset password' });
});
