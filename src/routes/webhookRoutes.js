/**
 * OmniAgent Commerce — Webhook Routes
 * POST /api/webhooks/razorpay — Razorpay webhook handler with HMAC signature
 * verification and event idempotency.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const paymentVerification = require('../services/paymentVerificationService');
const { logAudit } = require('../services/auditLogger');

// POST /api/webhooks/razorpay — Handle Razorpay webhook events
// Uses raw body for signature verification
router.post('/razorpay', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = typeof req.body === 'string' ? req.body : req.body.toString('utf-8');

  // Step 1: Verify webhook signature
  if (signature) {
    const isValid = paymentVerification.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logAudit({
        actor: 'razorpay_webhook',
        action: 'webhook_signature_invalid',
        reason: 'Received webhook with invalid signature. Rejected.',
        policyEvaluation: 'N/A',
        status: 'failed',
        errorDetails: 'HMAC signature mismatch on webhook payload.'
      });
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload.' });
  }

  const eventId = event.event_id || event.id;
  const eventType = event.event;

  if (!eventId || !eventType) {
    return res.status(400).json({ success: false, message: 'Missing event_id or event type.' });
  }

  // Step 2: Check idempotency — ignore duplicate webhook events
  if (paymentVerification.isWebhookProcessed(eventId)) {
    logAudit({
      actor: 'razorpay_webhook',
      action: 'webhook_duplicate_ignored',
      reason: `Duplicate webhook event ${eventId} (${eventType}) already processed. Safely ignored.`,
      policyEvaluation: 'N/A',
      status: 'success'
    });
    return res.json({ success: true, message: 'Event already processed.' });
  }

  // Step 3: Process the event
  try {
    switch (eventType) {
      case 'payment.captured': {
        const payment = event.payload?.payment?.entity;
        if (payment) {
          handlePaymentCaptured(payment, eventId);
        }
        break;
      }

      case 'payment.failed': {
        const payment = event.payload?.payment?.entity;
        if (payment) {
          handlePaymentFailed(payment, eventId);
        }
        break;
      }

      case 'order.paid': {
        const order = event.payload?.order?.entity;
        if (order) {
          handleOrderPaid(order, eventId);
        }
        break;
      }

      default: {
        logAudit({
          actor: 'razorpay_webhook',
          action: 'webhook_unhandled_event',
          reason: `Received unhandled webhook event type: ${eventType}`,
          policyEvaluation: 'N/A',
          status: 'success'
        });
      }
    }

    // Mark event as processed
    paymentVerification.markWebhookProcessed(eventId, eventType, rawBody);

    res.json({ success: true, message: 'Webhook processed.' });
  } catch (error) {
    logAudit({
      actor: 'razorpay_webhook',
      action: 'webhook_processing_error',
      reason: `Error processing webhook event ${eventId}: ${error.message}`,
      policyEvaluation: 'N/A',
      status: 'failed',
      errorDetails: error.message
    });
    res.status(500).json({ success: false, message: 'Webhook processing error.' });
  }
});

function handlePaymentCaptured(payment, eventId) {
  const db = getDb();
  const orderId = payment.order_id;

  if (!orderId) return;

  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(orderId);
  if (!order) {
    logAudit({
      actor: 'razorpay_webhook',
      action: 'webhook_order_not_found',
      reason: `Webhook payment.captured for unknown order ${orderId}`,
      policyEvaluation: 'N/A',
      razorpayOrderId: orderId,
      status: 'failed'
    });
    return;
  }

  if (order.state === 'PAID') return; // Already paid

  // Update to PAYMENT_VERIFIED then PAID
  db.prepare(`
    UPDATE orders SET
      state = 'PAID',
      razorpay_payment_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE razorpay_order_id = ?
  `).run(payment.id, orderId);

  // Record spend
  const guardrailService = require('../services/guardrailService');
  guardrailService.recordSpend(order.session_id, order.final_amount);

  logAudit({
    actor: 'razorpay_webhook',
    action: 'payment_captured',
    reason: `Payment captured via webhook for order ${order.id}. Payment: ${payment.id}`,
    policyEvaluation: 'N/A',
    amount: order.final_amount,
    razorpayOrderId: orderId,
    status: 'success'
  });
}

function handlePaymentFailed(payment, eventId) {
  const db = getDb();
  const orderId = payment.order_id;
  if (!orderId) return;

  db.prepare(`
    UPDATE orders SET state = 'PAYMENT_FAILED', failure_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE razorpay_order_id = ? AND state != 'PAID'
  `).run(payment.error_description || 'Payment failed', orderId);

  logAudit({
    actor: 'razorpay_webhook',
    action: 'payment_failed',
    reason: `Payment failed via webhook for order ${orderId}: ${payment.error_description || 'Unknown error'}`,
    policyEvaluation: 'N/A',
    razorpayOrderId: orderId,
    status: 'failed',
    errorDetails: payment.error_description
  });
}

function handleOrderPaid(order, eventId) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(order.id);
  if (existing && existing.state !== 'PAID') {
    db.prepare(`
      UPDATE orders SET state = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE razorpay_order_id = ?
    `).run(order.id);

    logAudit({
      actor: 'razorpay_webhook',
      action: 'order_paid_webhook',
      reason: `Order marked PAID via order.paid webhook for ${order.id}`,
      policyEvaluation: 'N/A',
      razorpayOrderId: order.id,
      status: 'success'
    });
  }
}

module.exports = router;
