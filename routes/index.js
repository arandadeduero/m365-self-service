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
const { isAuthenticated, redirectIfAuthenticated } = require('../middleware/auth');
const { getAllUserData, getGroupsWithMembership, getDistributionListsWithMembership, getSharedMailboxesWithAccess } = require('../services/graphService');

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
      title: 'Profile',
      currentPage: 'profile',
      user: userData.profile,
      photo: photoBase64,
      groups: userData.groups,
      manager: userData.manager,
      // Pass raw JSON for display
      rawJson: JSON.stringify({
        profile: userData.profile,
        groups: userData.groups,
        manager: userData.manager,
      }, null, 2),
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
 * GET /groups
 * Groups management page - displays all tenant groups with membership status
 */
router.get('/groups', isAuthenticated, async (req, res, next) => {
  try {
    // Get access token from session
    const accessToken = req.session.accessToken;

    // Fetch all groups with membership status
    const groupsData = await getGroupsWithMembership(accessToken);

    // Render groups page
    res.render('groups', {
      title: 'Groups',
      currentPage: 'groups',
      allGroups: groupsData.allGroups,
      memberCount: groupsData.memberCount,
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
      return res.status(400).json({ error: 'No groups selected' });
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
 * Distribution Lists management page - displays all mail-enabled groups with membership status
 */
router.get('/distribution-lists', isAuthenticated, async (req, res, next) => {
  try {
    // Get access token from session
    const accessToken = req.session.accessToken;

    // Fetch all distribution lists with membership status
    const distListsData = await getDistributionListsWithMembership(accessToken);

    // Render distribution lists page
    res.render('distribution-lists', {
      title: 'Distribution Lists',
      currentPage: 'distribution-lists',
      allDistLists: distListsData.allDistLists,
      memberCount: distListsData.memberCount,
      totalCount: distListsData.totalCount,
    });
  } catch (error) {
    console.error('Error fetching distribution lists data:', error);
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
 * POST /distribution-lists/generate-report
 * Generate a text report of non-member distribution lists
 */
router.post('/distribution-lists/generate-report', isAuthenticated, async (req, res, next) => {
  try {
    const { selectedDistLists } = req.body;
    
    if (!selectedDistLists || selectedDistLists.length === 0) {
      return res.status(400).json({ error: 'No distribution lists selected' });
    }

    // Get access token to fetch distribution list details
    const accessToken = req.session.accessToken;
    const distListsData = await getDistributionListsWithMembership(accessToken);

    // Filter selected distribution lists
    const selectedDistListDetails = distListsData.allDistLists.filter(dl => 
      selectedDistLists.includes(dl.id)
    );

    // Generate report text
    let report = 'Distribution Lists Access Request\n';
    report += '='.repeat(50) + '\n\n';
    report += `User: ${req.session.account?.name || req.session.account?.username}\n`;
    report += `Date: ${new Date().toISOString().split('T')[0]}\n\n`;
    report += 'Requesting access to the following distribution lists:\n\n';

    selectedDistListDetails.forEach((list, index) => {
      report += `${index + 1}. ${list.displayName}\n`;
      if (list.description) {
        report += `   Description: ${list.description}\n`;
      }
      if (list.mail) {
        report += `   Email: ${list.mail}\n`;
      }
      report += `   Distribution List ID: ${list.id}\n`;
      report += `   Current Status: Not a member\n\n`;
    });

    report += '\n' + '='.repeat(50) + '\n';
    report += 'Please grant access to these distribution lists.\n';

    // Return the report
    res.json({ 
      success: true, 
      report,
      distListCount: selectedDistListDetails.length,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    next(error);
  }
});

/**
 * GET /shared-mailboxes
 * Shared Mailboxes management page - displays all shared mailboxes with access status
 */
router.get('/shared-mailboxes', isAuthenticated, async (req, res, next) => {
  try {
    // Get access token from session
    const accessToken = req.session.accessToken;

    // Fetch all shared mailboxes with access status
    const mailboxesData = await getSharedMailboxesWithAccess(accessToken);

    // Render shared mailboxes page
    res.render('shared-mailboxes', {
      title: 'Shared Mailboxes',
      currentPage: 'shared-mailboxes',
      allMailboxes: mailboxesData.allMailboxes,
      accessCount: mailboxesData.accessCount,
      totalCount: mailboxesData.totalCount,
    });
  } catch (error) {
    console.error('Error fetching shared mailboxes data:', error);
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
 * POST /shared-mailboxes/generate-report
 * Generate a text report of shared mailboxes without access
 */
router.post('/shared-mailboxes/generate-report', isAuthenticated, async (req, res, next) => {
  try {
    const { selectedMailboxes } = req.body;
    
    if (!selectedMailboxes || selectedMailboxes.length === 0) {
      return res.status(400).json({ error: 'No shared mailboxes selected' });
    }

    // Get access token to fetch mailbox details
    const accessToken = req.session.accessToken;
    const mailboxesData = await getSharedMailboxesWithAccess(accessToken);

    // Filter selected mailboxes
    const selectedMailboxDetails = mailboxesData.allMailboxes.filter(mb => 
      selectedMailboxes.includes(mb.id)
    );

    // Generate report text
    let report = 'Shared Mailboxes Access Request\n';
    report += '='.repeat(50) + '\n\n';
    report += `User: ${req.session.account?.name || req.session.account?.username}\n`;
    report += `Date: ${new Date().toISOString().split('T')[0]}\n\n`;
    report += 'Requesting access to the following shared mailboxes:\n\n';

    selectedMailboxDetails.forEach((mailbox, index) => {
      report += `${index + 1}. ${mailbox.displayName}\n`;
      if (mailbox.mail) {
        report += `   Email: ${mailbox.mail}\n`;
      }
      if (mailbox.userPrincipalName) {
        report += `   User Principal Name: ${mailbox.userPrincipalName}\n`;
      }
      report += `   Mailbox ID: ${mailbox.id}\n`;
      report += `   Current Status: No access\n\n`;
    });

    report += '\n' + '='.repeat(50) + '\n';
    report += 'Please grant access to these shared mailboxes.\n';

    // Return the report
    res.json({ 
      success: true, 
      report,
      mailboxCount: selectedMailboxDetails.length,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    next(error);
  }
});

/**
 * GET /login
 * Login page (redirects to home if already authenticated)
 */
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', {
    title: 'Sign In',
    currentPage: 'login',
  });
});

module.exports = router;
