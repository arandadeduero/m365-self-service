/**
 * Signature Route
 *
 * - GET /firma - the organization's signature generator (a page of its own,
 *   github.com/arandadeduero/firmas-correo) shown inside the portal, next to
 *   the person's own details so they can be copied into it
 */

const express = require('express');
const router = express.Router();
const appConfig = require('../config/appConfig');
const { isAuthenticated } = require('../middleware/auth');
const { getUserProfile } = require('../services/graphService');

router.get('/firma', isAuthenticated, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.session.accessToken);

    // The generator fills its fields from the URL (see its README)
    const phone = [...(profile.businessPhones || []), profile.mobilePhone].filter(Boolean)[0] || '';
    const params = new URLSearchParams();
    Object.entries({ name: profile.displayName, position: profile.jobTitle, concejalia: profile.department, email: profile.mail || profile.userPrincipalName, phone })
      .forEach(([key, value]) => { if (value) params.set(key, value); });
    const generatorUrl = appConfig.SIGNATURE_GENERATOR_URL ? `${appConfig.SIGNATURE_GENERATOR_URL}?${params}` : '';

    res.render('signature', {
      title: 'Mi firma de correo',
      currentPage: 'account',
      generatorUrl,
      details: [
        ['Nombre completo', profile.displayName],
        ['Puesto', profile.jobTitle],
        ['Concejalía o departamento', profile.department],
        ['Correo', profile.mail || profile.userPrincipalName],
        ['Teléfono', [...(profile.businessPhones || []), profile.mobilePhone].filter(Boolean).join(' · ')],
      ].filter(([, value]) => value),
      missing: ['jobTitle', 'department'].filter(field => !profile[field]),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
