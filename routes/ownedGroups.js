/**
 * Owned Group Routes
 *
 * What the owner of a group can do with it:
 * - GET /groups/owned - The groups I own, and which ones need attention
 * - GET /groups/owned/:id - Members, guests and owners of one of them
 * - POST /groups/owned/:id/members - Add a member
 * - POST /groups/owned/:id/members/:userId/remove - Remove a member
 *
 * Every change is made with the owner's own token, and that they own the
 * group is checked on the server on every request.
 */

const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { userError } = require('../middleware/errorHandler');
const { auditRequest } = require('../services/auditService');
const { describeGroup, isManageable } = require('../services/accountInsights');
const {
  getOwnedGroups,
  getGroupOwners,
  getGroupMembers,
  getAllUsers,
  addGroupMember,
  removeGroupMember
} = require('../services/graphService');

const DIRECTORY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const byName = (a, b) => (a.displayName || '').localeCompare(b.displayName || '');

/**
 * Load the group named in the URL, refusing it unless the signed-in user is
 * one of its owners
 */
async function loadOwnedGroup(req) {
  const ownedGroups = await getOwnedGroups(req.session.accessToken);
  const group = ownedGroups.find(candidate => candidate.id === req.params.id);

  if (!group) {
    await auditRequest(req, 'permission.denied', { path: req.path, method: req.method });
    throw userError(403, 'Solo los propietarios del grupo pueden gestionarlo');
  }

  return group;
}

/**
 * Same, for a change of members: the group must also be one Graph can change
 */
async function loadGroupToChange(req, userId) {
  const group = await loadOwnedGroup(req);

  if (!isManageable(group)) {
    throw userError(400, 'Los miembros de este grupo se gestionan en Exchange. Pide el cambio a Informática.');
  }
  if (!DIRECTORY_ID.test(userId || '')) {
    throw userError(400, 'Elige a una persona de la lista');
  }

  return group;
}

/**
 * GET /groups/owned
 * The groups the user owns
 */
router.get('/groups/owned', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const groups = (await getOwnedGroups(accessToken)).sort(byName);
    const owners = await Promise.all(groups.map(group => getGroupOwners(accessToken, group.id)));

    res.render('owned-groups', {
      title: 'Grupos que administro',
      currentPage: 'groups',
      groups: groups.map((group, index) => ({
        ...group,
        about: describeGroup(group),
        // Exactly one: an unreadable owner list comes back empty, and that
        // must not turn into a warning
        onlyOwner: owners[index].length === 1,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /groups/owned/:id
 * Who is in one of the user's groups
 */
router.get('/groups/owned/:id', isAuthenticated, async (req, res, next) => {
  try {
    const accessToken = req.session.accessToken;
    const group = await loadOwnedGroup(req);
    const manageable = isManageable(group);

    const [members, owners, users] = await Promise.all([
      getGroupMembers(accessToken, group.id),
      getGroupOwners(accessToken, group.id),
      manageable ? getAllUsers(accessToken) : [],
    ]);
    const memberIds = new Set(members.map(member => member.id));

    res.render('owned-group', {
      title: group.displayName,
      currentPage: 'groups',
      group: { ...group, about: describeGroup(group) },
      manageable,
      members: members.map(member => ({ ...member, guest: member.userType === 'Guest' })).sort(byName),
      owners: owners.sort(byName),
      candidates: users.filter(user => !memberIds.has(user.id)),
      changed: ['added', 'removed'].includes(req.query.changed) ? req.query.changed : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /groups/owned/:id/members
 * Add a member to one of the user's groups
 */
router.post('/groups/owned/:id/members', isAuthenticated, async (req, res, next) => {
  try {
    const userId = String(req.body.userId || '');
    const group = await loadGroupToChange(req, userId);

    await addGroupMember(req.session.accessToken, group.id, userId);
    await auditRequest(req, 'group.member_added', { groupId: group.id, member: userId });

    res.redirect(`/groups/owned/${encodeURIComponent(group.id)}?changed=added`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /groups/owned/:id/members/:userId/remove
 * Remove a member from one of the user's groups
 */
router.post('/groups/owned/:id/members/:userId/remove', isAuthenticated, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const group = await loadGroupToChange(req, userId);

    await removeGroupMember(req.session.accessToken, group.id, userId);
    await auditRequest(req, 'group.member_removed', { groupId: group.id, member: userId });

    res.redirect(`/groups/owned/${encodeURIComponent(group.id)}?changed=removed`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
