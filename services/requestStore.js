/**
 * Request Store
 *
 * Keeps the requests to join a group, in one JSON file under DATA_DIR
 * (./data by default). Every operation reads and writes the file in one
 * synchronous step, so two requests handled by this process cannot overwrite
 * each other. It is not safe for several instances sharing the directory.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function storeFile() {
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  return path.join(dir, 'group-requests.json');
}

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    // A damaged file is reported, not silently replaced by an empty one
    throw error;
  }
}

function writeAll(requests) {
  const file = storeFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write aside and rename, so a crash never leaves half a file
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(requests, null, 2));
  fs.renameSync(temp, file);
}

/**
 * Record a request to join a group
 * @param {Object} data
 * @param {string} data.groupId - Group asked for
 * @param {string} data.groupName - Its name, for display
 * @param {Object} data.requester - { id, name, email } of who asks
 * @returns {{request: Object, created: boolean}} The request, and whether it is new
 *   (false when the same person already has one pending for that group)
 */
function createRequest({ groupId, groupName, requester }) {
  const requests = readAll();
  const existing = requests.find(r =>
    r.status === 'pending' && r.groupId === groupId && r.requester.id === requester.id
  );

  if (existing) {
    return { request: existing, created: false };
  }

  const request = {
    id: crypto.randomUUID(),
    groupId,
    groupName,
    requester,
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  writeAll([...requests, request]);
  return { request, created: true };
}

/**
 * Get a request by ID
 * @returns {Object|null}
 */
function getRequest(id) {
  return readAll().find(r => r.id === id) || null;
}

/**
 * Pending requests for any of the given groups, oldest first
 * @param {Array<string>} groupIds
 * @returns {Array}
 */
function listPendingForGroups(groupIds) {
  const wanted = new Set(groupIds);
  return readAll().filter(r => r.status === 'pending' && wanted.has(r.groupId));
}

/**
 * Requests made by a user, newest first
 * @param {string} requesterId
 * @returns {Array}
 */
function listByRequester(requesterId) {
  return readAll().filter(r => r.requester.id === requesterId).reverse();
}

/**
 * Close a pending request
 * @param {string} id - Request ID
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} resolvedBy - Who decided
 * @returns {Object|null} The updated request, or null if it was not pending
 */
function resolveRequest(id, status, resolvedBy) {
  const requests = readAll();
  const request = requests.find(r => r.id === id);

  if (!request || request.status !== 'pending') {
    return null;
  }

  Object.assign(request, { status, resolvedBy, resolvedAt: new Date().toISOString() });
  writeAll(requests);
  return request;
}

module.exports = {
  createRequest,
  getRequest,
  listPendingForGroups,
  listByRequester,
  resolveRequest,
};
