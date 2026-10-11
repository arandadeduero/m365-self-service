/**
 * Admin Routes
 *
 * Pages for administrators only (users holding an Entra ID directory role):
 * - /admin/audit - The audit log
 */

const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { userError } = require('../middleware/errorHandler');
const { auditRequest, readAudit } = require('../services/auditService');

// Entries shown at most, so a busy week cannot produce an enormous page
const MAX_ENTRIES = 500;

/**
 * Allow only users that checkAdminStatus found to hold a directory role
 */
function requireAdmin(req, res, next) {
  if (res.locals.isAdmin) {
    return next();
  }
  auditRequest(req, 'permission.denied', { path: req.path, method: req.method });
  next(userError(403, 'Esta página es solo para administradores'));
}

/**
 * GET /admin/audit
 * The audit log, newest first: the last 7 days, or one day when given,
 * optionally only one kind of event or one person
 */
router.get('/admin/audit', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const filters = {
      day: String(req.query.day || ''),
      event: String(req.query.event || ''),
      actor: String(req.query.actor || '').trim().toLowerCase(),
    };

    const all = await readAudit({ day: filters.day });
    const matching = all.filter(entry =>
      (!filters.event || entry.event === filters.event) &&
      (!filters.actor || (entry.actor || '').toLowerCase().includes(filters.actor))
    );

    res.render('audit', {
      title: 'Auditoría',
      currentPage: 'audit',
      filters,
      events: [...new Set(all.map(entry => entry.event))].sort(),
      entries: matching.slice(0, MAX_ENTRIES),
      total: matching.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
