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
    scopes: ['user.read', 'User.ReadBasic.All'],
    // Fields to retrieve
    select: [
      'id',
      'displayName',
      'givenName',
      'surname',
      'mail',
      'userPrincipalName',
      'jobTitle',
      'department',
      'officeLocation',
      'mobilePhone',
      'businessPhones',
      'companyName',
      'employeeId',
      'preferredLanguage',
    ].join(','),
  },

  // User profile photo endpoint
  // Returns binary image data
  userPhoto: {
    endpoint: `${GRAPH_API_BASE}/me/photo/$value`,
    scopes: ['user.read'],
  },

  // User's group memberships endpoint
  groupMemberships: {
    endpoint: `${GRAPH_API_BASE}/me/memberOf`,
    scopes: ['GroupMember.Read.All'],
  },

  // User's manager endpoint
  manager: {
    endpoint: `${GRAPH_API_BASE}/me/manager`,
    scopes: ['Directory.Read.All'],
  },
};

module.exports = graphConfig;
