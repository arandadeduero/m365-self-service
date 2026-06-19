const test = require('ava').default;
const { isAuthenticated, redirectIfAuthenticated } = require('../middleware/auth');

test('isAuthenticated redirects to /login if not authenticated', t => {
    const req = { session: {} };
    const res = { redirect: (url) => t.is(url, '/login') };
    const next = () => t.fail('Next should not be called');
    
    isAuthenticated(req, res, next);
});

test('isAuthenticated calls next() if authenticated', t => {
    const req = { session: { accessToken: 'token' } };
    const res = { redirect: () => t.fail('Redirect should not be called') };
    const next = () => t.pass();
    
    isAuthenticated(req, res, next);
});

test('redirectIfAuthenticated redirects to / if already authenticated', t => {
    const req = { session: { accessToken: 'token' } };
    const res = { redirect: (url) => t.is(url, '/') };
    const next = () => t.fail('Next should not be called');
    
    redirectIfAuthenticated(req, res, next);
});

test('redirectIfAuthenticated calls next() if not authenticated', t => {
    const req = { session: {} };
    const res = { redirect: () => t.fail('Redirect should not be called') };
    const next = () => t.pass();
    
    redirectIfAuthenticated(req, res, next);
});
