/**
 * OmniAgent Commerce — Approval Routes
 * Merchant approval gate for transactions exceeding limits.
 */

const express = require('express');
const router = express.Router();
const approvalService = require('../services/approvalService');
const { validateApproval } = require('../middleware/validation');

// GET /api/approvals — Get all approvals
router.get('/', (req, res) => {
  const { status } = req.query;
  const approvals = approvalService.getApprovals(status || null);
  res.json({ success: true, approvals });
});

// GET /api/approvals/pending — Get pending approvals only
router.get('/pending', (req, res) => {
  const approvals = approvalService.getPendingApprovals();
  res.json({ success: true, approvals });
});

// POST /api/approvals/decide — Approve or reject a transaction
router.post('/decide', validateApproval, (req, res, next) => {
  try {
    const { approval_id, decision } = req.body;
    const result = approvalService.processApproval(approval_id, decision);
    res.json({ success: true, result });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('already been')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

module.exports = router;
