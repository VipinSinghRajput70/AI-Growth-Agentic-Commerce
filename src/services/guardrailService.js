/**
 * OmniAgent Commerce — Guardrail Service
 * Deterministic policy validation engine. FINAL AUTHORITY on all money operations.
 * The LLM cannot override or bypass this engine.
 */

const { getDb } = require('../database/db');
const { logAudit } = require('./auditLogger');

/**
 * Get current merchant policies
 */
function getPolicy() {
  const db = getDb();
  const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get('default');
  return policy;
}

/**
 * Update merchant policies
 */
function updatePolicy(updates) {
  const db = getDb();
  const allowed = [
    'max_autonomous_limit', 'max_ai_discount_percent', 'daily_spend_cap',
    'require_approval_above_limit', 'upselling_enabled', 'cross_selling_enabled'
  ];

  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(updates[key]);
    }
  }

  if (sets.length === 0) return getPolicy();

  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push('default');

  db.prepare(`UPDATE policies SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  logAudit({
    actor: 'merchant',
    action: 'update_policy',
    reason: `Policy updated: ${Object.keys(updates).join(', ')}`,
    policyEvaluation: 'N/A',
    status: 'success'
  });

  return getPolicy();
}

/**
 * Evaluate a transaction against all merchant policies.
 * This is the FINAL AUTHORITY — LLM cannot override.
 *
 * @param {Object} params
 * @param {number} params.amount - Transaction total amount
 * @param {number} params.discountPercent - Requested discount percentage
 * @param {string} params.sessionId - Customer session ID
 * @param {Array} params.cartItems - Items in the cart with { product_id, quantity, unit_price }
 * @returns {Object} { allowed, violations, adjustments, requiresApproval }
 */
function evaluateTransaction(params) {
  const policy = getPolicy();
  const violations = [];
  const adjustments = [];
  let requiresApproval = false;
  let finalDiscountPercent = params.discountPercent || 0;

  // 1. Transaction Amount Limit
  if (params.amount > policy.max_autonomous_limit) {
    if (policy.require_approval_above_limit) {
      requiresApproval = true;
      violations.push({
        rule: 'MAX_TRANSACTION_LIMIT',
        limit: policy.max_autonomous_limit,
        actual: params.amount,
        message: `Transaction ₹${params.amount} exceeds autonomous limit of ₹${policy.max_autonomous_limit}. Merchant approval required.`
      });
    }
  }

  // 2. Discount Limit — Guardrail is the FINAL AUTHORITY
  if (finalDiscountPercent > policy.max_ai_discount_percent) {
    adjustments.push({
      rule: 'MAX_AI_DISCOUNT',
      requested: finalDiscountPercent,
      allowed: policy.max_ai_discount_percent,
      message: `Requested discount ${finalDiscountPercent}% exceeds merchant policy cap of ${policy.max_ai_discount_percent}%. Counter-offered at ${policy.max_ai_discount_percent}%.`
    });
    finalDiscountPercent = policy.max_ai_discount_percent;
  }

  // 3. Daily Spend Cap
  const dailySpend = getDailySpend(params.sessionId);
  if ((dailySpend + params.amount) > policy.daily_spend_cap) {
    violations.push({
      rule: 'DAILY_SPEND_CAP',
      limit: policy.daily_spend_cap,
      currentSpend: dailySpend,
      attemptedAdd: params.amount,
      message: `Daily spend cap of ₹${policy.daily_spend_cap} would be exceeded. Current: ₹${dailySpend}, Attempted: ₹${params.amount}.`
    });
  }

  // 4. Inventory Check
  if (params.cartItems && Array.isArray(params.cartItems)) {
    const catalogService = require('./catalogService');
    for (const item of params.cartItems) {
      const inv = catalogService.checkInventory(item.product_id);
      if (!inv) {
        violations.push({
          rule: 'PRODUCT_NOT_FOUND',
          productId: item.product_id,
          message: `Product ${item.product_id} does not exist in catalog.`
        });
      } else if (!inv.inStock || inv.available < item.quantity) {
        violations.push({
          rule: 'INVENTORY_INSUFFICIENT',
          productId: item.product_id,
          productName: inv.productName,
          available: inv.available,
          requested: item.quantity,
          message: `${inv.productName}: Requested ${item.quantity}, Available ${inv.available}.`
        });
      }
    }
  }

  const hasBlockingViolations = violations.some(v =>
    !['MAX_TRANSACTION_LIMIT'].includes(v.rule) || !policy.require_approval_above_limit
  );

  const allowed = violations.filter(v => v.rule !== 'MAX_TRANSACTION_LIMIT').length === 0;

  const result = {
    allowed,
    requiresApproval,
    violations,
    adjustments,
    finalDiscountPercent,
    policy: {
      maxAutonomousLimit: policy.max_autonomous_limit,
      maxAIDiscountPercent: policy.max_ai_discount_percent,
      dailySpendCap: policy.daily_spend_cap
    }
  };

  // Log the policy evaluation
  logAudit({
    actor: 'guardrail_engine',
    action: 'policy_evaluation',
    reason: allowed
      ? (requiresApproval ? `Transaction ₹${params.amount} allowed with merchant approval required.` : `Transaction ₹${params.amount} passed all policy checks.`)
      : `Transaction ₹${params.amount} blocked: ${violations.map(v => v.rule).join(', ')}`,
    policyEvaluation: allowed ? (requiresApproval ? 'APPROVAL_REQUIRED' : 'ALLOWED') : 'BLOCKED',
    amount: params.amount,
    status: allowed ? (requiresApproval ? 'pending' : 'success') : 'blocked'
  });

  return result;
}

/**
 * Evaluate a discount request from AI Buyer.
 * The guardrail is the FINAL AUTHORITY — the LLM cannot modify the final price.
 *
 * @param {number} requestedPercent - Discount percentage requested by AI buyer
 * @param {number} productPrice - Product price
 * @returns {Object} { allowed, grantedPercent, grantedDiscount, finalPrice, reason }
 */
function evaluateDiscount(requestedPercent, productPrice) {
  const policy = getPolicy();

  if (requestedPercent <= 0) {
    return {
      allowed: true,
      grantedPercent: 0,
      grantedDiscount: 0,
      finalPrice: productPrice,
      reason: 'No discount requested.'
    };
  }

  if (requestedPercent <= policy.max_ai_discount_percent) {
    const discount = Math.round(productPrice * (requestedPercent / 100));
    return {
      allowed: true,
      grantedPercent: requestedPercent,
      grantedDiscount: discount,
      finalPrice: productPrice - discount,
      reason: `Discount of ${requestedPercent}% approved within merchant policy cap of ${policy.max_ai_discount_percent}%.`
    };
  }

  // Counter-offer at max allowed
  const grantedPercent = policy.max_ai_discount_percent;
  const discount = Math.round(productPrice * (grantedPercent / 100));

  logAudit({
    actor: 'guardrail_engine',
    action: 'discount_evaluation',
    reason: `Requested ${requestedPercent}% exceeds policy cap. Counter-offered ${grantedPercent}%.`,
    policyEvaluation: 'ADJUSTED',
    amount: productPrice,
    status: 'adjusted'
  });

  return {
    allowed: false,
    counterOffer: true,
    grantedPercent,
    grantedDiscount: discount,
    finalPrice: productPrice - discount,
    requestedPercent,
    reason: `Requested discount ${requestedPercent}% exceeds merchant policy cap of ${policy.max_ai_discount_percent}%. Maximum allowed: ${grantedPercent}%.`
  };
}

/**
 * Get daily spend for a session
 */
function getDailySpend(sessionId) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(
    'SELECT total_spent FROM daily_spend WHERE session_id = ? AND date = ?'
  ).get(sessionId, today);
  return row ? row.total_spent : 0;
}

/**
 * Update daily spend after a successful transaction
 */
function recordSpend(sessionId, amount) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const { v4: uuidv4 } = require('uuid');

  const existing = db.prepare(
    'SELECT id, total_spent FROM daily_spend WHERE session_id = ? AND date = ?'
  ).get(sessionId, today);

  if (existing) {
    db.prepare(
      'UPDATE daily_spend SET total_spent = total_spent + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(amount, existing.id);
  } else {
    db.prepare(
      'INSERT INTO daily_spend (id, session_id, date, total_spent) VALUES (?, ?, ?, ?)'
    ).run(`spend_${uuidv4().slice(0, 8)}`, sessionId, today, amount);
  }
}

module.exports = {
  getPolicy,
  updatePolicy,
  evaluateTransaction,
  evaluateDiscount,
  getDailySpend,
  recordSpend
};
