/**
 * What administrators should look at among the accounts. Pure functions.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const IDLE_DAYS = 90;

// The last successful one when Graph gives it (since December 2023); the last
// attempt, interactive or not, otherwise
const lastSignIn = (user) => {
  const activity = user.signInActivity || {};
  const dates = [activity.lastSuccessfulSignInDateTime, activity.lastSignInDateTime, activity.lastNonInteractiveSignInDateTime].filter(Boolean).map(date => new Date(date).getTime());
  return dates.length ? new Date(Math.max(...dates)) : null;
};

const daysSince = (date, now) => Math.floor((now - new Date(date).getTime()) / DAY_MS);

/**
 * @param {Array} users - Users from Graph (see REVIEW_FIELDS)
 * @param {Object} options - signInsKnown, mfa (userRegistrationDetails or null), passwordMaxAgeDays, now
 * @returns {Object} Lists of accounts, each with why it is there
 */
function reviewAccounts(users, { signInsKnown = false, mfa = null, passwordMaxAgeDays = null, now = Date.now() } = {}) {
  const members = users.filter(user => user.userType !== 'Guest');
  const licensed = (user) => (user.assignedLicenses || []).length > 0;
  const mfaById = new Map((mfa || []).map(entry => [entry.id, entry]));
  const person = (user, note) => ({ id: user.id, name: user.displayName || user.userPrincipalName, username: user.userPrincipalName, note });

  const idle = signInsKnown
    ? members.filter(user => user.accountEnabled && licensed(user)).map((user) => {
      const last = lastSignIn(user);
      if (!last) return daysSince(user.createdDateTime || now, now) > IDLE_DAYS ? person(user, 'Nunca ha iniciado sesión') : null;
      const days = daysSince(last, now);
      return days > IDLE_DAYS ? person(user, `Último inicio de sesión hace ${days} días`) : null;
    }).filter(Boolean)
    : null;

  const expiredPassword = passwordMaxAgeDays
    ? members.filter(user => user.accountEnabled && licensed(user) && user.lastPasswordChangeDateTime && daysSince(user.lastPasswordChangeDateTime, now) > passwordMaxAgeDays)
      .map(user => person(user, `Contraseña de hace ${daysSince(user.lastPasswordChangeDateTime, now)} días`))
    : null;

  const disabledWithLicense = members.filter(user => !user.accountEnabled && licensed(user)).map(user => person(user, 'Cuenta deshabilitada con licencia asignada'));
  const enabledWithoutLicense = members.filter(user => user.accountEnabled && !licensed(user)).map(user => person(user, 'Sin licencia'));

  const withoutMfa = mfa
    ? members.filter(user => user.accountEnabled && licensed(user) && mfaById.has(user.id) && mfaById.get(user.id).isMfaRegistered === false)
      .map(user => person(user, 'Sin segundo factor registrado'))
    : null;

  const sortByName = (list) => list && list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return {
    total: members.length,
    guests: users.length - members.length,
    idle: sortByName(idle),
    expiredPassword: sortByName(expiredPassword),
    disabledWithLicense: sortByName(disabledWithLicense),
    enabledWithoutLicense: sortByName(enabledWithoutLicense),
    withoutMfa: sortByName(withoutMfa),
  };
}

/**
 * The licenses bought, with how many are left
 * @param {Array} skus - subscribedSkus from Graph
 * @param {Object} skuNames - code → name
 */
function describeLicenseStock(skus, skuNames) {
  return skus
    .filter(sku => (sku.prepaidUnits?.enabled || 0) > 0)
    .map((sku) => {
      const total = sku.prepaidUnits.enabled;
      const used = sku.consumedUnits || 0;
      const left = total - used;
      return {
        code: sku.skuPartNumber,
        name: skuNames[sku.skuPartNumber] || sku.skuPartNumber,
        total,
        used,
        left,
        // Running out: none left, or under a tenth
        low: left <= 0 || left < Math.max(2, Math.ceil(total / 10)),
      };
    })
    // Running out first, the fewest left before the rest
    .sort((a, b) => Number(b.low) - Number(a.low) || a.left - b.left || b.total - a.total);
}

module.exports = { reviewAccounts, describeLicenseStock };
