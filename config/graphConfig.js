/**
 * Microsoft Graph API Configuration
 * 
 * This file defines the Microsoft Graph API endpoints
 * used to retrieve user information.
 */

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

const graphConfig = {
  // User profile endpoint with selected fields
  // We select specific fields to optimize the API call
  userProfile: {
    endpoint: `${GRAPH_API_BASE}/me`,
  },

  // User profile photo endpoint
  // Returns binary image data
  userPhoto: {
    endpoint: `${GRAPH_API_BASE}/me/photo/$value`,
  },

  // User's group memberships endpoint
  groupMemberships: {
    endpoint: `${GRAPH_API_BASE}/me/memberOf`,
  },

  // User's manager endpoint
  manager: {
    endpoint: `${GRAPH_API_BASE}/me/manager`,
  },
};

module.exports = graphConfig;
