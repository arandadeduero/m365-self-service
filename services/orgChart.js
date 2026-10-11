/**
 * Org Chart
 *
 * Turns the directory (every user with the id of their manager) into what the
 * org chart page draws: one tree, and the list of people left out of it.
 * Pure functions, no Graph calls.
 */

// Id of the node that stands for the organization when nobody is above everyone else
const ORG_NODE_ID = 'org';

function toPerson(user) {
  return {
    id: user.id,
    name: user.displayName || user.mail || 'Sin nombre',
    jobTitle: user.jobTitle || null,
    department: user.department || null,
    mail: user.mail || null,
  };
}

/**
 * Build the tree the page draws
 * @param {Array} users - Users as returned by getUsersWithManager
 * @param {Object} options - `rootEmail`: who is at the top; `orgName`: label of the top node when several people are
 * @returns {{nodes: Array, unplaced: Array}} `nodes` is one tree (the first has
 *   `parentId: null`); `unplaced` is everybody who does not hang from it
 */
function buildOrgChart(users, { rootEmail, orgName } = {}) {
  const byId = new Map(users.map(user => [user.id, user]));
  const reports = new Map();
  users.forEach((user) => {
    if (!byId.has(user.managerId)) return;
    if (!reports.has(user.managerId)) reports.set(user.managerId, []);
    reports.get(user.managerId).push(user);
  });

  const wanted = (rootEmail || '').toLowerCase();
  const configuredRoot = wanted ? users.find(user => (user.mail || '').toLowerCase() === wanted) : null;

  // Without a configured top, the top is whoever has people below and nobody above
  const tops = configuredRoot
    ? [configuredRoot]
    : users.filter(user => !byId.has(user.managerId) && reports.has(user.id));

  const nodes = [];
  if (tops.length > 1) {
    nodes.push({ id: ORG_NODE_ID, name: orgName || 'Organización', jobTitle: null, department: null, mail: null, parentId: null, virtual: true });
  }
  const topParentId = tops.length > 1 ? ORG_NODE_ID : null;

  // Walk down from the top. `placed` also stops a loop of managers (A reports
  // to B, B to A) from being walked forever.
  const placed = new Set();
  const queue = tops.map(user => ({ user, parentId: topParentId }));
  queue.forEach(({ user }) => placed.add(user.id));
  while (queue.length > 0) {
    const { user, parentId } = queue.shift();
    nodes.push({ ...toPerson(user), parentId });
    (reports.get(user.id) || []).forEach((report) => {
      if (placed.has(report.id)) return;
      placed.add(report.id);
      queue.push({ user: report, parentId: user.id });
    });
  }

  const unplaced = users
    .filter(user => !placed.has(user.id))
    .map(user => ({ ...toPerson(user), managerName: byId.has(user.managerId) ? toPerson(byId.get(user.managerId)).name : null }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return { nodes, unplaced };
}

module.exports = { buildOrgChart, ORG_NODE_ID };
