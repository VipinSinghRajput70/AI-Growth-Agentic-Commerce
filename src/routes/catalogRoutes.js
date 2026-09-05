/**
 * OmniAgent Commerce — Catalog Routes
 * Product catalog browsing, search, and Agent Discovery Manifest.
 */

const express = require('express');
const router = express.Router();
const catalogService = require('../services/catalogService');
const { getPolicy } = require('../services/guardrailService');

// GET /api/catalog — Get all products
router.get('/', (req, res) => {
  const products = catalogService.getAllProducts();
  res.json({ success: true, count: products.length, products });
});

// GET /api/catalog/search?q=...&max_price=...
router.get('/search', (req, res) => {
  const { q, max_price } = req.query;
  if (!q) {
    return res.status(400).json({ success: false, message: 'Query parameter "q" is required.' });
  }
  const products = catalogService.searchProducts(q, max_price ? parseFloat(max_price) : null);
  res.json({ success: true, count: products.length, products });
});

// GET /api/catalog/categories
router.get('/categories', (req, res) => {
  const categories = catalogService.getCategories();
  res.json({ success: true, categories });
});

// GET /api/catalog/product/:id
router.get('/product/:id', (req, res) => {
  const product = catalogService.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  res.json({ success: true, product });
});

// GET /api/catalog/inventory/:id
router.get('/inventory/:id', (req, res) => {
  const inventory = catalogService.checkInventory(req.params.id);
  if (!inventory) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  res.json({ success: true, inventory });
});

// GET /.well-known/agent-catalog.json — Agent Discovery Manifest
router.get('/agent-manifest', (req, res) => {
  const policy = getPolicy();
  const products = catalogService.getAllProducts();
  const categories = catalogService.getCategories();

  const manifest = {
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
  };

  res.json(manifest);
});

module.exports = router;
