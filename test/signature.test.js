/**
 * Signature Tests
 * The email signature built from a profile
 */

require('./helpers/env');

const test = require('ava').default;
const { buildSignature } = require('../services/signature');
const { buildVCard, vcardFileName, directoryCsv } = require('../services/vcard');

const org = { orgName: 'Ayuntamiento de Aranda de Duero', orgWeb: 'https://www.arandadeduero.es/', orgAddress: 'Plaza Mayor, 1' };

test('the signature carries the person and the organization, as HTML and as text', t => {
  const { html, text } = buildSignature({ displayName: 'Ana García', jobTitle: 'Técnica', department: 'Urbanismo', businessPhones: ['947 500 100'], mobilePhone: '600 000 000', mail: 'ana@arandadeduero.es' }, org);

  t.true(html.startsWith('<table'));
  for (const piece of ['Ana García', 'Técnica', 'Urbanismo', 'Ayuntamiento de Aranda de Duero', 'Plaza Mayor, 1', 'Tel. 947 500 100 · 600 000 000', 'mailto:ana@arandadeduero.es', 'href="https://www.arandadeduero.es/"', '>www.arandadeduero.es<']) {
    t.true(html.includes(piece), piece);
  }
  t.is(text, 'Ana García\nTécnica\nUrbanismo\nAyuntamiento de Aranda de Duero\nPlaza Mayor, 1\nTel. 947 500 100 · 600 000 000\nana@arandadeduero.es\nwww.arandadeduero.es');
});

test('empty fields leave no empty lines, and profile text cannot add markup', t => {
  const { html, text } = buildSignature({ displayName: 'Zoe <b>Raro</b>', mail: 'zoe@arandadeduero.es' }, { orgName: 'Ayto', orgWeb: '', orgAddress: '' });

  t.false(html.includes('<b>'));
  t.true(html.includes('Zoe &lt;b&gt;Raro&lt;/b&gt;'));
  t.false(html.includes('Tel.'));
  t.is(text, 'Zoe <b>Raro</b>\nAyto\nzoe@arandadeduero.es');
});

test('a vCard has the name split, the organization, phones and the address escaped', t => {
  const card = buildVCard({ displayName: 'Ana García', givenName: 'Ana', surname: 'García', jobTitle: 'Técnica; Obras', department: 'Urbanismo', officeLocation: 'Plaza Mayor, 1', businessPhones: ['947500100'], mobilePhone: '600000000', mail: 'ana@arandadeduero.es' }, 'Ayuntamiento');

  const lines = card.split('\r\n');
  t.is(lines[0], 'BEGIN:VCARD');
  t.true(lines.includes('N:García;Ana;;;'));
  t.true(lines.includes('FN:Ana García'));
  t.true(lines.includes('ORG:Ayuntamiento;Urbanismo'));
  t.true(lines.includes('TITLE:Técnica\\; Obras'));
  t.true(lines.includes('TEL;TYPE=WORK,VOICE:947500100'));
  t.true(lines.includes('TEL;TYPE=CELL:600000000'));
  t.true(lines.includes('EMAIL;TYPE=INTERNET,WORK:ana@arandadeduero.es'));
  t.true(lines.includes('ADR;TYPE=WORK:;;Plaza Mayor\\, 1;;;;'));
  t.is(lines.at(-2), 'END:VCARD');
  t.is(vcardFileName({ displayName: 'Ana García Núñez' }), 'ana-garcia-nunez.vcf');
});

test('the CSV opens in Spanish Excel: byte order mark, semicolons, quotes doubled', t => {
  const csv = directoryCsv([{ displayName: 'Ana "Anita" García', jobTitle: 'Técnica', department: 'Urbanismo', officeLocation: null, businessPhones: ['947500100', '947500101'], mobilePhone: '', mail: 'ana@arandadeduero.es' }]);

  t.true(csv.startsWith('\uFEFF"Nombre";"Puesto";"Departamento";"Oficina";"Teléfono";"Móvil";"Correo"\r\n'));
  t.true(csv.includes('"Ana ""Anita"" García";"Técnica";"Urbanismo";"";"947500100 / 947500101";"";"ana@arandadeduero.es"\r\n'));
});
