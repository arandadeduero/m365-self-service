/**
 * What the permissions an app holds on a person's account mean. Pure functions.
 */

const SCOPES = {
  openid: 'Iniciar sesión con tu cuenta',
  profile: 'Ver tu nombre y tu foto',
  email: 'Ver tu dirección de correo',
  offline_access: 'Seguir teniendo acceso sin volver a preguntarte',
  'User.Read': 'Ver tu perfil',
  'User.ReadWrite': 'Ver y cambiar tu perfil',
  'User.ReadBasic.All': 'Ver el perfil básico de todas las personas',
  'User.Read.All': 'Ver el perfil completo de todas las personas',
  'Mail.Read': 'Leer tu correo',
  'Mail.ReadWrite': 'Leer, cambiar y borrar tu correo',
  'Mail.Send': 'Enviar correo en tu nombre',
  'Mail.Read.Shared': 'Leer el correo de los buzones a los que tienes acceso',
  'MailboxSettings.Read': 'Ver la configuración de tu buzón',
  'MailboxSettings.ReadWrite': 'Cambiar la configuración de tu buzón',
  'Calendars.Read': 'Ver tu calendario',
  'Calendars.ReadWrite': 'Ver y cambiar tu calendario',
  'Contacts.Read': 'Ver tus contactos',
  'Contacts.ReadWrite': 'Ver y cambiar tus contactos',
  'Files.Read': 'Leer tus archivos',
  'Files.Read.All': 'Leer todos los archivos a los que tienes acceso',
  'Files.ReadWrite': 'Leer y cambiar tus archivos',
  'Files.ReadWrite.All': 'Leer y cambiar todos los archivos a los que tienes acceso',
  'Sites.Read.All': 'Leer los sitios de SharePoint a los que tienes acceso',
  'Sites.ReadWrite.All': 'Leer y cambiar los sitios de SharePoint a los que tienes acceso',
  'Chat.Read': 'Leer tus chats de Teams',
  'Chat.ReadWrite': 'Leer y escribir en tus chats de Teams',
  'ChannelMessage.Read.All': 'Leer los mensajes de los canales de tus equipos',
  'Team.ReadBasic.All': 'Ver tus equipos de Teams',
  'Group.Read.All': 'Ver todos los grupos',
  'GroupMember.Read.All': 'Ver los miembros de los grupos',
  'Directory.Read.All': 'Leer el directorio de la organización',
  'Presence.Read.All': 'Ver si la gente está disponible en Teams',
  'Place.Read.All': 'Ver las salas de reuniones',
  'Notes.Read': 'Leer tus blocs de OneNote',
  'Tasks.ReadWrite': 'Ver y cambiar tus tareas',
};

// Permissions that reach the person's own content, which deserve a second look
const REACHES_CONTENT = /^(Mail|Files|Sites|Contacts|Chat|ChannelMessage|Notes)\./;

/**
 * Put the apps a person's grants point at in order, with their permissions in words
 * @param {Array} grants - oauth2PermissionGrants of the person
 * @param {Map<string,Object>} principals - Service principal by its id (clientId of the grant)
 * @param {string} ownAppId - This portal's application (client) id, to mark it
 * @returns {Array} One entry per app
 */
function describeAppGrants(grants, principals, ownAppId) {
  const byApp = new Map();
  grants.forEach((grant) => {
    const app = byApp.get(grant.clientId) || {
      id: grant.clientId,
      forEveryone: false,
      forMe: false,
      scopes: new Set(),
    };
    if (grant.consentType === 'AllPrincipals') app.forEveryone = true;
    else app.forMe = true;
    String(grant.scope || '').split(/\s+/).filter(Boolean).forEach(scope => app.scopes.add(scope));
    byApp.set(grant.clientId, app);
  });

  return [...byApp.values()]
    .map((app) => {
      const principal = principals.get(app.id) || {};
      const scopes = [...app.scopes].sort();
      return {
        id: app.id,
        name: principal.displayName || 'Aplicación sin nombre',
        publisher: principal.verifiedPublisher?.displayName || principal.publisherName || null,
        verified: Boolean(principal.verifiedPublisher?.displayName),
        homepage: principal.homepage || null,
        isThisPortal: Boolean(ownAppId) && principal.appId === ownAppId,
        forEveryone: app.forEveryone,
        forMe: app.forMe,
        permissions: scopes.map(scope => ({ scope, text: SCOPES[scope] || scope, reachesContent: REACHES_CONTENT.test(scope) })),
        reachesContent: scopes.some(scope => REACHES_CONTENT.test(scope)),
      };
    })
    .sort((a, b) => Number(b.reachesContent) - Number(a.reachesContent) || a.name.localeCompare(b.name, 'es'));
}

module.exports = { describeAppGrants };
