/**
 * Reset Token Service Tests
 * The token carried by password reset links
 */

require('./helpers/env');

const test = require('ava').default;
const { createResetToken, readResetToken } = require('../services/resetTokenService');

const USER = { userId: 'u1', email: 'alice@arandadeduero.es', passwordChangedAt: '2026-01-01T00:00:00Z' };

function withTokenSecret(t, value) {
  const previous = process.env.TOKEN_SECRET;
  if (value === undefined) {
    delete process.env.TOKEN_SECRET;
  } else {
    process.env.TOKEN_SECRET = value;
  }
  t.teardown(() => {
    process.env.TOKEN_SECRET = previous;
  });
}

test.serial('a token gives back what it was created with, plus a 15 minute expiry', t => {
  const before = Date.now();

  const payload = readResetToken(createResetToken(USER));

  t.like(payload, USER);
  t.true(payload.expires >= before + 15 * 60 * 1000);
  t.true(payload.expires <= Date.now() + 15 * 60 * 1000);
});

test.serial('tokens are URL-safe, unreadable and different every time', t => {
  const first = createResetToken(USER);
  const second = createResetToken(USER);

  t.regex(first, /^[\w-]+$/);
  t.not(first, second);
  t.false(Buffer.from(first, 'base64url').toString('latin1').includes('alice'));
});

test.serial('malformed tokens read as null', t => {
  t.is(readResetToken(''), null);
  t.is(readResetToken('not-a-real-token'), null);
  t.is(readResetToken(Buffer.alloc(64).toString('base64url')), null);
});

test.serial('a token cannot be read with another secret', t => {
  const token = createResetToken(USER);

  withTokenSecret(t, 'a-different-secret');

  t.is(readResetToken(token), null);
});

test.serial('creating or reading a token without TOKEN_SECRET is an error, not a crash at startup', t => {
  const token = createResetToken(USER);

  withTokenSecret(t, undefined);

  t.throws(() => createResetToken(USER), { message: 'TOKEN_SECRET is not configured' });
  t.throws(() => readResetToken(token), { message: 'TOKEN_SECRET is not configured' });
});
