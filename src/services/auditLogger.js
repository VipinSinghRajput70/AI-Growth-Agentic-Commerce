/**
 * OmniAgent Commerce — Audit Logger Service
 * Records concise, structured audit trail events.
 * Logs decision rationale, tool calls, policy evaluations, and results.
 * NEVER stores or exposes hidden LLM chain-of-thought.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

/**
 * Log an audit event.
 * @param {Object} event
 * @param {string} event.actor - Who performed the action (e.g., 'commerce_agent', 'guardrail_engine', 'merchant', 'ai_buyer', 'razorpay_webhook')
 * @param {string} event.action - What happened (e.g., 'recommend_product', 'policy_check', 'create_order')
 * @param {string} event.reason - Concise rationale for the decision (NOT hidden CoT)
 * @param {string} [event.policyEvaluation] - Policy evaluation result ('ALLOWED', 'BLOCKED', 'APPROVAL_REQUIRED', 'N/A')
 * @param {number} [event.amount] - Monetary amount involved
 * @param {string} [event.razorpayOrderId] - Associated Razorpay Order ID
 * @param {string} event.status - Outcome status ('success', 'failed', 'blocked', 'pending')
 * @param {string} [event.errorDetails] - Error details if applicable
 */
function logAudit(event) {
  const db = getDb();
  const id = `audit_${uuidv4().slice(0, 8)}`;

  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, actor, action, reason, policy_evaluation, amount, razorpay_order_id, status, error_details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    event.actor || 'system',
    event.action || 'unknown',
    event.reason || 'No reason provided',
    event.policyEvaluation || 'N/A',
    event.amount || null,
    event.razorpayOrderId || null,
    event.status || 'unknown',
    event.errorDetails || null
  );

  console.log(`[AUDIT] ${event.action} | ${event.actor} | ${event.status} | ${event.reason}`);
  return id;
}

/**
 * Get audit trail with optional filters.
 * @param {Object} [filters]
 * @param {number} [filters.limit] - Max number of results (default 100)
 * @param {string} [filters.actor] - Filter by actor
 * @param {string} [filters.action] - Filter by action
 * @param {string} [filters.status] - Filter by status
 */
function getAuditTrail(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM audit_logs';
  const conditions = [];
  const params = [];

  if (filters.actor) {
    conditions.push('actor = ?');
    params.push(filters.actor);
  }
  if (filters.action) {
    conditions.push('action = ?');
    params.push(filters.action);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY timestamp DESC';
  query += ` LIMIT ${filters.limit || 100}`;

  return db.prepare(query).all(...params);
}

/**
 * Get audit count by status
 */
function getAuditStats() {
  const db = getDb();
  const stats = db.prepare(`
    SELECT status, COUNT(*) as count FROM audit_logs GROUP BY status
  `).all();

  const total = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get();

  return { total: total.count, byStatus: stats };
}

module.exports = { logAudit, getAuditTrail, getAuditStats };
