/**
 * Settings Store
 *
 * The lists administrators edit from the web (who may publish on the blog,
 * which shared mailboxes exist), in one JSON file in DATA_DIR. When the
 * file exists its lists replace the ones of config/local.js; the objects
 * the rest of the app reads at request time are updated in place.
 * Synchronous on purpose, like requestStore: one read-and-write per call.
 */

const fs = require('fs');
const path = require('path');
const permissions = require('../config/permissions');
const appConfig = require('../config/appConfig');

const FILE = 'settings.json';

function storeFile() {
  return path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), FILE);
}

/**
 * @returns {{blogUsers: Array<string>, sharedMailboxes: Array<string>}|null} What the file says, or null when there is none
 */
function readSettings() {
  try {
    const data = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    return {
      blogUsers: Array.isArray(data.blogUsers) ? data.blogUsers : [],
      sharedMailboxes: Array.isArray(data.sharedMailboxes) ? data.sharedMailboxes : [],
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Error reading settings:', error.message);
    return null;
  }
}

/**
 * The lists in force now: the file's, or the configuration's
 */
function currentSettings() {
  return readSettings() || {
    blogUsers: [...(permissions['/blog'] || [])],
    sharedMailboxes: [...appConfig.SHARED_MAILBOXES],
  };
}

/**
 * Make the lists of the file the ones the app uses
 */
function applySettings() {
  const settings = readSettings();
  if (!settings) return;
  permissions['/blog'] = [...settings.blogUsers];
  appConfig.SHARED_MAILBOXES = [...settings.sharedMailboxes];
}

/**
 * Save the lists and put them in force
 */
function saveSettings({ blogUsers, sharedMailboxes }) {
  const file = storeFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ blogUsers, sharedMailboxes, updatedAt: new Date().toISOString() }, null, 2));
  fs.renameSync(tmp, file);
  applySettings();
}

module.exports = { currentSettings, applySettings, saveSettings };
