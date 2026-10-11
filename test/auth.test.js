/**
 * Authentication Route Tests
 * Tests for the authentication flow
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const app = require('../server');

test('GET /auth/signin redirects to Microsoft login', async t => {
  const res = await request(app)
    .get('/auth/signin')
    .expect(302);

  // Should redirect to Microsoft's login page
  t.true(res.header.location.includes('login.microsoftonline.com'));
  t.true(res.header.location.includes('oauth2'));
});

test('GET /auth/callback returns 401 without authorization code', async t => {
  const res = await request(app)
    .get('/auth/callback')
    .expect(401);

  t.is(res.status, 401);
});

test('GET /auth/logout clears session and redirects', async t => {
  const res = await request(app)
    .get('/auth/logout')
    .expect(302);

  // Should redirect to Microsoft logout
  t.true(res.header.location.includes('logout'));
});
