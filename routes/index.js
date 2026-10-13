/**
 * Main Application Routes
 * 
 * Handles the main pages of the application:
 * - / (home) - Profile page (requires authentication)
 * - /login - Login page
 * - /groups - Groups management page (requires authentication)
 *   (asking to join a group is in routes/groupRequests.js)
 */

const express = require('express');
const router = express.Router();
const appConfig = require('../config/appConfig');
const { ADMIN_EMAIL, APP_ORIGIN } = appConfig;
const { buildOrgChart } = require('../services/orgChart');
const permissions = require('../config/permissions');
const { isAuthenticated, redirectIfAuthenticated } = require('../middleware/auth');
const { userError } = require('../middleware/errorHandler');
const { resetRequestLimiter, resetLinkLimiter } = require('../middleware/rateLimit');
const { sendResetEmail } = require('../services/emailService');
const { getAppToken } = require('../services/tokenService');
const { createResetToken, readResetToken } = require('../services/resetTokenService');
const { auditRequest } = require('../services/auditService');
const {
  getAllUserData,
  getUserProfile,
  getGroupsWithMembership,
  getAllUsers,
  getUsersWithManager,
  findUserByEmail,
  getUserForReset,
  sendEmail,
  updateUserProfile,
  getJoinedTeamsAndChannels,
  resetUserPassword
} = require('../services/graphService');

/**
 * GET /organigrama
 * Org chart page
 */
router.get('/organigrama', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const usersWithManager = await getUsersWithManager(accessToken);

    res.render('organigrama', {
      title: 'Organigrama',
      currentPage: 'organigrama',
      chart: buildOrgChart(usersWithManager, { rootEmail: appConfig.ORG_CHART_ROOT, orgName: appConfig.ORG_NAME }),
      currentUserId: req.session.account?.localAccountId || null
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /
 * Home page - displays user profile (requires authentication)
 */
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    // Get access token from session
    const accessToken = req.session.accessToken;

    // Fetch all user data from Microsoft Graph
    const userData = await getAllUserData(accessToken);

    // Convert photo buffer to base64 for display in HTML
    let photoBase64 = null;
    if (userData.photo) {
      photoBase64 = `data:image/jpeg;base64,${userData.photo.toString('base64')}`;
    }

    // Render profile page with user data
    res.render('profile', {
      title: 'Perfil',
      currentPage: 'profile',
      user: userData.profile,
      photo: photoBase64,
      groups: userData.groups,
      manager: userData.manager,
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    next(error);
  }
});

/**
 * GET /profile/me/edit
 * Edit profile page
 */
router.get('/profile/me/edit', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const userData = await getAllUserData(accessToken);

    // Shown once: what the last save could not change
    const notice = req.session.profileNotice || null;
    delete req.session.profileNotice;

    res.render('edit-profile', {
      title: 'Editar Perfil',
      currentPage: 'profile',
      user: userData.profile,
      locked: lockedProfileFields(req),
      notice,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Profile fields this user cannot change here: the ones the installation
 * does not offer, and the ones Microsoft has already refused in this session
 */
function lockedProfileFields(req) {
  const refused = req.session.profileRefused || [];
  return appConfig.PROFILE_FIELDS.filter(field => !appConfig.PROFILE_EDITABLE_FIELDS.includes(field) || refused.includes(field));
}

const PROFILE_FIELD_LABELS = {
  mobilePhone: 'teléfono móvil',
  jobTitle: 'puesto de trabajo',
  officeLocation: 'ubicación de oficina',
  businessPhones: 'extensión',
};

/**
 * POST /profile/me/edit
 * Handle profile update
 */
router.post('/profile/me/edit', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const current = await getUserProfile(accessToken);
    const submitted = (field) => String(req.body[field] ?? '').trim();

    // Only what changed is sent: Graph refuses the whole update over one
    // field it does not like, and an empty box must clear with null, not ''
    // Locked fields are not in the form, so what arrives for them is ignored
    // rather than read as "emptied"
    const locked = lockedProfileFields(req);
    const updateData = {};
    for (const field of ['mobilePhone', 'jobTitle', 'officeLocation']) {
      if (!locked.includes(field) && submitted(field) !== (current[field] || '')) {
        updateData[field] = submitted(field) || null;
      }
    }
    const businessPhone = submitted('businessPhones');
    if (!locked.includes('businessPhones') && businessPhone !== (current.businessPhones?.[0] || '')) {
      updateData.businessPhones = businessPhone ? [businessPhone] : [];
    }

    // One request per field, so a field the user may not change (Graph
    // answers 403) does not take the others down with it
    const saved = [];
    const refused = [];
    try {
      for (const [field, value] of Object.entries(updateData)) {
        if (!appConfig.PROFILE_FIELDS.includes(field)) continue; // keys come from that list; said twice for clarity
        try {
          await updateUserProfile(accessToken, Object.fromEntries([[field, value]]));
          saved.push(field);
        } catch (error) {
          if (error.graphStatus !== 403) throw error;
          refused.push(field);
        }
      }
    } finally {
      if (saved.length > 0) {
        auditRequest(req, 'profile.update', { fields: saved });
      }
    }

    if (refused.length > 0) {
      // Back to the form, which from now on shows those fields read-only
      req.session.profileRefused = [...new Set([...(req.session.profileRefused || []), ...refused])];
      req.session.profileNotice = {
        refused: refused.map(field => PROFILE_FIELD_LABELS[field]),
        savedOthers: saved.length > 0,
      };
      return res.redirect('/profile/me/edit');
    }
    res.redirect('/');
  } catch (error) {
    console.error('Error updating profile:', error);
    const err = new Error('Error al actualizar el perfil: ' + error.message);
    err.status = 500;
    err.graphStatus = error.graphStatus;
    return next(err);
  }
});

/**
 * GET /teams
 * Teams management page - displays joined teams and their channels
 */
router.get('/teams', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const teamsWithChannels = await getJoinedTeamsAndChannels(accessToken);

    // Sort channels for every team
    teamsWithChannels.forEach(team => {
      team.channels.sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    // Separate and sort teams
    let todoAyto = teamsWithChannels.find(t => t.displayName === 'Todo Ayuntamiento');
    let otherTeams = teamsWithChannels.filter(t => t.displayName !== 'Todo Ayuntamiento');
    otherTeams.sort((a, b) => a.displayName.localeCompare(b.displayName));

    res.render('teams', {
      title: 'Teams',
      currentPage: 'teams',
      todoAyto,
      otherTeams,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /groups
 * Groups management page - displays all tenant groups categorized by type
 */
router.get('/groups', isAuthenticated, async (req, res, next) => {
  try {
    // Get access token from session
    const accessToken = req.session.accessToken;

    // Fetch all groups with membership status
    const groupsData = await getGroupsWithMembership(accessToken);

    // Categorize groups
    const m365Groups = [];
    const distributionLists = [];

    groupsData.allGroups.forEach(group => {
      // Logic for categorization based on name prefix
      if (group.displayName && group.displayName.startsWith('DIST')) {
        distributionLists.push(group);
      } else {
        m365Groups.push(group);
      }
    });

    // Render groups page
    res.render('groups', {
      title: 'Grupos',
      currentPage: 'groups',
      m365Groups,
      distributionLists,
      totalCount: groupsData.totalCount,
    });
  } catch (error) {
    console.error('Error fetching groups data:', error);
    next(error);
  }
});

/**
 * POST /groups/generate-report
 * Generate a text report of non-member groups
 */
router.post('/groups/generate-report', isAuthenticated, async (req, res, next) => {
  try {
    const { selectedGroups } = req.body;
    
    if (!selectedGroups || selectedGroups.length === 0) {
      const err = new Error('No groups selected');
      err.status = 400;
      return next(err);
    }

    // Get access token to fetch group details
    const accessToken = req.session.accessToken;
    const groupsData = await getGroupsWithMembership(accessToken);

    // Filter selected groups
    const selectedGroupDetails = groupsData.allGroups.filter(g => 
      selectedGroups.includes(g.id)
    );

    // Generate report text
    let report = 'Groups Access Request\n';
    report += '='.repeat(50) + '\n\n';
    report += `User: ${req.session.account?.name || req.session.account?.username}\n`;
    report += `Date: ${new Date().toISOString().split('T')[0]}\n\n`;
    report += 'Requesting access to the following groups:\n\n';

    selectedGroupDetails.forEach((group, index) => {
      report += `${index + 1}. ${group.displayName}\n`;
      if (group.description) {
        report += `   Description: ${group.description}\n`;
      }
      if (group.mail) {
        report += `   Email: ${group.mail}\n`;
      }
      report += `   Group ID: ${group.id}\n`;
      report += `   Current Status: Not a member\n\n`;
    });

    report += '\n' + '='.repeat(50) + '\n';
    report += 'Please grant access to these groups.\n';

    // Return the report
    res.json({ 
      success: true, 
      report,
      groupCount: selectedGroupDetails.length,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    next(error);
  }
});

/**
 * GET /api/users
 * Get all users in the organization for manager selection dropdown
 */
router.get('/api/users', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const users = await getAllUsers(accessToken);
    
    res.json({ 
      success: true, 
      users 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users' 
    });
  }
});

/**
 * POST /api/manager-correction
 * Send email notification about manager correction request
 */
router.post('/api/manager-correction', isAuthenticated, async (req, res, next) => {
  try {
    const { selectedManagerId, selectedManagerName, selectedManagerEmail } = req.body;
    
    if (!selectedManagerId || !selectedManagerName) {
      const err = new Error('Manager information is required');
      err.status = 400;
      return next(err);
    }

    const accessToken = req.session.accessToken;
    const currentUser = req.session.account?.name || req.session.account?.username;
    const currentUserEmail = req.session.account?.username;

    // Email configuration
    const emailData = {
      to: ADMIN_EMAIL,
      subject: '[m365-admin] Change request',
      body: `The user ${currentUser} (${currentUserEmail}) is requesting that their manager is ${selectedManagerName} (${selectedManagerEmail || 'no email'}) (ID: ${selectedManagerId})`,
    };

    // Send the email
    await sendEmail(accessToken, emailData);
    await auditRequest(req, 'request.manager_correction', { managerId: selectedManagerId });

    res.json({ 
      success: true, 
      message: 'Manager correction request sent successfully' 
    });
  } catch (error) {
    console.error('Error sending manager correction:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send manager correction request' 
    });
  }
});

/**
 * Look the user up and email them a reset link. The link goes to the
 * alternate address on the account when there is one, because the mailbox of
 * the account is usually out of reach for someone who forgot the password.
 * Does nothing if nobody has that address.
 */
async function sendResetLink(req, email) {
  // Verify user exists via Graph API (App-only token)
  const appToken = await getAppToken();
  const user = await findUserByEmail(appToken, email);

  if (!user) {
    await auditRequest(req, 'reset.link_requested', { email, sentTo: 'nobody' });
    return;
  }

  // A link is single use because checkResetToken compares this date with the
  // directory. Without the date that check would always pass, so no link
  if (!user.lastPasswordChangeDateTime) {
    throw new Error('The directory does not report when the password was last changed (lastPasswordChangeDateTime), so the link could not be made single use');
  }

  const account = user.mail || user.userPrincipalName;
  const alternate = (user.otherMails || [])[0];
  const token = createResetToken({
    userId: user.id,
    email: account,
    passwordChangedAt: user.lastPasswordChangeDateTime,
  });
  const resetUrl = `${APP_ORIGIN}/reset-password/${token}`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('--- DEBUG: Reset Password Link ---');
    console.log(resetUrl);
    console.log('----------------------------------');
  }

  await sendResetEmail(alternate || account, resetUrl);
  await auditRequest(req, 'reset.link_requested', { email, sentTo: alternate ? 'alternate' : 'mailbox' });
}

/**
 * Check a reset link: it must be intact, not expired, and the user's password
 * must not have changed since the link was issued (which makes it single use)
 * @returns {Promise<Object>} The link's payload and an app-only token
 */
async function checkResetToken(token) {
  const payload = readResetToken(token);

  if (!payload) {
    throw userError(400, 'Token no válido o corrupto');
  }

  if (Date.now() > payload.expires) {
    throw userError(400, 'El enlace ha caducado');
  }

  const appToken = await getAppToken();
  const user = await getUserForReset(appToken, payload.userId);

  if (!user || (user.lastPasswordChangeDateTime || null) !== payload.passwordChangedAt) {
    throw userError(400, 'El enlace ya ha sido utilizado');
  }

  return { payload, appToken };
}

/**
 * GET /reset-password
 */
router.get('/reset-password', (req, res) => {
  res.render('reset-password', {
    title: 'Recuperar contraseña',
    domain: permissions.DOMAIN,
    // The domain as a regular expression, for the form's pattern attribute
    domainPattern: permissions.DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    fromEmail: process.env.FROM_EMAIL,
  });
});

/**
 * POST /reset-password
 */
router.post('/reset-password', resetRequestLimiter, (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();

  if (!email.endsWith(`@${permissions.DOMAIN}`)) {
    return next(userError(400, `El correo electrónico debe ser válido y pertenecer al dominio @${permissions.DOMAIN}`));
  }

  // Answer before looking the user up: neither the response nor how long it
  // takes may reveal whether the address belongs to an account
  res.send('Si la dirección corresponde a una cuenta, recibirás un enlace en tu correo electrónico.');

  sendResetLink(req, email).catch((error) => {
    console.error('Error sending reset link:', error.message);
    auditRequest(req, 'reset.link_failed', { email, reason: error.message });
  });
});

/**
 * GET /reset-password/:token
 */
router.get('/reset-password/:token', resetLinkLimiter, async (req, res, next) => {
  try {
    const { payload } = await checkResetToken(req.params.token);

    res.render('reset-password-form', {
      title: 'Nueva contraseña',
      token: req.params.token,
      email: payload.email,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /reset-password/:token
 */
router.post('/reset-password/:token', resetLinkLimiter, async (req, res, next) => {
  try {
    const { payload, appToken } = await checkResetToken(req.params.token);
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword !== confirmPassword) {
      throw userError(400, 'Las contraseñas no coinciden');
    }

    // Reset password via Graph API (App-only token)
    await resetUserPassword(appToken, payload.userId, newPassword);
    await auditRequest(req, 'reset.password_changed', { userId: payload.userId, email: payload.email });

    res.send('Contraseña actualizada correctamente.');
  } catch (error) {
    await auditRequest(req, 'reset.rejected', { reason: error.message });
    if (error.expose) {
      return next(error);
    }
    console.error('Error resetting password:', error.message);
    next(userError(400, 'Error procesando el reseteo'));
  }
});

/**
 * GET /login
 * Login page (redirects to home if already authenticated)
 */
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', {
    title: 'Iniciar sesion',
    currentPage: 'login',
  });
});

module.exports = router;
