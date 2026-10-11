/**
 * Audit Service
 *
 * Keeps a record of who did what: one JSON object per line, in a file per
 * day under AUDIT_DIR (./audit by default). Passwords, tokens and message
 * contents are never written.
 */

const fs = require('fs');
const path = require('path');

function auditDir() {
  return process.env.AUDIT_DIR || path.join(__dirname, '..', 'audit');
}

/**
 * Record an event
 * @param {string} event - What happened, e.g. 'profile.update'
 * @param {Object} details - Who and what it affected
 * @returns {Promise<void>} Never rejects: a failure to write is logged, so it cannot break the action being recorded
 */
async function audit(event, details = {}) {
  const now = new Date();
  const entry = { time: now.toISOString(), event, ...details };

  try {
    const dir = auditDir();
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.appendFile(path.join(dir, `${entry.time.slice(0, 10)}.log`), JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('Could not write audit log:', error.message, entry);
  }
}

/**
 * Record an event for a request, adding the signed-in user and client address
 * @param {Object} req - Express request
 * @param {string} event - What happened
 * @param {Object} details - What it affected
 * @returns {Promise<void>}
 */
function auditRequest(req, event, details = {}) {
  return audit(event, {
    actor: req.session?.account?.username || null,
    ip: req.ip,
    ...details,
  });
}

const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.log$/;

/**
 * Read the audit log, newest entry first
 * @param {Object} options
 * @param {string} [options.day] - Only this day (YYYY-MM-DD); otherwise the most recent days
 * @param {number} [options.days] - How many of the most recent days to read
 * @returns {Promise<Array>} Entries; lines that cannot be read are skipped
 */
async function readAudit({ day, days = 7 } = {}) {
  let files;
  try {
    files = (await fs.promises.readdir(auditDir())).filter(file => DAY_FILE.test(file)).sort().reverse();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  // The day is matched against the files that exist, never used to build a path
  files = day ? files.filter(file => file === `${day}.log`) : files.slice(0, days);

  const entries = [];
  for (const file of files) {
    const lines = (await fs.promises.readFile(path.join(auditDir(), file), 'utf8')).split('\n').filter(Boolean);
    for (const line of lines.reverse()) {
      try {
        entries.push(JSON.parse(line));
      } catch (error) {
        // A line cut short by a crash; the rest of the file is still good
      }
    }
  }
  return entries;
}

module.exports = { audit, auditRequest, readAudit };
