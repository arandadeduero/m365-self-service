/**
 * Account Insights
 *
 * Turns what Microsoft Graph returns about an account into what the pages
 * tell its owner: what a license lets them use, what a group gives them,
 * what a mail rule does, how complete the account is. Pure functions, no
 * requests.
 */

const { SKU_NAMES, APPS } = require('../config/licenseCatalog');

const GIGABYTE = 1024 ** 3;

/**
 * Describe the licenses of a user as the apps they can use
 * @param {Array} licenses - licenseDetails from Graph
 * @returns {Object} The licenses by name, and the apps they include
 */
function describeLicenses(licenses) {
  const enabledPlans = licenses.flatMap(license =>
    (license.servicePlans || [])
      .filter(plan => plan.provisioningStatus === 'Success')
      .map(plan => plan.servicePlanName)
  );

  const apps = [];
  for (const app of APPS) {
    const plan = app.plans.find(candidate => enabledPlans.some(name => name.startsWith(candidate.name)));
    if (plan) {
      apps.push({ name: app.name, description: plan.detail || app.description, url: app.url });
    }
  }

  return {
    licenses: licenses.map(license => ({
      code: license.skuPartNumber || license.skuId,
      name: SKU_NAMES[license.skuPartNumber] || license.skuPartNumber || license.skuId,
    })),
    apps,
  };
}

/**
 * Describe the OneDrive space of a user
 * @param {Object|null} quota - drive.quota from Graph
 * @returns {Object|null} Used and total space as text and a percentage, or null if unknown
 */
function describeStorage(quota) {
  if (!quota || !quota.total) {
    return null;
  }

  const gigabytes = (bytes) => `${(bytes / GIGABYTE).toLocaleString('es-ES', { maximumFractionDigits: 1 })} GB`;
  return {
    used: gigabytes(quota.used || 0),
    total: gigabytes(quota.total),
    percent: Math.min(100, Math.round(((quota.used || 0) / quota.total) * 100)),
  };
}

/**
 * Say what kind of group this is and what belonging to it means
 * @param {Object} group - Group from Graph, with groupTypes, mailEnabled,
 *   securityEnabled, mail and resourceProvisioningOptions
 * @returns {Object} kind, label, what it gives, and links to use it
 */
function describeGroup(group) {
  const isMicrosoft365Group = (group.groupTypes || []).includes('Unified');
  const isTeam = (group.resourceProvisioningOptions || []).includes('Team');
  const receivesMail = group.mail ? `Recibes los mensajes enviados a ${group.mail}` : 'Recibes los mensajes enviados al grupo';

  if (isMicrosoft365Group && isTeam) {
    return {
      kind: 'team',
      label: 'Equipo de Teams',
      gives: ['Conversaciones y reuniones del equipo en Teams', 'Archivos compartidos del equipo', receivesMail],
      links: [{ label: 'Abrir Teams', url: 'https://teams.microsoft.com' }],
    };
  }

  if (isMicrosoft365Group) {
    const links = [];
    if (group.mail) {
      const [alias, domain] = group.mail.split('@');
      links.push({ label: 'Abrir en Outlook', url: `https://outlook.office.com/mail/group/${domain}/${alias}/email` });
    }
    return {
      kind: 'microsoft365',
      label: 'Grupo de Microsoft 365',
      gives: ['Buzón y calendario compartidos del grupo', 'Archivos compartidos del grupo', receivesMail],
      links,
    };
  }

  if (group.mailEnabled && group.securityEnabled) {
    return {
      kind: 'mailSecurity',
      label: 'Grupo de seguridad con correo',
      gives: [receivesMail, 'Da acceso a recursos como carpetas, aplicaciones o impresoras'],
      links: [],
    };
  }

  if (group.mailEnabled) {
    return {
      kind: 'distribution',
      label: 'Lista de distribución',
      gives: [receivesMail],
      links: [],
    };
  }

  return {
    kind: 'security',
    label: 'Grupo de seguridad',
    gives: ['Da acceso a recursos como carpetas, aplicaciones o impresoras. No tiene correo'],
    links: [],
  };
}

/**
 * Say what an inbox rule does
 * @param {Object} rule - messageRule from Graph
 * @param {string} domain - Domain of the organization
 * @returns {Object} name, whether it is on, its effects, and the outside addresses it sends mail to
 */
function describeRule(rule, domain) {
  const actions = rule.actions || {};
  const forwardedTo = [
    ...(actions.forwardTo || []),
    ...(actions.redirectTo || []),
    ...(actions.forwardAsAttachmentTo || []),
  ].map(recipient => recipient.emailAddress?.address).filter(Boolean);

  const effects = [];
  if (forwardedTo.length > 0) {
    effects.push(`Reenvía los mensajes a ${forwardedTo.join(', ')}`);
  }
  if (actions.delete || actions.permanentDelete) {
    effects.push('Elimina los mensajes');
  }
  if (actions.moveToFolder) {
    effects.push('Mueve los mensajes a otra carpeta');
  }
  if (actions.markAsRead) {
    effects.push('Marca los mensajes como leídos');
  }
  if (effects.length === 0) {
    effects.push('Otras acciones');
  }

  return {
    name: rule.displayName || 'Regla sin nombre',
    enabled: rule.isEnabled !== false,
    effects,
    external: forwardedTo.filter(address => !address.toLowerCase().endsWith(`@${domain.toLowerCase()}`)),
  };
}

/**
 * Describe the inbox rules of a mailbox
 * @param {Array|null} rules - messageRules from Graph, or null when they could not be read
 * @param {string} domain - Domain of the organization
 * @returns {Object|null} The rules, and the outside addresses that active rules send mail to
 */
function summarizeRules(rules, domain) {
  if (!rules) {
    return null;
  }

  const list = rules.map(rule => describeRule(rule, domain));
  const externalForwarding = [...new Set(list.filter(rule => rule.enabled).flatMap(rule => rule.external))];
  return { list, externalForwarding };
}

/**
 * Build the list of things a well set up account has
 * @param {Object} account
 * @param {Object|null} account.security - From describeSignInMethods, or null if unknown
 * @param {Object} account.status - otherMails, mobilePhone and businessPhones of the user
 * @param {boolean} account.hasPhoto
 * @param {Object|null} account.manager
 * @param {string} account.securityInfoUrl - Where sign-in methods are managed
 * @returns {Object} The items, and the percentage that is done
 */
function buildChecklist({ security, status, hasPhoto, manager, securityInfoUrl }) {
  const items = [];

  // Left out when it could not be checked, rather than shown as missing
  if (security) {
    items.push({
      label: 'Segundo método de inicio de sesión',
      done: security.hasSecondFactor,
      fix: { label: 'Añadir uno', url: securityInfoUrl, external: true },
    });
  }

  items.push(
    {
      label: 'Correo personal para recuperar la contraseña',
      done: (status.otherMails || []).length > 0,
      fix: { label: 'Pídelo a Informática' },
    },
    {
      label: 'Foto de perfil',
      done: hasPhoto,
      fix: { label: 'Subir una foto', url: '/profile/me/edit' },
    },
    {
      label: 'Teléfono de contacto',
      done: Boolean(status.mobilePhone) || (status.businessPhones || []).length > 0,
      fix: { label: 'Añadirlo', url: '/profile/me/edit' },
    },
    {
      label: 'Responsable asignado',
      done: Boolean(manager),
      fix: { label: 'Indicarlo en tu perfil', url: '/' },
    }
  );

  const done = items.filter(item => item.done).length;
  return { items, percent: Math.round((done / items.length) * 100) };
}

/**
 * Describe an entry of the sign-in log
 * @param {Object} entry - signIn from Graph
 * @returns {Object} When, with which app, from where, on what device, and whether it worked
 */
function describeSignIn(entry) {
  const location = entry.location || {};
  const device = entry.deviceDetail || {};

  return {
    id: entry.id || '',
    when: entry.createdDateTime,
    app: entry.appDisplayName || '',
    place: [location.city, location.countryOrRegion].filter(Boolean).join(', '),
    device: [device.operatingSystem, device.browser].filter(Boolean).join(' · '),
    ip: entry.ipAddress || '',
    succeeded: entry.status?.errorCode === 0,
    failureReason: entry.status?.failureReason || '',
  };
}

/**
 * Whether members can be added and removed through Microsoft Graph.
 * Distribution lists and mail-enabled security groups are managed in
 * Exchange and cannot.
 */
function isManageable(group) {
  const isMicrosoft365Group = (group.groupTypes || []).includes('Unified');
  const isPlainSecurityGroup = Boolean(group.securityEnabled) && !group.mailEnabled;
  return isMicrosoft365Group || isPlainSecurityGroup;
}

// What each level of calendar access lets the other person do
const CALENDAR_ROLES = {
  freeBusyRead: 'Ve si estás libre u ocupado, sin más detalle',
  limitedRead: 'Ve el título y el lugar de tus citas',
  read: 'Ve todos los detalles de tus citas',
  write: 'Puede crear, cambiar y borrar citas en tu calendario',
  delegateWithoutPrivateEventAccess: 'Es tu delegado: gestiona tu calendario y responde a las convocatorias por ti',
  delegateWithPrivateEventAccess: 'Es tu delegado: gestiona tu calendario por ti, incluidas tus citas privadas',
  custom: 'Tiene un acceso personalizado',
};
const CALENDAR_ROLES_THAT_CHANGE = new Set(['write', 'delegateWithoutPrivateEventAccess', 'delegateWithPrivateEventAccess']);

/**
 * Describe who can see the user's calendar
 * @param {Array|null} permissions - calendarPermissions from Graph, or null when unreadable
 * @returns {Array|null} One entry per person (or the whole organization) with access
 */
function describeCalendarSharing(permissions) {
  if (!permissions) {
    return null;
  }

  return permissions
    .filter(permission => permission.role && permission.role !== 'none')
    .map((permission) => {
      const address = permission.emailAddress?.address || '';
      // The entry for "everybody in the organization" has a name but no address
      const everyone = !address;
      return {
        id: permission.id || null,
        // The default entries (the organization's own) cannot be taken back here
        removable: Boolean(permission.id) && permission.isRemovable !== false && !everyone,
        who: everyone ? 'Todas las personas del Ayuntamiento' : (permission.emailAddress.name || address),
        email: address,
        access: CALENDAR_ROLES[permission.role] || permission.role,
        everyone,
        external: !everyone && permission.isInsideOrganization === false,
        canChange: CALENDAR_ROLES_THAT_CHANGE.has(permission.role),
      };
    });
}

module.exports = {
  isManageable,
  describeCalendarSharing,
  describeLicenses,
  describeStorage,
  describeGroup,
  describeRule,
  summarizeRules,
  buildChecklist,
  describeSignIn,
};
