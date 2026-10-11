/**
 * Team Routes
 *
 * - GET /equipo - the people who report to the signed-in person, and the
 *   requests a person in charge can send to IT (new hire, leaver, a Teams
 *   team, an external guest)
 * - POST /equipo/solicitud/:kind - send one of those requests, from the
 *   person's own mailbox so that IT's answer comes back to them
 */

const express = require('express');
const router = express.Router();
const appConfig = require('../config/appConfig');
const REQUESTS = require('../config/teamRequests');
const { isAuthenticated } = require('../middleware/auth');
const { userError } = require('../middleware/errorHandler');
const { auditRequest } = require('../services/auditService');
const { getDirectReports, sendEmail } = require('../services/graphService');

const MAX_FIELD = 2000;

router.get('/equipo', isAuthenticated, async (req, res, next) => {
  try {
    const reports = await getDirectReports(req.session.accessToken);

    res.render('team', {
      title: 'Mi equipo',
      currentPage: 'directory',
      reports: reports && reports.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'es')),
      requests: REQUESTS,
      sent: REQUESTS[req.query.sent] ? REQUESTS[req.query.sent].title : null,
      adminEmail: appConfig.ADMIN_EMAIL,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/equipo/solicitud/:kind', isAuthenticated, async (req, res, next) => {
  try {
    const request = REQUESTS[req.params.kind];
    if (!request) {
      throw userError(404, 'Esa solicitud no existe.');
    }

    const values = request.fields.map((field) => {
      const value = String(req.body[field.name] || '').trim();
      if (field.required && !value) {
        throw userError(400, `Falta «${field.label}».`);
      }
      if (value.length > MAX_FIELD) {
        throw userError(400, `«${field.label}» es demasiado largo.`);
      }
      if (field.type === 'select' && value && !field.options.includes(value)) {
        throw userError(400, `«${field.label}» no es una opción válida.`);
      }
      return [field.label, value];
    });

    const { account } = req.session;
    const body = [
      `${account.name || account.username} (${account.username}) pide desde el portal: ${request.title}.`,
      '',
      ...values.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
    ].join('\n');

    try {
      await sendEmail(req.session.accessToken, {
        to: appConfig.ADMIN_EMAIL,
        subject: `[${appConfig.APP_NAME}] ${request.subject}`,
        body,
      });
    } catch (error) {
      if (error.graphStatus === 401) throw error;
      throw userError(502, `No se ha podido enviar la solicitud. Escribe directamente a ${appConfig.ADMIN_EMAIL}.`);
    }
    // What was asked for, not the details of the person it concerns
    auditRequest(req, request.event, { kind: req.params.kind });

    res.redirect(`/equipo?sent=${req.params.kind}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
