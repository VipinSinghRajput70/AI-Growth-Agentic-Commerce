# 🤖 OmniAgent Commerce

> **An Autonomous AI-Powered Commerce Engine for Intelligent Merchant Growth and Agent-to-Agent (A2A) Transactions.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Integrated-0C2340?logo=razorpay)](https://razorpay.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.6%20Flash-4285F4?logo=google)](https://aistudio.google.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20(WASM)-003B57?logo=sqlite)](https://sql.js.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🌐 Live Demo

| Resource | Link |
| :--- | :--- |
| 🚀 **Live Web Application** | [https://ai-growth-agentic-commerce-arxq.onrender.com](https://ai-growth-agentic-commerce-arxq.onrender.com) |
| 📡 **API Health Check** | [https://ai-growth-agentic-commerce-arxq.onrender.com/api/health](https://ai-growth-agentic-commerce-arxq.onrender.com/api/health) |
| 🤖 **Agent Discovery Manifest** | [https://ai-growth-agentic-commerce-arxq.onrender.com/.well-known/agent-catalog.json](https://ai-growth-agentic-commerce-arxq.onrender.com/.well-known/agent-catalog.json) |
| 🐙 **GitHub Repository** | [https://github.com/VipinSinghRajput70/AI-Growth-Agentic-Commerce](https://github.com/VipinSinghRajput70/AI-Growth-Agentic-Commerce) |

---

## 💡 Overview & Problem Statement

As autonomous AI buyers and agents become mainstream, traditional e-commerce stores designed solely for human graphical interfaces fall short. The rise of NPCI's **Universal Agent Protocol (UAP)** and global standards like **ACP, AP2, and x402** demands that merchants become:

1. **Machine-Discoverable**: Exposing standardized, machine-readable catalogs and commerce endpoints.
2. **AI-Transactable**: Allowing autonomous AI buyers to discover products, negotiate discounts within policy, and execute checkouts safely.
3. **Protected & Bounded**: Ensuring every monetary action is strictly bounded by deterministic financial guardrails, gated for high-value transactions, and fully explainable via an audit trail.

**OmniAgent Commerce** solves this by providing a unified platform that drives merchant revenue growth through intelligent AI merchandising while enabling safe, autonomous agent-to-agent transactions.

---

## 🚀 Key Capabilities

### 1. AI Revenue Growth Engine
- **Conversational Commerce**: Natural language product discovery powered by **Google Gemini 3.6 Flash** with real-time tool calling.
- **Intelligent Upselling**: Proactively recommends higher-tier alternatives with clear value-add explanations.
- **Contextual Cross-Selling**: Identifies complementary accessories frequently bought together.
- **Dynamic Bundle Offers**: Automatically computes bundle discount savings to boost Average Order Value (AOV).

### 2. Agentic Commerce & Autonomous AI Buyer
- **Standardized Discovery Manifest**: Exposes `/.well-known/agent-catalog.json` so external AI agents can discover capabilities, catalog items, pricing, and policies.
- **Autonomous AI Buyer Simulator**: Executes multi-step purchases (Discovery → Catalog Browse → Inventory Check → Discount Negotiation → Cart Creation → Policy Validation → A2A Checkout).
- **Secure A2A Checkout API (`/api/agent/a2a-checkout`)**: Allows programmatic purchases via backend commerce APIs without exposing payment credentials to external agents.

### 3. Deterministic Guardrails & Financial Governance
- **Hard Boundaries**: Strict policies enforced on transactions (₹10,000 transaction cap, 20% maximum AI discount cap, daily spend limits).
- **Merchant Approval Gate**: High-value or outlier transactions are halted and routed to the merchant approval queue.
- **Dual-Path Verification**: Server-side HMAC SHA-256 signature verification plus webhook signature and idempotency checks.
- **Live Audit Trail**: Persistent, transparent logging capturing actor, action, rationale, amounts, and policy evaluations for every money movement.

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
    | Payment Service           |         | Merchant Approval Gate    |
    | (Backend-only execution)  |         | (Approve / Reject Action) |
    +-------------+-------------+         +-------------+-------------+
                  |                                     | (If Approved)
                  +------------------+------------------+
                                     |
                                     v
                 +---------------------------------------+
                 | Dual-Path Verification                |
                 | (HMAC SHA-256 Server + Webhook Verify)|
                 +-------------------+-------------------+
                                     |
                                     v
                 +---------------------------------------+
                 | Order State Machine & Audit Trail     |
                 | (SQLite: CREATED -> PAID | REJECTED)  |
                 +---------------------------------------+
```

> 🔒 **Security Principle**: The LLM can **PROPOSE** actions but **NEVER** directly modifies prices in the database, executes unverified payments, or accesses private payment credentials.

---

## 🧪 Failure Lab & Resilience

OmniAgent Commerce includes an interactive **Failure Lab** demonstrating resilient handling across critical failure scenarios:

| Failure Scenario | Problem Simulated | Graceful Recovery Mechanism |
| :--- | :--- | :--- |
| **1. Budget Violation** | Transaction exceeds autonomous limit (e.g. ₹15,000 vs ₹10,000 cap) | Deterministic policy halts auto-checkout; safely routes order to merchant approval queue. |
| **2. Timeout & Duplicate** | Network drops during checkout; duplicate request submitted | Idempotency engine (hash of cart + amount + session) prevents double-charge and reuses existing order. |
| **3. Inventory Stockout** | Product stock drops to 0 during checkout session | Transaction blocked gracefully; AI agent immediately suggests in-stock alternatives. |
| **4. HMAC Tampering** | Forged signature or tampered payment payload received | Server-side HMAC SHA-256 verification rejects transaction, flags state as `PAYMENT_FAILED`, and records a security audit event. |

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **AI Engine**: Google Gemini 3.6 Flash (Function Calling / Tool Use)
- **Payments**: Razorpay Node.js SDK (Test Mode)
- **Database**: SQLite (via `sql.js` WebAssembly — portable, zero C++ compilation dependencies)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Razorpay Obsidian Dark Design System)
- **Security**: Server-side HMAC SHA-256 verification, Webhook signature validation, Payload-validated Idempotency

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

### Payments & Webhooks
- `POST /api/razorpay/create-order` — Guardrail-bounded order creation
- `POST /api/razorpay/verify-payment` — Server-side HMAC SHA-256 signature verification
- `POST /api/webhooks/razorpay` — Webhook handler with signature & event idempotency

---

## ⚙️ Local Development Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18+ installed
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
# Razorpay Test Mode Keys
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Google Gemini API Key
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

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
