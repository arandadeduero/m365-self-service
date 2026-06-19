/**
 * Main Application Routes
 * 
 * Handles the main pages of the application:
 * - / (home) - Profile page (requires authentication)
 * - /login - Login page
 * - /groups - Groups management page (requires authentication)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const msal = require('@azure/msal-node');
const { msalConfig } = require('../config/authConfig');
const { isAuthenticated, redirectIfAuthenticated } = require('../middleware/auth');
const { sendResetEmail } = require('../services/emailService');
const { 
  getAllUserData, 
  getGroupsWithMembership, 
  getAllUsers, 
  sendEmail,
  updateUserProfile,
  getUserExtendedInfo,
  getJoinedTeamsAndChannels,
  getUserManager,
  getUserManagerById,
  resetUserPassword
} = require('../services/graphService');

// Create MSAL confidential client for app-only operations
const msalApp = new msal.ConfidentialClientApplication(msalConfig);

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.scryptSync(process.env.TOKEN_SECRET, 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString();
}

/**
 * GET /organigrama
 * Org chart page
 */
router.get('/organigrama', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const users = await getAllUsers(accessToken);
    
    // Obtenemos los managers para cada usuario
    const usersWithManager = await Promise.all(users.map(async (user) => {
        const manager = await getUserManagerById(accessToken, user.id);
        return {
            ...user,
            managerId: manager ? manager.id : null
        };
    }));
    
    res.render('organigrama', {
      title: 'Organigrama',
      currentPage: 'organigrama',
      users: JSON.stringify(usersWithManager)
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
    const extendedInfo = await getUserExtendedInfo(accessToken);

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
      extendedInfo: extendedInfo,
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    // If token is expired or invalid, clear session and redirect to login
    if (error.message.includes('token') || error.message.includes('unauthorized')) {
      req.session.destroy(() => {
        res.redirect('/login');
      });
    } else {
      next(error);
    }
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
    res.render('edit-profile', {
      title: 'Editar Perfil',
      currentPage: 'profile',
      user: userData.profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /profile/me/edit
 * Handle profile update
 */
router.post('/profile/me/edit', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const { mobilePhone, jobTitle, officeLocation, businessPhones } = req.body;
    
    // Prepare data
    const updateData = {
      mobilePhone,
      jobTitle,
      officeLocation,
      businessPhones: businessPhones ? [businessPhones] : []
    };

    await updateUserProfile(accessToken, updateData);
    res.redirect('/');
  } catch (error) {
    console.error('Error updating profile:', error);
    const err = new Error('Error al actualizar el perfil: ' + error.message);
    err.status = 500;
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
    // If token is expired or invalid, clear session and redirect to login
    if (error.message.includes('token') || error.message.includes('unauthorized')) {
      req.session.destroy(() => {
        res.redirect('/login');
      });
    } else {
      next(error);
    }
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
 * GET /distribution-lists
 * (Removed)
 */

/**
 * POST /distribution-lists/generate-report
 * (Removed)
 */

/**
 * GET /shared-mailboxes
 * (Removed)
 */

/**
 * POST /shared-mailboxes/generate-report
 * (Removed)
 */

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
      to: 'glopez@arandadeduero.es',
      subject: '[m365-admin] Change request',
      body: `The user ${currentUser} (${currentUserEmail}) is requesting that their manager is ${selectedManagerName} (${selectedManagerEmail || 'no email'}) (ID: ${selectedManagerId})`,
    };

    // Send the email
    await sendEmail(accessToken, emailData);

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
 * POST /api/group-access-request
 * Send email notification about group access request
 */
router.post('/api/group-access-request', isAuthenticated, async (req, res, next) => {
  try {
    const { selectedGroups } = req.body;
    
    if (!selectedGroups || selectedGroups.length === 0) {
      const err = new Error('Group information is required');
      err.status = 400;
      return next(err);
    }

    const accessToken = req.session.accessToken;
    const currentUser = req.session.account?.name || req.session.account?.username;
    const currentUserEmail = req.session.account?.username;

    // Fetch group details for the email body
    const groupsData = await getGroupsWithMembership(accessToken);
    const selectedGroupDetails = groupsData.allGroups.filter(g => 
      selectedGroups.includes(g.id)
    );

    // Generate email body
    let body = `The user ${currentUser} (${currentUserEmail}) is requesting access to the following groups:\n\n`;
    selectedGroupDetails.forEach((group, index) => {
      body += `${index + 1}. ${group.displayName} (ID: ${group.id})\n`;
    });

    // Email configuration
    const emailData = {
      to: 'glopez@arandadeduero.es',
      subject: '[m365-admin] Group Access Request',
      body: body,
    };

    // Send the email
    await sendEmail(accessToken, emailData);

    res.json({ 
      success: true, 
      message: 'Group access request sent successfully' 
    });
  } catch (error) {
    console.error('Error sending group access request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send group access request' 
    });
  }
});

/**
 * GET /reset-password
 */
router.get('/reset-password', (req, res) => {
  res.render('reset-password', { title: 'Recuperar contraseña' });
});

/**
 * POST /reset-password
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.endsWith('@arandadeduero.es')) {
        const err = new Error('El correo electrónico debe ser válido y pertenecer al dominio @arandadeduero.es');
        err.status = 400;
        return next(err);
    }

    // Verify user exists via Graph API (App-only token)
    const tokenRequest = { scopes: ['https://graph.microsoft.com/.default'] };
    const authResponse = await msalApp.acquireTokenByClientCredential(tokenRequest);
    
    // Get all users
    const users = await getAllUsers(authResponse.accessToken);
    const user = users.find(u => u.mail === email || u.userPrincipalName === email);
    
    if (!user) {
        const err = new Error('Usuario no encontrado');
        err.status = 404;
        return next(err);
    }
    
    // Create token payload
    const payload = JSON.stringify({
        userId: user.id,
        email: user.mail,
        expires: Date.now() + 15 * 60 * 1000 // 15 minutes
    });

    const token = encrypt(payload);
      
    // Create link
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    
    if (process.env.NODE_ENV !== 'production') {
        console.log('--- DEBUG: Reset Password Link ---');
        console.log(resetUrl);
        console.log('----------------------------------');
    }
    
    // Send email
    await sendResetEmail(user.mail, resetUrl);
    
    res.send('Se ha enviado un enlace a tu correo electrónico.');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /reset-password/:token
 */
router.get('/reset-password/:token', (req, res, next) => {
    try {
        const decrypted = decrypt(req.params.token);
        const payload = JSON.parse(decrypted);
        
        if (Date.now() > payload.expires) {
            const err = new Error('El enlace ha caducado');
            err.status = 400;
            return next(err);
        }

        if (!payload.email || !payload.email.endsWith('@arandadeduero.es')) {
             const err = new Error('Correo electrónico no válido');
             err.status = 400;
             return next(err);
        }

        res.render('reset-password-form', { 
            title: 'Nueva contraseña',
            token: req.params.token,
            email: payload.email,
            userId: payload.userId
        });
    } catch (e) {
        const err = new Error('Token no válido o corrupto');
        err.status = 400;
        return next(err);
    }
});

/**
 * POST /reset-password/:token
 */
router.post('/reset-password/:token', async (req, res, next) => {
    try {
        const decrypted = decrypt(req.params.token);
        const payload = JSON.parse(decrypted);
        
        if (Date.now() > payload.expires) {
            const err = new Error('El enlace ha caducado');
            err.status = 400;
            return next(err);
        }

        if (!payload.email || !payload.email.endsWith('@arandadeduero.es')) {
             const err = new Error('Correo electrónico no válido');
             err.status = 400;
             return next(err);
        }

        const { newPassword, confirmPassword } = req.body;
        
        if (newPassword !== confirmPassword) {
            const err = new Error('Las contraseñas no coinciden');
            err.status = 400;
            return next(err);
        }
        
        // Reset password via Graph API (App-only token)
        const tokenRequest = { scopes: ['https://graph.microsoft.com/.default'] };
        const authResponse = await msalApp.acquireTokenByClientCredential(tokenRequest);
        
        await resetUserPassword(authResponse.accessToken, payload.userId, newPassword);
        
        res.send('Contraseña actualizada correctamente.');
    } catch (error) {
        const err = new Error('Error procesando el reseteo');
        err.status = 400;
        return next(err);
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
