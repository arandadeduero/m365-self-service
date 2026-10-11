/**
 * Account Insights Tests
 * How Graph data is turned into what the account pages say
 */

require('./helpers/env');

const test = require('ava').default;
const {
  describeLicenses,
  describeStorage,
  describeGroup,
  describeRule,
  summarizeRules,
  buildChecklist,
  describeSignIn,
  describeCalendarSharing,
  isManageable,
} = require('../services/accountInsights');

const plan = (servicePlanName, provisioningStatus = 'Success') => ({ servicePlanName, provisioningStatus });
const GB = 1024 ** 3;

// ----------------------------------------------------------------- licenses

test('a license is named in plain language and listed with the apps it includes', t => {
  const result = describeLicenses([{
    skuPartNumber: 'O365_BUSINESS_PREMIUM',
    servicePlans: [plan('EXCHANGE_S_STANDARD'), plan('TEAMS1'), plan('SHAREPOINTWAC'), plan('OFFICE_BUSINESS'), plan('SOMETHING_UNKNOWN')],
  }]);

  t.deepEqual(result.licenses, [{ code: 'O365_BUSINESS_PREMIUM', name: 'Microsoft 365 Empresa Estándar' }]);
  t.deepEqual(result.apps.map(app => app.name), [
    'Correo y calendario (Outlook)',
    'Teams',
    'Word, Excel y PowerPoint en el navegador',
    'Word, Excel y PowerPoint para instalar',
  ]);
  t.true(result.apps[0].description.includes('Buzón de 50 GB'));
  t.true(result.apps.every(app => app.url.startsWith('https://')));
});

test('services that are switched off in the license are not offered', t => {
  const result = describeLicenses([{
    skuPartNumber: 'SPE_E3',
    servicePlans: [plan('TEAMS1', 'Disabled'), plan('EXCHANGE_S_ENTERPRISE'), plan('FORMS_PLAN_E3', 'PendingInput')],
  }]);

  t.deepEqual(result.apps.map(app => app.name), ['Correo y calendario (Outlook)']);
  t.true(result.apps[0].description.includes('100 GB'));
});

test('plans are recognised with the suffixes Microsoft adds, and apps are not repeated across licenses', t => {
  const result = describeLicenses([
    { skuPartNumber: 'STANDARDPACK', servicePlans: [plan('FORMS_PLAN_E1'), plan('TEAMS1'), plan('BPOS_S_TODO_1')] },
    { skuPartNumber: 'TEAMS_EXPLORATORY', servicePlans: [plan('TEAMS1'), plan('FLOW_O365_P2')] },
  ]);

  t.deepEqual(result.apps.map(app => app.name), ['Teams', 'To Do', 'Forms', 'Power Automate']);
});

test('an unknown license is shown by its code, and no licenses gives nothing', t => {
  t.deepEqual(describeLicenses([{ skuPartNumber: 'BRAND_NEW_SKU' }]), {
    licenses: [{ code: 'BRAND_NEW_SKU', name: 'BRAND_NEW_SKU' }],
    apps: [],
  });
  t.deepEqual(describeLicenses([{ skuId: 'abc-123' }]).licenses, [{ code: 'abc-123', name: 'abc-123' }]);
  t.deepEqual(describeLicenses([]), { licenses: [], apps: [] });
});

// ------------------------------------------------------------------ storage

test('storage is given in gigabytes with a percentage', t => {
  t.deepEqual(describeStorage({ total: 100 * GB, used: 25.5 * GB }), { used: '25,5 GB', total: '100 GB', percent: 26 });
  t.deepEqual(describeStorage({ total: 100 * GB }), { used: '0 GB', total: '100 GB', percent: 0 });
  t.is(describeStorage({ total: 10 * GB, used: 12 * GB }).percent, 100);
});

test('storage is unknown without a quota', t => {
  t.is(describeStorage(null), null);
  t.is(describeStorage({}), null);
  t.is(describeStorage({ total: 0, used: 0 }), null);
});

// ------------------------------------------------------------------- groups

test('each kind of group is told apart and explained', t => {
  const team = describeGroup({ groupTypes: ['Unified'], resourceProvisioningOptions: ['Team'], mail: 'obras@example.test', mailEnabled: true });
  const m365 = describeGroup({ groupTypes: ['Unified'], resourceProvisioningOptions: [], mail: 'archivo@example.test', mailEnabled: true });
  const list = describeGroup({ groupTypes: [], mailEnabled: true, securityEnabled: false, mail: 'todos@example.test' });
  const mailSecurity = describeGroup({ groupTypes: [], mailEnabled: true, securityEnabled: true, mail: 'acceso@example.test' });
  const security = describeGroup({ groupTypes: [], mailEnabled: false, securityEnabled: true });

  t.deepEqual([team, m365, list, mailSecurity, security].map(g => g.kind), ['team', 'microsoft365', 'distribution', 'mailSecurity', 'security']);
  t.is(team.label, 'Equipo de Teams');
  t.is(team.links[0].url, 'https://teams.microsoft.com');
  t.is(m365.links[0].url, 'https://outlook.office.com/mail/group/example.test/archivo/email');
  t.deepEqual(list.gives, ['Recibes los mensajes enviados a todos@example.test']);
  t.is(mailSecurity.gives.length, 2);
  t.true(security.gives[0].includes('No tiene correo'));
  t.deepEqual(security.links, []);
});

test('a group with almost no data is still described', t => {
  t.is(describeGroup({}).kind, 'security');
  t.deepEqual(describeGroup({ groupTypes: ['Unified'] }).links, []);
});

// --------------------------------------------------------------- mail rules

const to = (...addresses) => addresses.map(address => ({ emailAddress: { address } }));

test('a rule is described by what it does to the mail', t => {
  const rule = describeRule({
    displayName: 'Facturas',
    isEnabled: true,
    actions: { moveToFolder: 'abc', markAsRead: true, forwardTo: to('jefa@example.test') },
  }, 'example.test');

  t.like(rule, { name: 'Facturas', enabled: true, external: [] });
  t.deepEqual(rule.effects, [
    'Reenvía los mensajes a jefa@example.test',
    'Mueve los mensajes a otra carpeta',
    'Marca los mensajes como leídos',
  ]);
});

test('forwarding, redirecting and forwarding as attachment outside the organization are all noticed', t => {
  const forward = describeRule({ actions: { forwardTo: to('a@gmail.com', 'b@EXAMPLE.test') } }, 'example.test');
  const redirect = describeRule({ actions: { redirectTo: to('c@evil.example') } }, 'example.test');
  const attachment = describeRule({ actions: { forwardAsAttachmentTo: to('d@evil.example') } }, 'example.test');
  const lookalike = describeRule({ actions: { forwardTo: to('x@notexample.test') } }, 'example.test');

  t.deepEqual(forward.external, ['a@gmail.com']);
  t.deepEqual(redirect.external, ['c@evil.example']);
  t.deepEqual(attachment.external, ['d@evil.example']);
  t.deepEqual(lookalike.external, ['x@notexample.test']);
});

test('rules that delete, have no name or do something else are described too', t => {
  t.deepEqual(describeRule({ actions: { permanentDelete: true } }, 'example.test').effects, ['Elimina los mensajes']);
  t.like(describeRule({ actions: { stopProcessingRules: true } }, 'example.test'), { name: 'Regla sin nombre', effects: ['Otras acciones'] });
  t.false(describeRule({ isEnabled: false }, 'example.test').enabled);
});

test('only active rules count as forwarding mail outside', t => {
  const summary = summarizeRules([
    { displayName: 'Activa', isEnabled: true, actions: { forwardTo: to('a@gmail.com') } },
    { displayName: 'Otra', isEnabled: true, actions: { redirectTo: to('a@gmail.com', 'b@outlook.com') } },
    { displayName: 'Apagada', isEnabled: false, actions: { forwardTo: to('z@evil.example') } },
  ], 'example.test');

  t.is(summary.list.length, 3);
  t.deepEqual(summary.externalForwarding, ['a@gmail.com', 'b@outlook.com']);
});

test('rules that could not be read are unknown, not empty', t => {
  t.is(summarizeRules(null, 'example.test'), null);
  t.deepEqual(summarizeRules([], 'example.test'), { list: [], externalForwarding: [] });
});

// ---------------------------------------------------------------- checklist

const complete = {
  security: { hasSecondFactor: true },
  status: { otherMails: ['a@personal.example'], mobilePhone: '600' },
  hasPhoto: true,
  manager: { id: 'm1' },
  securityInfoUrl: 'https://example.test/security',
};

test('a complete account is at 100 %', t => {
  const checklist = buildChecklist(complete);

  t.is(checklist.percent, 100);
  t.is(checklist.items.length, 5);
  t.true(checklist.items.every(item => item.done));
});

test('each missing item lowers the percentage and says how to fix it', t => {
  const checklist = buildChecklist({
    ...complete,
    security: { hasSecondFactor: false },
    status: { otherMails: [], businessPhones: ['947'] },
    hasPhoto: false,
  });

  t.is(checklist.percent, 40);
  const missing = checklist.items.filter(item => !item.done);
  t.deepEqual(missing.map(item => item.label), [
    'Segundo método de inicio de sesión',
    'Correo personal para recuperar la contraseña',
    'Foto de perfil',
  ]);
  t.like(missing[0].fix, { url: 'https://example.test/security', external: true });
  t.is(missing[1].fix.url, undefined);
  t.is(missing[2].fix.url, '/profile/me/edit');
});

test('the second factor is left out of the list when it could not be checked', t => {
  const checklist = buildChecklist({ ...complete, security: null });

  t.is(checklist.items.length, 4);
  t.is(checklist.percent, 100);
});

// ----------------------------------------------------------------- sign-ins

test('a sign-in says when, with what, from where and whether it worked', t => {
  const entry = describeSignIn({
    id: 'signin-1',
    createdDateTime: '2026-10-10T08:00:00Z',
    appDisplayName: 'Outlook',
    ipAddress: '203.0.113.5',
    location: { city: 'Aranda de Duero', countryOrRegion: 'ES' },
    deviceDetail: { operatingSystem: 'Windows 10', browser: 'Edge 129' },
    status: { errorCode: 0 },
  });

  t.deepEqual(entry, {
    id: 'signin-1',
    when: '2026-10-10T08:00:00Z',
    app: 'Outlook',
    place: 'Aranda de Duero, ES',
    device: 'Windows 10 · Edge 129',
    ip: '203.0.113.5',
    succeeded: true,
    failureReason: '',
  });
});

test('a failed sign-in keeps its reason, and missing details are left empty', t => {
  const entry = describeSignIn({ createdDateTime: '2026-10-10T08:00:00Z', status: { errorCode: 50126, failureReason: 'Invalid username or password' } });

  t.like(entry, { succeeded: false, failureReason: 'Invalid username or password', place: '', device: '', app: '' });
  t.false(describeSignIn({}).succeeded);
});

// ----------------------------------------------------------------- calendar

const shared = (role, address, extra = {}) => ({ role, emailAddress: address ? { name: 'Bea Ruiz', address } : { name: 'My Organization' }, isInsideOrganization: true, ...extra });

test('each person with access to the calendar is listed with what they can do', t => {
  const [everyone, reader, delegate, outsider] = describeCalendarSharing([
    shared('freeBusyRead'),
    shared('read', 'bea@example.test'),
    shared('delegateWithPrivateEventAccess', 'jefe@example.test'),
    shared('write', 'x@gmail.com', { isInsideOrganization: false }),
  ]);

  t.like(everyone, { who: 'Todas las personas del Ayuntamiento', everyone: true, external: false, canChange: false });
  t.like(reader, { who: 'Bea Ruiz', email: 'bea@example.test', access: 'Ve todos los detalles de tus citas', canChange: false });
  t.like(delegate, { canChange: true, external: false });
  t.true(delegate.access.includes('citas privadas'));
  t.like(outsider, { external: true, canChange: true });
});

test('entries without access are left out, and an unknown level is shown as it comes', t => {
  const list = describeCalendarSharing([shared('none'), shared('somethingNew', 'bea@example.test'), { emailAddress: { address: 'x@example.test' } }]);

  t.is(list.length, 1);
  t.is(list[0].access, 'somethingNew');
});

test('calendar sharing that could not be read is unknown, not empty', t => {
  t.is(describeCalendarSharing(null), null);
  t.deepEqual(describeCalendarSharing([]), []);
});

test('only Microsoft 365 groups and plain security groups can be changed through Graph', t => {
  t.true(isManageable({ groupTypes: ['Unified'], mailEnabled: true }));
  t.true(isManageable({ groupTypes: [], mailEnabled: false, securityEnabled: true }));
  t.false(isManageable({ groupTypes: [], mailEnabled: true, securityEnabled: false }));
  t.false(isManageable({ groupTypes: [], mailEnabled: true, securityEnabled: true }));
  t.false(isManageable({}));
});
