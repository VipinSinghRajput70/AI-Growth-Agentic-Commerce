/**
 * OmniAgent Commerce — Payment Verification Service
 * Server-side HMAC signature verification and webhook signature validation.
 * Frontend payment success is NEVER trusted for marking orders PAID.
 */

const crypto = require('crypto');
const { RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../config/razorpayConfig');
const { getDb } = require('../database/db');
const { logAudit } = require('./auditLogger');

/**
 * Verify Razorpay payment signature (server-side HMAC SHA256).
 * This is called after Razorpay Checkout returns payment data to frontend,
 * and the frontend sends it to the backend for verification.
 *
 * @param {string} razorpayOrderId - Razorpay order ID
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @param {string} razorpaySignature - Razorpay HMAC signature
 * @returns {Object} { verified, message }
 */
function verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  const verified = expectedSignature === razorpaySignature;

  if (verified) {
    logAudit({
      actor: 'payment_verification',
      action: 'verify_signature',
      reason: `Payment signature verified for order ${razorpayOrderId}, payment ${razorpayPaymentId}.`,
      policyEvaluation: 'N/A',
      razorpayOrderId,
      status: 'success'
    });
  } else {
    logAudit({
      actor: 'payment_verification',
      action: 'verify_signature',
      reason: `INVALID signature for order ${razorpayOrderId}. Possible tampering detected.`,
      policyEvaluation: 'N/A',
      razorpayOrderId,
      status: 'failed',
      errorDetails: 'HMAC signature mismatch. Payment verification rejected.'
    });
  }

  return {
    verified,
    message: verified
      ? 'Payment verified successfully.'
      : 'Payment verification failed. Invalid signature detected.'
  };
}

/**
 * Verify Razorpay webhook signature.
 *
 * @param {string} body - Raw request body as string
 * @param {string} signature - x-razorpay-signature header
 * @returns {boolean}
 */
function verifyWebhookSignature(body, signature) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.warn('[WEBHOOK] Webhook secret not configured. Skipping signature verification.');
    return true; // Allow if webhook secret not set (test mode convenience)
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Check if a webhook event has already been processed (idempotency).
 *
 * @param {string} eventId - Razorpay webhook event ID
 * @returns {boolean} true if already processed
 */
function isWebhookProcessed(eventId) {
  const db = getDb();
  const existing = db.prepare(
    'SELECT event_id FROM processed_webhook_events WHERE event_id = ?'
  ).get(eventId);
  return !!existing;
}

/**
 * Mark a webhook event as processed.
 *
 * @param {string} eventId - Razorpay webhook event ID
 * @param {string} eventType - Event type (e.g., 'payment.captured')
 * @param {string} [payload] - Raw event payload for audit
 */
function markWebhookProcessed(eventId, eventType, payload = null) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO processed_webhook_events (event_id, event_type, payload)
    VALUES (?, ?, ?)
  `).run(eventId, eventType, payload);
}

/**
 * Update order state to PAID after successful verification.
 * This is the ONLY path to mark an order as PAID.
 *
 * @param {string} razorpayOrderId
 * @param {string} razorpayPaymentId
 * @param {string} razorpaySignature
 */
function markOrderPaid(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const db = getDb();

  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(razorpayOrderId);
  if (!order) {
    throw new Error(`Order not found for Razorpay order ${razorpayOrderId}`);
  }

  if (order.state === 'PAID') {
    return { alreadyPaid: true, orderId: order.id };
  }

  db.prepare(`
    UPDATE orders SET
      state = 'PAID',
      razorpay_payment_id = ?,
      razorpay_signature = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE razorpay_order_id = ?
  `).run(razorpayPaymentId, razorpaySignature, razorpayOrderId);

  logAudit({
    actor: 'payment_verification',
    action: 'order_paid',
    reason: `Order ${order.id} marked PAID after server-side verification.`,
    policyEvaluation: 'N/A',
    amount: order.final_amount,
    razorpayOrderId,
    status: 'success'
  });

  // Record spend
  const guardrailService = require('./guardrailService');
  guardrailService.recordSpend(order.session_id, order.final_amount);

  return { alreadyPaid: false, orderId: order.id };
}

module.exports = {
  verifyPaymentSignature,
  verifyWebhookSignature,
  isWebhookProcessed,
  markWebhookProcessed,
  markOrderPaid
};
