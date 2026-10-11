/**
 * Apps Route
 *
 * - GET /account/apps - the applications that hold permissions on the
 *   signed-in person's account, and what each one may do. Read only: taking
 *   a permission back is done in Microsoft's "Mis aplicaciones".
 */

const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getMyAppGrants, getServicePrincipal } = require('../services/graphService');
const { describeAppGrants } = require('../services/appGrants');

const MY_APPS_URL = 'https://myapplications.microsoft.com/';
const DIRECTORY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/account/apps', isAuthenticated, async (req, res, next) => {
  try {
    const token = req.session.accessToken;
    const grants = await getMyAppGrants(token);
    let apps = null;

    if (grants) {
      const ids = [...new Set(grants.map(grant => grant.clientId).filter(id => DIRECTORY_ID.test(id)))];
      const principals = new Map();
      await Promise.all(ids.map(async (id) => {
        const principal = await getServicePrincipal(token, id);
        if (principal) principals.set(id, principal);
      }));
      apps = describeAppGrants(grants, principals, process.env.CLIENT_ID);
    }

    res.render('apps', {
      title: 'Aplicaciones con acceso',
      currentPage: 'account',
      apps,
      myAppsUrl: MY_APPS_URL,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
