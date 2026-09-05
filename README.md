# 🤖 OmniAgent Commerce

### Razorpay AI Buildathon — Track 01: AI Growth & Agentic Commerce
> **Grow the merchant’s revenue, and make them sellable to AI buyers.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Test%20Mode-0C2340?logo=razorpay)](https://razorpay.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.6%20Flash-4285F4?logo=google)](https://aistudio.google.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20(WASM)-003B57?logo=sqlite)](https://sql.js.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🌐 Live Links & Deployment

| Resource | Link |
| :--- | :--- |
| 🚀 **Live Web App** | [https://ai-growth-agentic-commerce.onrender.com](https://ai-growth-agentic-commerce.onrender.com) |
| 📡 **API Health Check** | [https://ai-growth-agentic-commerce.onrender.com/api/health](https://ai-growth-agentic-commerce.onrender.com/api/health) |
| 🤖 **Agent Discovery Manifest** | [https://ai-growth-agentic-commerce.onrender.com/.well-known/agent-catalog.json](https://ai-growth-agentic-commerce.onrender.com/.well-known/agent-catalog.json) |
| 🐙 **GitHub Repository** | [https://github.com/VipinSinghRajput70/AI-Growth-Agentic-Commerce](https://github.com/VipinSinghRajput70/AI-Growth-Agentic-Commerce) |

### ⚡ 1-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/VipinSinghRajput70/AI-Growth-Agentic-Commerce)

---

## 💡 Why Now?

NPCI's **Universal Agent Protocol (UAP)** and the global protocol race (**ACP, AP2, x402**) make agent-to-agent commerce the open challenge of the year. Autonomous AI agents are becoming consumer buyers, making it imperative that merchants are **machine-discoverable**, **transactable by AI buyers**, and **protected by deterministic guardrails**.

---

## 🎯 What OmniAgent Commerce Does

OmniAgent Commerce delivers on the two core pillars of Track 01 while surpassing "The Bar":

1. **Grow Merchant Revenue**:
   - Natural language conversational shopping powered by **Google Gemini 3.6 Flash**.
   - Proactive **Intelligent Upselling** (suggesting higher-tier items with clear value rationale).
   - Contextual **Cross-selling** (recommending complementary accessories).
   - Automated **Bundle Deals** with dynamic discount savings.

2. **Make Merchant Sellable to AI Buyers**:
   - Standardized **Agent Discovery Manifest** (`/.well-known/agent-catalog.json`) exposing machine-readable catalog, policies, and commerce endpoints.
   - Autonomous **AI Buyer Simulator** executing end-to-end multi-step purchases (discovery, search, inventory, discount negotiation, A2A checkout).
   - A2A Checkout API (`/api/agent/a2a-checkout`) where AI buyers transact via backend commerce APIs without exposing Razorpay secrets.

3. **Meet "The Bar" (Every Money Action Explainable, Bounded & Gated)**:
   - **Bounded**: Deterministic guardrail limits (₹10,000 transaction cap, 20% max AI discount, daily spend caps).
   - **Gated**: High-value transactions automatically trigger a merchant **Approval Gate**.
   - **Explainable Audit Trail**: Persistent SQLite audit logging capturing actor, action, rationale, amount, and policy decisions.
   - **Graceful Failures**: Interactive **Failure Lab** demonstrating resilient handling across 4 critical failure scenarios.

---

## 🏗️ System Architecture

```
                      +-----------------------------+
                      |   Customer / AI Buyer       |
                      +--------------+--------------+
                                     |
                                     v
                 +---------------------------------------+
                 |  OmniAgent Commerce Engine            |
                 |  (Gemini 3.6 Flash + Function Calling)|
                 +-------------------+-------------------+
                                     |
                         [Proposes Money Action]
                                     |
                                     v
                 +---------------------------------------+
                 |   Deterministic Policy Guardrail      |
                 |       (FINAL AUTHORITY ENGINE)        |
                 +-------------------+-------------------+
                                     |
                  +------------------+------------------+
                  |                                     |
       [Within Policy Bounds]                 [Exceeds Autonomous Limit]
                  |                                     |
                  v                                     v
    +---------------------------+         +---------------------------+
    | Razorpay Service          |         | Human Merchant Gate       |
    | (Backend-only, Test Mode) |         | (Approve / Reject Action) |
    +-------------+-------------+         +-------------+-------------+
                  |                                     | (If Approved)
                  +------------------+------------------+
                                     |
                                     v
                 +---------------------------------------+
                 | Dual-Path Payment Verification        |
                 | (HMAC SHA-256 Server + Webhook Verify)|
                 +-------------------+-------------------+
                                     |
                                     v
                 +---------------------------------------+
                 | Order State Machine & Audit Trail     |
                 | (SQLite: CREATED -> PAID | REJECTED)  |
                 +---------------------------------------+
```

> 🔒 **Security Principle**: The LLM can **PROPOSE** actions but **NEVER** directly modifies database prices, creates orders, or accesses Razorpay API credentials.

---

## 🧪 The Failure Lab (Graceful Error Recovery)

OmniAgent Commerce includes an interactive **Failure Lab** demonstrating 4 real-world failure scenarios:

| Failure Scenario | Problem Simulated | Graceful Recovery Mechanism |
| :--- | :--- | :--- |
| **1. Budget Violation** | AI attempts ₹15,000 order against ₹10,000 policy limit | Blocked by deterministic policy; gated to merchant approval queue without crashing. |
| **2. Timeout & Duplicate** | Network drops after order submission; duplicate request sent | Idempotency engine (hash of cart + amount + session) identifies duplicate and reuses existing order without duplicate charge. |
| **3. Inventory Stockout** | Target product inventory drops to 0 during checkout | Order halted safely; AI agent automatically suggests top alternative products in stock. |
| **4. HMAC Tampering** | Malicious payload altered with forged payment signature | Server-side HMAC SHA-256 fails verification; order marked `PAYMENT_FAILED` and security audit log is recorded. |

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **AI Engine**: Google Gemini 3.6 Flash (Function Calling / Tool Use)
- **Payments**: Razorpay Node.js SDK (Test Mode)
- **Database**: SQLite (via `sql.js` WebAssembly — 100% portable, no C++ compilation dependencies)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Razorpay Obsidian Dark Design System)
- **Security**: Server-side HMAC SHA-256 verification, Webhook signature validation, Payload-validated Idempotency

---

## 🚀 Local Development Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- [Razorpay Test Account](https://dashboard.razorpay.com/) (Free)
- [Google Gemini API Key](https://aistudio.google.com/app/apikey) (Free Tier)

### 2. Clone Repository
```bash
git clone https://github.com/VipinSinghRajput70/AI-Growth-Agentic-Commerce.git
cd AI-Growth-Agentic-Commerce
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment
Create a `.env` file in the root directory:
```env
# Razorpay Test Mode Keys (FREE from dashboard.razorpay.com)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Google Gemini API Key (FREE from aistudio.google.com)
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=3000
NODE_ENV=development
```

### 5. Start the Application
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 📡 API Reference

### Agentic Commerce
- `GET /.well-known/agent-catalog.json` — Machine-readable merchant discovery manifest
- `POST /api/agent/chat` — Conversational AI shopping assistant
- `POST /api/agent/a2a-checkout` — Programmatic checkout endpoint for autonomous AI buyers

### Catalog & Revenue
- `GET /api/catalog` — List all products with inventory & pricing
- `GET /api/catalog/search?q={query}&max_price={price}` — Full-text product search
- `GET /api/catalog/inventory/:id` — Real-time stock status

### Safety & Guardrails
- `POST /api/policy/check` — Guardrail transaction evaluation
- `POST /api/policy/check-discount` — Discount negotiation evaluation
- `GET /api/audit-trail` — Live explainable audit trail logs
- `GET /api/dashboard/metrics` — Merchant revenue & AI growth metrics

### Razorpay Payments
- `POST /api/razorpay/create-order` — Guardrail-bounded Razorpay order creation
- `POST /api/razorpay/verify-payment` — Server-side HMAC SHA-256 signature verification
- `POST /api/webhooks/razorpay` — Webhook handler with signature & event idempotency

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
