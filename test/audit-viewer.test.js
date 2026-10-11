/**
 * Audit Viewer Tests
 * The page where administrators read the audit log
 */

require('./helpers/env');

const fs = require('fs');
const path = require('path');
const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, auditEvents, signInAgent } = require('./helpers/stubs');

const http = stubAxios();
const msal = stubMsal();

const app = require('../server');

const ROLES = '/me/memberOf/microsoft.graph.directoryRole';
const ADMIN = { username: 'admin@arandadeduero.es', name: 'Ada Admin', localAccountId: 'admin-id' };
const USER = { username: 'alice@arandadeduero.es', name: 'Alice Example', localAccountId: 'alice-id' };

const line = (entry) => JSON.stringify(entry) + '\n';
const writeDay = (day, entries) => fs.writeFileSync(path.join(process.env.AUDIT_DIR, `${day}.log`), entries.map(line).join(''));

async function signInAs(t, account, { admin }) {
  msal.account = account;
  const agent = request.agent(app);
  await signInAgent(agent);
  t.teardown(() => agent.get('/auth/logout'));
  // Asked on every request: holding a directory role is what makes an admin
  http.on('get', ROLES, { value: admin ? [{ displayName: 'Global Administrator' }] : [] });
  return agent;
}

test.beforeEach(() => {
  http.reset();
  http.on('get', '/v1.0/me', { displayName: 'Someone' });
  for (const file of fs.readdirSync(process.env.AUDIT_DIR)) {
    fs.rmSync(path.join(process.env.AUDIT_DIR, file));
  }
  writeDay('2026-10-08', [
    { time: '2026-10-08T09:00:00.000Z', event: 'profile.update', actor: 'bob@arandadeduero.es', ip: '203.0.113.8', fields: ['jobTitle'] },
  ]);
  writeDay('2026-10-09', [
    { time: '2026-10-09T09:00:00.000Z', event: 'blog.post', actor: 'carol@arandadeduero.es', ip: '203.0.113.9', title: 'Corte de agua' },
    { time: '2026-10-09T10:00:00.000Z', event: 'reset.password_changed', actor: null, ip: '198.51.100.7', email: 'bob@arandadeduero.es' },
  ]);
});

test.serial('only administrators get the administration menu', async t => {
  // One at a time: the Graph stub answers the roles question the same for everybody
  const admin = await signInAs(t, ADMIN, { admin: true });
  const adminMenu = (await admin.get('/ayuda').expect(200)).text.split('<nav ')[1].split('</nav>')[0];
  t.true(adminMenu.includes('>Administración</a>'));
  t.true(adminMenu.includes('href="/admin/audit"'));

  const user = await signInAs(t, USER, { admin: false });
  const userMenu = (await user.get('/ayuda').expect(200)).text.split('<nav ')[1].split('</nav>')[0];
  t.false(userMenu.includes('Administración'));
  t.false(userMenu.includes('/admin/audit'));
});

test.serial('an administrator sees the log, newest first, with its details', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });

  const res = await admin.get('/admin/audit').expect(200);

  const position = (text) => res.text.indexOf(text);
  t.true(position('reset.password_changed') > -1);
  t.true(position('reset.password_changed') < position('<code>blog.post</code>'));
  t.true(position('<code>blog.post</code>') < position('<code>profile.update</code>'));
  t.true(res.text.includes('carol@arandadeduero.es'));
  t.true(res.text.includes('203.0.113.9'));
  t.true(res.text.includes('Corte de agua'));
  // The admin's own sign-in is part of the log too
  t.true(res.text.includes('admin@arandadeduero.es'));
});

test.serial('only administrators get the page or the link to it', async t => {
  const user = await signInAs(t, USER, { admin: false });

  const res = await user.get('/admin/audit').expect(403);
  const home = await user.get('/').expect(200);

  t.true(res.text.includes('solo para administradores'));
  t.false(res.text.includes('Corte de agua'));
  t.false(home.text.includes('href="/admin/audit"'));
  t.like(auditEvents('permission.denied').at(-1), { actor: USER.username, path: '/admin/audit' });

  const anonymous = await request(app).get('/admin/audit').expect(302);
  t.is(anonymous.header.location, '/login');
});

test.serial('administrators have the link in the menu', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });

  const home = await admin.get('/').expect(200);

  t.true(home.text.includes('href="/admin/audit"'));
});

test.serial('the log can be filtered by event, by person and by day', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });

  const byEvent = await admin.get('/admin/audit?event=blog.post').expect(200);
  t.true(byEvent.text.includes('Corte de agua'));
  t.false(byEvent.text.includes('203.0.113.8'));

  const byActor = await admin.get('/admin/audit?actor=BOB').expect(200);
  t.true(byActor.text.includes('203.0.113.8'));
  t.false(byActor.text.includes('Corte de agua'));

  const byDay = await admin.get('/admin/audit?day=2026-10-08').expect(200);
  t.true(byDay.text.includes('203.0.113.8'));
  t.false(byDay.text.includes('Corte de agua'));
  t.true(byDay.text.includes('1 evento.'));

  const nothing = await admin.get('/admin/audit?day=2026-10-08&event=blog.post').expect(200);
  t.true(nothing.text.includes('No hay eventos que coincidan'));
});

test.serial('a day that is not a date reads nothing', async t => {
  const admin = await signInAs(t, ADMIN, { admin: true });
  fs.writeFileSync(path.join(process.env.AUDIT_DIR, 'secret.txt'), line({ time: '2026-10-09T00:00:00Z', event: 'leak', actor: 'x' }));

  for (const day of ['../secret', 'secret.txt', '2026-10-09/../secret', '']) {
    const res = await admin.get('/admin/audit').query({ day }).expect(200);
    t.false(res.text.includes('<code>leak</code>'), day);
  }
});

test.serial('without a day the last seven days with entries are shown', async t => {
  // Eight days later than any other file, whatever today's date is
  for (let day = 1; day <= 8; day += 1) {
    writeDay(`2099-11-0${day}`, [{ time: `2099-11-0${day}T09:00:00.000Z`, event: 'test.day', actor: `day${day}@example.test` }]);
  }
  const admin = await signInAs(t, ADMIN, { admin: true });

  const res = await admin.get('/admin/audit?event=test.day').expect(200);
  const older = await admin.get('/admin/audit?event=blog.post').expect(200);

  t.true(res.text.includes('day8@example.test'));
  t.true(res.text.includes('day2@example.test'));
  t.false(res.text.includes('day1@example.test'));
  t.false(older.text.includes('Corte de agua'));
});

test.serial('a line cut short does not hide the rest of the day', async t => {
  fs.appendFileSync(path.join(process.env.AUDIT_DIR, '2026-10-09.log'), '{"time":"2026-10-09T11:00:00.000Z","event":"trunc');
  const admin = await signInAs(t, ADMIN, { admin: true });

  const res = await admin.get('/admin/audit?day=2026-10-09').expect(200);

  t.true(res.text.includes('Corte de agua'));
  t.true(res.text.includes('2 eventos.'));
});

test.serial('a very busy period shows the most recent entries and says how many there are', async t => {
  const entries = Array.from({ length: 520 }, (_, index) => ({
    time: new Date(Date.UTC(2026, 9, 9, 12, 0, index)).toISOString(),
    event: 'test.busy',
    actor: `user${index}@example.test`,
  }));
  writeDay('2026-10-09', entries);
  const admin = await signInAs(t, ADMIN, { admin: true });

  const res = await admin.get('/admin/audit?event=test.busy').expect(200);

  t.true(res.text.includes('Se muestran los 500 más recientes de 520'));
  t.true(res.text.includes('user519@example.test'));
  t.false(res.text.includes('user19@example.test'));
});
