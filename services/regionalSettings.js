/**
 * Regional Settings
 *
 * Everybody works in the same place, so every account uses the same time
 * zone and language. This puts them back whenever they differ: the time zone
 * and language of the mailbox (Outlook, and the calendar Teams shows), the
 * time zone of the working hours, and the preferred language of the account
 * (what Microsoft 365 web apps, Teams included, are displayed in).
 *
 * Nothing here can stop a user from changing a setting in Outlook; it is
 * corrected the next time they sign in to this app.
 */

const { REGION } = require('../config/appConfig');
const {
  getMailboxSettings,
  updateMailboxSettings,
  getPreferredLanguage,
  updateUserProfile
} = require('./graphService');

/**
 * Correct the mailbox settings that differ
 * @returns {Promise<Array<string>>} Names of the settings that were changed
 */
async function enforceMailboxSettings(accessToken) {
  const settings = await getMailboxSettings(accessToken);
  const update = {};

  if (settings.timeZone !== REGION.timeZone) {
    update.timeZone = REGION.timeZone;
  }

  if (settings.language?.locale !== REGION.locale) {
    update.language = { locale: REGION.locale };
  }

  // Only the zone of the working hours is fixed; the days and times are the user's
  const hours = settings.workingHours;
  if (hours && hours.timeZone?.name !== REGION.timeZone) {
    update.workingHours = {
      daysOfWeek: hours.daysOfWeek,
      startTime: hours.startTime,
      endTime: hours.endTime,
      timeZone: { name: REGION.timeZone },
    };
  }

  if (Object.keys(update).length === 0) {
    return [];
  }

  await updateMailboxSettings(accessToken, update);
  return Object.keys(update);
}

/**
 * Correct the preferred language of the account if it differs
 * @returns {Promise<Array<string>>} ['preferredLanguage'] if it was changed
 */
async function enforcePreferredLanguage(accessToken) {
  if (await getPreferredLanguage(accessToken) === REGION.locale) {
    return [];
  }

  await updateUserProfile(accessToken, { preferredLanguage: REGION.locale });
  return ['preferredLanguage'];
}

/**
 * Put the regional settings of the signed-in user back to the organization's
 * @param {string} accessToken - Valid access token of the user
 * @returns {Promise<Array<string>>} Names of the settings that were changed.
 *   Never rejects: what cannot be read or changed is logged and skipped, so
 *   it cannot keep anybody from signing in.
 */
async function enforceRegionalSettings(accessToken) {
  const attempts = await Promise.allSettled([
    enforceMailboxSettings(accessToken),
    enforcePreferredLanguage(accessToken),
  ]);

  return attempts.flatMap((attempt) => {
    if (attempt.status === 'rejected') {
      console.error('Could not enforce regional settings:', attempt.reason.message);
      return [];
    }
    return attempt.value;
  });
}

module.exports = { enforceRegionalSettings };
