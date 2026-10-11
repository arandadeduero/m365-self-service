/**
 * Service Health Service
 *
 * Reads the incidents Microsoft currently reports for the tenant's services
 * (Teams, Exchange...), with an app-only token. The answer is the same for
 * everybody, so it is cached in memory and shared by all users.
 */

const axios = require('axios');
const { getAppToken } = require('./tokenService');

const ISSUES_ENDPOINT = 'https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/issues';

const REFRESH_MS = 5 * 60 * 1000;      // How long an answer is reused
const RETRY_MS = 60 * 60 * 1000;       // How long to wait after a failure
const TIMEOUT_MS = 3000;               // Pages wait for this call, so keep it short

let cache = { issues: [], expires: 0 };
let refreshing = null;

async function fetchIssues() {
  const accessToken = await getAppToken();
  const response = await axios.get(ISSUES_ENDPOINT, {
    params: {
      $filter: 'isResolved eq false',
      $select: 'id,title,service,classification,status,startDateTime',
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: TIMEOUT_MS,
  });

  // Advisories are frequent and rarely affect anyone; only incidents are shown
  return (response.data.value || []).filter(issue => issue.classification === 'incident');
}

/**
 * Get the open incidents
 * @returns {Promise<Array>} Never rejects: when they cannot be read (for
 *   example, the app lacks ServiceHealth.Read.All) the list is empty
 */
async function getServiceIssues() {
  if (Date.now() < cache.expires) {
    return cache.issues;
  }

  // One request at a time, however many pages are waiting for it
  if (!refreshing) {
    refreshing = fetchIssues()
      .then((issues) => {
        cache = { issues, expires: Date.now() + REFRESH_MS };
      })
      .catch((error) => {
        console.error('Error fetching service health:', error.response?.data || error.message);
        cache = { issues: [], expires: Date.now() + RETRY_MS };
      })
      .finally(() => {
        refreshing = null;
      });
  }

  await refreshing;
  return cache.issues;
}

module.exports = { getServiceIssues };
