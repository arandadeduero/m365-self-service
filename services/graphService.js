/**
 * Microsoft Graph API Service
 * 
 * This service handles all Microsoft Graph API calls to retrieve user data.
 * Each function makes an authenticated request to a specific Graph endpoint.
 */

const axios = require('axios');
const graphConfig = require('../config/graphConfig');

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Build the error thrown to callers, keeping the HTTP status Graph answered
 * with so that an expired or revoked token (401) can be told apart
 * @param {string} message - Message for the caller
 * @param {Error} error - Original axios error
 * @returns {Error}
 */
function graphError(message, error) {
  const err = new Error(message);
  err.graphStatus = error.response?.status;
  return err;
}

/**
 * Read a Graph collection to the end, following @odata.nextLink
 * @param {string} url - Collection endpoint
 * @param {Object} config - axios config for the first request
 * @returns {Promise<Array>} Items of every page
 */
async function getAllPages(url, config) {
  let response = await axios.get(url, config);
  const items = [...(response.data.value || [])];

  while (response.data['@odata.nextLink']) {
    // The next link already carries the query, so only the headers are sent again
    response = await axios.get(response.data['@odata.nextLink'], { headers: config.headers });
    items.push(...(response.data.value || []));
  }

  return items;
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
    throw graphError('Failed to fetch user profile', error);
  }
}

// What the directory shows about a person
const DIRECTORY_USER_FIELDS = 'id,displayName,givenName,surname,mail,jobTitle,department,officeLocation,businessPhones,mobilePhone';

/**
 * Get one person of the directory, with the signed-in user's token
 * @param {string} accessToken - Valid access token
 * @param {string} userId - Directory id, already checked for its format
 * @returns {Promise<Object|null>} The user, or null when there is none
 */
async function getUserById(accessToken, userId) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/users/${encodeURIComponent(userId)}`, {
      params: { $select: DIRECTORY_USER_FIELDS },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    console.error(`Error fetching user ${userId}:`, error.response?.data || error.message);
    throw graphError('Failed to fetch user', error);
  }
}

/**
 * Get all users in the organization for selection dropdowns
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @returns {Promise<Array>} Array of users with basic info
 */
async function getAllUsers(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/users`, {
      params: {
        $select: 'id,displayName,mail,jobTitle,department,officeLocation,businessPhones,mobilePhone',
        $orderby: 'displayName',
        $top: 999, // Largest page Graph allows
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching all users:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Send an email via Microsoft Graph
 * @param {string} accessToken - Valid access token for Microsoft Graph
 * @param {Object} emailData - Email data (to, subject, body); `to` is one address or a list
 * @returns {Promise<void>}
 */
async function sendEmail(accessToken, emailData) {
  try {
    const { to, subject, body, attachments } = emailData;
    const recipients = Array.isArray(to) ? to : [to];
    
    const message = {
      message: {
        subject: subject,
        body: {
          contentType: 'Text',
          content: body,
        },
        toRecipients: recipients.map(address => ({
          emailAddress: {
            address,
          },
        })),
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

    console.log(`Email sent successfully to ${recipients.join(', ')}`);
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    throw graphError('Failed to send email', error);
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
    return await getAllPages(graphConfig.groupMemberships.endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
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
    return await getAllPages(`${GRAPH_API_BASE}/groups`, {
      params: {
        $select: 'id,displayName,description,mail,mailEnabled,securityEnabled,groupTypes',
        $orderby: 'displayName',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching all tenant groups:', error.response?.data || error.message);
    throw graphError('Failed to fetch tenant groups', error);
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
 * Get the owners of a group
 * @param {string} accessToken - Valid access token
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} Owners, or [] if the group has none or they cannot be read
 */
async function getGroupOwners(accessToken, groupId) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/groups/${encodeURIComponent(groupId)}/owners`, {
      params: {
        $select: 'id,displayName,mail,userPrincipalName',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error(`Error fetching owners of group ${groupId}:`, error.response?.data || error.message);
    // Return empty array instead of throwing - a group without owners is handled by its caller
    return [];
  }
}

/**
 * Get the groups the signed-in user owns
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array>} Groups (id and name)
 */
async function getOwnedGroups(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/me/ownedObjects/microsoft.graph.group`, {
      params: {
        $select: 'id,displayName,description,mail,mailEnabled,securityEnabled,groupTypes',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching owned groups:', error.response?.data || error.message);
    throw graphError('Failed to fetch owned groups', error);
  }
}

/**
 * Add a user to a group, with the rights of whoever the token belongs to
 * @param {string} accessToken - Valid access token of an owner of the group
 * @param {string} groupId - Group ID
 * @param {string} userId - Directory ID of the new member
 * @returns {Promise<void>} Also resolves when the user was already a member
 */
async function addGroupMember(accessToken, groupId, userId) {
  try {
    await axios.post(
      `${GRAPH_API_BASE}/groups/${encodeURIComponent(groupId)}/members/$ref`,
      { '@odata.id': `${GRAPH_API_BASE}/directoryObjects/${userId}` },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    const message = error.response?.data?.error?.message || '';
    if (error.response?.status === 400 && message.includes('already exist')) {
      return;
    }
    console.error(`Error adding member to group ${groupId}:`, error.response?.data || error.message);
    throw graphError('Failed to add group member', error);
  }
}

/**
 * Get the people in a group (members that are groups or devices are left out)
 * @param {string} accessToken - Valid access token
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} Users, with userType telling guests apart
 */
async function getGroupMembers(accessToken, groupId) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/groups/${encodeURIComponent(groupId)}/members/microsoft.graph.user`, {
      params: {
        $select: 'id,displayName,mail,userPrincipalName,userType',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error(`Error fetching members of group ${groupId}:`, error.response?.data || error.message);
    throw graphError('Failed to fetch group members', error);
  }
}

/**
 * Remove a user from a group, with the rights of whoever the token belongs to
 * @param {string} accessToken - Valid access token of an owner of the group
 * @param {string} groupId - Group ID
 * @param {string} userId - Directory ID of the member
 * @returns {Promise<void>} Also resolves when the user was not a member
 */
async function removeGroupMember(accessToken, groupId, userId) {
  try {
    await axios.delete(
      `${GRAPH_API_BASE}/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}/$ref`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  } catch (error) {
    if (error.response?.status === 404) {
      return;
    }
    console.error(`Error removing member from group ${groupId}:`, error.response?.data || error.message);
    throw graphError('Failed to remove group member', error);
  }
}

/**
 * Close every session of the signed-in user, on every device and app. They
 * have to sign in again everywhere, this app included.
 * @param {string} accessToken - Valid access token
 * @returns {Promise<void>}
 */
async function revokeSignInSessions(accessToken) {
  try {
    await axios.post(`${GRAPH_API_BASE}/me/revokeSignInSessions`, {}, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error revoking sign-in sessions:', error.response?.data || error.message);
    throw graphError('Failed to revoke sign-in sessions', error);
  }
}

/**
 * Get who the signed-in user shares their calendar with
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array|null>} calendarPermissions, or null if they cannot be read
 */
async function getCalendarPermissions(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/me/calendar/calendarPermissions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching calendar permissions:', error.response?.data || error.message);
    // null and not []: "could not check" must not look like "shared with nobody"
    return null;
  }
}

/**
 * Share the signed-in user's calendar with somebody
 * @param {string} accessToken - Valid access token
 * @param {string} address - Who, by email address
 * @param {string} role - freeBusyRead, limitedRead, read or write
 * @returns {Promise<Object>} The permission Graph created
 */
async function shareCalendar(accessToken, address, role) {
  try {
    const response = await axios.post(`${GRAPH_API_BASE}/me/calendar/calendarPermissions`, {
      emailAddress: { address },
      role,
    }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    console.error('Error sharing calendar:', error.response?.data || error.message);
    throw graphError('Failed to share calendar', error);
  }
}

/**
 * Take back somebody's access to the signed-in user's calendar
 * @param {string} accessToken - Valid access token
 * @param {string} permissionId - Id of the calendarPermission
 * @returns {Promise<void>}
 */
async function removeCalendarPermission(accessToken, permissionId) {
  try {
    await axios.delete(`${GRAPH_API_BASE}/me/calendar/calendarPermissions/${encodeURIComponent(permissionId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    console.error('Error removing calendar permission:', error.response?.data || error.message);
    throw graphError('Failed to remove calendar permission', error);
  }
}

// People Graph answers about in one presence request
const PRESENCES_PER_REQUEST = 650;

/**
 * The Teams presence of several people
 * @param {string} accessToken - Valid access token
 * @param {Array<string>} userIds - Directory ids
 * @returns {Promise<Array|null>} One entry per person (id, availability, activity), or null when it could not be read
 */
async function getPresences(accessToken, userIds) {
  try {
    const all = [];
    for (let i = 0; i < userIds.length; i += PRESENCES_PER_REQUEST) {
      const response = await axios.post(`${GRAPH_API_BASE}/communications/getPresencesByUserId`, {
        ids: userIds.slice(i, i + PRESENCES_PER_REQUEST),
      }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      all.push(...(response.data.value || []));
    }
    return all;
  } catch (error) {
    console.error('Error fetching presences:', error.response?.data || error.message);
    // null, not []: "could not check" must not look like "everybody offline"
    return null;
  }
}

/**
 * The delegated permissions apps hold on the signed-in user's account: what
 * the user consented to, and what an administrator consented to for everybody
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array|null>} The grants, or null when they could not be read
 */
async function getMyAppGrants(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/me/oauth2PermissionGrants`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    console.error('Error fetching app grants:', error.response?.data || error.message);
    return null;
  }
}

/**
 * An application of the directory, by the id of its service principal
 * @param {string} accessToken - Valid access token
 * @param {string} id - Service principal id, already checked for its format
 * @returns {Promise<Object|null>} Name and publisher, or null when it cannot be read
 */
async function getServicePrincipal(accessToken, id) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/servicePrincipals/${encodeURIComponent(id)}`, {
      params: { $select: 'id,appId,displayName,publisherName,verifiedPublisher,homepage' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching service principal ${id}:`, error.response?.data || error.message);
    return null;
  }
}

// Pages of the drive listing read at most, so a huge OneDrive does not hang the page
const DRIVE_PAGES_MAX = 25;

/**
 * The items of the user's OneDrive that are shared with somebody
 * @param {string} accessToken - Valid access token
 * @returns {Promise<{items: Array, complete: boolean}|null>} The shared items, and whether the whole drive was read; null when it could not be
 */
async function getSharedDriveItems(accessToken) {
  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    let response = await axios.get(`${GRAPH_API_BASE}/me/drive/root/delta`, {
      params: { $select: 'id,name,webUrl,shared,file,folder,deleted,parentReference', $top: 1000 },
      headers,
    });
    const items = [];
    let pages = 1;
    const keep = (page) => items.push(...(page.value || []).filter(item => item.shared && !item.deleted));
    keep(response.data);
    while (response.data['@odata.nextLink'] && pages < DRIVE_PAGES_MAX) {
      response = await axios.get(response.data['@odata.nextLink'], { headers });
      keep(response.data);
      pages += 1;
    }
    return { items, complete: !response.data['@odata.nextLink'] };
  } catch (error) {
    console.error('Error listing shared drive items:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Who an item of the user's OneDrive is shared with
 * @param {string} accessToken - Valid access token
 * @param {string} itemId - Drive item id, already checked for its format
 * @returns {Promise<Array|null>} Its permissions, or null when they could not be read
 */
async function getDriveItemPermissions(accessToken, itemId) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/me/drive/items/${encodeURIComponent(itemId)}/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    console.error(`Error fetching permissions of item ${itemId}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Stop sharing an item of the user's OneDrive with somebody, or through a link
 * @param {string} accessToken - Valid access token
 * @param {string} itemId - Drive item id, already checked for its format
 * @param {string} permissionId - Permission id, already checked for its format
 * @returns {Promise<void>}
 */
async function removeDriveItemPermission(accessToken, itemId, permissionId) {
  try {
    await axios.delete(`${GRAPH_API_BASE}/me/drive/items/${encodeURIComponent(itemId)}/permissions/${encodeURIComponent(permissionId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    console.error(`Error removing permission ${permissionId} of item ${itemId}:`, error.response?.data || error.message);
    throw graphError('Failed to remove sharing', error);
  }
}

/**
 * Whether the signed-in user can open somebody else's mailbox (a shared one)
 * @param {string} accessToken - Valid access token
 * @param {string} address - Address of the mailbox
 * @returns {Promise<boolean|null>} null when Graph answered neither yes nor no
 */
async function canOpenMailbox(accessToken, address) {
  try {
    await axios.get(`${GRAPH_API_BASE}/users/${encodeURIComponent(address)}/mailFolders/inbox`, {
      params: {
        $select: 'id',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return true;
  } catch (error) {
    const status = error.response?.status;
    if (status === 403 || status === 404) {
      return false;
    }
    console.error(`Error checking access to mailbox ${address}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Get the meeting rooms of the organization
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array|null>} Rooms, or null if they cannot be read
 */
async function getRooms(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/places/microsoft.graph.room`, {
      params: {
        $top: 100,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching rooms:', error.response?.data || error.message);
    return null;
  }
}

// Mailboxes Graph accepts in one getSchedule request
const SCHEDULES_PER_REQUEST = 20;

/**
 * Get the free/busy information of several mailboxes for a period
 * @param {string} accessToken - Valid access token
 * @param {Array<string>} addresses - Mailboxes (people or rooms)
 * @param {string} start - Local date and time, e.g. 2026-10-12T10:00:00
 * @param {string} end - Local date and time
 * @param {string} timeZone - Time zone of start and end, as Exchange names it
 * @returns {Promise<Array>} One scheduleInformation per mailbox
 */
async function getSchedules(accessToken, addresses, start, end, timeZone) {
  try {
    const schedules = [];
    for (let index = 0; index < addresses.length; index += SCHEDULES_PER_REQUEST) {
      const response = await axios.post(
        `${GRAPH_API_BASE}/me/calendar/getSchedule`,
        {
          schedules: addresses.slice(index, index + SCHEDULES_PER_REQUEST),
          startTime: { dateTime: start, timeZone },
          endTime: { dateTime: end, timeZone },
          availabilityViewInterval: 15,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      schedules.push(...(response.data.value || []));
    }
    return schedules;
  } catch (error) {
    console.error('Error fetching schedules:', error.response?.data || error.message);
    throw graphError('Failed to fetch schedules', error);
  }
}

/**
 * Get the sign-in methods the signed-in user has registered
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array|null>} Methods, or null if they cannot be read
 */
async function getAuthenticationMethods(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/me/authentication/methods`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching authentication methods:', error.response?.data || error.message);
    // null and not []: "could not check" must not look like "has none"
    return null;
  }
}

/**
 * Get the devices registered to or owned by the signed-in user
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array>} Devices, or [] if they cannot be read
 */
async function getUserDevices(accessToken) {
  try {
    const config = {
      params: {
        $select: 'id,displayName,operatingSystem,operatingSystemVersion,approximateLastSignInDateTime',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
    const [registered, owned] = await Promise.all([
      getAllPages(`${GRAPH_API_BASE}/me/registeredDevices/microsoft.graph.device`, config),
      getAllPages(`${GRAPH_API_BASE}/me/ownedDevices/microsoft.graph.device`, config),
    ]);

    // Most devices appear in both lists
    const byId = new Map([...registered, ...owned].map(device => [device.id, device]));
    return [...byId.values()];
  } catch (error) {
    console.error('Error fetching user devices:', error.response?.data || error.message);
    return [];
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
    throw graphError('Failed to update user profile', error);
  }
}

/**
 * Replace the profile photo of the signed-in user
 * @param {string} accessToken - Valid access token
 * @param {Buffer} photo - Image data
 * @param {string} contentType - image/jpeg or image/png
 * @returns {Promise<void>}
 */
async function updateUserPhoto(accessToken, photo, contentType) {
  try {
    await axios.put(graphConfig.userPhoto.endpoint, photo, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Error updating user photo:', error.response?.data || error.message);
    throw graphError('Failed to update user photo', error);
  }
}

/**
 * Get the account details shown on the account page
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object>} Password change date, alternate addresses, phones and creation date
 */
async function getAccountStatus(accessToken) {
  try {
    const response = await axios.get(graphConfig.userProfile.endpoint, {
      params: {
        $select: 'lastPasswordChangeDateTime,otherMails,createdDateTime,mobilePhone,businessPhones',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching account status:', error.response?.data || error.message);
    throw graphError('Failed to fetch account status', error);
  }
}

/**
 * Get the licenses assigned to the signed-in user
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array>} License details, or [] if they cannot be read
 */
async function getUserLicenses(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/me/licenseDetails`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching user licenses:', error.response?.data || error.message);
    // Return empty array instead of throwing - licenses are optional
    return [];
  }
}

/**
 * Get the groups the signed-in user belongs to, with what is needed to tell
 * what kind of group each one is
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array>} Groups (directory roles are not included)
 */
async function getMyGroups(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/me/memberOf/microsoft.graph.group`, {
      params: {
        $select: 'id,displayName,description,mail,mailEnabled,securityEnabled,groupTypes,resourceProvisioningOptions',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching my groups:', error.response?.data || error.message);
    throw graphError('Failed to fetch groups', error);
  }
}

/**
 * Get the inbox rules of the signed-in user
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array|null>} Rules, or null if they cannot be read
 */
async function getInboxRules(accessToken) {
  try {
    return await getAllPages(`${GRAPH_API_BASE}/me/mailFolders/inbox/messageRules`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Error fetching inbox rules:', error.response?.data || error.message);
    // null and not []: "could not check" must not look like "has none"
    return null;
  }
}

/**
 * Get how much OneDrive space the signed-in user has and uses
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object|null>} Quota (total, used, remaining in bytes), or null if unknown
 */
async function getDriveQuota(accessToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/me/drive`, {
      params: {
        $select: 'quota',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.quota || null;
  } catch (error) {
    console.error('Error fetching drive quota:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get the most recent sign-ins of a user from the directory's sign-in log.
 * Users cannot read their own, so this needs an app-only token.
 * @param {string} appToken - App-only access token
 * @param {string} userId - Directory ID of the user
 * @returns {Promise<Array>} Sign-ins, newest first
 */
async function getRecentSignIns(appToken, userId) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/auditLogs/signIns`, {
      params: {
        $filter: `userId eq '${userId.replace(/'/g, "''")}'`,
        $orderby: 'createdDateTime desc',
        $top: 25,
      },
      headers: {
        Authorization: `Bearer ${appToken}`,
      },
    });
    return response.data.value || [];
  } catch (error) {
    console.error('Error fetching sign-ins:', error.response?.data || error.message);
    throw graphError('Failed to fetch sign-ins', error);
  }
}

/**
 * Get the mailbox settings of the signed-in user
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object>} mailboxSettings (time zone, language, working hours...)
 */
async function getMailboxSettings(accessToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/me/mailboxSettings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching mailbox settings:', error.response?.data || error.message);
    throw graphError('Failed to fetch mailbox settings', error);
  }
}

/**
 * Change mailbox settings of the signed-in user
 * @param {string} accessToken - Valid access token
 * @param {Object} settings - The settings to change; others are left as they are
 * @returns {Promise<void>}
 */
async function updateMailboxSettings(accessToken, settings) {
  try {
    await axios.patch(`${GRAPH_API_BASE}/me/mailboxSettings`, settings, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating mailbox settings:', error.response?.data || error.message);
    throw graphError('Failed to update mailbox settings', error);
  }
}

/**
 * Get the preferred language of the signed-in user's account
 * @param {string} accessToken - Valid access token
 * @returns {Promise<string|null>} Locale such as es-ES, or null if none is set
 */
async function getPreferredLanguage(accessToken) {
  try {
    const response = await axios.get(graphConfig.userProfile.endpoint, {
      params: {
        $select: 'preferredLanguage',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.preferredLanguage || null;
  } catch (error) {
    console.error('Error fetching preferred language:', error.response?.data || error.message);
    throw graphError('Failed to fetch preferred language', error);
  }
}

/**
 * Get the time zone of the signed-in user's mailbox
 * @param {string} accessToken - Valid access token
 * @returns {Promise<string>} Time zone name as Exchange knows it, or UTC if none is set
 */
async function getMailboxTimeZone(accessToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/me/mailboxSettings/timeZone`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.value || 'UTC';
  } catch (error) {
    console.error('Error fetching mailbox time zone:', error.response?.data || error.message);
    throw graphError('Failed to fetch mailbox settings', error);
  }
}

/**
 * Get the automatic replies (out of office) setting of the signed-in user,
 * with its dates expressed in the given time zone
 * @param {string} accessToken - Valid access token
 * @param {string} timeZone - Time zone from getMailboxTimeZone
 * @returns {Promise<Object>} automaticRepliesSetting
 */
async function getAutomaticReplies(accessToken, timeZone) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/me/mailboxSettings/automaticRepliesSetting`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: `outlook.timezone="${timeZone}"`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching automatic replies:', error.response?.data || error.message);
    throw graphError('Failed to fetch automatic replies', error);
  }
}

/**
 * Change the automatic replies (out of office) setting of the signed-in user
 * @param {string} accessToken - Valid access token
 * @param {Object} setting - automaticRepliesSetting
 * @returns {Promise<void>}
 */
async function updateAutomaticReplies(accessToken, setting) {
  try {
    await axios.patch(`${GRAPH_API_BASE}/me/mailboxSettings`, { automaticRepliesSetting: setting }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating automatic replies:', error.response?.data || error.message);
    throw graphError('Failed to update automatic replies', error);
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
    throw graphError('Failed to fetch extended user info', error);
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
    const teams = await getAllPages(`${GRAPH_API_BASE}/me/joinedTeams`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // 2. Get channels for each team
    const teamsWithChannels = await Promise.all(
      teams.map(async (team) => {
        try {
          const channels = await getAllPages(`${GRAPH_API_BASE}/teams/${team.id}/channels`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          return { ...team, channels };
        } catch (error) {
          console.error(`Error fetching channels for team ${team.id}:`, error.message);
          return { ...team, channels: [] };
        }
      })
    );

    return teamsWithChannels;
  } catch (error) {
    console.error('Error fetching joined teams:', error.response?.data || error.message);
    throw graphError('Failed to fetch teams', error);
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
    const roles = await getAllPages(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return roles.map(role => role.displayName);
  } catch (error) {
    console.error('Error fetching admin roles:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get every user in the organization together with the id of their manager
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Array>} Users sorted by name, each with a managerId (or null)
 */
async function getUsersWithManager(accessToken) {
  try {
    const users = await getAllPages(`${GRAPH_API_BASE}/users`, {
      params: {
        $select: 'id,displayName,mail,jobTitle,department',
        // One request per page instead of one manager request per user
        $expand: 'manager($select=id)',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return users
      .map(({ manager, ...user }) => ({ ...user, managerId: manager ? manager.id : null }))
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  } catch (error) {
    console.error('Error fetching users with manager:', error.response?.data || error.message);
    throw graphError('Failed to fetch users', error);
  }
}

// Fields needed to issue and check a password reset link
const RESET_USER_FIELDS = 'id,mail,userPrincipalName,otherMails,lastPasswordChangeDateTime';

/**
 * Find a user by mail address or user principal name
 * @param {string} accessToken - Valid access token
 * @param {string} email - Address to look for
 * @returns {Promise<Object|null>} The user, or null if nobody has that address
 */
async function findUserByEmail(accessToken, email) {
  try {
    // Single quotes are doubled inside an OData string literal
    const literal = email.replace(/'/g, "''");
    const response = await axios.get(`${GRAPH_API_BASE}/users`, {
      params: {
        $filter: `mail eq '${literal}' or userPrincipalName eq '${literal}'`,
        $select: RESET_USER_FIELDS,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return (response.data.value || [])[0] || null;
  } catch (error) {
    console.error('Error looking up user by email:', error.response?.data || error.message);
    throw graphError('Failed to look up user', error);
  }
}

/**
 * Get the fields of a user that a password reset link depends on
 * @param {string} accessToken - Valid access token
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} The user, or null if it no longer exists
 */
async function getUserForReset(accessToken, userId) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/users/${encodeURIComponent(userId)}`, {
      params: {
        $select: RESET_USER_FIELDS,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    console.error(`Error fetching user ${userId}:`, error.response?.data || error.message);
    throw graphError('Failed to fetch user', error);
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
    throw graphError('Failed to reset password', error);
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
  getGroupOwners,
  getOwnedGroups,
  addGroupMember,
  getGroupMembers,
  removeGroupMember,
  revokeSignInSessions,
  getCalendarPermissions,
  canOpenMailbox,
  getRooms,
  getSchedules,
  getAuthenticationMethods,
  getUserDevices,
  getAllUsers,
  getUserById,
  getPresences,
  getMyAppGrants,
  getServicePrincipal,
  getSharedDriveItems,
  getDriveItemPermissions,
  removeDriveItemPermission,
  shareCalendar,
  removeCalendarPermission,
  getUsersWithManager,
  findUserByEmail,
  getUserForReset,
  sendEmail,
  updateUserProfile,
  updateUserPhoto,
  getAccountStatus,
  getUserLicenses,
  getMyGroups,
  getInboxRules,
  getDriveQuota,
  getRecentSignIns,
  getMailboxSettings,
  updateMailboxSettings,
  getPreferredLanguage,
  getMailboxTimeZone,
  getAutomaticReplies,
  updateAutomaticReplies,
  getUserExtendedInfo,
  getJoinedTeamsAndChannels,
  getUserAdminRoles,
  resetUserPassword,
};
