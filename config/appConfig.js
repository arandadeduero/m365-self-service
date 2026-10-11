/**
 * Application Settings
 *
 * Values shared by several routes that are not specific to MSAL, Graph or
 * WordPress.
 */

const { redirectUri } = require('./authConfig');

// Optional settings of this installation, in the git-ignored config/local.js
let local = {};
try {
  local = require('./local');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    console.error('Error loading config/local.js:', error);
  }
}

const PROFILE_FIELDS = ['jobTitle', 'mobilePhone', 'businessPhones', 'officeLocation'];

module.exports = {
  // What the portal and the organization are called on every page
  APP_NAME: 'Mi Microsoft 365',
  ORG_NAME: 'Ayuntamiento de Aranda de Duero',

  // The organization's intranet, linked from the home page and the help page
  INTRANET_URL: process.env.INTRANET_URL || 'https://aytoarandaduero.sharepoint.com',

  // Recipient of the requests that have nobody else to go to
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'glopez@arandadeduero.es',

  // Public address of the app. Links sent by email are built from
  // configuration and not from the request's Host header, which whoever
  // sends the request controls.
  APP_ORIGIN: new URL(redirectUri).origin,

  // Profile fields users may change themselves. Tenants differ in what they
  // let a user edit; the rest are shown read-only.
  PROFILE_FIELDS,
  PROFILE_EDITABLE_FIELDS: process.env.PROFILE_EDITABLE_FIELDS
    ? process.env.PROFILE_EDITABLE_FIELDS.split(',').map(field => field.trim()).filter(field => PROFILE_FIELDS.includes(field))
    : [...PROFILE_FIELDS],

  // Addresses of the shared mailboxes of the organization. Graph cannot list
  // them, so the app checks these one by one for each user.
  SHARED_MAILBOXES: Array.isArray(local.sharedMailboxes) ? [...local.sharedMailboxes] : [],

  // Time zone (as Exchange names it) and language every account is kept on
  REGION: {
    timeZone: 'Romance Standard Time', // Madrid
    locale: 'es-ES',
  },
};
