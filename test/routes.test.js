/**
 * Route Protection Tests
 * Tests for authentication middleware and route access
 */

const test = require('ava');
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

  t.true(res.text.includes('Sign in with Microsoft'));
  t.true(res.text.includes('M365 Login Demo'));
});

test('GET /login renders correct content', async t => {
  const res = await request(app)
    .get('/login')
    .expect(200);

  // Check for key elements
  t.true(res.text.includes('fluent-button'));
  t.true(res.text.includes('/auth/signin'));
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
