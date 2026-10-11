/**
 * Message Center Service
 *
 * What Microsoft announces to administrators (changes coming, actions to
 * take), read with the app's own token and cached for everybody. Needs the
 * application permission ServiceMessage.Read.All; without it the page says
 * the messages are unavailable.
 */

const axios = require('axios');
const { getAppToken } = require('./tokenService');

const MESSAGES_ENDPOINT = 'https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/messages';
const REFRESH_MS = 30 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

let cache = { messages: null, expires: 0 };

async function fetchMessages() {
  const response = await axios.get(MESSAGES_ENDPOINT, {
    params: {
      $top: 50,
      $orderby: 'lastModifiedDateTime desc',
      $select: 'id,title,category,severity,services,isMajorChange,actionRequiredByDateTime,lastModifiedDateTime',
    },
    headers: { Authorization: `Bearer ${await getAppToken()}` },
    timeout: TIMEOUT_MS,
  });
  return response.data.value || [];
}

/**
 * @returns {Promise<Array|null>} Messages, newest first; null when they cannot be read
 */
async function getServiceMessages() {
  if (Date.now() < cache.expires) {
    return cache.messages;
  }
  try {
    cache = { messages: await fetchMessages(), expires: Date.now() + REFRESH_MS };
  } catch (error) {
    console.error('Error fetching service messages:', error.response?.data || error.message);
    cache = { messages: null, expires: Date.now() + RETRY_MS };
  }
  return cache.messages;
}

// For tests
function resetMessageCache() {
  cache = { messages: null, expires: 0 };
}

module.exports = { getServiceMessages, resetMessageCache };
