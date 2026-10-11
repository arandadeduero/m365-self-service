/**
 * What the sharing of a OneDrive item means: who can reach it, and whether
 * that is somebody outside the organization. Pure functions.
 */

const ROLES = { read: 'puede ver', write: 'puede editar', owner: 'propietario' };

const emailsOf = (permission) => {
  const identities = [
    permission.grantedToV2?.user, permission.grantedToV2?.siteUser,
    ...(permission.grantedToIdentitiesV2 || []).flatMap(identity => [identity.user, identity.siteUser]),
  ].filter(Boolean);
  const emails = identities.map(identity => (identity.email || identity.loginName || '').toLowerCase()).filter(Boolean);
  return [...new Set(emails)];
};

const isOutside = (email, domain) => {
  const address = email.includes('#ext#') ? email.split('#ext#')[0].replace(/_([^_]+)$/, '@$1') : email;
  const at = address.lastIndexOf('@');
  return at === -1 ? false : address.slice(at + 1) !== domain;
};

/**
 * @param {Object} permission - A driveItem permission from Graph
 * @param {string} domain - The organization's email domain
 * @returns {Object|null} How the item is reachable through this permission; null for the owner's own
 */
function describePermission(permission, domain) {
  const roles = (permission.roles || []).map(role => ROLES[role] || role);
  if ((permission.roles || []).includes('owner')) return null;

  const scope = permission.link?.scope;
  if (scope === 'anonymous') {
    return { id: permission.id, kind: 'anyone', who: 'Cualquiera que tenga el enlace', emails: [], outside: true, roles, link: true, expires: permission.expirationDateTime || null };
  }
  if (scope === 'organization') {
    return { id: permission.id, kind: 'organization', who: 'Todo el Ayuntamiento, con el enlace', emails: [], outside: false, roles, link: true, expires: permission.expirationDateTime || null };
  }
  const emails = emailsOf(permission);
  const outsiders = emails.filter(email => isOutside(email, domain));
  return {
    id: permission.id,
    kind: 'people',
    who: emails.join(', ') || 'Personas concretas',
    emails,
    // Somebody with no address is not called an outsider: a false alarm teaches people to ignore the page
    outside: outsiders.length > 0,
    outsiders,
    roles,
    link: Boolean(permission.link),
    expires: permission.expirationDateTime || null,
  };
}

/**
 * The items of a drive with what reaches outside the organization
 * @param {Array<{item: Object, permissions: Array|null}>} entries - Shared items with their permissions
 * @param {string} domain
 * @returns {{outside: Array, insideCount: number, uncheckedCount: number}}
 */
function describeSharing(entries, domain) {
  const outside = [];
  let insideCount = 0;
  let uncheckedCount = 0;
  entries.forEach(({ item, permissions }) => {
    if (!permissions) {
      uncheckedCount += 1;
      return;
    }
    const shares = permissions.map(permission => describePermission(permission, domain)).filter(Boolean);
    const outsideShares = shares.filter(share => share.outside);
    if (outsideShares.length > 0) {
      outside.push({
        id: item.id,
        name: item.name,
        url: item.webUrl || null,
        folder: Boolean(item.folder),
        path: (item.parentReference?.path || '').replace(/^\/drive\/root:/, '') || '/',
        shares: outsideShares,
      });
    } else if (shares.length > 0) {
      insideCount += 1;
    }
  });
  outside.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { outside, insideCount, uncheckedCount };
}

module.exports = { describePermission, describeSharing };
