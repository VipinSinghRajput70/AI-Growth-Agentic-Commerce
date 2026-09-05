/**
 * OmniAgent Commerce — Global Error Handler Middleware
 * Returns clean user-facing error messages. Never exposes stack traces.
 */

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Razorpay credential errors
  if (err.message && err.message.includes('Razorpay Test Keys Required')) {
    return res.status(503).json({
      success: false,
      error: 'RAZORPAY_NOT_CONFIGURED',
      message: err.message,
      action: 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.'
    });
  }

  // Gemini credential errors
  if (err.message && (err.message.includes('Gemini API Key Required') || err.message.includes('GEMINI'))) {
    return res.status(503).json({
      success: false,
      error: 'GEMINI_NOT_CONFIGURED',
      message: err.message,
      action: 'Get a FREE key at https://aistudio.google.com/app/apikey and add GEMINI_API_KEY to .env'
    });
  }

  // Validation errors
  if (err.type === 'VALIDATION_ERROR') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: err.message
    });
  }

  // Policy violations
  if (err.type === 'POLICY_VIOLATION') {
    return res.status(403).json({
      success: false,
      error: 'POLICY_VIOLATION',
      message: err.message,
      policyDetails: err.details || null
    });
  }

  // Default server error — clean message, no stack traces
  return res.status(err.statusCode || 500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Your data is safe. Please try again.'
  });
}

module.exports = errorHandler;
