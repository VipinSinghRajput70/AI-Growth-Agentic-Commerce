/**
 * OmniAgent Commerce — AI Agent Service (Google Gemini)
 * Uses FREE Gemini API with function calling for commerce operations.
 * The LLM can PROPOSE actions but NEVER directly modifies prices or calls Razorpay.
 */

const { getGeminiInstance, checkGeminiCredentials } = require('../config/openaiConfig');
const catalogService = require('./catalogService');
const recommendationService = require('./recommendationService');
const guardrailService = require('./guardrailService');
const { logAudit } = require('./auditLogger');

// Tool definitions for Gemini function calling
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'search_products',
      description: 'Search the product catalog by keyword, category, or attribute. Returns matching products with prices and availability.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Search query (e.g., "running shoes", "gaming", "fitness")' },
          max_price: { type: 'NUMBER', description: 'Maximum price filter in INR (optional)' }
        },
        required: ['query']
      }
    },
    {
      name: 'get_product_details',
      description: 'Get detailed information about a specific product including description, price, inventory, and related products.',
      parameters: {
        type: 'OBJECT',
        properties: {
          product_id: { type: 'STRING', description: 'The product ID (e.g., "prod_001")' }
        },
        required: ['product_id']
      }
    },
    {
      name: 'check_inventory',
      description: 'Check if a product is in stock and how many units are available.',
      parameters: {
        type: 'OBJECT',
        properties: {
          product_id: { type: 'STRING', description: 'The product ID to check' }
        },
        required: ['product_id']
      }
    },
    {
      name: 'get_recommendations',
      description: 'Get upsell and cross-sell recommendations for a product. Returns higher-tier alternatives (upsells) and complementary items (cross-sells).',
      parameters: {
        type: 'OBJECT',
        properties: {
          product_id: { type: 'STRING', description: 'The product ID to get recommendations for' }
        },
        required: ['product_id']
      }
    },
    {
      name: 'calculate_cart',
      description: 'Calculate the total for given cart items including any applicable discounts. Returns itemized breakdown.',
      parameters: {
        type: 'OBJECT',
        properties: {
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                product_id: { type: 'STRING' },
                quantity: { type: 'NUMBER' }
              },
              required: ['product_id', 'quantity']
            },
            description: 'Array of cart items with product_id and quantity'
          }
        },
        required: ['items']
      }
    },
    {
      name: 'check_policy',
      description: 'Check if a transaction amount passes merchant policy checks (transaction limits, daily spend caps). Returns whether allowed or needs approval.',
      parameters: {
        type: 'OBJECT',
        properties: {
          amount: { type: 'NUMBER', description: 'Transaction amount in INR' },
          discount_percent: { type: 'NUMBER', description: 'Discount percentage if any (0-100)' }
        },
        required: ['amount']
      }
    }
  ]
}];

// Tool execution handlers
const TOOL_HANDLERS = {
  search_products: (args) => {
    const results = catalogService.searchProducts(args.query, args.max_price || null);
    return results.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      inventory: p.inventory,
      description: p.description,
      inStock: p.inventory > 0
    }));
  },

  get_product_details: (args) => {
    const product = catalogService.getProductById(args.product_id);
    if (!product) return { error: `Product ${args.product_id} not found.` };
    return product;
  },

  check_inventory: (args) => {
    const result = catalogService.checkInventory(args.product_id);
    if (!result) return { error: `Product ${args.product_id} not found.` };
    return result;
  },

  get_recommendations: (args) => {
    const upsells = recommendationService.getUpsells(args.product_id);
    const crossSells = recommendationService.getCrossSells(args.product_id);
    return {
      upsells: upsells.map(u => ({
        id: u.id, name: u.name, price: u.price,
        reason: u.upsellReason, priceDifference: u.priceDifference
      })),
      crossSells: crossSells.map(c => ({
        id: c.id, name: c.name, price: c.price,
        reason: c.crossSellReason
      }))
    };
  },

  calculate_cart: (args) => {
    let subtotal = 0;
    const itemized = [];

    for (const item of args.items) {
      const product = catalogService.getProductById(item.product_id);
      if (!product) {
        itemized.push({ product_id: item.product_id, error: 'Product not found' });
        continue;
      }
      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;
      itemized.push({
        product_id: product.id,
        name: product.name,
        unit_price: product.price,
        quantity: item.quantity,
        line_total: lineTotal,
        inStock: product.inventory >= item.quantity
      });
    }

    const productIds = args.items.map(i => i.product_id);
    const bundles = recommendationService.getBundleSuggestions(productIds);

    return { items: itemized, subtotal, bundles };
  },

  check_policy: (args) => {
    const result = guardrailService.evaluateTransaction({
      amount: args.amount,
      discountPercent: args.discount_percent || 0,
      sessionId: 'agent_session',
      cartItems: []
    });
    return {
      allowed: result.allowed,
      requiresApproval: result.requiresApproval,
      violations: result.violations,
      adjustments: result.adjustments,
      policy: result.policy
    };
  }
};

const SYSTEM_PROMPT = `You are OmniAgent, an AI commerce assistant for OmniStore. Your role is to help customers discover and purchase products.

IMPORTANT RULES:
1. ALWAYS use the search_products tool to find products. NEVER invent or guess product details.
2. ALWAYS check inventory before recommending a product.
3. When a customer shows interest in a product, proactively suggest relevant upsells and cross-sells using get_recommendations.
4. Use calculate_cart to show accurate pricing.
5. Before suggesting checkout, use check_policy to verify the transaction passes merchant policies.
6. You CANNOT modify prices directly. Any discounts must go through the merchant policy engine.
7. You CANNOT access payment systems directly. You can only prepare the cart for checkout.
8. Be helpful, concise, and transparent about pricing. Use Indian Rupees (₹).
9. If a product is out of stock, suggest alternatives.
10. When recommending upsells, explain the value proposition clearly.
11. Always mention the product ID (e.g. prod_001) so users can add items to cart.

You work for OmniStore which sells sports, fitness, gaming, and electronics products.`;

/**
 * Universal commerce intelligence — handles ANY user query instantly.
 * Searches full 20-product catalog by name, description, category, and tags.
 * Always returns a useful response, never falls through empty.
 */
function handleCommerceIntent(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  // Extract price filter if present
  const priceMatch = msg.match(/(?:under|below|less than|within|budget of|upto|up to)?\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/i);
  let maxPrice = null;
  if (priceMatch) {
    const num = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    if (num > 0 && num < 1000000) maxPrice = num;
  }

  // Extract meaningful search words (remove filler/stop words)
  const stopWords = ['show','give','find','search','get','list','display','recommend','suggest',
    'me','i','need','want','have','do','you','what','which','some','any','a','an','the',
    'products','product','items','item','things','stuff','please','can','could','under',
    'below','less','than','within','budget','of','upto','up','to','for','in','with','and',
    'or','is','are','there','rs','inr','tell','about','looking','buy','purchase','order'];
  
  const words = msg.replace(/[₹,.!?'"]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !stopWords.includes(w) && !/^\d+$/.test(w));
  const searchQuery = words.join(' ');

  // 1. Search the full catalog with the extracted query
  let products = [];
  if (searchQuery.length >= 2) {
    // Try full query first
    products = catalogService.searchProducts(searchQuery, maxPrice);
    
    // If nothing found, try each word individually and combine results
    if (products.length === 0) {
      const seen = new Set();
      for (const word of words) {
        const results = catalogService.searchProducts(word, maxPrice);
        for (const p of results) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            products.push(p);
          }
        }
      }
    }
  }

  // 2. If still nothing, try category-based lookup
  if (products.length === 0) {
    const categories = catalogService.getCategories();
    for (const word of words) {
      for (const cat of categories) {
        if (cat.toLowerCase().includes(word) || word.includes(cat.toLowerCase())) {
          const catProducts = catalogService.getProductsByCategory(cat);
          products.push(...catProducts);
        }
      }
    }
  }

  // 3. If nothing found in catalog, let Gemini AI handle it conversationally
  if (products.length === 0) {
    return { handled: false };
  }

  // 4. Format results with upsells and cross-sells
  const bestMatch = products[0];
  const upsells = recommendationService.getUpsells(bestMatch.id);
  const crossSells = recommendationService.getCrossSells(bestMatch.id);

  let response = `🛍️ **Search Results${maxPrice ? ` (under ₹${maxPrice.toLocaleString('en-IN')})` : ''}:**\n\n`;
  
  products.slice(0, 5).forEach(p => {
    const stockLabel = p.inventory > 0 ? `✅ ${p.inventory} in stock` : '❌ Out of stock';
    response += `• **${p.name}** (${p.id}) — ₹${p.price.toLocaleString('en-IN')}\n  ${p.description}\n  ${stockLabel}\n\n`;
  });

  if (products.length > 5) {
    response += `...and ${products.length - 5} more results.\n\n`;
  }

  // Upsell suggestion
  if (upsells.length > 0) {
    const up = upsells[0];
    response += `✨ **Premium Upgrade:** **${up.name}** (${up.id}) — ₹${up.price.toLocaleString('en-IN')}\n  ${up.upsellReason}\n\n`;
  }

  // Cross-sell suggestions
  if (crossSells.length > 0) {
    response += `🔗 **Frequently Bought Together:**\n`;
    crossSells.slice(0, 2).forEach(cs => {
      response += `• **${cs.name}** (${cs.id}) — ₹${cs.price.toLocaleString('en-IN')}\n`;
    });
    response += '\n';
  }

  // Bundle suggestion if multiple items found
  if (products.length >= 2) {
    response += `🎁 **Bundle Deal Available!** Add multiple items to cart for automatic bundle discounts.\n\n`;
  }

  response += `💡 *Add items to cart and proceed to secure Razorpay checkout!*`;

  return {
    handled: true,
    response,
    tool: 'search_products',
    args: { query: searchQuery, max_price: maxPrice }
  };
}

/**
 * Process a chat message using Hybrid Engine (Fast Local Matcher + Gemini REST Fallback).
 */
async function processChat(userMessage, conversationHistory = []) {
  const creds = checkGeminiCredentials();

  // 1. Fast local commerce intent check (< 5ms response time)
  const localResult = handleCommerceIntent(userMessage);
  if (localResult.handled) {
    logAudit({
      actor: 'commerce_agent',
      action: 'chat_response',
      reason: `Processed query with instant commerce engine. Tool: ${localResult.tool}.`,
      policyEvaluation: 'ALLOWED',
      status: 'success'
    });

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: localResult.response }
    ];

    return {
      response: localResult.response,
      toolCalls: [{ tool: localResult.tool, args: localResult.args, status: 'success' }],
      conversationHistory: updatedHistory
    };
  }

  // 2. Gemini fallback for open-ended queries
  if (!creds.isConfigured) {
    throw new Error('Gemini API Key Required. Get a FREE key at https://aistudio.google.com/app/apikey and add GEMINI_API_KEY to .env');
  }

  const apiKey = creds.apiKey;
  // Use gemini-3.6-flash (fast, active model with tool calling)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  const contents = conversationHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const toolCallsLog = [];
  let iterations = 0;
  const maxIterations = 3;
  let assistantMessage = '';

  try {
    while (iterations < maxIterations) {
      iterations++;

      const payload = {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: TOOLS
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || `Gemini API error (${res.status})`);
      }

      const candidate = data.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter(p => p.functionCall);

      if (functionCalls.length === 0) {
        const textParts = parts.filter(p => p.text).map(p => p.text);
        assistantMessage = textParts.join('\n');
        break;
      }

      contents.push(candidate.content);

      for (const fc of functionCalls) {
        const funcName = fc.functionCall.name;
        const funcArgs = fc.functionCall.args || {};
        const handler = TOOL_HANDLERS[funcName];
        let result = handler ? handler(funcArgs) : { error: `Unknown tool: ${funcName}` };

        toolCallsLog.push({ tool: funcName, args: funcArgs, status: 'success' });
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: funcName,
              response: { result }
            }
          }]
        });
      }
    }
  } catch (err) {
    console.warn('[AI Agent] Gemini call timed out or failed, using catalog overview fallback:', err.message);
    const catalog = catalogService.getAllProducts();
    assistantMessage = `Welcome to **OmniStore**! Here are some of our popular items:\n\n` +
      catalog.slice(0, 3).map(p => `• **${p.name}** (${p.id}) — ₹${p.price.toLocaleString('en-IN')}\n  ${p.description}`).join('\n\n') +
      `\n\nFeel free to ask for specific items, running shoes, gaming gear, or fitness accessories!`;
  }

  if (!assistantMessage) {
    // Gemini used tools but didn't produce final text — build response from tool results
    if (toolCallsLog.length > 0) {
      const searchArgs = toolCallsLog.find(t => t.tool === 'search_products')?.args;
      if (searchArgs) {
        const results = catalogService.searchProducts(searchArgs.query || userMessage, searchArgs.max_price || null);
        if (results.length > 0) {
          assistantMessage = `🛍️ **Search Results for "${searchArgs.query}":**\n\n`;
          results.slice(0, 5).forEach(p => {
            assistantMessage += `• **${p.name}** (${p.id}) — ₹${p.price.toLocaleString('en-IN')}\n  ${p.description}\n  ${p.inventory > 0 ? `✅ ${p.inventory} in stock` : '❌ Out of stock'}\n\n`;
          });
          assistantMessage += `💡 *Add items to cart and proceed to secure Razorpay checkout!*`;
        } else {
          // No matching products — show alternatives
          const allProducts = catalogService.getAllProducts();
          const categories = catalogService.getCategories();
          assistantMessage = `Sorry, we don't currently stock "${searchArgs.query}". Here's what OmniStore offers across **${categories.length} categories**:\n\n`;
          categories.slice(0, 5).forEach(cat => {
            const catProducts = allProducts.filter(p => p.category === cat);
            if (catProducts.length > 0) {
              assistantMessage += `**${cat}:** ${catProducts.slice(0, 2).map(p => `${p.name} (₹${p.price.toLocaleString('en-IN')})`).join(', ')}\n`;
            }
          });
          assistantMessage += `\n💡 *Ask me about shoes, fitness gear, gaming accessories, electronics, or yoga equipment!*`;
        }
      }
    }
    // Final fallback
    if (!assistantMessage) {
      const popular = catalogService.getAllProducts().slice(0, 3);
      assistantMessage = `Welcome to **OmniStore**! Here are some of our popular items:\n\n` +
        popular.map(p => `• **${p.name}** (${p.id}) — ₹${p.price.toLocaleString('en-IN')}\n  ${p.description}`).join('\n\n') +
        `\n\nFeel free to ask for specific items, running shoes, gaming gear, or fitness accessories!`;
    }
  }

  logAudit({
    actor: 'commerce_agent',
    action: 'chat_response',
    reason: `Processed customer query. Tools used: ${toolCallsLog.map(t => t.tool).join(', ') || 'catalog_engine'}.`,
    policyEvaluation: 'ALLOWED',
    status: 'success'
  });

  const updatedHistory = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantMessage }
  ];

  return {
    response: assistantMessage,
    toolCalls: toolCallsLog,
    conversationHistory: updatedHistory
  };
}

module.exports = { processChat, TOOLS };

