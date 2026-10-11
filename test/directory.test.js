/**
 * Directory Tests
 * The directory's export, contact cards and vCards
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, signInAgent } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const app = require('../server');

const ANA_ID = '11111111-2222-3333-4444-555555555555';
const ANA = { id: ANA_ID, displayName: 'Ana García', givenName: 'Ana', surname: 'García', jobTitle: 'Técnica', department: 'Urbanismo', officeLocation: 'Planta 2', businessPhones: ['947500100'], mobilePhone: null, mail: 'ana@arandadeduero.es' };

let agent;

test.before(async () => {
  agent = request.agent(app);
  await signInAgent(agent);
});

test.after.always(() => agent.get('/auth/logout'));

test.beforeEach(() => {
  http.reset();
  http.on('get', '/v1.0/me', { displayName: 'Alice Example' });
  http.on('get', '/v1.0/users', { value: [ANA] });
  http.on('get', `/users/${ANA_ID}`, ANA);
});

test.serial('the directory links every person to their card and offers the export', async t => {
  const res = await agent.get('/directorio').expect(200);

  t.true(res.text.includes(`href="/directorio/${ANA_ID}"`));
  t.true(res.text.includes('href="/directorio/export.csv"'));
});

test.serial('the export is a CSV file with everybody', async t => {
  const res = await agent.get('/directorio/export.csv').expect(200).expect('Content-Type', /text\/csv/);

  t.true(res.headers['content-disposition'].includes('directorio.csv'));
  t.true(res.text.includes('"Ana García";"Técnica";"Urbanismo";"Planta 2";"947500100";"";"ana@arandadeduero.es"'));
});

test.serial("a person's card shows their details, a QR code and the vCard to download", async t => {
  const res = await agent.get(`/directorio/${ANA_ID}`).expect(200);

  t.true(res.text.includes('<h1 class="h2 mb-0 page-title">Ana García</h1>'));
  t.true(res.text.includes('Urbanismo'));
  t.true(res.text.includes('href="tel:947500100"'));
  t.true(res.text.includes(`href="/directorio/${ANA_ID}/vcard"`));
  // The QR is an image made here, not fetched from anywhere
  t.regex(res.text, /<img src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="Código QR/);
  t.is(http.callsTo('get', `/users/${ANA_ID}`)[0].config.params.$select, 'id,displayName,givenName,surname,mail,jobTitle,department,officeLocation,businessPhones,mobilePhone');
});

test.serial('the vCard downloads as a file named after the person', async t => {
  const res = await agent.get(`/directorio/${ANA_ID}/vcard`).expect(200).expect('Content-Type', /text\/vcard/);

  t.is(res.headers['content-disposition'], 'attachment; filename="ana-garcia.vcf"');
  t.true(res.text.includes('FN:Ana García\r\n'));
  t.true(res.text.includes('ORG:Ayuntamiento de Aranda de Duero;Urbanismo\r\n'));
});

test.serial('an id that is not a directory id never reaches Graph, and an unknown one is a 404', async t => {
  await agent.get('/directorio/not-an-id').expect(404);
  await agent.get('/directorio/..%2Fme/vcard').expect(404);
  t.is(http.calls.filter(call => call.url.includes('/users/')).length, 0);

  http.fail('get', `/users/${ANA_ID}`, 404);
  await agent.get(`/directorio/${ANA_ID}`).expect(404);
});
