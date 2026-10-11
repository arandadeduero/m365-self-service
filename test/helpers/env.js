/**
 * Test environment
 *
 * Require this before any app module. It marks the run as a test, which
 * stops the app from loading the developer's real .env, and sets every
 * variable the app needs to a fixed test value instead.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

Object.assign(process.env, {
  NODE_ENV: 'test',
  CLIENT_ID: 'test-client-id',
  CLIENT_SECRET: 'test-client-secret',
  TENANT_ID: 'test-tenant-id',
  REDIRECT_URI: 'http://localhost:3000/auth/callback',
  SESSION_SECRET: 'test-session-secret',
  TOKEN_SECRET: 'test-token-secret',
  WP_URL: 'https://wp.example.test',
  WP_USER: 'wp-user',
  WP_APP_PASSWORD: 'wp-app-password',
  JETPACK_POST_BY_EMAIL: 'post@wp.example.test',
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'test-access-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  FROM_EMAIL: 'no-reply@example.test',
  ADMIN_EMAIL: 'admin@example.test',
  // High enough that only the rate limit tests, which lower it, ever hit it
  RESET_RATE_LIMIT: '1000',
  PASSWORD_MAX_AGE_DAYS: '90',
  // A directory of its own for every test file, outside the project
  AUDIT_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'm365-audit-')),
  DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'm365-data-')),
});
