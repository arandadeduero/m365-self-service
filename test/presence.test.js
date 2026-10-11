/**
 * Presence Tests
 * Words for what Teams says about a person
 */

require('./helpers/env');

const test = require('ava').default;
const { describePresence } = require('../services/presence');

test('each availability has its words and colour, and the activity adds detail', t => {
  t.deepEqual(describePresence({ availability: 'Available', activity: 'Available' }), { label: 'Disponible', tone: 'available' });
  t.deepEqual(describePresence({ availability: 'Busy', activity: 'InACall' }), { label: 'Ocupado · En una llamada', tone: 'busy' });
  t.deepEqual(describePresence({ availability: 'DoNotDisturb', activity: 'Presenting' }), { label: 'No molestar · Presentando', tone: 'busy' });
  t.deepEqual(describePresence({ availability: 'Away', activity: 'Away' }), { label: 'Ausente', tone: 'away' });
  t.deepEqual(describePresence({ availability: 'Offline', activity: 'OutOfOffice' }), { label: 'Desconectado · Fuera de la oficina', tone: 'offline' });
});

test('no answer, or one this version does not know, is "no information"', t => {
  t.deepEqual(describePresence(undefined), { label: 'Sin información', tone: 'offline' });
  t.deepEqual(describePresence({ availability: 'SomethingNew' }), { label: 'Sin información', tone: 'offline' });
});
