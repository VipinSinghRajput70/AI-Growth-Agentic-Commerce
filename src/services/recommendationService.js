/**
 * OmniAgent Commerce — Recommendation Service
 * Upsell, cross-sell, and bundle engine based on catalog relationships.
 */

const catalogService = require('./catalogService');

/**
 * Get upsell recommendations for a product.
 * Finds higher-priced products in the same category.
 */
function getUpsells(productId) {
  const product = catalogService.getProductById(productId);
  if (!product) return [];

  const categoryProducts = catalogService.getProductsByCategory(product.category);
  const upsells = categoryProducts
    .filter(p => p.id !== productId && p.price > product.price && p.inventory > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);

  return upsells.map(p => ({
    ...p,
    upsellReason: `Upgrade from ${product.name} (₹${product.price}) to ${p.name} (₹${p.price}) for enhanced features.`,
    priceDifference: p.price - product.price
  }));
}

/**
 * Get cross-sell recommendations for a product.
 * Uses related_products from catalog data.
 */
function getCrossSells(productId) {
  const product = catalogService.getProductById(productId);
  if (!product) return [];

  const crossSells = [];
  for (const relatedId of product.related_products) {
    const related = catalogService.getProductById(relatedId);
    if (related && related.inventory > 0) {
      crossSells.push({
        ...related,
        crossSellReason: `Frequently purchased with ${product.name}. Enhances your ${product.category.toLowerCase()} experience.`
      });
    }
  }

  return crossSells.slice(0, 4);
}

/**
 * Generate bundle suggestions for cart items.
 * Groups related products and offers bundle pricing.
 */
function getBundleSuggestions(cartProductIds) {
  const bundles = [];
  const allRelated = new Set();

  // Collect all related products from cart items
  for (const pid of cartProductIds) {
    const product = catalogService.getProductById(pid);
    if (product) {
      for (const relatedId of product.related_products) {
        if (!cartProductIds.includes(relatedId)) {
          allRelated.add(relatedId);
        }
      }
    }
  }

  // Check if we can form a meaningful bundle
  const cartProducts = cartProductIds.map(id => catalogService.getProductById(id)).filter(Boolean);
  const relatedProducts = Array.from(allRelated)
    .map(id => catalogService.getProductById(id))
    .filter(p => p && p.inventory > 0)
    .slice(0, 3);

  if (relatedProducts.length > 0) {
    const bundleProducts = [...cartProducts, ...relatedProducts];
    const individualTotal = bundleProducts.reduce((sum, p) => sum + p.price, 0);
    const bundleDiscount = Math.round(individualTotal * 0.07); // 7% bundle discount
    const bundlePrice = individualTotal - bundleDiscount;

    bundles.push({
      name: generateBundleName(cartProducts),
      products: bundleProducts.map(p => ({ id: p.id, name: p.name, price: p.price })),
      additionalProducts: relatedProducts.map(p => ({ id: p.id, name: p.name, price: p.price })),
      individualTotal,
      bundleDiscount,
      bundlePrice,
      savingsPercent: Math.round((bundleDiscount / individualTotal) * 100),
      bundleReason: `Save ₹${bundleDiscount} by adding complementary items to your purchase.`
    });
  }

  return bundles;
}

/**
 * Get smart recommendations based on a user's query and current cart.
 */
function getSmartRecommendations(query, currentCartIds = []) {
  const searchResults = catalogService.searchProducts(query);

  if (searchResults.length === 0) return { products: [], upsells: [], crossSells: [] };

  const topProduct = searchResults[0];
  const upsells = getUpsells(topProduct.id);
  const crossSells = getCrossSells(topProduct.id)
    .filter(p => !currentCartIds.includes(p.id));

  return {
    products: searchResults,
    upsells,
    crossSells
  };
}

function generateBundleName(products) {
  const categories = [...new Set(products.map(p => p.category))];
  if (categories.length === 1) {
    return `${categories[0]} Starter Bundle`;
  }
  return `${categories[0]} + ${categories[1]} Combo Bundle`;
}

module.exports = {
  getUpsells,
  getCrossSells,
  getBundleSuggestions,
  getSmartRecommendations
};
