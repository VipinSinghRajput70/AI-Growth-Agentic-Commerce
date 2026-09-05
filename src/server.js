/**
 * OmniAgent Commerce — Express Server Entry Point
 * Autonomous AI-Powered Commerce Engine
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./database/db');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const catalogRoutes = require('./routes/catalogRoutes');
const agentRoutes = require('./routes/agentRoutes');
const cartRoutes = require('./routes/cartRoutes');
const razorpayRoutes = require('./routes/razorpayRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const policyRoutes = require('./routes/policyRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const auditRoutes = require('./routes/auditRoutes');
const failureRoutes = require('./routes/failureRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---

// CORS
app.use(cors());

// Webhook route needs raw body for signature verification — must be before JSON parser
app.use('/api/webhooks', webhookRoutes);

// JSON body parser for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- API Routes ---

// Health check
app.get('/api/health', (req, res) => {
  const { checkCredentials } = require('./config/razorpayConfig');
  const { checkGeminiCredentials } = require('./config/openaiConfig');

  const rzp = checkCredentials();
  const gemini = checkGeminiCredentials();

  res.json({
    success: true,
    service: 'OmniAgent Commerce',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    status: {
      razorpay: {
        configured: rzp.isConfigured,
        missing: rzp.missing
      },
      gemini: {
        configured: gemini.isConfigured,
        missing: gemini.missing
      },
      database: 'connected'
    }
  });
});

// Agent Discovery Manifest (/.well-known/agent-catalog.json)
app.get('/.well-known/agent-catalog.json', (req, res) => {
  const guardrailService = require('./services/guardrailService');
  const catalogService = require('./services/catalogService');
  const policy = guardrailService.getPolicy();
  const products = catalogService.getAllProducts();
  const categories = catalogService.getCategories();

  res.json({
    manifest_version: '1.0',
    merchant: {
      name: 'OmniStore',
      description: 'AI-powered commerce store for sports, fitness, gaming, and electronics products.',
      currency: 'INR',
      locale: 'en-IN'
    },
    capabilities: [
      'product_discovery',
      'product_search',
      'inventory_check',
      'cart_creation',
      'upselling',
      'cross_selling',
      'bundle_offers',
      'checkout'
    ],
    catalog: {
      total_products: products.length,
      categories,
      api_endpoints: {
        all_products: '/api/catalog',
        search: '/api/catalog/search?q={query}&max_price={max_price}',
        product_details: '/api/catalog/product/{product_id}',
        inventory: '/api/catalog/inventory/{product_id}'
      }
    },
    policies: {
      maxAutonomousTransaction: policy.max_autonomous_limit,
      maxAIDiscountPercent: policy.max_ai_discount_percent,
      dailySpendCap: policy.daily_spend_cap,
      requiresApprovalAboveLimit: !!policy.require_approval_above_limit
    },
    commerce: {
      cart_api: '/api/cart',
      checkout_api: '/api/razorpay/create-order',
      discount_check_api: '/api/policy/check-discount',
      a2a_checkout_api: '/api/agent/a2a-checkout'
    },
    payment: {
      provider: 'razorpay',
      mode: 'test',
      supported_methods: ['upi', 'card', 'netbanking', 'wallet']
    },
    safety: {
      guardrails: 'deterministic_policy_engine',
      approval_gate: 'merchant_approval_required_above_limit',
      audit_trail: '/api/audit-trail',
      idempotency: 'payload_validated_order_deduplication'
    }
  });
});

// Mount API routes
app.use('/api/catalog', catalogRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/audit-trail', auditRoutes);
app.use('/api/failure-lab', failureRoutes);
app.use('/api/dashboard', dashboardRoutes);

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler
app.use(errorHandler);

// Initialize database (async) then start server
async function startServer() {
  try {
    await initDb();
    console.log('[DB] Database ready.');

    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║          OmniAgent Commerce — Server Started            ║');
      console.log('║        Autonomous AI Growth & Agentic Commerce Engine    ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  🌐 App:       http://localhost:${PORT}                    ║`);
      console.log(`║  📡 API:       http://localhost:${PORT}/api/health          ║`);
      console.log(`║  🤖 Manifest:  http://localhost:${PORT}/.well-known/agent-catalog.json ║`);
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');

      // Check credentials
      const { checkCredentials } = require('./config/razorpayConfig');
      const { checkGeminiCredentials } = require('./config/openaiConfig');
      const rzp = checkCredentials();
      const gemini = checkGeminiCredentials();

      if (!rzp.isConfigured) {
        console.log('⚠️  RAZORPAY NOT CONFIGURED — Add RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET to .env');
      } else {
        console.log('✅ Razorpay Test Mode: Connected');
      }

      if (!gemini.isConfigured) {
        console.log('⚠️  GEMINI NOT CONFIGURED — Get FREE key at https://aistudio.google.com/app/apikey');
      } else {
        console.log('✅ Google Gemini: Connected (FREE tier)');
      }
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
