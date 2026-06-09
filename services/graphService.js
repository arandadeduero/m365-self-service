/**
 * Microsoft Graph API Service
 * 
 * This service handles all Microsoft Graph API calls to retrieve user data.
 * Each function makes an authenticated request to a specific Graph endpoint.
 */

const axios = require('axios');
const graphConfig = require('../config/graphConfig');

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
};
