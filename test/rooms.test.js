/**
 * Room Finder Tests
 * Which meeting rooms are free, with booking left to Outlook
 */

require('./helpers/env');

const test = require('ava').default;
const request = require('supertest');
const { stubAxios, stubMsal, httpError, getCsrfToken, auditEvents, signInAgent } = require('./helpers/stubs');

const http = stubAxios();
const msal = stubMsal();

const appConfig = require('../config/appConfig');
const app = require('../server');

const ALICE = { username: 'alice@arandadeduero.es', name: 'Alice Example', localAccountId: 'alice-id' };

/**
 * Sign in and return an agent with helpers for that session
 */
async function signIn(t, account = ALICE) {
  msal.account = account;
  const agent = request.agent(app);
  await signInAgent(agent);
  const csrf = await getCsrfToken(agent);
  t.teardown(() => agent.get('/auth/logout'));

  return {
    get: (url) => agent.get(url),
    post: (url) => agent.post(url).set('X-CSRF-Token', csrf),
    postWithoutToken: (url) => agent.post(url),
  };
}

const ROOMS = '/places/microsoft.graph.room';
const SCHEDULE = '/me/calendar/getSchedule';
const SEARCH = '/salas?date=2026-10-14&start=10:00&end=11:00';

test.beforeEach(() => {
  http.reset();
  http.on('get', ROOMS, {
    value: [
      { displayName: 'Sala B', emailAddress: 'Sala.B@arandadeduero.es', capacity: 8, building: 'Casa Consistorial', floorLabel: 'Planta 1' },
      { displayName: 'Salón de Plenos', emailAddress: 'plenos@arandadeduero.es', capacity: 40 },
      { displayName: 'Sala sin buzón' },
    ],
  });
  http.on('post', SCHEDULE, {
    value: [
      { scheduleId: 'sala.b@arandadeduero.es', availabilityView: '0220' },
      { scheduleId: 'plenos@arandadeduero.es', availabilityView: '0000' },
    ],
  });
});

test.serial('the page opens on the list of rooms and a form for today, without asking the calendars', async t => {
  const user = await signIn(t);
  http.calls.length = 0;

  const res = await user.get('/salas').expect(200);

  t.regex(res.text, /name="date" value="\d{4}-\d{2}-\d{2}"/);
  t.regex(res.text, /name="start" value="\d{2}:00"/);
  // Name, where and how many people, in alphabetical order; a room without a mailbox is left out
  t.true(res.text.includes('>2 salas</h2>'));
  t.true(res.text.indexOf('Sala B') < res.text.indexOf('Salón de Plenos'));
  t.true(res.text.includes('Casa Consistorial · Planta 1'));
  t.true(res.text.includes('<td>8 personas</td>'));
  t.true(res.text.includes('<td>40 personas</td>'));
  t.false(res.text.includes('Sala sin buzón'));
  // Nothing about availability until a search
  t.false(res.text.includes('Reservar en Outlook'));
  t.false(res.text.includes('<th>Estado</th>'));
  t.is(http.callsTo('get', ROOMS).length, 1);
  t.is(http.callsTo('post', SCHEDULE).length, 0);
  t.true(res.text.includes('href="/salas" class="nav-link active"'));
});

test.serial('the table can be sorted by name, place and capacity', async t => {
  const user = await signIn(t);

  const res = await user.get('/salas').expect(200);

  for (const key of ['name', 'where', 'capacity']) {
    t.true(res.text.includes(`class="table-sort" data-sort="${key}"`), key);
  }
  t.true(res.text.includes('data-sort="capacity" data-type="number"'));
  t.true(res.text.includes('data-name="Salón de Plenos" data-where="" data-capacity="40"'));
  t.true(res.text.includes('src="/js/rooms.js"'));
  await user.get('/js/rooms.js').expect(200);
});

test.serial('a search shows free rooms first, with a link that books them in Outlook', async t => {
  const user = await signIn(t);

  const res = await user.get(SEARCH).expect(200);

  t.true(res.text.includes('Salas el 14/10/2026 de 10:00 a 11:00'));
  t.true(res.text.indexOf('Salón de Plenos') < res.text.indexOf('Sala B'));
  t.is(res.text.split('>Libre</span>').length - 1, 1);
  t.is(res.text.split('>Ocupada</span>').length - 1, 1);
  t.true(res.text.includes('Casa Consistorial · Planta 1'));
  // A room without a mailbox cannot be booked, so it is not listed
  t.false(res.text.includes('Sala sin buzón'));

  // Only the free room can be booked, at the time asked for
  t.is(res.text.split('Reservar en Outlook').length - 1, 1);
  const link = res.text.match(/href="(https:\/\/outlook\.office\.com\/calendar\/deeplink\/compose\?[^"]+)"/)[1].replace(/&amp;/g, '&');
  const query = new URL(link).searchParams;
  t.is(query.get('to'), 'plenos@arandadeduero.es');
  t.is(query.get('location'), 'Salón de Plenos');
  t.is(query.get('startdt'), '2026-10-14T10:00:00');
  t.is(query.get('enddt'), '2026-10-14T11:00:00');

  // Asked in Madrid time, with the user's token
  const [call] = http.callsTo('post', SCHEDULE);
  t.deepEqual(call.data.schedules, ['Sala.B@arandadeduero.es', 'plenos@arandadeduero.es']);
  t.deepEqual(call.data.startTime, { dateTime: '2026-10-14T10:00:00', timeZone: 'Romance Standard Time' });
  t.deepEqual(call.data.endTime, { dateTime: '2026-10-14T11:00:00', timeZone: 'Romance Standard Time' });
  t.is(call.config.headers.Authorization, 'Bearer user-token');
});

test.serial('a room whose calendar could not be read is not shown as free or busy', async t => {
  http.on('post', SCHEDULE, {
    value: [
      { scheduleId: 'sala.b@arandadeduero.es', error: { message: 'Mailbox not found' } },
      { scheduleId: 'plenos@arandadeduero.es', availabilityView: '0000' },
    ],
  });
  const user = await signIn(t);

  const res = await user.get(SEARCH).expect(200);

  t.is(res.text.split('>Sin comprobar</span>').length - 1, 1);
  t.is(res.text.split('>Libre</span>').length - 1, 1);
  t.false(res.text.includes('>Ocupada</span>'));
});

test.serial('rooms are still listed when nobody\'s availability can be read', async t => {
  http.fail('post', SCHEDULE, 403);
  const user = await signIn(t);

  const res = await user.get(SEARCH).expect(200);

  t.true(res.text.includes('No se ha podido comprobar qué salas están libres'));
  t.is(res.text.split('>Sin comprobar</span>').length - 1, 2);
  t.false(res.text.includes('>Libre</span>'));
});

test.serial('"cannot read the rooms" is told apart from "there are no rooms"', async t => {
  const user = await signIn(t);

  http.fail('get', ROOMS, 403);
  const unreadable = await user.get(SEARCH).expect(200);
  t.true(unreadable.text.includes('no se puede consultar la lista de salas'));
  t.false(unreadable.text.includes('no tiene salas dadas de alta'));

  http.on('get', ROOMS, { value: [] });
  const none = await user.get(SEARCH).expect(200);
  t.true(none.text.includes('no tiene salas dadas de alta'));
});

test.serial('a period that makes no sense says why and asks no calendar', async t => {
  const user = await signIn(t);
  http.calls.length = 0;

  for (const query of ['date=2026-10-14&start=11:00&end=10:00', 'date=14/10/2026&start=10:00&end=11:00', 'date=2026-10-14&start=25:00&end=26:00', 'date=2026-10-14']) {
    const res = await user.get(`/salas?${query}`).expect(200);
    t.true(res.text.includes('Indica un día y una hora de inicio anterior a la de fin'), query);
    // The list is still there to look at
    t.true(res.text.includes('Casa Consistorial · Planta 1'), query);
  }

  t.is(http.callsTo('post', SCHEDULE).length, 0);
});

test.serial('more rooms than one request takes are asked for in several', async t => {
  const many = Array.from({ length: 45 }, (_, index) => ({ displayName: `Sala ${index}`, emailAddress: `sala${index}@arandadeduero.es` }));
  http.on('get', ROOMS, { value: many });
  http.on('post', SCHEDULE, (call) => ({ value: call.data.schedules.map(scheduleId => ({ scheduleId, availabilityView: '0000' })) }));
  const user = await signIn(t);

  const res = await user.get(SEARCH).expect(200);

  t.deepEqual(http.callsTo('post', SCHEDULE).map(call => call.data.schedules.length), [20, 20, 5]);
  t.is(res.text.split('>Libre</span>').length - 1, 45);
});

test.serial('the page needs a signed-in user', async t => {
  const res = await request(app).get('/salas').expect(302);

  t.is(res.header.location, '/login');
  t.truthy(appConfig.REGION && auditEvents && httpError);
});
