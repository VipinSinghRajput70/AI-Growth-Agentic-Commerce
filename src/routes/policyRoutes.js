/**
 * OmniAgent Commerce — Policy Routes
 * Merchant policy configuration and discount check endpoints.
 */

const express = require('express');
const router = express.Router();
const guardrailService = require('../services/guardrailService');
const { validatePolicyUpdate } = require('../middleware/validation');

// GET /api/policy — Get current merchant policies
router.get('/', (req, res) => {
  const policy = guardrailService.getPolicy();
  res.json({ success: true, policy });
});

// PUT /api/policy — Update merchant policies
router.put('/', validatePolicyUpdate, (req, res) => {
  const updated = guardrailService.updatePolicy(req.body);
  res.json({ success: true, policy: updated, message: 'Policy updated successfully.' });
});

// POST /api/policy/check — Check transaction against policies
router.post('/check', (req, res) => {
  const { amount, discount_percent, session_id, cart_items } = req.body;

  if (!amount || typeof amount !== 'number') {
    return res.status(400).json({ success: false, message: 'amount (number) is required.' });
  }

  const result = guardrailService.evaluateTransaction({
    amount,
    discountPercent: discount_percent || 0,
    sessionId: session_id || 'anonymous',
    cartItems: cart_items || []
  });

  res.json({ success: true, evaluation: result });
});

// POST /api/policy/check-discount — Check discount against policies
router.post('/check-discount', (req, res) => {
  const { discount_percent, product_price } = req.body;

  if (!discount_percent || !product_price) {
    return res.status(400).json({
      success: false,
      message: 'discount_percent and product_price are required.'
    });
  }

  const result = guardrailService.evaluateDiscount(discount_percent, product_price);
  res.json({ success: true, discount: result });
});

// GET /api/policy/daily-spend/:session_id
router.get('/daily-spend/:session_id', (req, res) => {
  const spent = guardrailService.getDailySpend(req.params.session_id);
  const policy = guardrailService.getPolicy();
  res.json({
    success: true,
    dailySpend: {
      spent,
      cap: policy.daily_spend_cap,
      remaining: Math.max(0, policy.daily_spend_cap - spent)
    }
  });
});

module.exports = router;
