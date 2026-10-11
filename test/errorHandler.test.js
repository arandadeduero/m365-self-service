/**
 * Error Handler Tests
 * Tests for the 404 and error rendering middleware
 */

require('./helpers/env');

const test = require('ava').default;
const { expiredSessionHandler, errorHandler, notFoundHandler } = require('../middleware/errorHandler');

function fakeResponse() {
  const res = {
    status(code) {
      res.statusCode = code;
      return res;
    },
    render(view, locals) {
      res.view = view;
      res.locals = locals;
    },
  };
  return res;
}

const req = { originalUrl: '/boom', method: 'GET' };

test.serial('errorHandler shows the real message outside production', t => {
  const res = fakeResponse();
  const err = Object.assign(new Error('Something specific'), { status: 418 });

  errorHandler(err, req, res, () => {});

  t.is(res.statusCode, 418);
  t.is(res.view, 'error');
  t.deepEqual(res.locals, { title: 'Error 418', statusCode: 418, message: 'Something specific' });
});

test.serial('errorHandler hides the message in production', t => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.teardown(() => {
    process.env.NODE_ENV = previous;
  });

  const res = fakeResponse();
  errorHandler(new Error('secret detail'), req, res, () => {});

  t.is(res.statusCode, 500);
  t.false(res.locals.message.includes('secret detail'));
  t.true(res.locals.message.startsWith('Lo sentimos'));
});

test.serial('errorHandler shows messages written for the user in production too', t => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.teardown(() => {
    process.env.NODE_ENV = previous;
  });

  const res = fakeResponse();
  const err = Object.assign(new Error('El enlace ha caducado'), { status: 400, expose: true });
  errorHandler(err, req, res, () => {});

  t.is(res.statusCode, 400);
  t.is(res.locals.message, 'El enlace ha caducado');
});

test.serial('errorHandler falls back to statusCode and then to 500', t => {
  const withStatusCode = fakeResponse();
  errorHandler(Object.assign(new Error('x'), { statusCode: 403 }), req, withStatusCode, () => {});
  t.is(withStatusCode.statusCode, 403);

  const withoutStatus = fakeResponse();
  errorHandler(new Error('x'), req, withoutStatus, () => {});
  t.is(withoutStatus.statusCode, 500);
});

test('notFoundHandler forwards a 404 error', t => {
  notFoundHandler({}, {}, (err) => {
    t.is(err.status, 404);
    t.is(err.message, 'Page Not Found');
  });
});

test('expiredSessionHandler signs the user out when Graph rejects the token', t => {
  t.plan(2);
  const session = { accessToken: 'token', regenerate: (done) => { t.pass(); done(); } };
  const res = { redirect: (url) => t.is(url, '/login') };
  const err = Object.assign(new Error('Failed to fetch user profile'), { graphStatus: 401 });

  expiredSessionHandler(err, { session }, res, () => t.fail('Next should not be called'));
});

test('expiredSessionHandler passes other errors on', t => {
  t.plan(2);
  const session = { accessToken: 'token', regenerate: () => t.fail('Session should be kept') };
  const forbidden = Object.assign(new Error('Failed to fetch tenant groups'), { graphStatus: 403 });
  const anonymous = Object.assign(new Error('Failed to fetch user'), { graphStatus: 401 });

  expiredSessionHandler(forbidden, { session }, {}, (err) => t.is(err, forbidden));
  // A 401 for an app-only call (no signed-in user) is not a reason to redirect
  expiredSessionHandler(anonymous, { session: {} }, {}, (err) => t.is(err, anonymous));
});
