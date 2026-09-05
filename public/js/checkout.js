/**
 * OmniAgent Commerce — Razorpay Checkout Integration
 * Opens Razorpay Checkout modal after server-side order creation.
 * Frontend response is NEVER trusted for marking order PAID.
 */

window.Checkout = (function() {
  async function initiate() {
    if (!AppState.razorpayConfigured) {
      showToast('Razorpay Test Keys not configured. Add them to .env and restart.', 'error');
      return;
    }

    const cart = AppState.cart;
    if (!cart.items || cart.items.length === 0) {
      showToast('Cart is empty', 'warning');
      return;
    }

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<span class="spinner"></span> Creating Order...';

    try {
      // Step 1: Create order on server (goes through guardrails)
      const cartItems = cart.items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity
      }));

      const orderData = await api('/api/razorpay/create-order', {
        method: 'POST',
        body: {
          cart_items: cartItems,
          session_id: AppState.sessionId
        }
      });

      // Handle approval required
      if (orderData.requiresApproval) {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Proceed to Razorpay Checkout';
        showToast(`Transaction ₹${orderData.amount} requires merchant approval. Check Safety & Audit tab.`, 'warning');
        switchScreen('safety');
        if (window.AuditView) window.AuditView.refreshApprovals();
        return;
      }

      // Handle duplicate order
      if (orderData.duplicate) {
        showToast('Duplicate order detected. Reusing existing order.', 'info');
        if (orderData.order.razorpay_order_id) {
          openRazorpayCheckout(orderData.order.razorpay_order_id, orderData.order.final_amount, orderData.keyId || '');
        }
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Proceed to Razorpay Checkout';
        return;
      }

      // Step 2: Open Razorpay Checkout
      openRazorpayCheckout(
        orderData.razorpayOrder.id,
        orderData.finalAmount,
        orderData.keyId
      );

    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Proceed to Razorpay Checkout';
    }
  }

  function openRazorpayCheckout(razorpayOrderId, amount, keyId) {
    const options = {
      key: keyId,
      amount: Math.round(amount * 100),
      currency: 'INR',
      name: 'OmniStore',
      description: 'OmniAgent Commerce — Test Mode Purchase',
      order_id: razorpayOrderId,
      prefill: {
        name: 'Test Customer',
        email: 'test@omnistore.com',
        contact: '9999999999'
      },
      notes: {
        platform: 'OmniAgent Commerce',
        session_id: AppState.sessionId
      },
      theme: {
        color: '#2563eb'
      },
      handler: async function(response) {
        // Step 3: Send to server for HMAC verification
        // Frontend NEVER marks order as paid
        await verifyPayment(response);
      },
      modal: {
        ondismiss: function() {
          showToast('Payment cancelled. Your cart is preserved.', 'info');
        }
      }
    };

    const rzp = new Razorpay(options);

    rzp.on('payment.failed', function(response) {
      showToast(`Payment failed: ${response.error.description}`, 'error');
    });

    rzp.open();
  }

  async function verifyPayment(response) {
    try {
      showToast('Verifying payment with server...', 'info');

      const verifyData = await api('/api/razorpay/verify-payment', {
        method: 'POST',
        body: {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        }
      });

      if (verifyData.verified) {
        showToast('✅ Payment verified and order confirmed!', 'success');

        // Clear cart
        await api('/api/cart/clear', {
          method: 'POST',
          body: { session_id: AppState.sessionId }
        });

        AppState.cart = { items: [], subtotal: 0, crossSells: [], bundles: [] };
        updateCartBadge(0);

        if (window.Cart) window.Cart.refresh();

        // Show success state
        document.getElementById('cartItemsList').innerHTML = `
          <div class="empty-state" style="padding:var(--space-2xl)">
            <div class="empty-state-icon">✅</div>
            <div class="empty-state-text" style="color:var(--success);font-size:1.125rem">Payment Successful!</div>
            <div class="empty-state-sub" style="margin-top:8px">
              Order ID: ${verifyData.orderId}<br>
              Payment verified via server-side HMAC signature check.
            </div>
            <button class="btn btn-secondary" style="margin-top:var(--space-md)" onclick="switchScreen('safety')">
              View Audit Trail →
            </button>
          </div>
        `;
        document.getElementById('cartSummary').style.display = 'none';
      } else {
        showToast('⚠️ Payment verification failed. Order NOT marked as paid.', 'error');
      }
    } catch (error) {
      showToast(`Verification error: ${error.message}`, 'error');
    }
  }

  // Checkout after approval
  async function checkoutAfterApproval(orderId) {
    try {
      const data = await api('/api/razorpay/create-order-after-approval', {
        method: 'POST',
        body: { order_id: orderId }
      });

      if (data.success) {
        openRazorpayCheckout(data.razorpayOrder.id, data.finalAmount, data.keyId);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  return { initiate, checkoutAfterApproval };
})();
