/**
 * Activity Route
 *
 * - GET /account/activity - what the signed-in person has done in the
 *   portal lately, read from the audit log
 */

const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { readAudit } = require('../services/auditService');
const eventLabels = require('../config/auditEvents');

const DAYS = 30;
const MAX_ENTRIES = 200;

router.get('/account/activity', isAuthenticated, async (req, res, next) => {
  try {
    const username = (req.session.account?.username || '').toLowerCase();
    const all = await readAudit({ days: DAYS });
    const mine = all.filter(entry => (entry.actor || '').toLowerCase() === username);

    res.render('my-activity', {
      title: 'Mi actividad',
      currentPage: 'account',
      days: DAYS,
      entries: mine.slice(0, MAX_ENTRIES).map(({ time, event, actor, ip, ...details }) => ({
        time,
        label: eventLabels[event] || event,
        ip,
        details: Object.keys(details).length > 0 ? JSON.stringify(details) : '',
      })),
      total: mine.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
