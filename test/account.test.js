/**
 * Account Route Tests
 * Directory, account page, automatic replies and photo upload, as a signed-in
 * user against a stubbed Microsoft Graph.
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, getCsrfToken, auditEvents } = require('./helpers/stubs');

const http = stubAxios();
stubMsal();

const app = require('../server');

const agent = request.agent(app);
let csrf;
const post = (path) => agent.post(path).set('X-CSRF-Token', csrf);

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString();

const TIME_ZONE = 'Romance Standard Time';
const SETTINGS = '/me/mailboxSettings';

test.before(async () => {
  await agent.get('/auth/callback?code=test-code').expect(302);
  csrf = await getCsrfToken(agent);
});

test.after.always(async () => {
  await agent.get('/auth/logout');
});

test.beforeEach(() => {
  http.reset();
  http.on('get', `${SETTINGS}/timeZone`, { value: TIME_ZONE });
  http.on('patch', SETTINGS, {});
});

function savedReply() {
  const [call] = http.callsTo('patch', SETTINGS);
  return call && call.data.automaticRepliesSetting;
}

// ---------------------------------------------------------------- directory

test.serial('GET /directorio lists everybody with their contact details', async t => {
  http.on('get', '/v1.0/users', {
    value: [
      {
        id: 'u1',
        displayName: 'Ana García',
        jobTitle: 'Técnica',
        department: 'Obras',
        officeLocation: 'Planta 2',
        businessPhones: ['947500100'],
        mobilePhone: '600111222',
        mail: 'ana@arandadeduero.es',
      },
      { id: 'u2', displayName: 'Luis Sin Datos' },
    ],
  });

  const res = await agent.get('/directorio').expect(200);

  for (const text of ['Ana García', 'Técnica', 'Obras', 'Planta 2', 'Luis Sin Datos']) {
    t.true(res.text.includes(text), text);
  }
  t.true(res.text.includes('href="tel:947500100"'));
  t.true(res.text.includes('href="tel:600111222"'));
  t.true(res.text.includes('href="mailto:ana@arandadeduero.es"'));
  t.true(http.callsTo('get', '/v1.0/users')[0].config.params.$select.includes('businessPhones'));
});

test.serial('GET /directorio says so when the directory cannot be read', async t => {
  http.fail('get', '/v1.0/users', 500);

  const res = await agent.get('/directorio').expect(200);

  t.true(res.text.includes('No se ha podido cargar el directorio'));
});

test.serial('the new pages redirect anonymous users to login', async t => {
  for (const path of ['/directorio', '/account', '/account/groups', '/account/sign-ins', '/profile/me/auto-reply']) {
    const res = await request(app).get(path).expect(302);
    t.is(res.header.location, '/login', path);
  }
});

// ------------------------------------------------------------- account page

test.serial('GET /account shows licenses, recovery address and a warning near expiry', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(80), otherMails: ['ana@personal.example'] });
  http.on('get', '/me/licenseDetails', { value: [{ skuPartNumber: 'O365_BUSINESS_PREMIUM' }] });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('O365_BUSINESS_PREMIUM'));
  t.true(res.text.includes('ana@personal.example'));
  // 90 day policy (PASSWORD_MAX_AGE_DAYS) and changed 80 days ago
  t.regex(res.text, /alert-warning">Tu contraseña caduca en <strong>10<\/strong> días/);
  t.true(res.text.includes('https://mysignins.microsoft.com/security-info/password/change'));
});

test.serial('GET /account shows the days left without a warning when expiry is far', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10), otherMails: ['ana@personal.example'] });

  const res = await agent.get('/account').expect(200);

  t.regex(res.text, /<p>Caduca en <strong>80<\/strong> días/);
  t.false(res.text.includes('Tu contraseña caduca'));
});

test.serial('GET /account says when the password has expired', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(100) });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('Tu contraseña ha caducado'));
});

test.serial('GET /account warns when there is no recovery address and no license', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: null, otherMails: [] });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('No tienes un correo personal registrado'));
  t.true(res.text.includes('No tienes licencias asignadas'));
  t.false(res.text.includes('aduca en'));
});

test.serial('GET /account renders the error page when the account cannot be read', async t => {
  http.fail('get', '/v1.0/me', 500);

  await agent.get('/account').expect(500);
  t.pass();
});

test.serial('GET /account lists the sign-in methods and is content when there is a second factor', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', '/me/authentication/methods', {
    value: [
      { '@odata.type': '#microsoft.graph.passwordAuthenticationMethod' },
      { '@odata.type': '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod', displayName: 'iPhone de Ana' },
      { '@odata.type': '#microsoft.graph.phoneAuthenticationMethod', phoneNumber: '+34 600111222' },
    ],
  });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('Aplicación Microsoft Authenticator'));
  t.true(res.text.includes('(iPhone de Ana)'));
  t.true(res.text.includes('(+34 600111222)'));
  t.false(res.text.includes('solo está protegida por la contraseña'));
});

test.serial('GET /account warns when the password is the only protection', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', '/me/authentication/methods', {
    value: [
      { '@odata.type': '#microsoft.graph.passwordAuthenticationMethod' },
      { '@odata.type': '#microsoft.graph.emailAuthenticationMethod', emailAddress: 'ana@personal.example' },
    ],
  });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('solo está protegida por la contraseña'));
  t.true(res.text.includes('Correo de recuperación'));
});

test.serial('GET /account counts a method it does not know as a second factor', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', '/me/authentication/methods', {
    value: [
      { '@odata.type': '#microsoft.graph.passwordAuthenticationMethod' },
      { '@odata.type': '#microsoft.graph.somethingNewAuthenticationMethod' },
    ],
  });

  const res = await agent.get('/account').expect(200);

  t.false(res.text.includes('solo está protegida por la contraseña'));
  t.true(res.text.includes('somethingNew'));
});

test.serial('GET /account does not warn when the sign-in methods cannot be read', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.fail('get', '/me/authentication/methods', 403);

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('No se han podido comprobar'));
  t.false(res.text.includes('solo está protegida por la contraseña'));
});

test.serial('GET /account lists the devices of the user once each', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  const laptop = { id: 'd1', displayName: 'PORTATIL-ANA', operatingSystem: 'Windows', operatingSystemVersion: '10.0.22631', approximateLastSignInDateTime: '2026-10-01T08:00:00Z' };
  http.on('get', '/me/registeredDevices/microsoft.graph.device', { value: [laptop] });
  http.on('get', '/me/ownedDevices/microsoft.graph.device', { value: [laptop, { id: 'd2', displayName: 'iPhone de Ana', operatingSystem: 'iOS' }] });

  const res = await agent.get('/account').expect(200);

  t.is(res.text.split('PORTATIL-ANA').length - 1, 1);
  t.true(res.text.includes('Windows 10.0.22631'));
  t.true(res.text.includes('1 de octubre de 2026'));
  t.true(res.text.includes('iPhone de Ana'));
});

test.serial('GET /account says so when there are no devices', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('No hay dispositivos registrados'));
});

// ------------------------------------------------ what I have, and checklist

const servicePlan = (servicePlanName, provisioningStatus = 'Success') => ({ servicePlanName, provisioningStatus });

test.serial('GET /account says what the license includes, in plain language, with a way to open each app', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', '/me/licenseDetails', {
    value: [{
      skuPartNumber: 'O365_BUSINESS_PREMIUM',
      servicePlans: [servicePlan('EXCHANGE_S_STANDARD'), servicePlan('TEAMS1'), servicePlan('FORMS_PLAN_E1', 'Disabled')],
    }],
  });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('Microsoft 365 Empresa Estándar'));
  t.true(res.text.includes('Correo y calendario (Outlook)'));
  t.true(res.text.includes('Buzón de 50 GB'));
  t.true(res.text.includes('href="https://teams.microsoft.com"'));
  t.false(res.text.includes('Formularios y encuestas'));
});

test.serial('GET /account shows the OneDrive space used when it is known', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', '/me/drive', { quota: { total: 100 * 1024 ** 3, used: 25.5 * 1024 ** 3 } });

  const res = await agent.get('/account').expect(200);

  t.regex(res.text, /Espacio en OneDrive: <strong>25,5 GB<\/strong> usados de 100 GB/);
  t.is(http.callsTo('get', '/me/drive')[0].config.params.$select, 'quota');

  http.fail('get', '/me/drive', 403);
  const unknown = await agent.get('/account').expect(200);
  t.false(unknown.text.includes('Espacio en OneDrive'));
});

test.serial('GET /account shows a complete account at 100 %', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10), otherMails: ['ana@personal.example'], mobilePhone: '600111222' });
  http.on('get', '/me/photo/$value', Buffer.from('img'));
  http.on('get', '/me/manager', { id: 'm1', displayName: 'Boss' });
  http.on('get', '/me/authentication/methods', {
    value: [{ '@odata.type': '#microsoft.graph.fido2AuthenticationMethod', displayName: 'Llave' }],
  });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('Tu cuenta está al 100 %'));
  t.false(res.text.includes('⬜'));
});

test.serial('GET /account lists what is missing with a way to fix each thing', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', '/me/authentication/methods', {
    value: [{ '@odata.type': '#microsoft.graph.passwordAuthenticationMethod' }],
  });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('Tu cuenta está al 0 %'));
  t.is(res.text.split('⬜').length - 1, 5);
  t.true(res.text.includes('Subir una foto'));
  t.true(res.text.includes('Pídelo a Informática'));
});

// --------------------------------------------------------------- mail rules

const RULES = '/me/mailFolders/inbox/messageRules';
const recipient = (address) => ({ emailAddress: { address } });

test.serial('GET /account warns when a rule sends the mail outside the organization', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', RULES, {
    value: [
      { displayName: 'Copia', isEnabled: true, actions: { forwardTo: [recipient('alguien@gmail.com')] } },
      { displayName: 'Boletines', isEnabled: true, actions: { moveToFolder: 'x' } },
    ],
  });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('reenviando fuera del Ayuntamiento'));
  t.true(res.text.includes('<strong>alguien@gmail.com</strong>'));
  t.true(res.text.includes('Boletines'));
  t.true(res.text.includes('Mueve los mensajes a otra carpeta'));
});

test.serial('GET /account does not warn about forwarding inside, or rules that are off', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', RULES, {
    value: [
      { displayName: 'A mi jefa', isEnabled: true, actions: { forwardTo: [recipient('jefa@arandadeduero.es')] } },
      { displayName: 'Antigua', isEnabled: false, actions: { redirectTo: [recipient('yo@gmail.com')] } },
    ],
  });

  const res = await agent.get('/account').expect(200);

  t.false(res.text.includes('reenviando fuera del Ayuntamiento'));
  t.true(res.text.includes('A mi jefa'));
  t.regex(res.text, /Antigua<\/strong> <span class="badge bg-secondary">Desactivada/);
});

test.serial('GET /account tells no rules apart from rules it could not read', async t => {
  http.on('get', '/v1.0/me', { lastPasswordChangeDateTime: daysAgo(10) });
  http.on('get', RULES, { value: [] });
  const none = await agent.get('/account').expect(200);
  t.true(none.text.includes('No tienes reglas en tu bandeja de entrada'));

  http.fail('get', RULES, 403);
  const unknown = await agent.get('/account').expect(200);
  t.true(unknown.text.includes('No se han podido comprobar las reglas'));
  t.false(unknown.text.includes('No tienes reglas'));
});

// ---------------------------------------------------------------- my groups

test.serial('GET /account/groups explains what each group is and gives', async t => {
  http.on('get', '/me/memberOf/microsoft.graph.group', {
    value: [
      { id: 'g3', displayName: 'Zona Archivo', groupTypes: [], mailEnabled: false, securityEnabled: true },
      { id: 'g1', displayName: 'Equipo Obras', description: 'Obras y servicios', groupTypes: ['Unified'], resourceProvisioningOptions: ['Team'], mail: 'obras@arandadeduero.es', mailEnabled: true },
      { id: 'g2', displayName: 'Todos', groupTypes: [], mailEnabled: true, securityEnabled: false, mail: 'todos@arandadeduero.es' },
    ],
  });

  const res = await agent.get('/account/groups').expect(200);

  const position = (text) => res.text.indexOf(text);
  t.true(position('Equipo Obras') < position('>Todos<'));
  t.true(position('>Todos<') < position('Zona Archivo'));
  for (const text of ['Equipo de Teams', 'Lista de distribución', 'Grupo de seguridad', 'Obras y servicios', 'Recibes los mensajes enviados a todos@arandadeduero.es', 'Abrir Teams']) {
    t.true(res.text.includes(text), text);
  }
  t.true(http.callsTo('get', '/me/memberOf/microsoft.graph.group')[0].config.params.$select.includes('resourceProvisioningOptions'));
});

test.serial('GET /account/groups handles having no groups and Graph failing', async t => {
  http.on('get', '/me/memberOf/microsoft.graph.group', { value: [] });
  const none = await agent.get('/account/groups').expect(200);
  t.true(none.text.includes('No perteneces a ningún grupo'));

  http.fail('get', '/me/memberOf/microsoft.graph.group', 500);
  await agent.get('/account/groups').expect(500);
});

// ----------------------------------------------------------------- sign-ins

const SIGN_INS = '/auditLogs/signIns';

test.serial('GET /account/sign-ins shows the user\'s own recent sign-ins', async t => {
  http.on('get', SIGN_INS, {
    value: [
      {
        createdDateTime: '2026-10-10T08:15:00Z',
        appDisplayName: 'Microsoft Teams',
        ipAddress: '203.0.113.5',
        location: { city: 'Aranda de Duero', countryOrRegion: 'ES' },
        deviceDetail: { operatingSystem: 'Windows 10', browser: 'Edge 129' },
        status: { errorCode: 0 },
      },
      {
        createdDateTime: '2026-10-09T23:40:00Z',
        appDisplayName: 'Outlook',
        ipAddress: '198.51.100.20',
        location: { city: 'Lagos', countryOrRegion: 'NG' },
        status: { errorCode: 50126, failureReason: 'Invalid username or password' },
      },
    ],
  });

  const res = await agent.get('/account/sign-ins').expect(200);

  for (const text of ['Microsoft Teams', 'Aranda de Duero, ES', 'Windows 10 · Edge 129', 'Correcto', 'Lagos, NG', 'Fallido', 'Invalid username or password', '198.51.100.20']) {
    t.true(res.text.includes(text), text);
  }
  // Shown in Madrid time: 08:15 UTC is 10:15
  t.true(res.text.includes('10:15'));

  // Read with the app's token, for the signed-in user and nobody else
  const [call] = http.callsTo('get', SIGN_INS);
  t.is(call.config.headers.Authorization, 'Bearer app-token');
  t.is(call.config.params.$filter, "userId eq 'alice-id'");
});

test.serial('GET /account/sign-ins cannot be asked for somebody else\'s log', async t => {
  http.on('get', SIGN_INS, { value: [] });

  await agent.get('/account/sign-ins?userId=bob-id&id=bob-id').expect(200);

  t.is(http.callsTo('get', SIGN_INS)[0].config.params.$filter, "userId eq 'alice-id'");
});

test.serial('GET /account/sign-ins says when there are none, or when the log is unavailable', async t => {
  http.on('get', SIGN_INS, { value: [] });
  const none = await agent.get('/account/sign-ins').expect(200);
  t.true(none.text.includes('No hay inicios de sesión recientes'));

  http.fail('get', SIGN_INS, 403);
  const unavailable = await agent.get('/account/sign-ins').expect(200);
  t.true(unavailable.text.includes('no se puede consultar el registro'));
});

// -------------------------------------------------------- automatic replies

test.serial('GET /profile/me/auto-reply shows the current setting in the mailbox time zone', async t => {
  http.on('get', `${SETTINGS}/automaticRepliesSetting`, {
    status: 'scheduled',
    externalAudience: 'all',
    internalReplyMessage: '<html><head><style>p{margin:0}</style></head><body><div>Estoy fuera.</div><div>Vuelvo el lunes &amp; martes.</div></body></html>',
    scheduledStartDateTime: { dateTime: '2026-12-24T08:00:00.0000000', timeZone: TIME_ZONE },
    scheduledEndDateTime: { dateTime: '2027-01-07T15:30:00.0000000', timeZone: TIME_ZONE },
  });

  const res = await agent.get('/profile/me/auto-reply').expect(200);

  t.regex(res.text, /value="scheduled" checked/);
  t.true(res.text.includes('value="2026-12-24T08:00"'));
  t.true(res.text.includes('value="2027-01-07T15:30"'));
  t.true(res.text.includes('>Estoy fuera.\nVuelvo el lunes &amp; martes.</textarea>'));
  t.regex(res.text, /name="external" checked/);
  t.true(res.text.includes(TIME_ZONE));
  t.is(
    http.callsTo('get', '/automaticRepliesSetting')[0].config.headers.Prefer,
    `outlook.timezone="${TIME_ZONE}"`
  );
});

test.serial('GET /profile/me/auto-reply shows replies as disabled when nothing is set', async t => {
  http.on('get', `${SETTINGS}/automaticRepliesSetting`, { status: 'disabled', externalAudience: 'none' });

  const res = await agent.get('/profile/me/auto-reply?saved=1').expect(200);

  t.regex(res.text, /value="disabled" checked/);
  t.notRegex(res.text, /name="external" checked/);
  t.true(res.text.includes('Cambios guardados'));
});

test.serial('POST /profile/me/auto-reply schedules replies between two dates', async t => {
  const res = await post('/profile/me/auto-reply')
    .type('form')
    .send({
      status: 'scheduled',
      start: '2026-12-24T08:00',
      end: '2027-01-07T15:30',
      message: 'Estoy fuera <hasta> enero\nSaludos',
      external: 'on',
    })
    .expect(302);

  t.is(res.header.location, '/profile/me/auto-reply?saved=1');
  t.deepEqual(savedReply(), {
    status: 'scheduled',
    externalAudience: 'all',
    internalReplyMessage: 'Estoy fuera &lt;hasta&gt; enero<br>Saludos',
    externalReplyMessage: 'Estoy fuera &lt;hasta&gt; enero<br>Saludos',
    scheduledStartDateTime: { dateTime: '2026-12-24T08:00:00', timeZone: TIME_ZONE },
    scheduledEndDateTime: { dateTime: '2027-01-07T15:30:00', timeZone: TIME_ZONE },
  });
});

test.serial('POST /profile/me/auto-reply can enable replies for people inside only', async t => {
  await post('/profile/me/auto-reply').type('form').send({ status: 'alwaysEnabled', message: 'De baja' }).expect(302);

  t.deepEqual(savedReply(), {
    status: 'alwaysEnabled',
    externalAudience: 'none',
    internalReplyMessage: 'De baja',
    externalReplyMessage: 'De baja',
  });
});

test.serial('POST /profile/me/auto-reply can disable replies and keeps the stored message', async t => {
  await post('/profile/me/auto-reply').type('form').send({ status: 'disabled', message: '' }).expect(302);

  t.deepEqual(savedReply(), { status: 'disabled', externalAudience: 'none' });
});

test.serial('POST /profile/me/auto-reply rejects incomplete or inconsistent forms', async t => {
  const form = (fields) => post('/profile/me/auto-reply').type('form').send(fields);

  await form({ status: 'whatever', message: 'x' }).expect(400);
  await form({ message: 'x' }).expect(400);
  const noMessage = await form({ status: 'alwaysEnabled', message: '   ' }).expect(400);
  const backwards = await form({ status: 'scheduled', message: 'x', start: '2027-01-07T08:00', end: '2026-12-24T08:00' }).expect(400);
  await form({ status: 'scheduled', message: 'x', start: '2026-12-24T08:00' }).expect(400);
  await form({ status: 'scheduled', message: 'x', start: 'mañana', end: 'pasado' }).expect(400);

  t.true(noMessage.text.includes('Escribe el mensaje'));
  t.true(backwards.text.includes('fecha de inicio anterior'));
  t.is(savedReply(), undefined);
});

test.serial('POST /profile/me/auto-reply renders the error page when Graph rejects the change', async t => {
  http.fail('patch', SETTINGS, 403);

  await post('/profile/me/auto-reply').type('form').send({ status: 'alwaysEnabled', message: 'De baja' }).expect(500);
  t.pass();
});

test.serial('changing automatic replies is audited without the message', async t => {
  const before = auditEvents('mail.auto_reply_update').length;

  await post('/profile/me/auto-reply')
    .type('form')
    .send({ status: 'alwaysEnabled', message: 'Texto privado', external: 'on' })
    .expect(302);

  const events = auditEvents('mail.auto_reply_update');
  t.is(events.length, before + 1);
  t.like(events.at(-1), { actor: 'alice@arandadeduero.es', status: 'alwaysEnabled', external: true });
  t.false(JSON.stringify(events.at(-1)).includes('Texto privado'));
});

// -------------------------------------------------------------------- photo

const PHOTO = Buffer.from('JPEG-DATA');
const jpeg = { filename: 'me.jpg', contentType: 'image/jpeg' };

test.serial('POST /profile/me/photo uploads the image to Graph', async t => {
  http.on('put', '/me/photo/$value', {});

  const res = await agent
    .post('/profile/me/photo')
    .field('_csrf', csrf)
    .attach('photo', PHOTO, jpeg)
    .expect(302);

  t.is(res.header.location, '/');
  const [put] = http.callsTo('put', '/me/photo/$value');
  t.true(PHOTO.equals(put.data));
  t.is(put.config.headers['Content-Type'], 'image/jpeg');
  t.like(auditEvents('profile.photo_update').at(-1), { actor: 'alice@arandadeduero.es', bytes: PHOTO.length });
});

test.serial('POST /profile/me/photo is refused without the CSRF token', async t => {
  http.on('put', '/me/photo/$value', {});

  await agent.post('/profile/me/photo').attach('photo', PHOTO, jpeg).expect(403);

  t.is(http.callsTo('put', '/me/photo/$value').length, 0);
});

test.serial('POST /profile/me/photo rejects missing, non-image and oversized files', async t => {
  http.on('put', '/me/photo/$value', {});

  const missing = await post('/profile/me/photo').field('other', 'x').expect(400);
  const text = await post('/profile/me/photo')
    .attach('photo', Buffer.from('hello'), { filename: 'me.txt', contentType: 'text/plain' })
    .expect(400);
  const huge = await post('/profile/me/photo')
    .attach('photo', Buffer.alloc(4 * 1024 * 1024 + 1), jpeg)
    .expect(400);

  t.true(missing.text.includes('JPG o PNG'));
  t.true(text.text.includes('JPG o PNG'));
  t.true(huge.text.includes('4 MB'));
  t.is(http.callsTo('put', '/me/photo/$value').length, 0);
});

test.serial('POST /profile/me/photo renders the error page when Graph rejects the image', async t => {
  http.fail('put', '/me/photo/$value', 400);

  await post('/profile/me/photo').attach('photo', PHOTO, jpeg).expect(500);
  t.pass();
});

// ----------------------------------------------------------------- calendar

const CALENDAR = '/me/calendar/calendarPermissions';

test.serial('GET /account lists who can see the calendar and warns about outsiders', async t => {
  http.on('get', '/v1.0/me', {});
  http.on('get', CALENDAR, {
    value: [
      { role: 'freeBusyRead', emailAddress: { name: 'My Organization' }, isInsideOrganization: true },
      { role: 'write', emailAddress: { name: 'Bea Ruiz', address: 'bea@arandadeduero.es' }, isInsideOrganization: true },
      { role: 'read', emailAddress: { name: 'Fuera', address: 'alguien@gmail.com' }, isInsideOrganization: false },
    ],
  });

  const res = await agent.get('/account').expect(200);

  t.true(res.text.includes('Todas las personas del Ayuntamiento'));
  t.true(res.text.includes('Bea Ruiz'));
  t.is(res.text.split('Puede hacer cambios').length - 1, 1);
  t.regex(res.text, /compartido con personas de fuera del Ayuntamiento: <strong>alguien@gmail\.com<\/strong>/);
});

test.serial('GET /account tells "shared with nobody" apart from "could not check"', async t => {
  http.on('get', '/v1.0/me', {});
  http.on('get', CALENDAR, { value: [] });
  const nobody = await agent.get('/account').expect(200);
  t.true(nobody.text.includes('Nadie más puede ver tu calendario'));

  http.fail('get', CALENDAR, 403);
  const unknown = await agent.get('/account').expect(200);
  t.true(unknown.text.includes('No se ha podido comprobar con quién compartes tu calendario'));
  t.false(unknown.text.includes('Nadie más puede ver tu calendario'));
});
