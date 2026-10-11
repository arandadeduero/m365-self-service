/**
 * Route Protection Tests
 * Tests for authentication middleware and route access
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');

// Counts attempts to load a .env file while the app starts
const dotenv = require('dotenv');
let dotenvLoads = 0;
dotenv.config = () => {
  dotenvLoads += 1;
  return {};
};

const app = require('../server');

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

  t.true(res.text.includes('Iniciar sesión con Microsoft'));
  t.true(res.text.includes('Mi Microsoft 365 · Ayuntamiento de Aranda de Duero'));
});

test('pages load their styles, scripts and typeface from the app, not from other servers', async t => {
  const res = await request(app).get('/login').expect(200);

  t.deepEqual(res.text.match(/<(?:link|script)\b[^>]*(?:href|src)="https?:[^"]*"/g), null);

  const css = await request(app).get('/css/custom.css').expect(200);
  t.false(/url\(\s*['"]?https?:/.test(css.text));

  await request(app).get('/vendor/bootstrap-5.3.3.min.css').expect(200);
  await request(app).get('/vendor/bootstrap-5.3.3.bundle.min.js').expect(200);
  await request(app).get('/vendor/fonts/outfit-latin.woff2').expect(200).expect('Content-Type', 'font/woff2');
});

test('every response carries the security headers, and pages can only be shown by themselves', async t => {
  const page = await request(app).get('/login').expect(200);
  const asset = await request(app).get('/css/custom.css').expect(200);

  for (const res of [page, asset]) {
    t.is(res.headers['x-frame-options'], 'DENY');
    t.is(res.headers['x-content-type-options'], 'nosniff');
    t.is(res.headers['referrer-policy'], 'same-origin');
    t.true(res.headers['content-security-policy'].includes("frame-ancestors 'none'"));
    t.true(res.headers['content-security-policy'].includes("default-src 'self'"));
  }
  // Only sent over HTTPS, which is production
  t.is(page.headers['strict-transport-security'], undefined);
  // Scripts run only from the app's own files
  t.true(page.headers['content-security-policy'].includes("script-src 'self';"));
  t.false(page.headers['content-security-policy'].includes("script-src 'self' 'unsafe-inline'"));
});

test('no view carries inline JavaScript, which the policy would refuse', t => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'views');
  const views = fs.readdirSync(dir).filter(name => name.endsWith('.ejs')).map(name => path.join(dir, name));
  views.push(...fs.readdirSync(path.join(dir, 'partials')).map(name => path.join(dir, 'partials', name)));

  for (const view of views) {
    const source = fs.readFileSync(view, 'utf8');
    // A <script> needs a src, unless it is a data block the browser does not run
    t.false(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>/.test(source), `${path.basename(view)} has an inline <script>`);
    t.false(/\son[a-z]+=["']/i.test(source), `${path.basename(view)} has an inline event handler`);
    t.false(/href=["']javascript:/i.test(source), `${path.basename(view)} has a javascript: link`);
  }
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

test('the app does not load the .env file during tests', t => {
  t.is(dotenvLoads, 0);
});
