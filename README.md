# OmniAgent Commerce

## Razorpay AI Buildathon — Track 01: AI Growth & Agentic Commerce

> An AI commerce agent that helps customers discover products, intelligently grows merchant revenue through upselling and cross-selling, and safely completes transactions through Razorpay Test Mode with policy controls, approval gates, and a complete audit trail.

**⚠️ Payments are executed using Razorpay Test Mode and do not involve real-money transactions.**

---

## Problem Being Solved

Track 01 asks us to solve two challenges simultaneously:

1. **Grow the merchant's revenue** — using AI-powered product discovery, intelligent upselling, cross-selling, and bundle recommendations.
2. **Make the merchant transactable by an AI buyer** — exposing a machine-readable agent discovery manifest and enabling autonomous AI-to-AI commerce.
3. **Meet The Bar** — every money action must be explainable, bounded, gated, with a visible audit trail and graceful failure handling.

---

## Architecture

```
Customer / AI Buyer
       ↓
Commerce Agent (LLM + Tool Calling)
       ↓
Catalog / Revenue / Cart Tools
       ↓
Deterministic Policy / Guardrail Engine (FINAL AUTHORITY)
       ↓
Approval Gate (if limit exceeded)
       ↓
Razorpay Service (Backend-only, Test Mode)
       ↓
Server-side HMAC Verification + Webhook Handler
       ↓
Order State Machine (CART → PAID)
       ↓
Persistent Audit Trail (SQLite)
```

**Key principle:** The LLM can PROPOSE actions but NEVER directly modifies prices, creates payments, or accesses Razorpay credentials.

---

## Features

### AI Revenue Growth
- **Conversational Commerce** — Natural language product discovery via OpenAI tool-calling
- **Intelligent Upselling** — Higher-tier product suggestions with value explanations
- **Cross-selling** — Related product recommendations based on catalog relationships
- **Bundle Offers** — Complementary product bundles with discount savings

### Agentic Commerce
- **Agent Discovery Manifest** — `/.well-known/agent-catalog.json` for AI buyer discoverability
- **AI Buyer Simulator** — End-to-end autonomous buyer using real backend APIs
- **A2A Checkout API** — Programmatic checkout endpoint for external AI agents

### Safety & Explainability
- **Deterministic Guardrail Engine** — Transaction limits (₹10,000), discount caps (20%), daily spend caps (₹50,000)
- **Human Approval Gate** — Merchant Approve/Reject for transactions exceeding limits
- **Dual-Path Payment Verification** — Server HMAC + Webhook signature verification
- **Webhook Event Idempotency** — Duplicate webhook events safely ignored
- **Order Idempotency** — Payload-validated deduplication (key + cart + amount + session)
- **Order State Machine** — Strict states from CART to PAID with failure states
- **Live Audit Trail** — Concise decision rationale without hidden LLM chain-of-thought
- **Failure Lab** — 4 interactive failure scenarios handled gracefully

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| AI Agent | OpenAI API (gpt-4o-mini) with function/tool calling |
| Payments | Razorpay Node SDK (Test Mode) |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Design | Custom Razorpay Dark Obsidian Design System |

---

## Setup Instructions

### 1. Prerequisites
- Node.js 18+ installed
- Razorpay Test Mode account ([Sign up free](https://dashboard.razorpay.com/))
- OpenAI API key ([Get key](https://platform.openai.com/api-keys))

### 2. Clone & Install

```bash
cd "AI Growth & Agentic Commerce"
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and add your credentials:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
PORT=3000
```

### 4. Getting Razorpay Test Keys

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Switch to **Test Mode** (toggle at top)
3. Go to **Settings → API Keys**
4. Generate a new key pair
5. Copy `Key Id` and `Key Secret` to `.env`

### 5. Start the Server

```bash
npm start
```

The database is automatically initialized on first run.

### 6. Open the Application

Navigate to [http://localhost:3000](http://localhost:3000)

---

## API Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health and credential status |
| `/.well-known/agent-catalog.json` | GET | Agent Discovery Manifest |
| `/api/catalog` | GET | All products |
| `/api/catalog/search?q=...&max_price=...` | GET | Search products |
| `/api/catalog/product/:id` | GET | Product details |
| `/api/catalog/inventory/:id` | GET | Inventory check |
| `/api/cart/add` | POST | Add to cart |
| `/api/cart/:session_id` | GET | Get cart |
| `/api/agent/chat` | POST | AI Commerce Agent |
| `/api/agent/a2a-checkout` | POST | AI Buyer checkout |
| `/api/razorpay/create-order` | POST | Create Razorpay order |
| `/api/razorpay/verify-payment` | POST | HMAC payment verification |
| `/api/webhooks/razorpay` | POST | Webhook handler |
| `/api/policy` | GET/PUT | Merchant policies |
| `/api/policy/check` | POST | Policy evaluation |
| `/api/policy/check-discount` | POST | Discount evaluation |
| `/api/approvals/pending` | GET | Pending approvals |
| `/api/approvals/decide` | POST | Approve/Reject |
| `/api/audit-trail` | GET | Audit log |
| `/api/dashboard/metrics` | GET | Revenue metrics |
| `/api/failure-lab/*` | POST | Failure scenarios |

---

## Demo Flow for Judges

### Happy Path
1. Customer: "I need running shoes under ₹3000"
2. AI searches catalog → recommends products
3. AI suggests cross-sell (socks, bottle)
4. Cart updated → Policy check: ALLOWED
5. Razorpay Test Checkout opens
6. Complete test payment
7. Server verifies HMAC signature
8. Order marked PAID → Audit trail updated

### Failure Demonstrations
1. **Budget Violation** — ₹15,000 transaction → BLOCKED → Approval required
2. **Timeout & Idempotency** — Duplicate prevented → Safe retry
3. **Inventory Failure** — Out of stock → Alternative recommended
4. **Invalid Signature** — Tampered payload → Verification rejected

---

## Safety Architecture

```
LLM Agent ──→ PROPOSE action ──→ Guardrail Engine (deterministic)
                                        ↓
                                  ALLOW / BLOCK / REQUIRE APPROVAL
                                        ↓
                                  Razorpay Service (backend-only)
                                        ↓
                                  HMAC Verification
                                        ↓
                                  Audit Trail (SQLite)
```

- LLM never receives Razorpay secret credentials
- LLM never directly calls Razorpay APIs
- LLM never modifies final prices
- Guardrail engine is the FINAL AUTHORITY
- Frontend payment success is NEVER trusted

---

## Screens

1. **AI Commerce** — Conversational shopping with tool-calling agent
2. **Cart & Checkout** — Cart management with Razorpay Test Checkout
3. **Growth Dashboard** — Revenue metrics (labeled Demo/Simulated)
4. **Safety & Audit** — Policy config, approvals, live audit trail
5. **AI Buyer** — Autonomous buyer using real backend APIs
6. **Failure Lab** — 4 interactive failure test scenarios

---

## License

MIT
