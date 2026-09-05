/**
 * OmniAgent Commerce — AI Buyer Simulator
 * Screen 5: End-to-end autonomous AI buyer using REAL backend APIs.
 * AI Buyer NEVER receives Razorpay secrets — interacts only through backend commerce API.
 */

window.AIBuyer = (function() {
  const STEPS = [
    { id: 'discover', title: 'Discover Merchant', detail: 'GET /.well-known/agent-catalog.json' },
    { id: 'browse', title: 'Browse Catalog', detail: 'GET /api/catalog' },
    { id: 'search', title: 'Search Products', detail: 'GET /api/catalog/search?q=running&max_price=3000' },
    { id: 'inventory', title: 'Check Inventory', detail: 'GET /api/catalog/inventory/{product_id}' },
    { id: 'discount', title: 'Negotiate Discount', detail: 'POST /api/policy/check-discount' },
    { id: 'cart', title: 'Add to Cart', detail: 'POST /api/cart/add' },
    { id: 'policy', title: 'Policy Check', detail: 'POST /api/policy/check' },
    { id: 'checkout', title: 'Request Checkout', detail: 'POST /api/agent/a2a-checkout' },
    { id: 'payment', title: 'Razorpay Payment', detail: 'POST /api/razorpay/create-order (via backend)' },
    { id: 'verify', title: 'Verify & Complete', detail: 'Server-side HMAC verification' }
  ];

  let currentStep = -1;
  let isRunning = false;

  function initSteps() {
    const stepsEl = document.getElementById('buyerSteps');
    stepsEl.innerHTML = STEPS.map((step, i) => `
      <div class="buyer-step" id="buyer-step-${step.id}">
        <div class="step-number">${i + 1}</div>
        <div class="step-content">
          <div class="step-title">${step.title}</div>
          <div class="step-detail">${step.detail}</div>
        </div>
      </div>
    `).join('');
  }

  function setStep(stepId, state, detail = null) {
    const el = document.getElementById(`buyer-step-${stepId}`);
    if (!el) return;
    el.className = `buyer-step ${state}`;
    if (detail) {
      el.querySelector('.step-detail').textContent = detail;
    }
  }

  function log(text) {
    const logEl = document.getElementById('buyerLog');
    const line = document.createElement('div');
    line.style.cssText = 'padding:4px 0;border-bottom:1px solid var(--border);';
    line.innerHTML = `<span style="color:var(--text-muted)">[${new Date().toLocaleTimeString()}]</span> ${text}`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function logJson(label, data) {
    log(`<span style="color:var(--rzp-blue-light)">${label}</span>`);
    const logEl = document.getElementById('buyerLog');
    const pre = document.createElement('pre');
    pre.style.cssText = 'padding:8px;background:var(--bg-input);border-radius:4px;margin:4px 0 8px;overflow-x:auto;font-size:0.6875rem;max-height:150px;overflow-y:auto;';
    pre.textContent = JSON.stringify(data, null, 2);
    logEl.appendChild(pre);
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function start() {
    if (isRunning) return;
    isRunning = true;

    const btn = document.getElementById('startBuyerBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Running...';

    document.getElementById('buyerLog').innerHTML = '';
    initSteps();

    const buyerSession = 'ai_buyer_' + Math.random().toString(36).slice(2, 8);

    try {
      // Step 1: Discover Merchant
      setStep('discover', 'active');
      log('🤖 AI Buyer starting autonomous purchase flow...');
      await delay(600);

      const manifest = await api('/.well-known/agent-catalog.json');
      logJson('Agent Discovery Manifest', manifest);
      log(`✅ Discovered merchant: <strong>${manifest.merchant.name}</strong> (${manifest.merchant.currency})`);
      log(`📋 Capabilities: ${manifest.capabilities.join(', ')}`);
      log(`🛡️ Max autonomous transaction: ₹${manifest.policies.maxAutonomousTransaction}`);
      setStep('discover', 'complete', `Merchant: ${manifest.merchant.name} | ${manifest.catalog.total_products} products`);

      await delay(500);

      // Step 2: Browse Catalog
      setStep('browse', 'active');
      const catalog = await api('/api/catalog');
      log(`📦 Catalog loaded: ${catalog.count} products across categories`);
      logJson('Catalog (first 3)', catalog.products.slice(0, 3));
      setStep('browse', 'complete', `${catalog.count} products loaded`);

      await delay(500);

      // Step 3: Search Products
      setStep('search', 'active');
      const search = await api('/api/catalog/search?q=running&max_price=3000');
      log(`🔍 Search "running" under ₹3000: ${search.count} results`);
      logJson('Search Results', search.products);

      const selectedProduct = search.products[0];
      if (!selectedProduct) {
        throw new Error('No products found matching search criteria');
      }
      log(`✅ Selected: <strong>${selectedProduct.name}</strong> — ₹${selectedProduct.price}`);
      setStep('search', 'complete', `Selected: ${selectedProduct.name} (₹${selectedProduct.price})`);

      await delay(500);

      // Step 4: Check Inventory
      setStep('inventory', 'active');
      const inventory = await api(`/api/catalog/inventory/${selectedProduct.id}`);
      logJson('Inventory Check', inventory.inventory);
      log(`📊 Stock: ${inventory.inventory.available} units available`);
      setStep('inventory', 'complete', `${inventory.inventory.available} units in stock`);

      await delay(500);

      // Step 5: Negotiate Discount (guardrail as final authority)
      setStep('discount', 'active');
      log('💰 AI Buyer requesting 25% discount...');
      const discountCheck = await api('/api/policy/check-discount', {
        method: 'POST',
        body: { discount_percent: 25, product_price: selectedProduct.price }
      });
      logJson('Discount Evaluation (Guardrail Final Authority)', discountCheck.discount);

      if (discountCheck.discount.counterOffer) {
        log(`⚠️ 25% rejected! Counter-offered at ${discountCheck.discount.grantedPercent}% (Policy cap)`);
        log(`💵 Final price: ₹${discountCheck.discount.finalPrice} (was ₹${selectedProduct.price})`);
      } else if (discountCheck.discount.allowed) {
        log(`✅ Discount ${discountCheck.discount.grantedPercent}% approved`);
      }
      setStep('discount', 'complete', `Granted: ${discountCheck.discount.grantedPercent}% (₹${discountCheck.discount.grantedDiscount} off)`);

      await delay(500);

      // Step 6: Add to Cart
      setStep('cart', 'active');
      const cartResult = await api('/api/cart/add', {
        method: 'POST',
        body: { session_id: buyerSession, product_id: selectedProduct.id, quantity: 1 }
      });
      logJson('Cart Updated', cartResult.cart);
      log(`🛒 Added to cart: ${selectedProduct.name}`);
      setStep('cart', 'complete', `1x ${selectedProduct.name} in cart`);

      await delay(500);

      // Step 7: Policy Check
      setStep('policy', 'active');
      const policyCheck = await api('/api/policy/check', {
        method: 'POST',
        body: {
          amount: discountCheck.discount.finalPrice,
          discount_percent: discountCheck.discount.grantedPercent,
          session_id: buyerSession,
          cart_items: [{ product_id: selectedProduct.id, quantity: 1 }]
        }
      });
      logJson('Policy Evaluation', policyCheck.evaluation);
      const policyStatus = policyCheck.evaluation.allowed ? '✅ ALLOWED' : (policyCheck.evaluation.requiresApproval ? '⚠️ APPROVAL REQUIRED' : '❌ BLOCKED');
      log(`🛡️ Policy: ${policyStatus}`);
      setStep('policy', 'complete', policyStatus);

      await delay(500);

      // Step 8: A2A Checkout
      setStep('checkout', 'active');
      const checkout = await api('/api/agent/a2a-checkout', {
        method: 'POST',
        body: {
          cart_items: [{ product_id: selectedProduct.id, quantity: 1 }],
          session_id: buyerSession,
          discount_percent: discountCheck.discount.grantedPercent
        }
      });
      logJson('A2A Checkout Result', checkout.checkout);
      log(`💳 Checkout prepared: ₹${checkout.checkout.finalAmount}`);
      setStep('checkout', 'complete', `₹${checkout.checkout.finalAmount} ready for payment`);

      await delay(500);

      // Step 9 & 10: Payment (show as complete in simulation — real payment requires Razorpay keys)
      setStep('payment', 'active');
      if (AppState.razorpayConfigured) {
        log('🔐 Creating Razorpay Test Order via backend commerce API...');
        log('(AI Buyer does NOT have Razorpay credentials — requests through backend)');

        try {
          const orderData = await api('/api/razorpay/create-order', {
            method: 'POST',
            body: {
              cart_items: [{ product_id: selectedProduct.id, quantity: 1 }],
              session_id: buyerSession,
              discount_percent: discountCheck.discount.grantedPercent
            }
          });

          if (orderData.requiresApproval) {
            logJson('Approval Required', orderData);
            log('⚠️ Transaction requires merchant approval before Razorpay order creation.');
            setStep('payment', 'complete', 'Awaiting merchant approval');
            setStep('verify', 'active');
            log('🏁 AI Buyer flow paused — merchant approval needed in Safety tab.');
            setStep('verify', 'complete', 'Awaiting approval');
          } else {
            logJson('Razorpay Order Created', orderData.razorpayOrder);
            log(`✅ Razorpay Order: ${orderData.razorpayOrder.id}`);
            setStep('payment', 'complete', `Order: ${orderData.razorpayOrder.id}`);
            setStep('verify', 'active');
            log('🔐 In a real flow, Razorpay Checkout would open and payment would be verified server-side via HMAC.');
            setStep('verify', 'complete', 'Flow complete — payment would be verified server-side');
          }
        } catch (e) {
          log(`⚠️ ${e.message}`);
          setStep('payment', 'complete', 'Order creation attempted');
          setStep('verify', 'complete', 'See audit trail for details');
        }
      } else {
        log('⚠️ Razorpay not configured. Showing flow completion without real order.');
        log('Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env for real order creation.');
        setStep('payment', 'complete', 'Razorpay not configured');
        setStep('verify', 'complete', 'Configure Razorpay for full flow');
      }

      log('');
      log('🏁 <strong>AI Buyer Simulation Complete!</strong>');
      log('Check the Safety & Audit tab for the complete audit trail.');

    } catch (error) {
      const failedStep = STEPS[Math.max(0, currentStep)];
      if (failedStep) setStep(failedStep.id, 'failed', error.message);
      log(`❌ Error: ${error.message}`);
      showToast(`AI Buyer error: ${error.message}`, 'error');
    } finally {
      isRunning = false;
      btn.disabled = false;
      btn.textContent = '▶️ Start AI Buyer';

      // Clean up buyer cart
      try {
        await api('/api/cart/clear', { method: 'POST', body: { session_id: 'ai_buyer_' } });
      } catch(e) {}
    }
  }

  return { start };
})();
