/**
 * Reset Password Route Tests
 * Tests for the password reset functionality
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { getCsrfToken } = require('./helpers/stubs');
const app = require('../server');

test('GET /reset-password returns form', async t => {
  const agent = request.agent(app);
  t.teardown(() => agent.get('/auth/logout'));

  const res = await agent
    .get('/reset-password')
    .expect(200);

  t.true(res.text.includes('Recuperar contraseña'));
});

test('POST /reset-password rejects invalid domain', async t => {
  const agent = request.agent(app);
  const csrf = await getCsrfToken(agent);
  t.teardown(() => agent.get('/auth/logout'));

  const res = await agent
    .post('/reset-password')
    .send({ email: 'user@example.com', _csrf: csrf })
    .expect(400);

  t.true(res.text.includes('El correo electrónico debe ser válido y pertenecer al dominio @arandadeduero.es'));
});

test('GET /reset-password/:token handles invalid token', async t => {
  const res = await request(app)
    .get('/reset-password/invalid-token')
    .expect(400);

  // Should trigger our nice error page (since we return next(err))
  t.true(res.text.includes('Token no válido o corrupto'));
});
