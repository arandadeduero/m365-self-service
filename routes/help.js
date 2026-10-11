/**
 * Help Routes
 *
 * - GET /ayuda - What Microsoft 365 is and what the organization has in it,
 *   answers to the usual questions, and a form to write to IT
 * - POST /ayuda/contacto - Send that message, with the state of the account attached
 */

const express = require('express');
const router = express.Router();
const appConfig = require('../config/appConfig');
const helpTopics = require('../config/helpTopics');
const helpGuide = require('../config/helpGuide');
const { isAuthenticated } = require('../middleware/auth');
const { userError } = require('../middleware/errorHandler');
const { auditRequest } = require('../services/auditService');
const { describeLicenses } = require('../services/accountInsights');
const { getAccountStatus, getUserLicenses, getAuthenticationMethods, sendEmail } = require('../services/graphService');

const MAX_SUBJECT = 150;
const MAX_MESSAGE = 5000;

/**
 * What IT would otherwise have to ask the user for: who they are, what they
 * have and how the account is set up. Anything unreadable is left out.
 */
async function accountSummary(req, res) {
  const accessToken = req.session.accessToken;
  const account = req.session.account || {};
  const [status, licenses, methods] = await Promise.allSettled([
    getAccountStatus(accessToken),
    getUserLicenses(accessToken),
    getAuthenticationMethods(accessToken),
  ]);

  const lines = [`Cuenta: ${account.name || ''} <${account.username}>`];

  // An empty list also means "could not be read", so it is not reported as none
  if (licenses.status === 'fulfilled' && licenses.value.length > 0) {
    const names = describeLicenses(licenses.value).licenses.map(license => license.name);
    lines.push(`Licencias: ${names.join(', ')}`);
  }
  if (status.status === 'fulfilled') {
    lines.push(`Último cambio de contraseña: ${status.value.lastPasswordChangeDateTime || 'desconocido'}`);
    lines.push(`Correo de recuperación: ${(status.value.otherMails || []).length > 0 ? 'sí' : 'no'}`);
  }
  if (methods.status === 'fulfilled' && methods.value) {
    lines.push(`Métodos de inicio de sesión registrados: ${methods.value.length}`);
  }
  const issues = res.locals.serviceIssues || [];
  if (issues.length > 0) {
    lines.push(`Incidencias de Microsoft 365 en ese momento: ${issues.map(issue => `${issue.service}: ${issue.title}`).join('; ')}`);
  }
  lines.push(`Navegador: ${req.get('user-agent') || 'desconocido'}`);

  return lines.join('\n');
}

/**
 * GET /ayuda
 * Help page
 */
router.get('/ayuda', isAuthenticated, (req, res) => {
  res.render('help', {
    title: 'Ayuda',
    currentPage: 'help',
    guide: helpGuide,
    topics: helpTopics,
    sent: req.query.sent === '1',
    adminEmail: appConfig.ADMIN_EMAIL,
  });
});

/**
 * POST /ayuda/contacto
 * Write to IT from the user's own mailbox, so the answer comes back to them
 */
router.post('/ayuda/contacto', isAuthenticated, async (req, res, next) => {
  try {
    const subject = String(req.body.subject || '').replace(/\s+/g, ' ').trim();
    const message = String(req.body.message || '').trim();
    const includeAccount = req.body.includeAccount === 'on';

    if (!subject || !message) {
      throw userError(400, 'Escribe un asunto y cuéntanos qué ocurre');
    }
    if (subject.length > MAX_SUBJECT || message.length > MAX_MESSAGE) {
      throw userError(400, 'El asunto o el mensaje son demasiado largos');
    }

    let body = message;
    if (includeAccount) {
      body += `\n\n--- Datos de la cuenta (añadidos por el portal) ---\n${await accountSummary(req, res)}`;
    }

    try {
      await sendEmail(req.session.accessToken, {
        to: appConfig.ADMIN_EMAIL,
        subject: `[m365-ayuda] ${subject}`,
        body,
      });
    } catch (error) {
      if (error.graphStatus === 401) throw error;
      throw userError(502, `No se ha podido enviar el mensaje. Escribe directamente a ${appConfig.ADMIN_EMAIL}.`);
    }
    await auditRequest(req, 'help.contact', { includeAccount });

    res.redirect('/ayuda?sent=1');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
