/**
 * Contact Card Tests
 * vCards and the directory's CSV
 */

require('./helpers/env');

const test = require('ava').default;
const { buildVCard, vcardFileName, directoryCsv } = require('../services/vcard');

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
