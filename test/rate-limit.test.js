/**
 * Rate Limit Tests
 * The public password reset pages accept a limited number of requests per
 * client address.
 */

require('./helpers/env');

// Low enough to reach in a test: 2 link requests, 8 link attempts
process.env.RESET_RATE_LIMIT = '2';

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, stubSes, waitFor, getCsrfToken } = require('./helpers/stubs');

const http = stubAxios();
stubSes();
stubMsal();

const app = require('../server');

const agent = request.agent(app);
let csrf;
const post = (path) => agent.post(path).set('X-CSRF-Token', csrf);

test.before(async () => {
  csrf = await getCsrfToken(agent);
});

test.after.always(async () => {
  await agent.get('/auth/logout');
});

test.serial('asking for reset links is limited per client', async t => {
  http.on('get', '/v1.0/users', { value: [] });
  const ask = () => post('/reset-password').type('form').send({ email: 'alice@arandadeduero.es' });

  await ask().expect(200);
  await ask().expect(200);
  const blocked = await ask().expect(429);

  t.true(blocked.text.includes('Demasiados intentos'));
  // The blocked request never got as far as looking the user up
  await waitFor(() => http.callsTo('get', '/v1.0/users').length === 2);
  await new Promise(resolve => setTimeout(resolve, 20));
  t.is(http.callsTo('get', '/v1.0/users').length, 2);
});

test.serial('trying reset links is limited per client', async t => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await agent.get('/reset-password/not-a-real-token').expect(400);
  }

  await agent.get('/reset-password/not-a-real-token').expect(429);
  const blocked = await post('/reset-password/not-a-real-token')
    .type('form')
    .send({ newPassword: 'N3w-Passw0rd', confirmPassword: 'N3w-Passw0rd' })
    .expect(429);

  t.true(blocked.text.includes('Demasiados intentos'));
});

test.serial('the reset request form itself is not limited', async t => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await agent.get('/reset-password').expect(200);
  }
  t.pass();
});
