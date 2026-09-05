/**
 * OmniAgent Commerce — Cart Routes
 * Cart management, bundle calculations, and checkout preparation.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const catalogService = require('../services/catalogService');
const recommendationService = require('../services/recommendationService');
const { logAudit } = require('../services/auditLogger');

// POST /api/cart/add — Add item to cart
router.post('/add', (req, res) => {
  const { session_id, product_id, quantity } = req.body;

  if (!session_id || !product_id) {
    return res.status(400).json({ success: false, message: 'session_id and product_id required.' });
  }

  const product = catalogService.getProductById(product_id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  const qty = quantity || 1;
  if (product.inventory < qty) {
    return res.status(400).json({
      success: false,
      message: `Insufficient inventory. Available: ${product.inventory}`
    });
  }

  const db = getDb();

  // Check if item already in cart
  const existing = db.prepare(
    'SELECT * FROM cart_items WHERE session_id = ? AND product_id = ?'
  ).get(session_id, product_id);

  if (existing) {
    const newQty = existing.quantity + qty;
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    const id = `cart_${uuidv4().slice(0, 8)}`;
    db.prepare(
      'INSERT INTO cart_items (id, session_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)'
    ).run(id, session_id, product_id, qty, product.price);
  }

  logAudit({
    actor: 'customer',
    action: 'add_to_cart',
    reason: `Added ${qty}x ${product.name} (₹${product.price}) to cart.`,
    policyEvaluation: 'N/A',
    amount: product.price * qty,
    status: 'success'
  });

  const cart = getCartDetails(session_id);
  res.json({ success: true, cart });
});

// POST /api/cart/remove — Remove item from cart
router.post('/remove', (req, res) => {
  const { session_id, product_id } = req.body;
  const db = getDb();

  db.prepare('DELETE FROM cart_items WHERE session_id = ? AND product_id = ?')
    .run(session_id, product_id);

  const cart = getCartDetails(session_id);
  res.json({ success: true, cart });
});

// POST /api/cart/update — Update item quantity
router.post('/update', (req, res) => {
  const { session_id, product_id, quantity } = req.body;
  const db = getDb();

  if (quantity <= 0) {
    db.prepare('DELETE FROM cart_items WHERE session_id = ? AND product_id = ?')
      .run(session_id, product_id);
  } else {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE session_id = ? AND product_id = ?')
      .run(quantity, session_id, product_id);
  }

  const cart = getCartDetails(session_id);
  res.json({ success: true, cart });
});

// GET /api/cart/:session_id — Get cart contents
router.get('/:session_id', (req, res) => {
  const cart = getCartDetails(req.params.session_id);
  res.json({ success: true, cart });
});

// POST /api/cart/clear — Clear cart
router.post('/clear', (req, res) => {
  const { session_id } = req.body;
  const db = getDb();
  db.prepare('DELETE FROM cart_items WHERE session_id = ?').run(session_id);
  res.json({ success: true, message: 'Cart cleared.' });
});

/**
 * Helper: Get full cart details with product info and recommendations
 */
function getCartDetails(sessionId) {
  const db = getDb();
  const items = db.prepare('SELECT * FROM cart_items WHERE session_id = ?').all(sessionId);

  let subtotal = 0;
  const cartItems = [];
  const productIds = [];

  for (const item of items) {
    const product = catalogService.getProductById(item.product_id);
    if (!product) continue;

    const lineTotal = item.unit_price * item.quantity;
    subtotal += lineTotal;
    productIds.push(item.product_id);

    cartItems.push({
      id: item.id,
      product_id: item.product_id,
      name: product.name,
      category: product.category,
      unit_price: item.unit_price,
      quantity: item.quantity,
      line_total: lineTotal,
      image: product.image_url,
      inStock: product.inventory >= item.quantity
    });
  }

  // Get cross-sell recommendations for cart
  const crossSells = [];
  for (const pid of productIds.slice(0, 2)) {
    const recs = recommendationService.getCrossSells(pid);
    for (const rec of recs) {
      if (!productIds.includes(rec.id) && !crossSells.find(c => c.id === rec.id)) {
        crossSells.push({
          id: rec.id,
          name: rec.name,
          price: rec.price,
          image: rec.image_url,
          reason: rec.crossSellReason
        });
      }
    }
  }

  // Get bundle suggestions
  const bundles = recommendationService.getBundleSuggestions(productIds);

  return {
    items: cartItems,
    itemCount: cartItems.length,
    subtotal,
    crossSells: crossSells.slice(0, 4),
    bundles
  };
}

module.exports = router;
