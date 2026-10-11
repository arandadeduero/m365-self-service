/**
 * Contact cards: a vCard (what phones and Outlook import) for a person of
 * the directory. Pure functions.
 */

// Commas, semicolons, backslashes and line breaks have a meaning in vCard
const escapeValue = (text) => String(text == null ? '' : text).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (char) => `\\${char}`);

/**
 * @param {Object} user - Graph user: displayName, givenName, surname, jobTitle, department, officeLocation, businessPhones, mobilePhone, mail
 * @param {string} orgName
 * @returns {string} vCard 3.0 text
 */
function buildVCard(user, orgName) {
  const name = user.displayName || user.mail || '';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeValue(user.surname || '')};${escapeValue(user.givenName || (user.surname ? '' : name))};;;`,
    `FN:${escapeValue(name)}`,
    `ORG:${escapeValue(orgName)}${user.department ? `;${escapeValue(user.department)}` : ''}`,
    user.jobTitle ? `TITLE:${escapeValue(user.jobTitle)}` : null,
    ...(user.businessPhones || []).map(phone => `TEL;TYPE=WORK,VOICE:${escapeValue(phone)}`),
    user.mobilePhone ? `TEL;TYPE=CELL:${escapeValue(user.mobilePhone)}` : null,
    user.mail ? `EMAIL;TYPE=INTERNET,WORK:${escapeValue(user.mail)}` : null,
    user.officeLocation ? `ADR;TYPE=WORK:;;${escapeValue(user.officeLocation)};;;;` : null,
    'END:VCARD',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}

/**
 * A safe file name for the card
 */
function vcardFileName(user) {
  const base = (user.displayName || 'contacto').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${base || 'contacto'}.vcf`;
}

/**
 * The directory as CSV for Excel: a byte order mark so accents survive, and
 * semicolons, which Spanish Excel expects
 */
function directoryCsv(users) {
  const cell = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
  const header = ['Nombre', 'Puesto', 'Departamento', 'Oficina', 'Teléfono', 'Móvil', 'Correo'];
  const rows = users.map(user => [
    user.displayName, user.jobTitle, user.department, user.officeLocation,
    (user.businessPhones || []).join(' / '), user.mobilePhone, user.mail,
  ].map(cell).join(';'));
  return '\uFEFF' + [header.map(cell).join(';'), ...rows].join('\r\n') + '\r\n';
}

module.exports = { buildVCard, vcardFileName, directoryCsv };
