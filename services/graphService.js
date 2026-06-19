/**
 * Microsoft Graph API Service
 * 
 * This service handles all Microsoft Graph API calls to retrieve user data.
 * Each function makes an authenticated request to a specific Graph endpoint.
 */

const axios = require('axios');
const graphConfig = require('../config/graphConfig');

/**
 * Helper function to process requests in batches to avoid overwhelming the API
 * @param {Array} items - Items to process
 * @param {Function} processFn - Async function to process each item
 * @param {number} batchSize - Number of items to process concurrently
 * @returns {Promise<Array>} Results from all batches
 */
async function processBatches(items, processFn, batchSize = 10) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Get user profile information with extended fields
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Object>} User profile data
 */
async function getUserProfile(accessToken) {
  try {
    const response = await axios.get(graphConfig.userProfile.endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error.response?.data || error.message);
    throw new Error('Failed to fetch user profile');
  }
}

/**
 * Get all users in the organization for selection dropdowns
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Array>} Array of users with basic info
 */
async function getAllUsers(accessToken) {
  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
      params: {
        $select: 'id,displayName,mail,jobTitle,department',
        $orderby: 'displayName',
        $top: 999, // Get up to 999 users
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.value || [];
  } catch (error) {
    console.error('Error fetching all users:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Send an email via Microsoft Graph
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @param {Object} emailData - Email data (to, subject, body)
 * @returns {Promise<void>}
 */
async function sendEmail(accessToken, emailData) {
  try {
    const { to, subject, body, attachments } = emailData;
    
    const message = {
      message: {
        subject: subject,
        body: {
          contentType: 'Text',
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
    };

    if (attachments && attachments.length > 0) {
      message.message.hasAttachments = true;
      message.message.attachments = attachments.map(att => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes // base64 encoded
      }));
    }

    await axios.post(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      message,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    throw new Error('Failed to send email');
  }
}

/**
 * Get user profile photo
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Buffer|null>} Photo data as buffer, or null if no photo exists
 */
async function getUserPhoto(accessToken) {
  try {
    const response = await axios.get(graphConfig.userPhoto.endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    // 404 means user has no profile photo - this is normal
    if (error.response?.status === 404) {
      console.log('No profile photo found for user');
      return null;
    }
    console.error('Error fetching user photo:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get user's group memberships
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Array>} Array of groups the user belongs to
 */
async function getUserGroups(accessToken) {
  try {
    const response = await axios.get(graphConfig.groupMemberships.endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.value || [];
  } catch (error) {
    console.error('Error fetching user groups:', error.response?.data || error.message);
    // Return empty array instead of throwing - groups are optional
    return [];
  }
}

/**
 * Get user's manager information
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Object|null>} Manager data, or null if no manager assigned
 */
async function getUserManager(accessToken) {
  try {
    const response = await axios.get(graphConfig.manager.endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    // 404 means user has no manager assigned - this is normal
    if (error.response?.status === 404) {
      console.log('No manager found for user');
      return null;
    }
    console.error('Error fetching user manager:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get all groups in the tenant
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Array>} Array of all groups in the tenant
 */
async function getAllTenantGroups(accessToken) {
  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/groups', {
      params: {
        $select: 'id,displayName,description,mail,mailEnabled,securityEnabled',
        $orderby: 'displayName',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.value || [];
  } catch (error) {
    console.error('Error fetching all tenant groups:', error.response?.data || error.message);
    throw new Error('Failed to fetch tenant groups');
  }
}

/**
 * Get all tenant groups with user membership status
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Object>} Object with all groups and user's groups
 */
async function getGroupsWithMembership(accessToken) {
  try {
    const [allGroups, userGroups] = await Promise.all([
      getAllTenantGroups(accessToken),
      getUserGroups(accessToken),
    ]);

    // Create a Set of user's group IDs for fast lookup
    const userGroupIds = new Set(userGroups.map(g => g.id));

    // Add membership status to each group
    const groupsWithStatus = allGroups.map(group => ({
      ...group,
      isMember: userGroupIds.has(group.id),
    }));

    return {
      allGroups: groupsWithStatus,
      userGroups,
      memberCount: userGroups.length,
      totalCount: allGroups.length,
    };
  } catch (error) {
    console.error('Error fetching groups with membership:', error.message);
    throw error;
  }
}

/**
 * Get all distribution lists (mail-enabled groups) in the tenant
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Array>} Array of all distribution lists in the tenant
 */
async function getAllDistributionLists(accessToken) {
  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/groups', {
      params: {
        $filter: 'mailEnabled eq true',
        $select: 'id,displayName,description,mail,mailEnabled,securityEnabled,groupTypes',
        $orderby: 'displayName',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.value || [];
  } catch (error) {
    console.error('Error fetching distribution lists:', error.response?.data || error.message);
    throw new Error('Failed to fetch distribution lists');
  }
}

/**
 * Get all distribution lists with user membership status
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Object>} Object with all distribution lists and user's membership
 */
async function getDistributionListsWithMembership(accessToken) {
  try {
    const [allDistLists, userGroups] = await Promise.all([
      getAllDistributionLists(accessToken),
      getUserGroups(accessToken),
    ]);

    // Create a Set of user's group IDs for fast lookup
    const userGroupIds = new Set(userGroups.map(g => g.id));

    // Add membership status to each distribution list
    const distListsWithStatus = allDistLists.map(list => ({
      ...list,
      isMember: userGroupIds.has(list.id),
    }));

    // Count how many distribution lists user is member of
    const memberCount = distListsWithStatus.filter(dl => dl.isMember).length;

    return {
      allDistLists: distListsWithStatus,
      memberCount,
      totalCount: allDistLists.length,
    };
  } catch (error) {
    console.error('Error fetching distribution lists with membership:', error.message);
    throw error;
  }
}

/**
 * Get all shared mailboxes in the tenant
 * Checks mailboxSettings.userPurpose to identify shared mailboxes
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Array>} Array of all shared mailboxes in the tenant
 */
async function getAllSharedMailboxes(accessToken) {
  try {
    // Step 1: Get all users in the tenant
    const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
      params: {
        $select: 'id,displayName,mail,userPrincipalName,accountEnabled',
        $orderby: 'displayName',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const users = response.data.value || [];

    // Filter out users without mail addresses first
    const usersWithMail = users.filter(user => user.mail);

    console.log(`Checking ${usersWithMail.length} users with mail addresses for shared mailboxes...`);

    // Step 2: Check each user's mailboxSettings to determine if it's a shared mailbox
    // Process in batches of 10 to avoid overwhelming the API
    const checkMailbox = async (user) => {
      try {
        // Get mailbox settings for this user
        const mailboxResponse = await axios.get(
          `https://graph.microsoft.com/v1.0/users/${user.id}/mailboxSettings`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const mailboxSettings = mailboxResponse.data;

        // Check if userPurpose is 'shared'
        if (mailboxSettings.userPurpose === 'shared') {
          console.log(`Found shared mailbox: ${user.displayName} (${user.mail})`);
          return {
            id: user.id,
            displayName: user.displayName,
            mail: user.mail,
            userPrincipalName: user.userPrincipalName,
            accountEnabled: user.accountEnabled,
            userPurpose: mailboxSettings.userPurpose,
          };
        }
      } catch (error) {
        // Silently skip users where we can't access mailbox settings
        // This is normal for some system accounts or users without mailboxes
      }

      return null;
    };

    // Process in batches for better performance and API rate limit management
    const results = await processBatches(usersWithMail, checkMailbox, 10);

    // Filter out null results and return only shared mailboxes
    const sharedMailboxes = results.filter(mailbox => mailbox !== null);

    console.log(`Found ${sharedMailboxes.length} shared mailboxes out of ${usersWithMail.length} users with mail`);

    return sharedMailboxes;
  } catch (error) {
    console.error('Error fetching shared mailboxes:', error.response?.data || error.message);
    // If the query fails, return empty array instead of throwing
    // This prevents the entire page from failing
    return [];
  }
}

/**
 * Get all shared mailboxes with user access status
 * Note: Detecting access to shared mailboxes requires checking delegated permissions
 * This is a simplified version that lists all shared mailboxes
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Object>} Object with all shared mailboxes
 */
async function getSharedMailboxesWithAccess(accessToken) {
  try {
    const allMailboxes = await getAllSharedMailboxes(accessToken);

    // Mark all as "not accessible" by default since we can't easily check access
    // In a real implementation, you'd need to check mailbox permissions via EWS or Exchange Online PowerShell
    const mailboxesWithStatus = allMailboxes.map(mailbox => ({
      ...mailbox,
      hasAccess: false, // Default to false, would need additional API calls to verify
    }));

    return {
      allMailboxes: mailboxesWithStatus,
      accessCount: 0, // Would need to be calculated from actual permissions
      totalCount: allMailboxes.length,
    };
  } catch (error) {
    console.error('Error fetching shared mailboxes with access:', error.message);
    // Return empty structure instead of throwing to prevent page crashes
    return {
      allMailboxes: [],
      accessCount: 0,
      totalCount: 0,
    };
  }
}

/**
 * Get all user data in one call (convenience function)
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Object>} Complete user data object
 */
async function getAllUserData(accessToken) {
  try {
    // Fetch all data in parallel for better performance
    const [profile, photo, groups, manager] = await Promise.all([
      getUserProfile(accessToken),
      getUserPhoto(accessToken),
      getUserGroups(accessToken),
      getUserManager(accessToken),
    ]);

    return {
      profile,
      photo,
      groups,
      manager,
    };
  } catch (error) {
    console.error('Error fetching all user data:', error.message);
    throw error;
  }
}

/**
 * Update user profile information
 * @param {string} accessToken - Valid access token
 * @param {Object} profileData - Data to update
 * @returns {Promise<void>}
 */
async function updateUserProfile(accessToken, profileData) {
  try {
    await axios.patch('https://graph.microsoft.com/v1.0/me', profileData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error.response?.data || error.message);
    throw new Error('Failed to update user profile');
  }
}

/**
 * Get user extended directory information
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object>} User extended data
 */
async function getUserExtendedInfo(accessToken) {
  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching extended user info:', error.response?.data || error.message);
    throw new Error('Failed to fetch extended user info');
  }
}

/**
 * Get joined teams and their channels
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array>} Array of teams with channels
 */
async function getJoinedTeamsAndChannels(accessToken) {
  try {
    // 1. Get joined teams
    const teamsResponse = await axios.get('https://graph.microsoft.com/v1.0/me/joinedTeams', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const teams = teamsResponse.data.value || [];

    // 2. Get channels for each team
    const teamsWithChannels = await Promise.all(
      teams.map(async (team) => {
        try {
          const channelsResponse = await axios.get(`https://graph.microsoft.com/v1.0/teams/${team.id}/channels`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          return {
            ...team,
            channels: channelsResponse.data.value || []
          };
        } catch (error) {
          console.error(`Error fetching channels for team ${team.id}:`, error.message);
          return { ...team, channels: [] };
        }
      })
    );

    return teamsWithChannels;
  } catch (error) {
    console.error('Error fetching joined teams:', error.response?.data || error.message);
    throw new Error('Failed to fetch teams');
  }
}

/**
 * Get administrative directory roles for the user
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array>} Array of admin role names
 */
async function getUserAdminRoles(accessToken) {
  try {
    const url = 'https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.directoryRole';
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const roles = response.data.value || [];

    return roles
      .map(role => role.displayName);
  } catch (error) {
    console.error('Error fetching admin roles:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Check if the user has administrative directory roles
 * @param {string} accessToken - Valid access token
 * @returns {Promise<boolean>} True if user is an admin
 */
async function isUserAdmin(accessToken) {
  const roles = await getUserAdminRoles(accessToken);
  return roles.length > 0;
}

/**
 * Get manager for a specific user by ID
 * @param {string} accessToken - Valid access token
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Manager data
 */
async function getUserManagerById(accessToken, userId) {
  try {
    const response = await axios.get(`https://graph.microsoft.com/v1.0/users/${userId}/manager`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    console.error(`Error fetching manager for ${userId}:`, error.message);
    return null;
  }
}

/**
 * Reset user password via Microsoft Graph API
 * @param {string} accessToken - Valid access token with appropriate permissions
 * @param {string} userId - User ID
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
async function resetUserPassword(accessToken, userId, newPassword) {
  try {
    const passwordProfile = {
      passwordProfile: {
        password: newPassword,
        forceChangePasswordNextSignIn: false,
      },
    };
    await axios.patch(`https://graph.microsoft.com/v1.0/users/${userId}`, passwordProfile, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`Password reset successfully for user ${userId}`);
  } catch (error) {
    console.error('Error resetting password:', error.response?.data || error.message);
    throw new Error('Failed to reset password');
  }
}

module.exports = {
  getUserProfile,
  getUserPhoto,
  getUserGroups,
  getUserManager,
  getUserManagerById, // Exportada
  getAllUserData,
  getAllTenantGroups,
  getGroupsWithMembership,
  getAllUsers,
  sendEmail,
  updateUserProfile,
  getUserExtendedInfo,
  getJoinedTeamsAndChannels,
  isUserAdmin,
  getUserAdminRoles,
  resetUserPassword, // Exportada
};
