/**
 * Account Routes
 *
 * Self-service pages for the signed-in user:
 * - /directorio - Staff directory
 * - /account - What the user has, and how their account is set up and protected
 * - /account/groups - The user's groups and what each one gives them
 * - /account/sign-ins - Where and when the account was used
 * - /account/sign-ins/report - "It was not me": tell IT and close every session
 * - /account/mailboxes - The shared mailboxes the user can open
 * - /profile/me/auto-reply - Automatic replies (out of office)
 * - /profile/me/photo - Profile photo upload
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { isAuthenticated } = require('../middleware/auth');
const { userError } = require('../middleware/errorHandler');
const { verifyCsrfToken } = require('../middleware/csrf');
const { auditRequest } = require('../services/auditService');
const { getAppToken } = require('../services/tokenService');
const permissions = require('../config/permissions');
const appConfig = require('../config/appConfig');
const {
  describeLicenses,
  describeStorage,
  describeGroup,
  summarizeRules,
  buildChecklist,
  describeSignIn,
  describeCalendarSharing
} = require('../services/accountInsights');
const {
  getAllUsers,
  getAccountStatus,
  getUserLicenses,
  getAuthenticationMethods,
  getUserDevices,
  getUserPhoto,
  getUserManager,
  getInboxRules,
  getDriveQuota,
  getMyGroups,
  getRecentSignIns,
  getCalendarPermissions,
  canOpenMailbox,
  revokeSignInSessions,
  sendEmail,
  getMailboxTimeZone,
  getAutomaticReplies,
  updateAutomaticReplies,
  updateUserPhoto
} = require('../services/graphService');

// Microsoft's own pages for what this app deliberately does not handle itself
const CHANGE_PASSWORD_URL = 'https://mysignins.microsoft.com/security-info/password/change';
const SECURITY_INFO_URL = 'https://mysignins.microsoft.com/security-info';

const DAY_MS = 24 * 60 * 60 * 1000;

// Names for the sign-in methods of Entra ID, by the type Graph reports
const SIGN_IN_METHOD_LABELS = {
  password: 'Contraseña',
  email: 'Correo de recuperación',
  phone: 'Teléfono (SMS o llamada)',
  microsoftAuthenticator: 'Aplicación Microsoft Authenticator',
  softwareOath: 'Aplicación de autenticación (código)',
  fido2: 'Llave de seguridad',
  windowsHelloForBusiness: 'Windows Hello',
  temporaryAccessPass: 'Pase de acceso temporal',
};

// Methods that do not count as a second factor. Any other, including types
// Microsoft adds later, does: a wrong "you have no second factor" is worse
// than a missing one.
const NOT_A_SECOND_FACTOR = new Set(['password', 'email', 'temporaryAccessPass']);

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // Largest photo Microsoft Graph accepts
const PHOTO_TYPES = ['image/jpeg', 'image/png'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES } });

const AUTO_REPLY_STATUSES = ['disabled', 'alwaysEnabled', 'scheduled'];
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/; // Value of a datetime-local input

/**
 * Days until the password expires, or null when that is unknown
 * (PASSWORD_MAX_AGE_DAYS is not set, or the password was never changed)
 */
function passwordDaysLeft(lastChange) {
  const maxAgeDays = Number(process.env.PASSWORD_MAX_AGE_DAYS);
  if (!maxAgeDays || !lastChange) {
    return null;
  }
  const expires = new Date(lastChange).getTime() + maxAgeDays * DAY_MS;
  return Math.ceil((expires - Date.now()) / DAY_MS);
}

/**
 * Describe the registered sign-in methods for the account page
 * @param {Array|null} methods - From Graph, or null when they could not be read
 * @returns {Object|null} The methods and whether one of them is a second factor
 */
function describeSignInMethods(methods) {
  if (!methods) {
    return null;
  }

  const list = methods.map((method) => {
    const type = (method['@odata.type'] || '').replace('#microsoft.graph.', '').replace('AuthenticationMethod', '');
    return {
      label: SIGN_IN_METHOD_LABELS[type] || type,
      detail: method.phoneNumber || method.displayName || method.emailAddress || '',
      secondFactor: !NOT_A_SECOND_FACTOR.has(type),
    };
  });

  return { list, hasSecondFactor: list.some(method => method.secondFactor) };
}

/**
 * Turn the text of the form into the HTML that Exchange stores
 */
function textToHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>');
}

/**
 * Turn a stored reply back into text for the form. Replies written in
 * Outlook carry formatting, which is dropped.
 */
function htmlToText(html) {
  // Each strip repeats until nothing changes, so a tag hidden inside another
  // (<st<style>yle>) does not come out whole after one pass
  const stripAll = (text, pattern) => {
    let previous;
    do {
      previous = text;
      text = text.replace(pattern, '');
    } while (text !== previous);
    return text;
  };

  let text = stripAll(html || '', /<(style|head)[\s\S]*?<\/\1>/gi);
  text = text.replace(/<br\s*\/?>|<\/(p|div)>/gi, '\n');
  return stripAll(text, /<[^>]+>/g)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * GET /directorio
 * Staff directory - everybody in the organization with their contact details
 */
router.get('/directorio', isAuthenticated, async (req, res, next) => {
  try {
    const users = await getAllUsers(req.session.accessToken);

    res.render('directory', {
      title: 'Directorio',
      currentPage: 'directory',
      users,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /account
 * Account page - password, sign-in methods, devices, recovery details and licenses
 */
router.get('/account', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const [status, licenses, methods, devices, photo, manager, rules, quota, calendar] = await Promise.all([
      getAccountStatus(accessToken),
      getUserLicenses(accessToken),
      getAuthenticationMethods(accessToken),
      getUserDevices(accessToken),
      getUserPhoto(accessToken),
      getUserManager(accessToken),
      getInboxRules(accessToken),
      getDriveQuota(accessToken),
      getCalendarPermissions(accessToken),
    ]);
    const security = describeSignInMethods(methods);

    res.render('account', {
      title: 'Mi cuenta',
      currentPage: 'account',
      status,
      owned: describeLicenses(licenses),
      storage: describeStorage(quota),
      security,
      devices,
      mailRules: summarizeRules(rules, permissions.DOMAIN),
      calendarSharing: describeCalendarSharing(calendar),
      hasSharedMailboxes: appConfig.SHARED_MAILBOXES.length > 0,
      checklist: buildChecklist({
        security,
        status,
        hasPhoto: Boolean(photo),
        manager,
        securityInfoUrl: SECURITY_INFO_URL,
      }),
      passwordDaysLeft: passwordDaysLeft(status.lastPasswordChangeDateTime),
      changePasswordUrl: CHANGE_PASSWORD_URL,
      securityInfoUrl: SECURITY_INFO_URL,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /account/groups
 * The groups the user belongs to, and what each one gives them
 */
router.get('/account/groups', isAuthenticated, async (req, res, next) => {
  try {
    const groups = await getMyGroups(req.session.accessToken);

    res.render('my-groups', {
      title: 'Mis grupos',
      currentPage: 'account',
      groups: groups
        .map(group => ({ ...group, about: describeGroup(group) }))
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /account/sign-ins
 * Recent sign-ins of the user. The log is read with the app's own token, so
 * the user it is read for always comes from the session, never the request.
 */
router.get('/account/sign-ins', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.session.account?.localAccountId;
    let signIns = null;

    if (userId) {
      try {
        const entries = await getRecentSignIns(await getAppToken(), userId);
        signIns = entries.map(describeSignIn);
      } catch (error) {
        // Missing permission or license: the page says it is unavailable
        console.error('Sign-in log unavailable:', error.message);
      }
    }

    res.render('sign-ins', {
      title: 'Mis inicios de sesión',
      currentPage: 'account',
      signIns,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /account/sign-ins/report
 * "It was not me": tell IT about a sign-in the user does not recognise and
 * close every session of the account, this one included
 */
router.post('/account/sign-ins/report', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const account = req.session.account || {};
    const signInId = String(req.body.signInId || '');

    // What IT is told comes from the log, never from the browser
    let entries;
    try {
      entries = await getRecentSignIns(await getAppToken(), account.localAccountId);
    } catch (error) {
      throw userError(503, 'Ahora mismo no se puede consultar el registro de inicios de sesión. Cambia tu contraseña y avisa a Informática.');
    }
    const entry = entries.find(candidate => candidate.id && candidate.id === signInId);
    if (!entry) {
      throw userError(404, 'Ese inicio de sesión ya no está en el registro');
    }
    const signIn = describeSignIn(entry);

    // The email leaves first: it is sent with the session that is about to end
    let notified = true;
    try {
      await sendEmail(accessToken, {
        to: appConfig.ADMIN_EMAIL,
        subject: `[m365] Inicio de sesión no reconocido: ${account.username}`,
        body: [
          `${account.name || account.username} (${account.username}) indica que NO reconoce este inicio de sesión en su cuenta:`,
          '',
          `Fecha (UTC): ${signIn.when}`,
          `Aplicación: ${signIn.app || '-'}`,
          `Lugar: ${signIn.place || '-'}`,
          `Dirección IP: ${signIn.ip || '-'}`,
          `Dispositivo: ${signIn.device || '-'}`,
          `Resultado: ${signIn.succeeded ? 'correcto' : `fallido (${signIn.failureReason || 'sin motivo'})`}`,
          `Identificador: ${signIn.id}`,
          '',
          'Se han cerrado todas las sesiones de la cuenta desde el portal. Conviene revisar la cuenta y que cambie la contraseña.',
        ].join('\n'),
      });
    } catch (error) {
      console.error('Could not notify about the reported sign-in:', error.message);
      notified = false;
    }

    let revoked = true;
    try {
      await revokeSignInSessions(accessToken);
    } catch (error) {
      revoked = false;
    }

    await auditRequest(req, 'account.sign_in_reported', { signInId, ip: signIn.ip, notified, revoked });

    // Microsoft has closed this session too (or should have): end it here
    req.session.regenerate(() => {
      res.locals.isAdmin = false;
      res.status(notified || revoked ? 200 : 502).render('sign-in-reported', {
        title: 'Inicio de sesión no reconocido',
        currentPage: 'login',
        notified,
        revoked,
        adminEmail: appConfig.ADMIN_EMAIL,
        changePasswordUrl: CHANGE_PASSWORD_URL,
      });
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /account/mailboxes
 * The shared mailboxes the user can open, out of the list IT keeps in
 * config/local.js. Each one is checked with the user's own token.
 */
router.get('/account/mailboxes', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const addresses = appConfig.SHARED_MAILBOXES;
    const answers = await Promise.all(addresses.map(address => canOpenMailbox(accessToken, address)));

    res.render('mailboxes', {
      title: 'Buzones compartidos',
      currentPage: 'account',
      configured: addresses.length > 0,
      mailboxes: addresses.filter((address, index) => answers[index] === true),
      // Not "no access": Graph did not answer for these
      unknown: addresses.filter((address, index) => answers[index] === null),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /profile/me/auto-reply
 * Automatic replies form
 */
router.get('/profile/me/auto-reply', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const timeZone = await getMailboxTimeZone(accessToken);
    const setting = await getAutomaticReplies(accessToken, timeZone);

    res.render('auto-reply', {
      title: 'Respuestas automáticas',
      currentPage: 'account',
      timeZone,
      saved: req.query.saved === '1',
      reply: {
        status: setting.status || 'disabled',
        message: htmlToText(setting.internalReplyMessage),
        external: Boolean(setting.externalAudience) && setting.externalAudience !== 'none',
        start: (setting.scheduledStartDateTime?.dateTime || '').slice(0, 16),
        end: (setting.scheduledEndDateTime?.dateTime || '').slice(0, 16),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /profile/me/auto-reply
 * Save automatic replies
 */
router.post('/profile/me/auto-reply', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const { status, start, end } = req.body;
    const message = String(req.body.message || '').trim();
    const external = req.body.external === 'on';

    if (!AUTO_REPLY_STATUSES.includes(status)) {
      throw userError(400, 'Estado no válido');
    }

    if (status !== 'disabled' && !message) {
      throw userError(400, 'Escribe el mensaje de la respuesta automática');
    }

    const setting = {
      status,
      externalAudience: external ? 'all' : 'none',
    };

    // Without a message the one already stored is kept
    if (message) {
      setting.internalReplyMessage = textToHtml(message);
      setting.externalReplyMessage = setting.internalReplyMessage;
    }

    if (status === 'scheduled') {
      if (!LOCAL_DATE_TIME.test(start) || !LOCAL_DATE_TIME.test(end) || start >= end) {
        throw userError(400, 'Indica una fecha de inicio anterior a la de fin');
      }
      // The form's dates are in the time zone of the mailbox
      const timeZone = await getMailboxTimeZone(accessToken);
      setting.scheduledStartDateTime = { dateTime: `${start}:00`, timeZone };
      setting.scheduledEndDateTime = { dateTime: `${end}:00`, timeZone };
    }

    await updateAutomaticReplies(accessToken, setting);
    await auditRequest(req, 'mail.auto_reply_update', { status, external });

    res.redirect('/profile/me/auto-reply?saved=1');
  } catch (error) {
    next(error);
  }
});

/**
 * Read the uploaded photo, turning multer's errors into messages for the user
 */
function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (error) => {
    if (error) {
      return next(userError(400, 'La imagen no puede superar los 4 MB'));
    }
    next();
  });
}

/**
 * POST /profile/me/photo
 * Replace the profile photo
 */
router.post('/profile/me/photo', isAuthenticated, uploadPhoto, verifyCsrfToken, async (req, res, next) => {
  try {
    if (!req.file || !PHOTO_TYPES.includes(req.file.mimetype)) {
      throw userError(400, 'Elige una imagen en formato JPG o PNG');
    }

    await updateUserPhoto(req.session.accessToken, req.file.buffer, req.file.mimetype);
    await auditRequest(req, 'profile.photo_update', { bytes: req.file.size });

    res.redirect('/');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
