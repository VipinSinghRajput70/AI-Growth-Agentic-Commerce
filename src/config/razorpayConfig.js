/**
 * OmniAgent Commerce — Razorpay Configuration
 * Initializes Razorpay SDK with mandatory credential validation.
 * No fake/mock fallback — credentials are required.
 */

require('dotenv').config();
const Razorpay = require('razorpay');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

/**
 * Check if Razorpay credentials are properly configured.
 * Returns an object with isConfigured boolean and missing keys list.
 */
function checkCredentials() {
  const missing = [];
  if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.trim() === '') {
    missing.push('RAZORPAY_KEY_ID');
  }
  if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET.trim() === '') {
    missing.push('RAZORPAY_KEY_SECRET');
  }
  return {
    isConfigured: missing.length === 0,
    missing,
    keyId: RAZORPAY_KEY_ID || '',
    webhookSecret: RAZORPAY_WEBHOOK_SECRET
  };
}

/**
 * Get Razorpay SDK instance.
 * Throws clear error if credentials are missing.
 */
function getRazorpayInstance() {
  const creds = checkCredentials();
  if (!creds.isConfigured) {
    throw new Error(
      `Razorpay Test Keys Required. Missing: ${creds.missing.join(', ')}. ` +
      'Please add your Razorpay Test Mode credentials to .env file. ' +
      'Get keys from: https://dashboard.razorpay.com/ → Settings → API Keys → Test Mode'
    );
  }

  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });
}

module.exports = {
  checkCredentials,
  getRazorpayInstance,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET
};
