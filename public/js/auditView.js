/**
 * OmniAgent Commerce — Audit View & Approval Queue
 * Screen 4B: Live audit trail timeline and pending approvals with Approve/Reject.
 */

window.AuditView = (function() {
  async function refresh() {
    try {
      const data = await api('/api/audit-trail?limit=50');
      if (data.success) {
        renderTimeline(data.trail);
      }
    } catch (e) {
      console.error('Audit refresh error:', e);
    }
  }

  async function refreshApprovals() {
    try {
      const data = await api('/api/approvals/pending');
      if (data.success) {
        renderApprovals(data.approvals);
      }
    } catch (e) {
      console.error('Approvals refresh error:', e);
    }
  }

  function renderTimeline(trail) {
    const el = document.getElementById('auditTimeline');

    if (!trail || trail.length === 0) {
      el.innerHTML = '<div class="empty-state" style="padding:var(--space-lg)"><div class="empty-state-text" style="font-size:0.8125rem">No audit events yet. Interact with the system to generate events.</div></div>';
      return;
    }

    const statusBadge = {
      'success': 'badge-success',
      'failed': 'badge-danger',
      'blocked': 'badge-danger',
      'pending': 'badge-warning',
      'adjusted': 'badge-warning'
    };

    el.innerHTML = trail.map(event => `
      <div class="audit-event">
        <span class="audit-time">${formatTime(event.timestamp)}</span>
        <span class="audit-actor">${event.actor}</span>
        <span class="audit-reason" title="${escapeHtml(event.reason)}">${event.action}: ${event.reason}</span>
        <span class="badge ${statusBadge[event.status] || 'badge-info'}">${event.policy_evaluation !== 'N/A' ? event.policy_evaluation : event.status}</span>
      </div>
    `).join('');
  }

  function renderApprovals(approvals) {
    const el = document.getElementById('pendingApprovals');

    if (!approvals || approvals.length === 0) {
      el.innerHTML = '<div class="empty-state" style="padding:var(--space-lg)"><div class="empty-state-text" style="font-size:0.8125rem">No pending approvals</div></div>';
      return;
    }

    el.innerHTML = approvals.map(appr => {
      let cartItems = '';
      try {
        const snapshot = JSON.parse(appr.cart_snapshot || '[]');
        cartItems = snapshot.map(i => `${i.name} x${i.quantity} — ${formatCurrency(i.line_total)}`).join('<br>');
      } catch(e) { cartItems = 'Unable to load cart details'; }

      return `
        <div class="approval-card">
          <div class="approval-card-header">
            <div>
              <span class="badge badge-warning">⏳ APPROVAL REQUIRED</span>
              <div style="margin-top:4px;font-size:0.75rem;color:var(--text-tertiary)">Order: ${appr.order_id}</div>
            </div>
            <div class="approval-amount">${formatCurrency(appr.amount)}</div>
          </div>

          <div style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:8px">
            <strong>Reason:</strong> ${appr.reason}
          </div>

          <div style="font-size:0.8125rem;color:var(--text-secondary);padding:8px;background:var(--bg-input);border-radius:var(--radius-sm)">
            ${cartItems}
          </div>

          <div class="approval-actions">
            <button class="btn btn-success" onclick="window.AuditView.decide('${appr.id}', '${appr.order_id}', 'APPROVED')">
              ✅ Approve
            </button>
            <button class="btn btn-danger" onclick="window.AuditView.decide('${appr.id}', '${appr.order_id}', 'REJECTED')">
              ❌ Reject
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function decide(approvalId, orderId, decision) {
    try {
      const data = await api('/api/approvals/decide', {
        method: 'POST',
        body: { approval_id: approvalId, decision }
      });

      if (data.success) {
        showToast(`Transaction ${decision.toLowerCase()}!`, decision === 'APPROVED' ? 'success' : 'warning');
        refreshApprovals();
        refresh();

        // If approved, trigger Razorpay checkout
        if (decision === 'APPROVED' && window.Checkout) {
          window.Checkout.checkoutAfterApproval(orderId);
        }
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { refresh, refreshApprovals, decide };
})();
