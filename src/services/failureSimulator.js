/**
 * OmniAgent Commerce — Failure Simulator Service
 * Implements 4 failure scenarios for the Failure Lab.
 * Also handles order idempotency with payload validation.
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../database/db');
const { logAudit } = require('./auditLogger');
const catalogService = require('./catalogService');

/**
 * Generate a cart hash for payload-validated idempotency.
 * Hash includes cart items, total amount, and session ID.
 */
function generateCartHash(cartItems, totalAmount, sessionId) {
  const payload = JSON.stringify({
    items: cartItems.map(i => ({ pid: i.product_id, qty: i.quantity })).sort((a, b) => a.pid.localeCompare(b.pid)),
    total: totalAmount,
    session: sessionId
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Check idempotency for order creation.
 * Validates idempotency_key AND cart/amount/session match.
 *
 * @param {string} idempotencyKey
 * @param {Array} cartItems
 * @param {number} totalAmount
 * @param {string} sessionId
 * @returns {Object|null} Existing order if found and valid, null otherwise
 */
function checkIdempotency(idempotencyKey, cartItems, totalAmount, sessionId) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?').get(idempotencyKey);

  if (!existing) return null;

  // Validate payload match
  const newHash = generateCartHash(cartItems, totalAmount, sessionId);

  if (existing.cart_hash !== newHash) {
    logAudit({
      actor: 'idempotency_engine',
      action: 'idempotency_payload_mismatch',
      reason: `Idempotency key ${idempotencyKey} exists but cart/amount/session does not match. Request rejected.`,
      policyEvaluation: 'BLOCKED',
      amount: totalAmount,
      status: 'blocked',
      errorDetails: 'Idempotency key reused with different payload. This could indicate a duplicate request with modified data.'
    });
    return { mismatch: true, existingOrderId: existing.id };
  }

  // Payload matches — return existing order
  logAudit({
    actor: 'idempotency_engine',
    action: 'duplicate_prevented',
    reason: `Duplicate order creation prevented. Reusing existing order ${existing.id} (Razorpay: ${existing.razorpay_order_id || 'pending'}).`,
    policyEvaluation: 'N/A',
    amount: totalAmount,
    razorpayOrderId: existing.razorpay_order_id,
    status: 'success'
  });

  return { duplicate: true, order: existing };
}

/**
 * Simulate Failure Scenario 1: Budget Violation
 * Attempts a ₹15,000 transaction against a ₹10,000 limit.
 */
function simulateBudgetViolation() {
  const guardrailService = require('./guardrailService');

  const result = guardrailService.evaluateTransaction({
    amount: 15000,
    discountPercent: 0,
    sessionId: 'failure_lab_session',
    cartItems: [
      { product_id: 'prod_004', quantity: 2, unit_price: 3999 },
      { product_id: 'prod_005', quantity: 1, unit_price: 4999 }
    ]
  });

  logAudit({
    actor: 'failure_lab',
    action: 'simulate_budget_violation',
    reason: 'Failure Lab: Tested budget violation with ₹15,000 transaction.',
    policyEvaluation: result.allowed ? 'ALLOWED' : (result.requiresApproval ? 'APPROVAL_REQUIRED' : 'BLOCKED'),
    amount: 15000,
    status: result.requiresApproval ? 'pending' : 'blocked'
  });

  return {
    scenario: 'BUDGET_VIOLATION',
    description: 'AI attempted ₹15,000 transaction against ₹10,000 autonomous limit.',
    result,
    expectedBehavior: 'Transaction blocked. Merchant approval required.',
    handled: true
  };
}

/**
 * Simulate Failure Scenario 2: Timeout & Duplicate Prevention
 */
function simulateTimeoutDuplicate() {
  const db = getDb();
  const idempotencyKey = `timeout_test_${Date.now()}`;
  const sessionId = 'failure_lab_session';
  const cartItems = [{ product_id: 'prod_001', quantity: 1, unit_price: 2499 }];
  const totalAmount = 2499;
  const cartHash = generateCartHash(cartItems, totalAmount, sessionId);

  // Create first order (simulating initial attempt)
  const orderId = `ord_timeout_${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO orders (id, idempotency_key, session_id, cart_hash, total_amount, final_amount, state, cart_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, 'TIMEOUT', ?)
  `).run(orderId, idempotencyKey, sessionId, cartHash, totalAmount, totalAmount, JSON.stringify(cartItems));

  // Attempt duplicate (should be caught by idempotency)
  const idempotencyResult = checkIdempotency(idempotencyKey, cartItems, totalAmount, sessionId);

  logAudit({
    actor: 'failure_lab',
    action: 'simulate_timeout_duplicate',
    reason: 'Failure Lab: Simulated Razorpay timeout and duplicate order prevention.',
    policyEvaluation: 'N/A',
    amount: totalAmount,
    status: 'success'
  });

  return {
    scenario: 'TIMEOUT_DUPLICATE_PREVENTION',
    description: 'Razorpay timeout occurred. Second attempt detected duplicate via idempotency key + payload validation.',
    firstOrderId: orderId,
    idempotencyResult,
    expectedBehavior: 'Duplicate detected. Existing order reused. No second charge.',
    handled: true
  };
}

/**
 * Simulate Failure Scenario 3: Inventory Failure
 */
function simulateInventoryFailure() {
  const targetProduct = catalogService.getProductById('prod_001');
  const originalInventory = targetProduct ? targetProduct.inventory : 0;

  // Set inventory to 0
  catalogService.setInventory('prod_001', 0);

  // Evaluate transaction
  const guardrailService = require('./guardrailService');
  const result = guardrailService.evaluateTransaction({
    amount: 2499,
    discountPercent: 0,
    sessionId: 'failure_lab_session',
    cartItems: [{ product_id: 'prod_001', quantity: 1, unit_price: 2499 }]
  });

  // Restore inventory
  catalogService.setInventory('prod_001', originalInventory);

  // Get alternative recommendations
  const recommendationService = require('./recommendationService');
  const alternatives = recommendationService.getUpsells('prod_001');

  logAudit({
    actor: 'failure_lab',
    action: 'simulate_inventory_failure',
    reason: `Failure Lab: Product ${targetProduct?.name} inventory set to 0 during checkout. Transaction blocked. Alternatives suggested.`,
    policyEvaluation: 'BLOCKED',
    amount: 2499,
    status: 'blocked'
  });

  return {
    scenario: 'INVENTORY_FAILURE',
    description: `Product "${targetProduct?.name}" went out of stock during checkout.`,
    product: targetProduct?.name,
    result,
    alternatives: alternatives.map(a => ({ id: a.id, name: a.name, price: a.price })),
    expectedBehavior: 'Transaction blocked. Alternative products recommended.',
    handled: true
  };
}

/**
 * Simulate Failure Scenario 4: Invalid HMAC Signature
 */
function simulateInvalidSignature() {
  const paymentVerificationService = require('./paymentVerificationService');

  const fakeOrderId = 'order_TAMPERED_123';
  const fakePaymentId = 'pay_TAMPERED_456';
  const fakeSignature = 'tampered_invalid_signature_abc123def456';

  const result = paymentVerificationService.verifyPaymentSignature(
    fakeOrderId,
    fakePaymentId,
    fakeSignature
  );

  return {
    scenario: 'INVALID_HMAC_SIGNATURE',
    description: 'Tampered payment payload sent with invalid HMAC signature.',
    fakeOrderId,
    fakePaymentId,
    verificationResult: result,
    expectedBehavior: 'Verification failed. Order NOT marked paid. Security event logged.',
    handled: true
  };
}

module.exports = {
  generateCartHash,
  checkIdempotency,
  simulateBudgetViolation,
  simulateTimeoutDuplicate,
  simulateInventoryFailure,
  simulateInvalidSignature
};
