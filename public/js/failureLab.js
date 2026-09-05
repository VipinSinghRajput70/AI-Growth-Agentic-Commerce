/**
 * OmniAgent Commerce — Failure Lab
 * Screen 6: Interactive 4-failure scenario test center.
 */

window.FailureLab = (function() {
  const SCENARIOS = [
    {
      id: 'budget-violation',
      icon: '💰',
      iconClass: 'budget',
      title: 'Budget Violation',
      description: 'AI attempts a ₹15,000 transaction against the ₹10,000 autonomous limit. The guardrail engine should BLOCK the transaction and require merchant approval.',
      endpoint: '/api/failure-lab/budget-violation',
      expected: 'Transaction blocked → Merchant approval required → Audit event logged'
    },
    {
      id: 'timeout-duplicate',
      icon: '⏱️',
      iconClass: 'timeout',
      title: 'Razorpay Timeout & Duplicate Prevention',
      description: 'Simulates a Razorpay timeout followed by a retry. The idempotency engine should detect the duplicate and reuse the existing order.',
      endpoint: '/api/failure-lab/timeout-duplicate',
      expected: 'Timeout → Check existing order → Duplicate prevented → Safe retry with existing order'
    },
    {
      id: 'inventory-failure',
      icon: '📦',
      iconClass: 'inventory',
      title: 'Inventory Out-of-Stock',
      description: 'Product inventory drops to 0 during checkout. The system should block the transaction and recommend alternative products.',
      endpoint: '/api/failure-lab/inventory-failure',
      expected: 'Inventory = 0 → Transaction blocked → Alternative products recommended → Audit logged'
    },
    {
      id: 'invalid-signature',
      icon: '🔐',
      iconClass: 'signature',
      title: 'Invalid HMAC Signature',
      description: 'A tampered payment payload with an invalid signature is sent to the verification endpoint. The system should reject it and log a security event.',
      endpoint: '/api/failure-lab/invalid-signature',
      expected: 'Verification failed → Order NOT marked paid → Security event in audit trail'
    }
  ];

  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    render();
  }

  function render() {
    const el = document.getElementById('failureGrid');
    el.innerHTML = SCENARIOS.map(scenario => `
      <div class="failure-card" id="failure-${scenario.id}">
        <div class="failure-card-header">
          <div class="failure-icon ${scenario.iconClass}">${scenario.icon}</div>
          <div>
            <div class="failure-title">${scenario.title}</div>
          </div>
        </div>
        <div class="failure-desc">${scenario.description}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:var(--space-md)">
          <strong>Expected:</strong> ${scenario.expected}
        </div>
        <button class="btn btn-primary" id="btn-${scenario.id}" onclick="window.FailureLab.run('${scenario.id}')">
          ▶️ Run Test
        </button>
        <div class="failure-result" id="result-${scenario.id}"></div>
      </div>
    `).join('');
  }

  async function run(scenarioId) {
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) return;

    const btn = document.getElementById(`btn-${scenarioId}`);
    const resultEl = document.getElementById(`result-${scenarioId}`);

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Running...';
    resultEl.className = 'failure-result';
    resultEl.textContent = '';

    try {
      const data = await api(scenario.endpoint, { method: 'POST' });

      resultEl.className = 'failure-result visible';
      resultEl.textContent = JSON.stringify(data, null, 2);

      // Color code based on handled status
      if (data.handled) {
        showToast(`✅ ${scenario.title}: Handled gracefully!`, 'success');
        resultEl.style.borderColor = 'var(--success)';
      } else {
        showToast(`⚠️ ${scenario.title}: Check result`, 'warning');
      }

    } catch (error) {
      resultEl.className = 'failure-result visible';
      resultEl.textContent = `Error: ${error.message}`;
      resultEl.style.borderColor = 'var(--danger)';
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Run Again';
    }
  }

  return { init, run };
})();
