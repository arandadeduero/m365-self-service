/**
 * Debug Route
 *
 * - GET /debug - what Microsoft Graph says about the signed-in person, as
 *   it comes, plus what the portal knows about the session. For looking up
 *   an attribute or checking why a page says what it says. No tokens.
 */

const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getUserExtendedInfo } = require('../services/graphService');
const { version } = require('../package.json');

router.get('/debug', isAuthenticated, async (req, res, next) => {
  try {
    const { account, expiresOn } = req.session;

    res.render('debug', {
      title: 'Datos técnicos',
      currentPage: 'debug',
      blocks: [
        ['Perfil en Microsoft Graph (/me)', await getUserExtendedInfo(req.session.accessToken)],
        ['Cuenta de la sesión', {
          username: account?.username,
          name: account?.name,
          localAccountId: account?.localAccountId,
          tenantId: account?.tenantId,
          accessTokenExpiresOn: expiresOn,
          adminRoles: res.locals.adminRoles,
        }],
        ['Portal', { version, node: process.version, environment: process.env.NODE_ENV || 'development' }],
      ],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
