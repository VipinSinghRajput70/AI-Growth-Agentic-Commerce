/**
 * OmniAgent Commerce — Input Validation Middleware
 * Validates request bodies for critical API endpoints.
 */

function validateCreateOrder(req, res, next) {
  const { cart_items, session_id } = req.body;

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'session_id is required and must be a string.'
    });
  }

  if (!cart_items || !Array.isArray(cart_items) || cart_items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'cart_items is required and must be a non-empty array.'
    });
  }

  for (const item of cart_items) {
    if (!item.product_id || !item.quantity || item.quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Each cart item must have a valid product_id and quantity >= 1.'
      });
    }
  }

  next();
}

function validateVerifyPayment(req, res, next) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are all required.'
    });
  }

  next();
}

function validatePolicyUpdate(req, res, next) {
  const { max_autonomous_limit, max_ai_discount_percent, daily_spend_cap } = req.body;

  if (max_autonomous_limit !== undefined && (typeof max_autonomous_limit !== 'number' || max_autonomous_limit < 0)) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'max_autonomous_limit must be a non-negative number.'
    });
  }

  if (max_ai_discount_percent !== undefined && (typeof max_ai_discount_percent !== 'number' || max_ai_discount_percent < 0 || max_ai_discount_percent > 100)) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'max_ai_discount_percent must be between 0 and 100.'
    });
  }

  if (daily_spend_cap !== undefined && (typeof daily_spend_cap !== 'number' || daily_spend_cap < 0)) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'daily_spend_cap must be a non-negative number.'
    });
  }

  next();
}

function validateApproval(req, res, next) {
  const { approval_id, decision } = req.body;

  if (!approval_id || typeof approval_id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'approval_id is required.'
    });
  }

  if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'decision must be APPROVED or REJECTED.'
    });
  }

  next();
}

module.exports = {
  validateCreateOrder,
  validateVerifyPayment,
  validatePolicyUpdate,
  validateApproval
};
