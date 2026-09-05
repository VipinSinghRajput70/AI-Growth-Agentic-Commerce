/**
 * OmniAgent Commerce — Agent Routes
 * AI Commerce Agent chat endpoint and AI Buyer A2A checkout.
 * The LLM NEVER receives Razorpay credentials or directly calls Razorpay APIs.
 */

const express = require('express');
const router = express.Router();
const aiAgentService = require('../services/aiAgentService');
const catalogService = require('../services/catalogService');
const recommendationService = require('../services/recommendationService');
const guardrailService = require('../services/guardrailService');
const { logAudit } = require('../services/auditLogger');

// In-memory conversation store (per session)
const conversations = new Map();

// POST /api/agent/chat — AI Commerce Agent conversation
router.post('/chat', async (req, res, next) => {
  try {
    const { message, session_id } = req.body;

    if (!message || !session_id) {
      return res.status(400).json({
        success: false,
        message: 'message and session_id are required.'
      });
    }

    const history = conversations.get(session_id) || [];

    const result = await aiAgentService.processChat(message, history);

    // Store updated conversation
    conversations.set(session_id, result.conversationHistory);

    res.json({
      success: true,
      response: result.response,
      toolCalls: result.toolCalls
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/reset — Reset conversation
router.post('/reset', (req, res) => {
  const { session_id } = req.body;
  if (session_id) {
    conversations.delete(session_id);
  }
  res.json({ success: true, message: 'Conversation reset.' });
});

// POST /api/agent/a2a-checkout — AI Buyer checkout endpoint
// AI Buyer interacts with this INSTEAD of directly calling Razorpay
router.post('/a2a-checkout', async (req, res, next) => {
  try {
    const { cart_items, session_id, discount_percent } = req.body;

    if (!cart_items || !session_id || !Array.isArray(cart_items) || cart_items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'cart_items (array) and session_id are required.'
      });
    }

    // Step 1: Validate products and calculate total
    let subtotal = 0;
    const validatedItems = [];
    for (const item of cart_items) {
      const product = catalogService.getProductById(item.product_id);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.product_id} not found in catalog.`
        });
      }
      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;
      validatedItems.push({
        product_id: product.id,
        name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        line_total: lineTotal
      });
    }

    // Step 2: Evaluate discount through guardrail (FINAL AUTHORITY)
    let discountResult = { grantedPercent: 0, grantedDiscount: 0, finalPrice: subtotal };
    if (discount_percent && discount_percent > 0) {
      discountResult = guardrailService.evaluateDiscount(discount_percent, subtotal);
    }

    const finalAmount = subtotal - discountResult.grantedDiscount;

    // Step 3: Run full guardrail evaluation
    const policyResult = guardrailService.evaluateTransaction({
      amount: finalAmount,
      discountPercent: discountResult.grantedPercent,
      sessionId: session_id,
      cartItems: cart_items
    });

    logAudit({
      actor: 'ai_buyer',
      action: 'a2a_checkout_request',
      reason: `AI Buyer requested checkout: ${validatedItems.length} items, ₹${finalAmount}. Discount: ${discountResult.grantedPercent}%.`,
      policyEvaluation: policyResult.allowed ? (policyResult.requiresApproval ? 'APPROVAL_REQUIRED' : 'ALLOWED') : 'BLOCKED',
      amount: finalAmount,
      status: policyResult.allowed ? 'success' : 'blocked'
    });

    // Step 4: Return result (frontend or AI Buyer proceeds to payment through razorpayRoutes)
    res.json({
      success: true,
      checkout: {
        items: validatedItems,
        subtotal,
        discount: {
          requestedPercent: discount_percent || 0,
          grantedPercent: discountResult.grantedPercent,
          grantedDiscount: discountResult.grantedDiscount,
          reason: discountResult.reason
        },
        finalAmount,
        policyResult: {
          allowed: policyResult.allowed,
          requiresApproval: policyResult.requiresApproval,
          violations: policyResult.violations,
          adjustments: policyResult.adjustments
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
