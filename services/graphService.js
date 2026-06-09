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
      params: {
        $select: graphConfig.userProfile.select,
      },
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
    const { to, subject, body } = emailData;
    
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

module.exports = {
  getUserProfile,
  getUserPhoto,
  getUserGroups,
  getUserManager,
  getAllUserData,
  getAllTenantGroups,
  getGroupsWithMembership,
  getAllDistributionLists,
  getDistributionListsWithMembership,
  getAllSharedMailboxes,
  getSharedMailboxesWithAccess,
  getAllUsers,
  sendEmail,
};
