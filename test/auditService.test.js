/**
 * Audit Service Tests
 */

require('./helpers/env');

const fs = require('fs');
const path = require('path');
const test = require('ava').default;
const { auditEvents } = require('./helpers/stubs');
const { audit, auditRequest } = require('../services/auditService');

test.serial('audit appends one JSON line per event to the file of the day', async t => {
  await audit('test.first', { actor: 'alice@example.test' });
  await audit('test.second', { target: 'u1' });

  const today = new Date().toISOString().slice(0, 10);
  const lines = fs.readFileSync(path.join(process.env.AUDIT_DIR, `${today}.log`), 'utf8').trim().split('\n');

  t.is(lines.length, 2);
  t.like(JSON.parse(lines[0]), { event: 'test.first', actor: 'alice@example.test' });
  t.like(JSON.parse(lines[1]), { event: 'test.second', target: 'u1' });
  t.false(Number.isNaN(Date.parse(JSON.parse(lines[0]).time)));
});

test.serial('auditRequest records who made the request and from where', async t => {
  const req = { session: { account: { username: 'alice@example.test' } }, ip: '203.0.113.5' };

  await auditRequest(req, 'test.request', { fields: ['jobTitle'] });
  await auditRequest({ session: {}, ip: '203.0.113.9' }, 'test.anonymous');

  t.like(auditEvents('test.request')[0], { actor: 'alice@example.test', ip: '203.0.113.5', fields: ['jobTitle'] });
  t.like(auditEvents('test.anonymous')[0], { actor: null, ip: '203.0.113.9' });
});

test.serial('a log that cannot be written does not break the action being recorded', async t => {
  const previous = process.env.AUDIT_DIR;
  // A directory cannot be created underneath a file
  const blocker = path.join(previous, 'not-a-directory');
  fs.writeFileSync(blocker, '');
  process.env.AUDIT_DIR = path.join(blocker, 'audit');
  t.teardown(() => {
    process.env.AUDIT_DIR = previous;
    fs.unlinkSync(blocker);
  });

  await t.notThrowsAsync(() => audit('test.unwritable'));
});
