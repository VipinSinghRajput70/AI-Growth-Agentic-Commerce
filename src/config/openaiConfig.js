/**
 * OmniAgent Commerce — Google Gemini Configuration
 * Uses FREE Gemini API tier (15 requests/minute).
 * Get your free key at: https://aistudio.google.com/app/apikey
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

function getApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

/**
 * Get the GoogleGenerativeAI instance (lazy initialization).
 */
function getGeminiInstance() {
  const key = getApiKey();
  if (!key) {
    throw new Error('Gemini API Key Required. Get a FREE key at https://aistudio.google.com/app/apikey and add GEMINI_API_KEY to your .env file.');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

/**
 * Check if Gemini credentials are configured.
 */
function checkGeminiCredentials() {
  const key = getApiKey();
  const missing = [];
  if (!key) missing.push('GEMINI_API_KEY');
  return {
    isConfigured: missing.length === 0,
    apiKey: key,
    missing
  };
}

module.exports = { getGeminiInstance, checkGeminiCredentials, getApiKey, get GEMINI_API_KEY() { return getApiKey(); } };
