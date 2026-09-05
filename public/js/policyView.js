/**
 * OmniAgent Commerce — Policy View
 * Screen 4A: Merchant policy configuration UI.
 * Changes are persisted and actually affect the backend guardrail engine.
 */

window.PolicyView = (function() {
  async function load() {
    try {
      const data = await api('/api/policy');
      if (data.success) {
        renderPolicyForm(data.policy);
      }
    } catch (e) {
      console.error('Policy load error:', e);
    }
  }

  function renderPolicyForm(policy) {
    const el = document.getElementById('policySettings');
    el.innerHTML = `
      <div class="policy-grid">
        <div class="policy-field">
          <label class="policy-label">Max Autonomous Limit (₹)</label>
          <input type="number" id="policyMaxLimit" class="policy-input" value="${policy.max_autonomous_limit}" min="0" step="1000">
          <span style="font-size:0.6875rem;color:var(--text-muted)">Transactions above this require merchant approval</span>
        </div>
        <div class="policy-field">
          <label class="policy-label">Max AI Discount (%)</label>
          <input type="number" id="policyMaxDiscount" class="policy-input" value="${policy.max_ai_discount_percent}" min="0" max="100" step="1">
          <span style="font-size:0.6875rem;color:var(--text-muted)">Maximum discount the AI agent can apply</span>
        </div>
        <div class="policy-field">
          <label class="policy-label">Daily Spend Cap (₹)</label>
          <input type="number" id="policyDailyCap" class="policy-input" value="${policy.daily_spend_cap}" min="0" step="5000">
          <span style="font-size:0.6875rem;color:var(--text-muted)">Maximum total spend per session per day</span>
        </div>
      </div>

      <div style="margin-top:var(--space-lg)">
        <div class="toggle-row">
          <span style="font-size:0.8125rem;font-weight:500">Require Approval Above Limit</span>
          <div class="toggle ${policy.require_approval_above_limit ? 'active' : ''}" id="toggleApproval" onclick="window.PolicyView.toggleField('toggleApproval')">
            <div class="toggle-knob"></div>
          </div>
        </div>
        <div class="toggle-row">
          <span style="font-size:0.8125rem;font-weight:500">Enable AI Upselling</span>
          <div class="toggle ${policy.upselling_enabled ? 'active' : ''}" id="toggleUpsell" onclick="window.PolicyView.toggleField('toggleUpsell')">
            <div class="toggle-knob"></div>
          </div>
        </div>
        <div class="toggle-row">
          <span style="font-size:0.8125rem;font-weight:500">Enable AI Cross-selling</span>
          <div class="toggle ${policy.cross_selling_enabled ? 'active' : ''}" id="toggleCrossSell" onclick="window.PolicyView.toggleField('toggleCrossSell')">
            <div class="toggle-knob"></div>
          </div>
        </div>
      </div>

      <button class="btn btn-primary" style="margin-top:var(--space-lg);width:100%" onclick="window.PolicyView.save()">
        💾 Save Policy Changes
      </button>
    `;
  }

  function toggleField(toggleId) {
    const el = document.getElementById(toggleId);
    el.classList.toggle('active');
  }

  async function save() {
    const updates = {
      max_autonomous_limit: parseFloat(document.getElementById('policyMaxLimit').value),
      max_ai_discount_percent: parseFloat(document.getElementById('policyMaxDiscount').value),
      daily_spend_cap: parseFloat(document.getElementById('policyDailyCap').value),
      require_approval_above_limit: document.getElementById('toggleApproval').classList.contains('active') ? 1 : 0,
      upselling_enabled: document.getElementById('toggleUpsell').classList.contains('active') ? 1 : 0,
      cross_selling_enabled: document.getElementById('toggleCrossSell').classList.contains('active') ? 1 : 0
    };

    try {
      await api('/api/policy', {
        method: 'PUT',
        body: updates
      });
      showToast('Policy updated successfully!', 'success');
    } catch (e) {
      showToast('Failed to update policy: ' + e.message, 'error');
    }
  }

  return { load, save, toggleField };
})();
