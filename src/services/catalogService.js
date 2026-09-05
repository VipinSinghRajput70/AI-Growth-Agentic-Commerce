/**
 * OmniAgent Commerce — Catalog Service
 * Product catalog lookup, search, inventory management.
 */

const { getDb } = require('../database/db');

/**
 * Get all products from catalog
 */
function getAllProducts() {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products ORDER BY category, name').all();
  return products.map(parseProductRow);
}

/**
 * Get a product by ID
 */
function getProductById(productId) {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  return product ? parseProductRow(product) : null;
}

/**
 * Search products by query string (matches name, description, category, tags)
 */
function searchProducts(query, maxPrice = null) {
  const db = getDb();
  let sql = `SELECT * FROM products WHERE (
    LOWER(name) LIKE ? OR
    LOWER(description) LIKE ? OR
    LOWER(category) LIKE ? OR
    LOWER(tags) LIKE ?
  )`;
  const searchTerm = `%${query.toLowerCase()}%`;
  const params = [searchTerm, searchTerm, searchTerm, searchTerm];

  if (maxPrice !== null && maxPrice > 0) {
    sql += ' AND price <= ?';
    params.push(maxPrice);
  }

  sql += ' ORDER BY price ASC';

  const products = db.prepare(sql).all(...params);
  return products.map(parseProductRow);
}

/**
 * Get products by category
 */
function getProductsByCategory(category) {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products WHERE LOWER(category) = ?')
    .all(category.toLowerCase());
  return products.map(parseProductRow);
}

/**
 * Check inventory for a product
 */
function checkInventory(productId) {
  const db = getDb();
  const product = db.prepare('SELECT id, name, inventory FROM products WHERE id = ?').get(productId);
  if (!product) return null;
  return {
    productId: product.id,
    productName: product.name,
    available: product.inventory,
    inStock: product.inventory > 0
  };
}

/**
 * Reduce inventory after successful purchase
 */
function reduceInventory(productId, quantity) {
  const db = getDb();
  const product = db.prepare('SELECT inventory FROM products WHERE id = ?').get(productId);

  if (!product) throw new Error(`Product ${productId} not found.`);
  if (product.inventory < quantity) {
    throw new Error(`Insufficient inventory for ${productId}. Available: ${product.inventory}, Requested: ${quantity}`);
  }

  db.prepare('UPDATE products SET inventory = inventory - ? WHERE id = ?').run(quantity, productId);
  return true;
}

/**
 * Restore inventory (for cancelled/failed orders)
 */
function restoreInventory(productId, quantity) {
  const db = getDb();
  db.prepare('UPDATE products SET inventory = inventory + ? WHERE id = ?').run(quantity, productId);
  return true;
}

/**
 * Set inventory for a product (used by Failure Lab)
 */
function setInventory(productId, quantity) {
  const db = getDb();
  db.prepare('UPDATE products SET inventory = ? WHERE id = ?').run(quantity, productId);
  return true;
}

/**
 * Get all unique categories
 */
function getCategories() {
  const db = getDb();
  return db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all()
    .map(r => r.category);
}

/**
 * Parse raw DB row into a clean product object (parse JSON fields)
 */
function parseProductRow(row) {
  return {
    ...row,
    tags: safeJsonParse(toStr(row.tags), []),
    related_products: safeJsonParse(toStr(row.related_products), []),
    discount_allowed: !!row.discount_allowed,
    image_url: toStr(row.image_url)
  };
}

/**
 * Convert potential Uint8Array to string (sql.js returns Uint8Array for some TEXT fields)
 */
function toStr(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Uint8Array) {
    return new TextDecoder('utf-8').decode(val);
  }
  return String(val);
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  searchProducts,
  getProductsByCategory,
  checkInventory,
  reduceInventory,
  restoreInventory,
  setInventory,
  getCategories
};
