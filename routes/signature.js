/**
 * Signature Route
 *
 * - GET /firma - the organization's email signature for the signed-in
 *   person, built from their profile, ready to copy into Outlook
 */

const express = require('express');
const router = express.Router();
const appConfig = require('../config/appConfig');
const { isAuthenticated } = require('../middleware/auth');
const { getUserProfile } = require('../services/graphService');
const { buildSignature } = require('../services/signature');

router.get('/firma', isAuthenticated, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.session.accessToken);
    const signature = buildSignature(profile, {
      orgName: appConfig.ORG_NAME,
      orgWeb: appConfig.ORG_WEB,
      orgAddress: appConfig.ORG_ADDRESS,
    });

    res.render('signature', {
      title: 'Mi firma de correo',
      currentPage: 'account',
      signature,
      missing: ['jobTitle', 'department'].filter(field => !profile[field]),
      phones: [...(profile.businessPhones || []), profile.mobilePhone].filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
