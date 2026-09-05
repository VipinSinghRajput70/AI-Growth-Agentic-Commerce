/**
 * OmniAgent Commerce — Cart & Checkout Management
 * Screen 2: Cart view, cross-sell suggestions, and checkout preparation.
 */

window.Cart = (function() {
  async function refresh() {
    try {
      const data = await api(`/api/cart/${AppState.sessionId}`);
      if (data.success) {
        AppState.cart = data.cart;
        renderCart(data.cart);
        updateCartBadge(data.cart.itemCount);
      }
    } catch (e) {
      console.error('Cart refresh error:', e);
    }
  }

  function renderCart(cart) {
    const listEl = document.getElementById('cartItemsList');
    const summaryEl = document.getElementById('cartSummary');
    const crossSellSection = document.getElementById('crossSellSection');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (!cart.items || cart.items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛒</div>
          <div class="empty-state-text">Your cart is empty</div>
          <div class="empty-state-sub">Use the AI Commerce assistant to discover and add products</div>
        </div>`;
      summaryEl.style.display = 'none';
      crossSellSection.style.display = 'none';
      checkoutBtn.disabled = true;
      return;
    }

    // Render cart items
    listEl.innerHTML = cart.items.map(item => `
      <div class="cart-item">
        <div style="font-size:1.5rem">${item.image || '📦'}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatCurrency(item.unit_price)} each · ${item.category}</div>
        </div>
        <div class="cart-item-qty">
          <button onclick="window.Cart.updateQty('${item.product_id}', ${item.quantity - 1})">−</button>
          <span style="min-width:24px;text-align:center;font-weight:600">${item.quantity}</span>
          <button onclick="window.Cart.updateQty('${item.product_id}', ${item.quantity + 1})">+</button>
        </div>
        <div class="cart-item-total">${formatCurrency(item.line_total)}</div>
        <button class="btn btn-danger btn-sm" onclick="window.Cart.remove('${item.product_id}')" title="Remove">✕</button>
      </div>
    `).join('');

    // Render summary
    summaryEl.style.display = 'block';
    const summaryRows = document.getElementById('cartSummaryRows');
    summaryRows.innerHTML = `
      <div class="cart-summary-row">
        <span>Subtotal (${cart.itemCount} items)</span>
        <span>${formatCurrency(cart.subtotal)}</span>
      </div>
      <div class="cart-summary-row total">
        <span>Total</span>
        <span>${formatCurrency(cart.subtotal)}</span>
      </div>
    `;

    // Policy status check
    checkPolicyStatus(cart.subtotal);

    // Cross-sell suggestions
    if (cart.crossSells && cart.crossSells.length > 0) {
      crossSellSection.style.display = 'block';
      document.getElementById('crossSellItems').innerHTML = cart.crossSells.map(cs => `
        <div class="cross-sell-item">
          <div>
            <div style="font-weight:500;font-size:0.8125rem">${cs.name}</div>
            <div style="font-size:0.75rem;color:var(--text-tertiary)">${cs.reason || ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:600;color:var(--success)">${formatCurrency(cs.price)}</span>
            <button class="btn btn-primary btn-sm" onclick="window.Cart.addItem('${cs.id}')">Add</button>
          </div>
        </div>
      `).join('');
    } else {
      crossSellSection.style.display = 'none';
    }

    // Bundle suggestions
    if (cart.bundles && cart.bundles.length > 0) {
      const bundle = cart.bundles[0];
      const bundleHtml = `
        <div style="margin-top:var(--space-md);padding:var(--space-md);background:var(--bg-elevated);border:1px solid var(--rzp-blue);border-radius:var(--radius-md)">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--rzp-blue-light);margin-bottom:4px">💰 ${bundle.name}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary)">
            Individual: ${formatCurrency(bundle.individualTotal)} → Bundle: <strong style="color:var(--success)">${formatCurrency(bundle.bundlePrice)}</strong>
            <span class="badge badge-success" style="margin-left:4px">Save ${formatCurrency(bundle.bundleDiscount)}</span>
          </div>
        </div>
      `;
      summaryRows.innerHTML += bundleHtml;
    }

    checkoutBtn.disabled = false;
  }

  async function checkPolicyStatus(amount) {
    const statusEl = document.getElementById('policyStatus');
    try {
      const data = await api('/api/policy/check', {
        method: 'POST',
        body: {
          amount,
          session_id: AppState.sessionId,
          cart_items: AppState.cart.items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity
          }))
        }
      });

      if (data.evaluation.allowed && !data.evaluation.requiresApproval) {
        statusEl.innerHTML = `<div class="badge badge-success" style="width:100%;justify-content:center;padding:8px">✅ Policy Check: ALLOWED — Transaction within limits</div>`;
      } else if (data.evaluation.requiresApproval) {
        statusEl.innerHTML = `<div class="badge badge-warning" style="width:100%;justify-content:center;padding:8px">⚠️ Exceeds autonomous limit — Merchant approval will be required</div>`;
      } else {
        const reasons = data.evaluation.violations.map(v => v.message).join('. ');
        statusEl.innerHTML = `<div class="badge badge-danger" style="width:100%;justify-content:center;padding:8px">❌ Policy: BLOCKED — ${reasons}</div>`;
      }
    } catch (e) {
      statusEl.innerHTML = '';
    }
  }

  async function addItem(productId) {
    try {
      const data = await api('/api/cart/add', {
        method: 'POST',
        body: { session_id: AppState.sessionId, product_id: productId, quantity: 1 }
      });
      if (data.success) {
        AppState.cart = data.cart;
        renderCart(data.cart);
        updateCartBadge(data.cart.itemCount);
        showToast('Item added to cart!', 'success');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function remove(productId) {
    try {
      const data = await api('/api/cart/remove', {
        method: 'POST',
        body: { session_id: AppState.sessionId, product_id: productId }
      });
      if (data.success) {
        AppState.cart = data.cart;
        renderCart(data.cart);
        updateCartBadge(data.cart.itemCount);
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function updateQty(productId, quantity) {
    try {
      const data = await api('/api/cart/update', {
        method: 'POST',
        body: { session_id: AppState.sessionId, product_id: productId, quantity }
      });
      if (data.success) {
        AppState.cart = data.cart;
        renderCart(data.cart);
        updateCartBadge(data.cart.itemCount);
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  return { refresh, addItem, remove, updateQty };
})();

// Checkout button handler
document.getElementById('checkoutBtn').addEventListener('click', () => {
  if (window.Checkout) window.Checkout.initiate();
});
