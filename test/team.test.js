/**
 * Team Tests
 * The people who report to a person, and the requests they send to IT
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, signInAgent, getCsrfToken, auditEvents } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const app = require('../server');

let agent;
let csrf;
const post = (path) => agent.post(path).set('X-CSRF-Token', csrf);

test.before(async () => {
  agent = request.agent(app);
  await signInAgent(agent);
  csrf = await getCsrfToken(agent);
});
test.after.always(() => agent.get('/auth/logout'));
test.beforeEach(() => {
  http.reset();
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  http.on('post', '/me/sendMail', {});
});

test.serial('GET /equipo lists the people who report to me, with the four requests', async t => {
  http.on('get', '/me/directReports/microsoft.graph.user', { value: [
    { id: '11111111-2222-3333-4444-555555555555', displayName: 'Zoe Vega', jobTitle: 'Administrativa', department: 'Obras', businessPhones: ['947500101'], mail: 'zoe@arandadeduero.es' },
    { id: '11111111-2222-3333-4444-555555555556', displayName: 'Bob Builder', jobTitle: 'Capataz', department: 'Obras' },
  ] });

  const res = await agent.get('/equipo').expect(200);

  t.true(res.text.indexOf('Bob Builder') < res.text.indexOf('Zoe Vega'));
  t.true(res.text.includes('href="/directorio/11111111-2222-3333-4444-555555555555"'));
  for (const kind of ['alta', 'baja', 'teams', 'invitado']) {
    t.true(res.text.includes(`action="/equipo/solicitud/${kind}"`), kind);
  }
  t.true(res.text.includes('href="/equipo" class="nav-link'.replace(' class="nav-link', '')));
});

test.serial('GET /equipo tells "nobody" apart from "could not check"', async t => {
  http.on('get', '/me/directReports/microsoft.graph.user', { value: [] });
  const nobody = await agent.get('/equipo').expect(200);
  t.true(nobody.text.includes('Nadie tiene puesto que depende de ti'));

  http.fail('get', '/me/directReports/microsoft.graph.user', 403);
  const unknown = await agent.get('/equipo').expect(200);
  t.true(unknown.text.includes('no se puede consultar quién depende de ti'));
  t.false(unknown.text.includes('Nadie tiene puesto'));
});

test.serial('a request to IT goes from my mailbox with its fields, and is audited without them', async t => {
  const res = await post('/equipo/solicitud/alta').type('form').send({
    fullName: 'Nueva Persona', jobTitle: 'Técnica', department: 'Urbanismo', startDate: '2026-11-02', likeUser: 'zoe@arandadeduero.es', notes: '',
  }).expect(302);

  t.is(res.header.location, '/equipo?sent=alta');
  const [call] = http.callsTo('post', '/me/sendMail');
  t.is(call.data.message.toRecipients[0].emailAddress.address, 'admin@example.test');
  t.is(call.data.message.subject, '[Mi Microsoft 365] Alta de una nueva persona');
  t.true(call.data.message.body.content.includes('Nombre y apellidos: Nueva Persona'));
  t.true(call.data.message.body.content.includes('Con los mismos grupos y accesos que: zoe@arandadeduero.es'));
  t.false(call.data.message.body.content.includes('Otras necesidades'));
  t.is(call.data.message.body.contentType, 'Text');
  t.deepEqual(auditEvents('request.onboarding').at(-1).kind, 'alta');
  t.false(JSON.stringify(auditEvents('request.onboarding').at(-1)).includes('Nueva Persona'));

  const page = await agent.get('/equipo?sent=alta').expect(200);
  t.true(page.text.includes('Solicitud enviada: <strong>Nueva incorporación</strong>'));
});

test.serial('a request with a required field missing, a bad option, or an unknown kind sends nothing', async t => {
  await post('/equipo/solicitud/baja').type('form').send({ person: 'Zoe' }).expect(400);
  await post('/equipo/solicitud/teams').type('form').send({ teamName: 'X', purpose: 'Y', members: 'Z', privacy: 'Secreto' }).expect(400);
  await post('/equipo/solicitud/nada').type('form').send({}).expect(404);

  t.is(http.callsTo('post', '/me/sendMail').length, 0);
});
