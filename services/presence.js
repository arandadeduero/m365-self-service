/**
 * What a Teams presence means, in words. Pure functions.
 */

const AVAILABILITY = {
  Available: ['Disponible', 'available'],
  AvailableIdle: ['Disponible', 'available'],
  Busy: ['Ocupado', 'busy'],
  BusyIdle: ['Ocupado', 'busy'],
  DoNotDisturb: ['No molestar', 'busy'],
  Away: ['Ausente', 'away'],
  BeRightBack: ['Vuelve enseguida', 'away'],
  Offline: ['Desconectado', 'offline'],
};

const ACTIVITY = {
  InACall: 'En una llamada',
  InAConferenceCall: 'En una llamada',
  InAMeeting: 'En una reunión',
  Presenting: 'Presentando',
  UrgentInterruptionsOnly: 'Solo urgencias',
  OutOfOffice: 'Fuera de la oficina',
};

/**
 * @param {Object|undefined} presence - Graph presence: availability, activity
 * @returns {{ label: string, tone: string }} Words for the person, and a tone for the colour
 */
function describePresence(presence) {
  if (!presence) {
    return { label: 'Sin información', tone: 'offline' };
  }
  const [label, tone] = AVAILABILITY[presence.availability] || ['Sin información', 'offline'];
  const detail = ACTIVITY[presence.activity];
  return { label: detail ? `${label} · ${detail}` : label, tone };
}

module.exports = { describePresence };
