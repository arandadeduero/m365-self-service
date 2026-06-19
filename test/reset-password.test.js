/**
 * Reset Password Route Tests
 * Tests for the password reset functionality
 */

const test = require('ava').default;
const request = require('supertest');
const app = require('../server');

test.before(async t => {
  // Setup: Ensure environment variables are set for testing
  process.env.CLIENT_ID = process.env.CLIENT_ID || 'test-client-id';
  process.env.CLIENT_SECRET = process.env.CLIENT_SECRET || 'test-client-secret';
  process.env.TENANT_ID = process.env.TENANT_ID || 'test-tenant-id';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
  process.env.TOKEN_SECRET = process.env.TOKEN_SECRET || 'test-token-secret';
});

test('GET /reset-password returns form', async t => {
  const res = await request(app)
    .get('/reset-password')
    .expect(200);

  t.true(res.text.includes('Recuperar contraseña'));
});

test('POST /reset-password rejects invalid domain', async t => {
  const res = await request(app)
    .post('/reset-password')
    .send({ email: 'user@example.com' })
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
