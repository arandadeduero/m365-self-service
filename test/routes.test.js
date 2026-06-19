/**
 * Route Protection Tests
 * Tests for authentication middleware and route access
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
});

test('GET / redirects unauthenticated users to login', async t => {
  const res = await request(app)
    .get('/')
    .expect(302);

  t.is(res.header.location, '/login');
});

test('GET /login returns login page', async t => {
  const res = await request(app)
    .get('/login')
    .expect(200);

  t.true(res.text.includes('Iniciar sesion con Microsoft'));
  t.true(res.text.includes('Herramienta 365 - Ayuntamiento de Aranda de Duero'));
});

test('GET /login renders correct content', async t => {
  const res = await request(app)
    .get('/login')
    .expect(200);

  // Check for key elements
  t.true(res.text.includes('btn btn-primary'));
  t.true(res.text.includes('/auth/signin'));
});

test('GET /organigrama redirects unauthenticated users to login', async t => {
  const res = await request(app)
    .get('/organigrama')
    .expect(302);

  t.is(res.header.location, '/login');
});

test('GET /profile/me/edit redirects unauthenticated users to login', async t => {
  const res = await request(app)
    .get('/profile/me/edit')
    .expect(302);

  t.is(res.header.location, '/login');
});

test('GET /teams redirects unauthenticated users to login', async t => {
  const res = await request(app)
    .get('/teams')
    .expect(302);

  t.is(res.header.location, '/login');
});

test('GET /groups redirects unauthenticated users to login', async t => {
  const res = await request(app)
    .get('/groups')
    .expect(302);

  t.is(res.header.location, '/login');
});

test('GET /api/users redirects unauthenticated users to login', async t => {
  const res = await request(app)
    .get('/api/users')
    .expect(302);

  t.is(res.header.location, '/login');
});

test('GET /nonexistent returns 404', async t => {
  const res = await request(app)
    .get('/nonexistent-page')
    .expect(404);

  t.is(res.status, 404);
});

test('Server starts without errors', t => {
  // This test just checks that the app was created successfully
  t.truthy(app);
  t.is(typeof app, 'function');
});
