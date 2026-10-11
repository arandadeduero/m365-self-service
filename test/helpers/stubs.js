/**
 * Test stubs for outbound calls (Microsoft Graph, WordPress, MSAL, AWS SES)
 *
 * Ava runs every test file in its own worker, so patching these modules in
 * place does not leak between files. Tests inside a file that share a stub
 * must run with test.serial.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Build an error shaped like an axios HTTP failure
 */
function httpError(status) {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data: { error: { code: String(status) } } };
  return error;
}

/**
 * Replace axios.get/post/patch/put/delete (and axios.create) with a recorder.
 * Requests are matched by method and URL suffix; the last matching route wins
 * and anything unmatched fails with a 404, like an unknown Graph resource.
 */
function stubAxios() {
  const calls = [];
  let routes = [];

  const dispatch = (method) => async (url, ...args) => {
    const [data, config] = ['get', 'delete'].includes(method) ? [undefined, args[0]] : args;
    const call = { method, url, data, config };
    calls.push(call);

    const route = routes.findLast(r => r.method === method && url.endsWith(r.path));
    if (!route) {
      throw httpError(404);
    }
    const body = typeof route.reply === 'function' ? await route.reply(call) : route.reply;
    return { data: body };
  };

  const fake = { get: dispatch('get'), post: dispatch('post'), patch: dispatch('patch'), put: dispatch('put'), delete: dispatch('delete') };
  Object.assign(axios, fake);
  axios.create = () => fake;

  return {
    calls,
    on(method, path, reply) {
      routes.push({ method, path, reply });
    },
    fail(method, path, status = 500) {
      routes.push({ method, path, reply: () => { throw httpError(status); } });
    },
    callsTo(method, path) {
      return calls.filter(c => c.method === method && c.url.endsWith(path));
    },
    reset() {
      calls.length = 0;
      routes = [];
    },
  };
}

/**
 * Replace the MSAL token calls so no request reaches Entra ID.
 * The returned state controls who signs in next, how long their token lasts
 * and whether silent renewal works, and counts the renewals.
 */
function stubMsal({ account } = {}) {
  const msal = require('@azure/msal-node');
  const proto = msal.ConfidentialClientApplication.prototype;
  const state = {
    account: account || { username: 'alice@arandadeduero.es', name: 'Alice Example', localAccountId: 'alice-id' },
    expiresInMs: 60 * 60 * 1000,
    silentCalls: 0,
    failSilent: false,
  };

  proto.acquireTokenByCode = async () => ({
    accessToken: 'user-token',
    idToken: 'id-token',
    expiresOn: new Date(Date.now() + state.expiresInMs),
    account: state.account,
  });
  proto.acquireTokenSilent = async () => {
    state.silentCalls += 1;
    if (state.failSilent) {
      throw new Error('interaction_required');
    }
    return {
      accessToken: 'renewed-token',
      idToken: 'id-token',
      expiresOn: new Date(Date.now() + 60 * 60 * 1000),
      account: state.account,
    };
  };
  proto.acquireTokenByClientCredential = async () => ({ accessToken: 'app-token' });

  return state;
}

/**
 * Replace SESClient.send and collect the emails that would have been sent
 */
function stubSes() {
  const { SESClient } = require('@aws-sdk/client-ses');
  const state = { sent: [], failWith: null };

  SESClient.prototype.send = async (command) => {
    if (state.failWith) {
      throw state.failWith;
    }
    state.sent.push(command.input);
    return { MessageId: 'test-message-id' };
  };

  return state;
}

/**
 * Wait until a condition holds, for work the app does after it has answered
 */
async function waitFor(condition, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

/**
 * Get the CSRF token of an agent's session, the way a browser does: from a
 * form. The reset request page is public, so this works signed in or not.
 */
async function getCsrfToken(agent) {
  const res = await agent.get('/reset-password');
  return res.text.match(/name="_csrf" value="([^"]+)"/)[1];
}

/**
 * Read the audit log written so far, optionally only one kind of event
 */
function auditEvents(event) {
  const dir = process.env.AUDIT_DIR;
  const entries = fs.readdirSync(dir)
    .flatMap(file => fs.readFileSync(path.join(dir, file), 'utf8').split('\n'))
    .filter(Boolean)
    .map(line => JSON.parse(line));
  return event ? entries.filter(entry => entry.event === event) : entries;
}

module.exports = { httpError, stubAxios, stubMsal, stubSes, waitFor, getCsrfToken, auditEvents };
