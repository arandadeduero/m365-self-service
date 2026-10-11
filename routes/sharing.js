/**
 * Sharing Routes
 *
 * - GET /account/sharing - what the signed-in person's OneDrive shares with
 *   anybody outside the organization: links for anyone, and external people
 * - POST /account/sharing/:item/permissions/:permission/remove - stop one
 */

const express = require('express');
const router = express.Router();
const permissions = require('../config/permissions');
const { isAuthenticated } = require('../middleware/auth');
const { userError } = require('../middleware/errorHandler');
const { auditRequest } = require('../services/auditService');
const { getSharedDriveItems, getDriveItemPermissions, removeDriveItemPermission } = require('../services/graphService');
const { describeSharing, describePermission } = require('../services/sharing');

// Shared items whose permissions are read; beyond this the page says so
const ITEMS_MAX = 150;
const ITEM_ID = /^[A-Za-z0-9!._-]{1,128}$/;
const PERMISSION_ID = /^[A-Za-z0-9+/=_.!-]{1,512}$/;

router.get('/account/sharing', isAuthenticated, async (req, res, next) => {
  try {
    const token = req.session.accessToken;
    const listing = await getSharedDriveItems(token);
    let sharing = null;
    let partial = false;

    if (listing) {
      const items = listing.items.slice(0, ITEMS_MAX);
      partial = !listing.complete || listing.items.length > ITEMS_MAX;
      const entries = [];
      // A few at a time: one request per item
      for (let i = 0; i < items.length; i += 8) {
        entries.push(...await Promise.all(items.slice(i, i + 8).map(async item => ({ item, permissions: await getDriveItemPermissions(token, item.id) }))));
      }
      sharing = describeSharing(entries, permissions.DOMAIN);
    }

    const notice = req.session.sharingNotice || null;
    delete req.session.sharingNotice;

    res.render('sharing', {
      title: 'Qué comparto fuera',
      currentPage: 'account',
      sharing,
      partial,
      notice,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/account/sharing/:item/permissions/:permission/remove', isAuthenticated, async (req, res, next) => {
  try {
    const { item, permission } = req.params;
    if (!ITEM_ID.test(item) || !PERMISSION_ID.test(permission)) {
      throw userError(404, 'Ese acceso no existe.');
    }
    // Read again, so the audit entry can say what kind of access it was
    const current = await getDriveItemPermissions(req.session.accessToken, item);
    const share = (current || []).map(entry => describePermission(entry, permissions.DOMAIN)).find(entry => entry && entry.id === permission);
    if (!share) {
      throw userError(404, 'Ese acceso ya no existe.');
    }

    await removeDriveItemPermission(req.session.accessToken, item, permission);
    auditRequest(req, 'files.unshared', { item, kind: share.kind, with: share.emails });
    req.session.sharingNotice = share.kind === 'anyone' ? 'El enlace ya no funciona para nadie.' : `${share.who} ya no tiene acceso.`;
    res.redirect('/account/sharing');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
