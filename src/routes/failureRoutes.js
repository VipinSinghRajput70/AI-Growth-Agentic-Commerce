/**
 * OmniAgent Commerce — Failure Lab Routes
 * Interactive endpoints for 4 failure scenarios.
 */

const express = require('express');
const router = express.Router();
const failureSimulator = require('../services/failureSimulator');

// POST /api/failure-lab/budget-violation
router.post('/budget-violation', (req, res) => {
  const result = failureSimulator.simulateBudgetViolation();
  res.json({ success: true, ...result });
});

// POST /api/failure-lab/timeout-duplicate
router.post('/timeout-duplicate', (req, res) => {
  const result = failureSimulator.simulateTimeoutDuplicate();
  res.json({ success: true, ...result });
});

// POST /api/failure-lab/inventory-failure
router.post('/inventory-failure', (req, res) => {
  const result = failureSimulator.simulateInventoryFailure();
  res.json({ success: true, ...result });
});

// POST /api/failure-lab/invalid-signature
router.post('/invalid-signature', (req, res) => {
  const result = failureSimulator.simulateInvalidSignature();
  res.json({ success: true, ...result });
});

// GET /api/failure-lab/scenarios — List available scenarios
router.get('/scenarios', (req, res) => {
  res.json({
    success: true,
    scenarios: [
      {
        id: 'budget-violation',
        name: 'Budget Violation',
        description: 'AI attempts ₹15,000 transaction against ₹10,000 autonomous limit.',
        endpoint: 'POST /api/failure-lab/budget-violation'
      },
      {
        id: 'timeout-duplicate',
        name: 'Razorpay Timeout & Duplicate Prevention',
        description: 'Simulates network timeout and verifies idempotency prevents duplicate orders.',
        endpoint: 'POST /api/failure-lab/timeout-duplicate'
      },
      {
        id: 'inventory-failure',
        name: 'Inventory Failure',
        description: 'Product goes out of stock during checkout. Alternative recommended.',
        endpoint: 'POST /api/failure-lab/inventory-failure'
      },
      {
        id: 'invalid-signature',
        name: 'Invalid HMAC Signature',
        description: 'Tampered payment payload sent with invalid signature. Verification fails.',
        endpoint: 'POST /api/failure-lab/invalid-signature'
      }
    ]
  });
});

module.exports = router;
