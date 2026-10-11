/**
 * Authenticated Route Tests
 * Signs in through /auth/callback with MSAL stubbed, then exercises the
 * protected pages and APIs against a stubbed Microsoft Graph / WordPress.
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, httpError, getCsrfToken, auditEvents, signInAgent } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const permissions = require('../config/permissions');
const app = require('../server');

const agent = request.agent(app);

// Token of the agent's session, and a POST that carries it like the pages do
let csrf;
const post = (path) => agent.post(path).set('X-CSRF-Token', csrf);

const ADMIN_BANNER = 'bg-danger text-white text-center';
const GROUPS = {
  value: [
    { id: 'g1', displayName: 'DIST Todos', mail: 'todos@arandadeduero.es', description: 'Lista general' },
    { id: 'g2', displayName: 'Obras' },
  ],
};

// Profile changes go to Graph one field at a time
const profileChanges = () => Object.assign({}, ...http.callsTo('patch', '/v1.0/me').map(call => call.data));

function sentMessage() {
  const [call] = http.callsTo('post', '/me/sendMail');
  return call && call.data.message;
}

test.before(async () => {
  await signInAgent(agent);
  csrf = await getCsrfToken(agent);
});

test.after.always(async () => {
  // Logging out removes the session file created by the sign-in above
  await agent.get('/auth/logout');
});

test.beforeEach(() => {
  http.reset();
  permissions.DOMAIN = 'arandadeduero.es';
  permissions['/blog'] = ['alice'];
});

test.serial('GET / renders the profile of the signed-in user', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example', mail: 'alice@arandadeduero.es', jobTitle: 'Tecnica' });
  http.on('get', '/me/memberOf', { value: [{ id: 'g2', displayName: 'Obras' }] });
  http.on('get', '/me/manager', { displayName: 'Boss Person', mail: 'boss@arandadeduero.es' });

  const res = await agent.get('/').expect(200);

  t.true(res.text.includes('Alice Example'));
  t.true(res.text.includes('Tecnica'));
  t.true(res.text.includes('Obras'));
  t.true(res.text.includes('Boss Person'));
  t.true(res.text.includes('/images/default-avatar.png'));
  // Name of the portal in the menu, and the intranet one click away
  t.true(res.text.includes('<a class="navbar-brand fw-semibold" href="/">Mi Microsoft 365</a>'));
  t.regex(res.text, /Intranet del Ayuntamiento[\s\S]*?href="https:\/\/aytoarandaduero\.sharepoint\.com" target="_blank" rel="noopener" class="btn btn-primary/);
  t.false(res.text.includes(ADMIN_BANNER));
  t.is(http.callsTo('get', '/v1.0/me')[0].config.headers.Authorization, 'Bearer user-token');
});

test.serial('the menu groups the pages, names the user, and only shows what applies to them', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });

  const res = await agent.get('/').expect(200);

  const menu = res.text.split('<nav ')[1].split('</nav>')[0];
  t.true(menu.includes('href="/" class="nav-link active"'));
  for (const href of ['/account', '/account/groups', '/account/sign-ins', '/profile/me/edit', '/profile/me/auto-reply', '/directorio', '/organigrama', '/groups', '/groups/requests', '/groups/owned', '/teams', '/salas', '/ayuda', '/blog']) {
    t.true(menu.includes(`href="${href}"`), href);
  }
  // Nothing is configured for shared mailboxes, and alice holds no directory role
  t.false(menu.includes('/account/mailboxes'));
  t.false(menu.includes('Administración'));
  t.true(menu.includes('id="userMenu"'));
  t.true(menu.includes('>Alice Example</a>'));
  t.true(menu.includes('alice@arandadeduero.es'));
  t.true(menu.includes('href="/auth/logout">Cerrar sesión</a>'));
});

test.serial('the menu marks the group and the page the user is on', async t => {
  http.on('get', '/me/memberOf/microsoft.graph.group', { value: [] });

  const res = await agent.get('/account/groups').expect(200);

  const menu = res.text.split('<nav ')[1].split('</nav>')[0];
  t.true(menu.includes('href="/account" class="nav-link dropdown-toggle active"'));
  t.true(menu.includes('class="dropdown-item active" href="/account/groups"'));
  t.false(menu.includes('href="/" class="nav-link active"'));
});

test.serial('the menu shows Blog only to users on its list', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  permissions['/blog'] = ['someone-else'];

  const res = await agent.get('/').expect(200);

  t.false(res.text.split('<nav ')[1].split('</nav>')[0].includes('href="/blog"'));
});

test.serial('GET / embeds the profile photo when the user has one', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  http.on('get', '/me/photo/$value', Buffer.from('img'));

  const res = await agent.get('/').expect(200);

  t.true(res.text.includes('data:image/jpeg;base64,aW1n'));
});

test.serial('GET / shows the admin banner and roles for directory admins', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  http.on('get', '/me/memberOf/microsoft.graph.directoryRole', { value: [{ displayName: 'Global Administrator' }] });

  const res = await agent.get('/').expect(200);

  t.true(res.text.includes(ADMIN_BANNER));
  t.true(res.text.includes('Global Administrator'));
});

test.serial('GET / renders the error page when Graph is unavailable', async t => {
  http.fail('get', '/v1.0/me', 500);

  const res = await agent.get('/').expect(500);

  t.true(res.text.includes('Failed to fetch user profile'));
});

test.serial('GET /login redirects signed-in users to the home page', async t => {
  const res = await agent.get('/login').expect(302);

  t.is(res.header.location, '/');
});

test.serial('GET /groups separates distribution lists and offers only non-member groups', async t => {
  http.on('get', '/v1.0/groups', GROUPS);
  http.on('get', '/me/memberOf', { value: [{ id: 'g2' }] });

  const res = await agent.get('/groups').expect(200);

  t.true(res.text.includes('DIST Todos'));
  t.true(res.text.includes('Obras'));
  t.true(res.text.includes('data-group-id="g1"'));
  t.false(res.text.includes('data-group-id="g2"'));
});

test.serial('GET /groups renders the error page when groups cannot be read', async t => {
  http.fail('get', '/v1.0/groups', 500);

  await agent.get('/groups').expect(500);
  t.pass();
});

test.serial('POST /groups/generate-report rejects an empty selection', async t => {
  const res = await post('/groups/generate-report').send({ selectedGroups: [] }).expect(400);

  t.true(res.text.includes('No groups selected'));
});

test.serial('POST /groups/generate-report describes the selected groups', async t => {
  http.on('get', '/v1.0/groups', GROUPS);

  const res = await post('/groups/generate-report').send({ selectedGroups: ['g1'] }).expect(200);

  t.true(res.body.success);
  t.is(res.body.groupCount, 1);
  t.true(res.body.report.includes('User: Alice Example'));
  t.true(res.body.report.includes('1. DIST Todos'));
  t.true(res.body.report.includes('Description: Lista general'));
  t.true(res.body.report.includes('Email: todos@arandadeduero.es'));
  t.true(res.body.report.includes('Group ID: g1'));
  t.false(res.body.report.includes('Obras'));
});

test.serial('GET /teams lists "Todo Ayuntamiento" first and sorts the rest', async t => {
  http.on('get', '/me/joinedTeams', {
    value: [
      { id: 't1', displayName: 'Zeta' },
      { id: 't2', displayName: 'Todo Ayuntamiento' },
      { id: 't3', displayName: 'Alfa' },
    ],
  });
  http.on('get', '/teams/t1/channels', { value: [{ displayName: 'Canal B' }, { displayName: 'Canal A' }] });

  const res = await agent.get('/teams').expect(200);

  const position = (text) => res.text.indexOf(text);
  t.true(position('>Todo Ayuntamiento</h3>') > -1);
  t.true(position('>Todo Ayuntamiento</h3>') < position('>Alfa</h3>'));
  t.true(position('>Alfa</h3>') < position('>Zeta</h3>'));
  t.true(position('Canal A') < position('Canal B'));
});

test.serial('GET /organigrama embeds the tree of people and lists who is outside it', async t => {
  http.on('get', '/v1.0/users', {
    value: [
      { id: 'u1', displayName: 'Alice', jobTitle: 'Tecnica', manager: { id: 'u2' } },
      { id: 'u2', displayName: 'Boss' },
      { id: 'u3', displayName: 'Buzon </script><b>Registro</b>' },
    ],
  });

  const res = await agent.get('/organigrama').expect(200);
  const data = JSON.parse(res.text.match(/<script type="application\/json" id="orgChartData">(.*?)<\/script>/s)[1]);

  // Nobody has the configured address, so the top is the one with people below
  t.deepEqual(data.nodes.map(node => [node.id, node.name, node.parentId]), [['u2', 'Boss', null], ['u1', 'Alice', 'u2']]);
  t.is(data.nodes[1].jobTitle, 'Tecnica');
  t.deepEqual(data.unplaced.map(person => person.id), ['u3']);
  t.is(data.currentUserId, 'alice-id');
  // A name cannot close the data block or add markup to the page
  t.is(data.unplaced[0].name, 'Buzon </script><b>Registro</b>');
  t.false(res.text.includes('<b>Registro</b>'));
  t.true(res.text.includes('Fuera del organigrama (1)'));
  // Names stay in the page: no avatar service, and the chart library is served by the app
  t.false(res.text.includes('ui-avatars'));
  t.true(res.text.includes('src="/vendor/d3-org-chart-3.1.1.min.js"'));
  t.false(/src="https?:[^"]*d3/.test(res.text));
  // One request for the whole directory, not one per user
  t.is(http.callsTo('get', '/v1.0/users').length, 1);
});

test.serial('GET /organigrama says so when nobody has a manager', async t => {
  http.on('get', '/v1.0/users', { value: [{ id: 'u1', displayName: 'Alice' }, { id: 'u2', displayName: 'Boss' }] });

  const res = await agent.get('/organigrama').expect(200);

  t.true(res.text.includes('ninguna cuenta tiene un responsable asignado'));
  t.false(res.text.includes('d3-org-chart'));
});

test.serial('GET /profile/me/edit prefills the form with the current profile', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example', jobTitle: 'Tecnica', businessPhones: ['947500100'] });

  const res = await agent.get('/profile/me/edit').expect(200);

  t.true(res.text.includes('value="Tecnica"'));
  t.true(res.text.includes('value="947500100"'));
});

test.serial('POST /profile/me/edit patches the profile and returns to the home page', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  http.on('patch', '/v1.0/me', {});

  const res = await post('/profile/me/edit')
    .type('form')
    .send({ jobTitle: 'Dev', mobilePhone: '600000000', officeLocation: 'Casa', businessPhones: '947500100' })
    .expect(302);

  t.is(res.header.location, '/');
  t.deepEqual(profileChanges(), {
    mobilePhone: '600000000',
    jobTitle: 'Dev',
    officeLocation: 'Casa',
    businessPhones: ['947500100'],
  });
});

test.serial('POST /profile/me/edit sends only what the user changed', async t => {
  // An account with no office: its box arrives empty, and Graph refuses ''
  http.on('get', '/v1.0/me', { jobTitle: 'Tecnica', mobilePhone: '600000000', officeLocation: null, businessPhones: ['947500100'] });
  http.on('patch', '/v1.0/me', {});

  await post('/profile/me/edit')
    .type('form')
    .send({ jobTitle: 'Tecnica', mobilePhone: ' 611111111 ', officeLocation: '', businessPhones: '947500100' })
    .expect(302);

  t.deepEqual(http.callsTo('patch', '/v1.0/me')[0].data, { mobilePhone: '611111111' });
  t.deepEqual(auditEvents('profile.update').at(-1).fields, ['mobilePhone']);
});

test.serial('POST /profile/me/edit clears the fields left empty', async t => {
  http.on('get', '/v1.0/me', { jobTitle: 'Tecnica', mobilePhone: '600000000', officeLocation: 'Casa', businessPhones: ['947500100'] });
  http.on('patch', '/v1.0/me', {});

  await post('/profile/me/edit')
    .type('form')
    .send({ jobTitle: 'Tecnica', mobilePhone: '', officeLocation: '', businessPhones: '' })
    .expect(302);

  t.deepEqual(profileChanges(), { mobilePhone: null, officeLocation: null, businessPhones: [] });
});

// These two get a session of their own: a refused field stays read-only for
// the rest of the session
async function freshSession(t) {
  const other = request.agent(app);
  await signInAgent(other);
  const token = await getCsrfToken(other);
  t.teardown(() => other.get('/auth/logout'));
  return { get: (path) => other.get(path), post: (path) => other.post(path).set('X-CSRF-Token', token) };
}

test.serial('POST /profile/me/edit saves what it may and names the fields Microsoft refuses', async t => {
  const user = await freshSession(t);
  http.on('get', '/v1.0/me', { jobTitle: 'Tecnica', mobilePhone: '600000000' });
  http.on('patch', '/v1.0/me', (call) => {
    if ('mobilePhone' in call.data) throw httpError(403);
    return {};
  });

  const res = await user.post('/profile/me/edit')
    .type('form')
    .send({ jobTitle: 'Jefa', mobilePhone: '611111111' })
    .expect(302);

  t.is(res.header.location, '/profile/me/edit');
  t.deepEqual(auditEvents('profile.update').at(-1).fields, ['jobTitle']);

  // Back on the form: told once, and the field is read-only from now on
  const form = await user.get('/profile/me/edit').expect(200);
  t.regex(form.text, /Microsoft no permite que cambies tú estos datos: <strong>teléfono móvil<\/strong>/);
  t.true(form.text.includes('El resto de cambios se ha guardado.'));
  t.regex(form.text, /id="mobilePhone" value="600000000" disabled/);
  t.true(form.text.includes('name="jobTitle"'));
  t.false(form.text.includes('name="mobilePhone"'));

  const again = await user.get('/profile/me/edit').expect(200);
  t.false(again.text.includes('Microsoft no permite que cambies'));
  t.regex(again.text, /id="mobilePhone" value="600000000" disabled/);

  // The read-only box is not posted, and its absence must not clear the phone
  const calls = http.callsTo('patch', '/v1.0/me').length;
  await user.post('/profile/me/edit').type('form').send({ jobTitle: 'Tecnica' }).expect(302);
  t.is(http.callsTo('patch', '/v1.0/me').length, calls);
});

test.serial('POST /profile/me/edit says so when nothing could be changed', async t => {
  const user = await freshSession(t);
  http.on('get', '/v1.0/me', { mobilePhone: '600000000' });
  http.fail('patch', '/v1.0/me', 403);
  const before = auditEvents('profile.update').length;

  await user.post('/profile/me/edit').type('form').send({ mobilePhone: '611111111' }).expect(302);
  const form = await user.get('/profile/me/edit').expect(200);

  t.true(form.text.includes('teléfono móvil'));
  t.false(form.text.includes('El resto de cambios'));
  t.is(auditEvents('profile.update').length, before);
});

test.serial('fields the installation does not offer are read-only and ignored when posted', async t => {
  const appConfig = require('../config/appConfig');
  const all = appConfig.PROFILE_EDITABLE_FIELDS;
  appConfig.PROFILE_EDITABLE_FIELDS = ['mobilePhone'];
  t.teardown(() => { appConfig.PROFILE_EDITABLE_FIELDS = all; });
  http.on('get', '/v1.0/me', { jobTitle: 'Tecnica', mobilePhone: '600000000', officeLocation: 'Planta 2' });
  http.on('patch', '/v1.0/me', {});

  const form = await agent.get('/profile/me/edit').expect(200);
  t.regex(form.text, /id="jobTitle" value="Tecnica" disabled/);
  t.is(form.text.split('Este dato solo puede cambiarlo Informática').length - 1, 3);
  t.true(form.text.includes('name="mobilePhone"'));

  await post('/profile/me/edit').type('form').send({ jobTitle: 'Alcaldesa', mobilePhone: '611111111', officeLocation: '' }).expect(302);

  t.deepEqual(profileChanges(), { mobilePhone: '611111111' });
});

test.serial('POST /profile/me/edit changes nothing when the form is saved as it was', async t => {
  http.on('get', '/v1.0/me', { jobTitle: 'Tecnica', mobilePhone: null, businessPhones: [] });
  const before = auditEvents('profile.update').length;

  const res = await post('/profile/me/edit')
    .type('form')
    .send({ jobTitle: 'Tecnica', mobilePhone: '', officeLocation: '', businessPhones: '' })
    .expect(302);

  t.is(res.header.location, '/');
  t.is(http.callsTo('patch', '/v1.0/me').length, 0);
  t.is(auditEvents('profile.update').length, before);
});

test.serial('POST /profile/me/edit renders the error page when Graph rejects the update', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  http.fail('patch', '/v1.0/me', 400);

  const res = await post('/profile/me/edit').type('form').send({ jobTitle: 'Dev' }).expect(500);

  t.true(res.text.includes('Error al actualizar el perfil'));
  t.is(http.callsTo('patch', '/v1.0/me').length, 1);
});

test.serial('GET /api/users returns the organization users', async t => {
  http.on('get', '/v1.0/users', { value: [{ id: 'u1', displayName: 'Alice' }] });

  const res = await agent.get('/api/users').expect(200);

  t.deepEqual(res.body, { success: true, users: [{ id: 'u1', displayName: 'Alice' }] });
});

test.serial('POST /api/manager-correction requires a manager', async t => {
  await post('/api/manager-correction').send({ selectedManagerName: 'Boss' }).expect(400);

  t.is(sentMessage(), undefined);
});

test.serial('POST /api/manager-correction emails the change request', async t => {
  http.on('post', '/me/sendMail', {});

  const res = await post('/api/manager-correction')
    .send({ selectedManagerId: 'm1', selectedManagerName: 'Boss', selectedManagerEmail: 'boss@arandadeduero.es' })
    .expect(200);

  t.true(res.body.success);
  t.is(sentMessage().subject, '[m365-admin] Change request');
  t.is(sentMessage().toRecipients[0].emailAddress.address, 'admin@example.test');
  t.is(
    sentMessage().body.content,
    'The user Alice Example (alice@arandadeduero.es) is requesting that their manager is Boss (boss@arandadeduero.es) (ID: m1)'
  );
});

test.serial('POST /api/manager-correction reports a failure to send', async t => {
  http.fail('post', '/me/sendMail', 500);

  const res = await post('/api/manager-correction')
    .send({ selectedManagerId: 'm1', selectedManagerName: 'Boss' })
    .expect(500);

  t.deepEqual(res.body, { success: false, error: 'Failed to send manager correction request' });
});

test.serial('POST /api/group-access-request requires a selection', async t => {
  await post('/api/group-access-request').send({}).expect(400);

  t.is(sentMessage(), undefined);
});

test.serial('POST /api/group-access-request emails the selected groups', async t => {
  http.on('get', '/v1.0/groups', GROUPS);
  http.on('post', '/me/sendMail', {});

  const res = await post('/api/group-access-request').send({ selectedGroups: ['g1'] }).expect(200);

  t.true(res.body.success);
  t.is(sentMessage().subject, '[m365-admin] Group Access Request');
  t.is(sentMessage().toRecipients[0].emailAddress.address, 'admin@example.test');
  t.true(sentMessage().body.content.includes('Alice Example (alice@arandadeduero.es)'));
  t.true(sentMessage().body.content.includes('1. DIST Todos (ID: g1)'));
  t.false(sentMessage().body.content.includes('Obras'));
});

test.serial('GET /blog is forbidden for users missing from the permission list', async t => {
  permissions['/blog'] = ['someone-else'];

  const res = await agent.get('/blog').expect(403);

  t.is(res.text, 'Access Denied');
});

test.serial('POST /blog is forbidden for users missing from the permission list', async t => {
  permissions['/blog'] = ['someone-else'];

  await post('/blog').field('title', 'Aviso').field('content', 'Texto').expect(403);

  t.is(sentMessage(), undefined);
});

test.serial('GET /blog lists the WordPress categories alphabetically', async t => {
  http.on('get', '/categories', [{ name: 'Zeta' }, { name: 'Bandos' }]);

  const res = await agent.get('/blog').expect(200);

  t.true(res.text.indexOf('value="Bandos"') > -1);
  t.true(res.text.indexOf('value="Bandos"') < res.text.indexOf('value="Zeta"'));
});

test.serial('POST /blog emails the post to Jetpack with shortcodes and attachments', async t => {
  http.on('post', '/me/sendMail', {});

  const res = await agent
    .post('/blog')
    .field('_csrf', csrf)
    .field('title', 'Corte de agua')
    .field('content', 'Texto del bando')
    .field('categories', 'Bandos')
    .field('categories', 'Avisos')
    .field('status', 'publish')
    .field('delay', '2')
    .attach('files', Buffer.from('PDF'), { filename: 'bando.pdf', contentType: 'application/pdf' })
    .expect(302);

  t.is(res.header.location, '/blog');
  const message = sentMessage();
  t.is(message.toRecipients[0].emailAddress.address, 'post@wp.example.test');
  t.is(message.subject, 'BANDO: Corte de agua');
  t.is(message.body.content, 'Texto del bando\n\n[category Bandos, Avisos]\n[status publish]\n[delay +2 hours]\n');
  t.is(message.attachments.length, 1);
  t.is(message.attachments[0].name, 'bando.pdf');
  t.is(message.attachments[0].contentType, 'application/pdf');
  t.is(message.attachments[0].contentBytes, Buffer.from('PDF').toString('base64'));
});

test.serial('POST /blog omits category, delay and attachments when not provided', async t => {
  http.on('post', '/me/sendMail', {});

  await post('/blog')
    .field('title', 'Aviso')
    .field('content', 'Texto')
    .field('status', 'draft')
    .field('delay', '0')
    .expect(302);

  t.is(sentMessage().body.content, 'Texto\n\n[status draft]\n');
  t.false('attachments' in sentMessage());
});

test.serial('POST /blog reports a failure to send the email', async t => {
  http.fail('post', '/me/sendMail', 500);

  const res = await post('/blog')
    .field('title', 'Aviso')
    .field('content', 'Texto')
    .field('status', 'draft')
    .expect(500);

  t.true(res.text.includes('Error al enviar email para publicar'));
});

test.serial('what the user did is in the audit log, with who and from where', async t => {
  const events = auditEvents();
  const byName = (name) => events.filter(entry => entry.event === name);

  // The shared session, and the two of the refused profile changes
  t.is(byName('auth.sign_in').length, 3);
  t.like(byName('auth.sign_in')[0], { actor: 'alice@arandadeduero.es' });
  t.truthy(byName('auth.sign_in')[0].ip);
  t.like(byName('profile.update')[0], { actor: 'alice@arandadeduero.es', fields: ['mobilePhone', 'jobTitle', 'officeLocation', 'businessPhones'] });
  t.like(byName('request.manager_correction')[0], { managerId: 'm1' });
  t.like(byName('request.group_access')[0], { groups: ['g1'] });
  t.like(byName('blog.post')[0], { title: 'Corte de agua', status: 'publish', attachments: 1 });
  t.like(byName('permission.denied')[0], { actor: 'alice@arandadeduero.es', path: '/blog' });
  // Failed actions leave no success entry: 5 profile updates and 2 blog posts worked
  t.is(byName('profile.update').length, 5);
  t.is(byName('blog.post').length, 2);
});

test.serial('GET /auth/logout ends the session and signs out of Microsoft', async t => {
  const res = await agent.get('/auth/logout').expect(302);

  t.true(res.header.location.startsWith('https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/logout'));
  t.true(res.header.location.includes(encodeURIComponent('http://localhost:3000/login')));

  const home = await agent.get('/').expect(302);
  t.is(home.header.location, '/login');
});

test.serial('the login page carries the name of the portal', async t => {
  const res = await request(app).get('/login').expect(200);

  t.true(res.text.includes('· Mi Microsoft 365 · Ayuntamiento de Aranda de Duero</title>'));
  t.true(res.text.includes('<h1 class="h2 mb-3 page-title">Mi Microsoft 365</h1>'));
  t.false(res.text.includes('Gestor M365'));
});
