/**
 * OmniAgent Commerce — Razorpay Routes
 * Order creation with guardrail checks, payment verification, and order state management.
 * Frontend payment success is NEVER trusted — server verifies via HMAC.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../database/db');
const { checkCredentials, RAZORPAY_KEY_ID } = require('../config/razorpayConfig');
const razorpayService = require('../services/razorpayService');
const guardrailService = require('../services/guardrailService');
const approvalService = require('../services/approvalService');
const paymentVerification = require('../services/paymentVerificationService');
const { generateCartHash, checkIdempotency } = require('../services/failureSimulator');
const { logAudit } = require('../services/auditLogger');
const { validateCreateOrder, validateVerifyPayment } = require('../middleware/validation');

// GET /api/razorpay/status — Check Razorpay configuration status
router.get('/status', (req, res) => {
  const creds = checkCredentials();
  res.json({
    success: true,
    razorpay: {
      configured: creds.isConfigured,
      missing: creds.missing,
      keyId: creds.isConfigured ? creds.keyId : null
    }
  });
});

// POST /api/razorpay/create-order — Create a Razorpay order with full guardrail checks
router.post('/create-order', validateCreateOrder, async (req, res, next) => {
  try {
    const { cart_items, session_id, discount_percent, idempotency_key } = req.body;

    // Step 1: Check Razorpay configuration
    const creds = checkCredentials();
    if (!creds.isConfigured) {
      return res.status(503).json({
        success: false,
        error: 'RAZORPAY_NOT_CONFIGURED',
        message: `Razorpay Test Keys Required. Missing: ${creds.missing.join(', ')}. Add them to your .env file.`
      });
    }

    // Step 2: Validate products and calculate amounts
    const catalogService = require('../services/catalogService');
    let subtotal = 0;
    const validatedItems = [];

    for (const item of cart_items) {
      const product = catalogService.getProductById(item.product_id);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.product_id} not found.`
        });
      }
      const lineTotal = product.price * (item.quantity || 1);
      subtotal += lineTotal;
      validatedItems.push({
        product_id: product.id,
        name: product.name,
        quantity: item.quantity || 1,
        unit_price: product.price,
        line_total: lineTotal
      });
    }

    // Step 3: Evaluate discount through guardrail
    let discountAmount = 0;
    let finalDiscountPercent = 0;
    if (discount_percent && discount_percent > 0) {
      const discountResult = guardrailService.evaluateDiscount(discount_percent, subtotal);
      finalDiscountPercent = discountResult.grantedPercent;
      discountAmount = discountResult.grantedDiscount;
    }

    const finalAmount = subtotal - discountAmount;

    // Step 4: Check idempotency (payload-validated)
    const idemKey = idempotency_key || `idem_${uuidv4()}`;
    const idempotencyResult = checkIdempotency(idemKey, cart_items, finalAmount, session_id);

    if (idempotencyResult) {
      if (idempotencyResult.mismatch) {
        return res.status(409).json({
          success: false,
          error: 'IDEMPOTENCY_MISMATCH',
          message: 'Idempotency key exists but cart/amount/session does not match. Request rejected.'
        });
      }
      if (idempotencyResult.duplicate) {
        return res.json({
          success: true,
          duplicate: true,
          message: 'Existing order found. No duplicate created.',
          order: idempotencyResult.order
        });
      }
    }

    // Step 5: Run guardrail policy evaluation
    const policyResult = guardrailService.evaluateTransaction({
      amount: finalAmount,
      discountPercent: finalDiscountPercent,
      sessionId: session_id,
      cartItems: cart_items
    });

    // Step 6: Create internal order record
    const db = getDb();
    const orderId = `ord_${uuidv4().slice(0, 8)}`;
    const cartHash = generateCartHash(cart_items, finalAmount, session_id);

    db.prepare(`
      INSERT INTO orders (id, idempotency_key, session_id, cart_hash, total_amount, discount_amount, final_amount, state, cart_snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, idemKey, session_id, cartHash,
      subtotal, discountAmount, finalAmount,
      'POLICY_CHECK',
      JSON.stringify(validatedItems)
    );

    // Step 7: Handle policy result
    if (!policyResult.allowed) {
      // Blocked by non-approval violations (inventory, daily cap, etc.)
      const blockingViolations = policyResult.violations.filter(v => v.rule !== 'MAX_TRANSACTION_LIMIT');
      if (blockingViolations.length > 0) {
        db.prepare('UPDATE orders SET state = ?, failure_reason = ? WHERE id = ?')
          .run(
            blockingViolations.some(v => v.rule === 'INVENTORY_INSUFFICIENT') ? 'INVENTORY_FAILED' : 'REJECTED',
            blockingViolations.map(v => v.message).join('; '),
            orderId
          );

        return res.status(403).json({
          success: false,
          error: 'POLICY_BLOCKED',
          orderId,
          violations: policyResult.violations,
          message: 'Transaction blocked by merchant policy.'
        });
      }
    }

    if (policyResult.requiresApproval) {
      // Needs merchant approval
      const approval = approvalService.createApprovalRequest(
        orderId,
        finalAmount,
        policyResult.violations.find(v => v.rule === 'MAX_TRANSACTION_LIMIT')?.message || 'Exceeds autonomous limit.'
      );

      return res.json({
        success: true,
        requiresApproval: true,
        orderId,
        approvalId: approval.id,
        amount: finalAmount,
        message: `Transaction ₹${finalAmount} exceeds autonomous limit. Merchant approval required.`,
        violations: policyResult.violations
      });
    }

    // Step 8: Create Razorpay order
    const rzpOrder = await razorpayService.createOrder(finalAmount, orderId, {
      order_id: orderId,
      session_id
    });

    // Update our order with Razorpay order ID
    db.prepare(`
      UPDATE orders SET state = 'RAZORPAY_ORDER_CREATED', razorpay_order_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rzpOrder.id, orderId);

    res.json({
      success: true,
      orderId,
      razorpayOrder: {
        id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        status: rzpOrder.status
      },
      keyId: RAZORPAY_KEY_ID,
      cart: validatedItems,
      subtotal,
      discountAmount,
      finalAmount
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/razorpay/verify-payment — Server-side HMAC verification
router.post('/verify-payment', validateVerifyPayment, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Step 1: Verify HMAC signature
    const verification = paymentVerification.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!verification.verified) {
      // Update order state to PAYMENT_FAILED
      const db = getDb();
      db.prepare(`
        UPDATE orders SET state = 'PAYMENT_FAILED', failure_reason = 'Invalid HMAC signature', updated_at = CURRENT_TIMESTAMP
        WHERE razorpay_order_id = ?
      `).run(razorpay_order_id);

      return res.status(400).json({
        success: false,
        error: 'SIGNATURE_INVALID',
        message: verification.message
      });
    }

    // Step 2: Mark order as PAID (only path to PAID)
    const result = paymentVerification.markOrderPaid(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    res.json({
      success: true,
      verified: true,
      orderId: result.orderId,
      alreadyPaid: result.alreadyPaid,
      message: result.alreadyPaid
        ? 'Payment was already verified.'
        : 'Payment verified and order marked as PAID.'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/razorpay/create-order-after-approval — Create Razorpay order for approved transaction
router.post('/create-order-after-approval', async (req, res, next) => {
  try {
    const { order_id } = req.body;
    const db = getDb();

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.state !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Order is in ${order.state} state. Only APPROVED orders can proceed.`
      });
    }

    const rzpOrder = await razorpayService.createOrder(order.final_amount, order.id, {
      order_id: order.id,
      session_id: order.session_id
    });

    db.prepare(`
      UPDATE orders SET state = 'RAZORPAY_ORDER_CREATED', razorpay_order_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rzpOrder.id, order.id);

    res.json({
      success: true,
      orderId: order.id,
      razorpayOrder: {
        id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        status: rzpOrder.status
      },
      keyId: RAZORPAY_KEY_ID,
      finalAmount: order.final_amount
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/razorpay/orders — Get all orders
router.get('/orders', (req, res) => {
  const db = getDb();
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50').all();
  res.json({ success: true, orders });
});

// GET /api/razorpay/order/:id — Get order by ID
router.get('/order/:id', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  res.json({ success: true, order });
});

module.exports = router;
