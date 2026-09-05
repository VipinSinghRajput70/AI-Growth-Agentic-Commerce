/**
 * OmniAgent Commerce — Approval Service
 * Handles merchant approval gate for transactions exceeding autonomous limits.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { logAudit } = require('./auditLogger');

/**
 * Create a pending approval request
 */
function createApprovalRequest(orderId, amount, reason) {
  const db = getDb();
  const id = `appr_${uuidv4().slice(0, 8)}`;

  db.prepare(`
    INSERT INTO approvals (id, order_id, amount, reason, status)
    VALUES (?, ?, ?, ?, 'PENDING')
  `).run(id, orderId, amount, reason);

  // Update order state
  db.prepare(`
    UPDATE orders SET state = 'APPROVAL_REQUIRED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(orderId);

  logAudit({
    actor: 'guardrail_engine',
    action: 'approval_requested',
    reason: `Transaction ₹${amount} requires merchant approval: ${reason}`,
    policyEvaluation: 'APPROVAL_REQUIRED',
    amount,
    status: 'pending'
  });

  return { id, orderId, amount, reason, status: 'PENDING' };
}

/**
 * Process a merchant's approval decision
 */
function processApproval(approvalId, decision) {
  const db = getDb();
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);

  if (!approval) {
    throw new Error(`Approval ${approvalId} not found.`);
  }

  if (approval.status !== 'PENDING') {
    throw new Error(`Approval ${approvalId} has already been ${approval.status.toLowerCase()}.`);
  }

  // Update approval status
  db.prepare(`
    UPDATE approvals SET status = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(decision, approvalId);

  // Update order state based on decision
  const newOrderState = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  db.prepare(`
    UPDATE orders SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(newOrderState, approval.order_id);

  logAudit({
    actor: 'merchant',
    action: decision === 'APPROVED' ? 'approval_granted' : 'approval_rejected',
    reason: `Merchant ${decision.toLowerCase()} transaction ₹${approval.amount} for order ${approval.order_id}.`,
    policyEvaluation: decision,
    amount: approval.amount,
    razorpayOrderId: null,
    status: decision === 'APPROVED' ? 'success' : 'blocked'
  });

  return {
    approvalId,
    orderId: approval.order_id,
    decision,
    amount: approval.amount
  };
}

/**
 * Get all pending approval requests
 */
function getPendingApprovals() {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, o.cart_snapshot, o.final_amount
    FROM approvals a
    JOIN orders o ON a.order_id = o.id
    WHERE a.status = 'PENDING'
    ORDER BY a.created_at DESC
  `).all();
}

/**
 * Get all approvals (with optional status filter)
 */
function getApprovals(status = null) {
  const db = getDb();
  if (status) {
    return db.prepare('SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC').all(status);
  }
  return db.prepare('SELECT * FROM approvals ORDER BY created_at DESC').all();
}

module.exports = {
  createApprovalRequest,
  processApproval,
  getPendingApprovals,
  getApprovals
};
