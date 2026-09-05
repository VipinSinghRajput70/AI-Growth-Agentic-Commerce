/**
 * OmniAgent Commerce — Dashboard Routes
 * Merchant revenue metrics and growth analytics.
 * Labeled as Demo/Simulated Analytics where applicable.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/dashboard/metrics or /api/dashboard/stats — Revenue and growth metrics
router.get(['/metrics', '/stats'], (req, res) => {
  const db = getDb();

  // Total orders by state
  const orderStats = db.prepare(`
    SELECT state, COUNT(*) as count, COALESCE(SUM(final_amount), 0) as total_amount
    FROM orders GROUP BY state
  `).all();

  const paidOrders = orderStats.find(s => s.state === 'PAID') || { count: 0, total_amount: 0 };
  const allOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get();

  // AI-related audit events
  const aiEvents = db.prepare(`
    SELECT action, COUNT(*) as count FROM audit_logs
    WHERE actor = 'commerce_agent'
    GROUP BY action
  `).all();

  const upsellEvents = db.prepare(`
    SELECT COUNT(*) as count FROM audit_logs
    WHERE action LIKE '%upsell%' OR action LIKE '%recommend%'
  `).get();

  const crossSellEvents = db.prepare(`
    SELECT COUNT(*) as count FROM audit_logs
    WHERE action LIKE '%cross_sell%'
  `).get();

  const policyBlocked = db.prepare(`
    SELECT COUNT(*) as count FROM audit_logs WHERE policy_evaluation = 'BLOCKED'
  `).get();

  const approvalRequested = db.prepare(`
    SELECT COUNT(*) as count FROM approvals
  `).get();

  const approvalApproved = db.prepare(`
    SELECT COUNT(*) as count FROM approvals WHERE status = 'APPROVED'
  `).get();

  // Calculate average order value
  const avgOrderValue = paidOrders.count > 0
    ? Math.round(paidOrders.total_amount / paidOrders.count)
    : 0;

  res.json({
    success: true,
    label: 'Demo / Simulated Analytics',
    metrics: {
      revenue: {
        totalRevenue: paidOrders.total_amount,
        totalOrders: allOrders.count,
        paidOrders: paidOrders.count,
        averageOrderValue: avgOrderValue
      },
      aiInfluence: {
        aiAssistedInteractions: aiEvents.reduce((sum, e) => sum + e.count, 0),
        upsellAttempts: upsellEvents.count,
        crossSellAttempts: crossSellEvents.count
      },
      safety: {
        policyBlocked: policyBlocked.count,
        approvalRequested: approvalRequested.count,
        approvalApproved: approvalApproved.count
      },
      ordersByState: orderStats
    }
  });
});

module.exports = router;
