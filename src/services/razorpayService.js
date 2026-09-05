/**
 * OmniAgent Commerce — Razorpay Service
 * Wraps Razorpay APIs for order creation and payment fetching.
 * AI Buyer/LLM NEVER receives Razorpay secret credentials or calls this directly.
 */

const { getRazorpayInstance, checkCredentials } = require('../config/razorpayConfig');
const { logAudit } = require('./auditLogger');

/**
 * Create a Razorpay order.
 * @param {number} amount - Amount in INR (will be converted to paise)
 * @param {string} receipt - Unique receipt/order ID
 * @param {Object} [notes] - Additional notes for the order
 * @returns {Object} Razorpay order object
 */
async function createOrder(amount, receipt, notes = {}) {
  const rzp = getRazorpayInstance();

  const orderOptions = {
    amount: Math.round(amount * 100), // Convert to paise
    currency: 'INR',
    receipt,
    notes: {
      ...notes,
      platform: 'OmniAgent Commerce',
      mode: 'test'
    }
  };

  try {
    const order = await rzp.orders.create(orderOptions);

    logAudit({
      actor: 'razorpay_service',
      action: 'create_order',
      reason: `Razorpay order created: ${order.id} for ₹${amount}`,
      policyEvaluation: 'N/A',
      amount,
      razorpayOrderId: order.id,
      status: 'success'
    });

    return order;
  } catch (error) {
    logAudit({
      actor: 'razorpay_service',
      action: 'create_order',
      reason: `Failed to create Razorpay order for ₹${amount}`,
      policyEvaluation: 'N/A',
      amount,
      status: 'failed',
      errorDetails: error.message
    });
    throw error;
  }
}

/**
 * Fetch a payment by payment ID.
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Object} Payment details
 */
async function fetchPayment(paymentId) {
  const rzp = getRazorpayInstance();

  try {
    const payment = await rzp.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    logAudit({
      actor: 'razorpay_service',
      action: 'fetch_payment',
      reason: `Failed to fetch payment ${paymentId}`,
      policyEvaluation: 'N/A',
      status: 'failed',
      errorDetails: error.message
    });
    throw error;
  }
}

/**
 * Fetch an order by order ID.
 * @param {string} orderId - Razorpay order ID
 * @returns {Object} Order details
 */
async function fetchOrder(orderId) {
  const rzp = getRazorpayInstance();

  try {
    const order = await rzp.orders.fetch(orderId);
    return order;
  } catch (error) {
    logAudit({
      actor: 'razorpay_service',
      action: 'fetch_order',
      reason: `Failed to fetch order ${orderId}`,
      policyEvaluation: 'N/A',
      status: 'failed',
      errorDetails: error.message
    });
    throw error;
  }
}

/**
 * Check if Razorpay is configured
 */
function isConfigured() {
  return checkCredentials();
}

module.exports = {
  createOrder,
  fetchPayment,
  fetchOrder,
  isConfigured
};
