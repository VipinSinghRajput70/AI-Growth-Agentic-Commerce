/**
 * OmniAgent Commerce — Merchant Growth Dashboard
 * Screen 3: Revenue metrics and AI influence analytics.
 * Clearly labeled as Demo / Simulated Analytics.
 */

window.MerchantDashboard = (function() {
  async function refresh() {
    try {
      const data = await api('/api/dashboard/metrics');
      if (data.success) {
        renderMetrics(data.metrics);
        renderOrdersByState(data.metrics.ordersByState);
        renderAIInfluence(data.metrics.aiInfluence, data.metrics.safety);
      }
    } catch (e) {
      console.error('Dashboard error:', e);
    }
  }

  function renderMetrics(metrics) {
    const el = document.getElementById('dashboardMetrics');
    el.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Total Revenue</div>
        <div class="metric-value">${formatCurrency(metrics.revenue.totalRevenue)}</div>
        <div class="metric-change positive">From ${metrics.revenue.paidOrders} paid orders</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Orders</div>
        <div class="metric-value">${metrics.revenue.totalOrders}</div>
        <div class="metric-change">${metrics.revenue.paidOrders} completed</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Order Value</div>
        <div class="metric-value">${formatCurrency(metrics.revenue.averageOrderValue)}</div>
        <div class="metric-change">Per paid order</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">AI Interactions</div>
        <div class="metric-value">${metrics.aiInfluence.aiAssistedInteractions}</div>
        <div class="metric-change positive">Commerce agent sessions</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Policy Blocks</div>
        <div class="metric-value">${metrics.safety.policyBlocked}</div>
        <div class="metric-change">Transactions blocked by guardrails</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Approval Requests</div>
        <div class="metric-value">${metrics.safety.approvalRequested}</div>
        <div class="metric-change">${metrics.safety.approvalApproved} approved</div>
      </div>
    `;
  }

  function renderOrdersByState(ordersByState) {
    const el = document.getElementById('ordersByState');
    if (!ordersByState || ordersByState.length === 0) {
      el.innerHTML = '<div class="empty-state" style="padding:var(--space-lg)"><div class="empty-state-text" style="font-size:0.8125rem">No orders yet</div></div>';
      return;
    }

    const stateColors = {
      'PAID': 'success',
      'PAYMENT_FAILED': 'danger',
      'REJECTED': 'danger',
      'APPROVAL_REQUIRED': 'warning',
      'RAZORPAY_ORDER_CREATED': 'info',
      'TIMEOUT': 'warning',
      'INVENTORY_FAILED': 'danger',
      'CANCELLED': 'danger'
    };

    el.innerHTML = ordersByState.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge badge-${stateColors[s.state] || 'info'}">${s.state}</span>
        </div>
        <div>
          <span style="font-weight:600">${s.count}</span>
          <span style="color:var(--text-tertiary);font-size:0.75rem;margin-left:8px">${formatCurrency(s.total_amount)}</span>
        </div>
      </div>
    `).join('');
  }

  function renderAIInfluence(aiInfluence, safety) {
    const el = document.getElementById('aiInfluence');
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-secondary)">🤖 AI Chat Sessions</span>
          <span style="font-weight:600">${aiInfluence.aiAssistedInteractions}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-secondary)">📈 Upsell Attempts</span>
          <span style="font-weight:600">${aiInfluence.upsellAttempts}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-secondary)">🔄 Cross-sell Attempts</span>
          <span style="font-weight:600">${aiInfluence.crossSellAttempts}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-secondary)">🛡️ Policy Blocked</span>
          <span style="font-weight:600;color:var(--danger)">${safety.policyBlocked}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0">
          <span style="color:var(--text-secondary)">✅ Approvals Granted</span>
          <span style="font-weight:600;color:var(--success)">${safety.approvalApproved}</span>
        </div>
      </div>
    `;
  }

  return { refresh };
})();
