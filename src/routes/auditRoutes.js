/**
 * OmniAgent Commerce — Audit Routes
 * Audit trail query endpoint.
 */

const express = require('express');
const router = express.Router();
const { getAuditTrail, getAuditStats } = require('../services/auditLogger');

// GET /api/audit-trail — Get audit trail with optional filters
router.get('/', (req, res) => {
  const { actor, action, status, limit } = req.query;
  const trail = getAuditTrail({
    actor,
    action,
    status,
    limit: limit ? parseInt(limit) : 100
  });
  res.json({ success: true, count: trail.length, trail });
});

// GET /api/audit-trail/stats — Get audit statistics
router.get('/stats', (req, res) => {
  const stats = getAuditStats();
  res.json({ success: true, stats });
});

module.exports = router;
