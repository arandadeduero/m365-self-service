/**
 * Activity Tests
 * A person's own entries of the audit log
 */

require('./helpers/env');

const fs = require('fs');
const path = require('path');
const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, signInAgent } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const app = require('../server');

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

test.serial('my activity lists what I did, in plain words, and nothing of anybody else', async t => {
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  const agent = request.agent(app);
  t.teardown(() => agent.get('/auth/logout'));
  await signInAgent(agent);

  const lines = [
    { time: `${day(1)}T09:00:00.000Z`, event: 'profile.update', actor: 'alice@arandadeduero.es', ip: '203.0.113.5', fields: ['mobilePhone'] },
    { time: `${day(1)}T10:00:00.000Z`, event: 'blog.post', actor: 'carol@arandadeduero.es', ip: '203.0.113.9', title: 'Corte de agua' },
    { time: `${day(2)}T09:00:00.000Z`, event: 'something.new', actor: 'ALICE@arandadeduero.es', ip: '203.0.113.5' },
  ];
  fs.appendFileSync(path.join(process.env.AUDIT_DIR, `${day(1)}.log`), lines.slice(0, 2).map(line => JSON.stringify(line) + '\n').join(''));
  fs.appendFileSync(path.join(process.env.AUDIT_DIR, `${day(2)}.log`), JSON.stringify(lines[2]) + '\n');

  const res = await agent.get('/account/activity').expect(200);

  t.true(res.text.includes('Datos del perfil cambiados'));
  t.true(res.text.includes('{&#34;fields&#34;:[&#34;mobilePhone&#34;]}'));
  t.true(res.text.includes('203.0.113.5'));
  // An event without a name yet is shown as it is
  t.true(res.text.includes('<td>something.new</td>'));
  // Somebody else's doings are not
  t.false(res.text.includes('Corte de agua'));
  t.false(res.text.includes('203.0.113.9'));
  // The sign-in of this very test is there too, so three of mine
  t.true(res.text.includes('3 eventos.'));
});
