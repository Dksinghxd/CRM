# SmartReach AI CRM — Production-Grade AI-Native CRM for Shopper Engagement

<div align="center">

![SmartReach AI CRM](https://img.shields.io/badge/SmartReach-AI_CRM-4F46E5?style=for-the-badge&logo=lightning&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js_15-000?style=for-the-badge&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)

**A production-grade AI-Native Mini CRM** — Identify customer segments, generate personalized campaigns, simulate omni-channel delivery, and analyze performance using real OpenAI GPT-4o-mini.

</div>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND  (Next.js 15)                        │
│  Login │ Dashboard │ Customers │ Orders │ Segments │             │
│  Campaigns │ Analytics │ AI Copilot │ Settings                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST + JWT (port 4000)
┌────────────────────────▼────────────────────────────────────────┐
│                  BACKEND API  (Express + TS)                     │
│  Auth │ Customers │ Orders │ Segments │ Campaigns │              │
│  Analytics │ AI Layer │ Channel Callbacks                        │
└─────┬────────────────┬───────────────────────────┬──────────────┘
      │                │                           │
 ┌────▼──────┐  ┌──────▼──────────┐  ┌────────────▼──────────────┐
 │ PostgreSQL│  │  OpenAI API     │  │  Channel Microservice      │
 │ (Prisma)  │  │  gpt-4o-mini    │  │  (Express, port 5000)      │
 └───────────┘  └─────────────────┘  └───────────────────────────┘
                                               │
                                    Async callbacks → Backend
```

---

## ✨ Features

### 🧠 AI Features (Powered by GPT-4o-mini)
| Feature | Description |
|---|---|
| **AI Segment Builder** | Natural language → structured filter rules |
| **AI Message Generator** | Goal + Audience + Tone → Subject, Headline, Message, CTA (3 variants) |
| **AI Performance Analyst** | Campaign data → What worked, failed, suggestions, predictions |
| **AI Copilot Chat** | Conversational CRM assistant with full context |
| **Audience Suggestions** | AI-recommended segment ideas based on your data |

### 📊 Core CRM
- **Customer Management** — CRUD, search, filter, import sample data
- **Order Management** — Purchase history, revenue tracking, category analytics
- **Dynamic Segmentation** — 5+ filter types, AND/OR logic, real-time preview
- **Campaign Management** — Multi-step creation, AI message generation, one-click launch
- **Communication Tracking** — Full event timeline (sent → delivered → opened → clicked → converted)
- **Analytics Dashboard** — Revenue trends, conversion rates, top campaigns

### 🚀 Infrastructure
- **Separate Channel Microservice** — Simulates real-world delivery with probabilities
- **Async Delivery Pipeline** — Queue-based with retry + dead-letter
- **JWT Authentication** — Stateless, scalable
- **Docker Compose** — Full local setup in one command

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Git

### Option A — Docker Compose (Recommended)

```bash
git clone <your-repo>
cd smartreach-crm

# Copy env files
cp .env.example .env

# Start everything
docker-compose up -d

# Seed database
docker-compose exec backend npx prisma db seed
```

Access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Channel Service**: http://localhost:5000

### Option B — Local Development

```bash
# 1. Start PostgreSQL (or use docker just for DB)
docker run -d -e POSTGRES_USER=smartreach -e POSTGRES_PASSWORD=smartreach_pass \
  -e POSTGRES_DB=smartreach_crm -p 5432:5432 postgres:16-alpine

# 2. Backend
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run dev        # port 4000

# 3. Channel Service
cd ../channel-service
npm install
npm run dev        # port 5000

# 4. Frontend
cd ../frontend
npm install
npm run dev        # port 3000
```

### Demo Login Credentials
```
Email:    admin@smartreach.ai
Password: Admin@123
```

---

## 📁 Project Structure

```
smartreach-crm/
├── frontend/                    # Next.js 15 + TypeScript + TailwindCSS
│   └── src/
│       ├── app/                 # App Router pages
│       │   ├── login/           # Auth page
│       │   └── dashboard/       # Protected pages
│       │       ├── customers/
│       │       ├── orders/
│       │       ├── segments/
│       │       ├── campaigns/
│       │       ├── analytics/
│       │       ├── copilot/
│       │       └── settings/
│       ├── components/layout/   # Sidebar, Header
│       ├── lib/                 # API client, utils
│       └── store/               # Zustand state
│
├── backend/                     # Express + TypeScript + Prisma
│   ├── prisma/
│   │   ├── schema.prisma        # Complete DB schema
│   │   └── seed.ts              # 100 customers, 500 orders, campaigns
│   └── src/
│       ├── routes/              # 8 route modules
│       ├── controllers/         # Business logic
│       ├── services/            # AI, Campaign, Segment, Channel
│       └── middleware/          # Auth, Error handling
│
├── channel-service/             # Separate microservice
│   └── src/
│       ├── services/
│       │   ├── simulator.ts     # Probabilistic delivery simulation
│       │   └── queue.ts         # In-memory queue with retry
│       └── routes/
│
├── docker-compose.yml
├── .env.example
├── README.md
└── INTERVIEW_GUIDE.md
```

---

## 🗄️ Database Schema

```prisma
User          → CRM operators with JWT auth
Customer      → Core entity (demographics, spend metrics)
Order         → Purchase history
Segment       → Saved dynamic filter rules (JSON)
Campaign      → Marketing campaigns with status + aggregated stats
Communication → Individual message per customer per campaign
CommunicationEvent → Event timeline (sent, delivered, opened, clicked...)
```

---

## 📡 API Reference

### Authentication
```
POST /api/auth/register   Register new user
POST /api/auth/login      Login (returns JWT)
GET  /api/auth/me         Get current user
```

### Customers
```
GET    /api/customers          List with search/filter/pagination
GET    /api/customers/stats    Aggregated customer stats
GET    /api/customers/:id      Get single customer with orders
POST   /api/customers          Create customer
PUT    /api/customers/:id      Update customer
DELETE /api/customers/:id      Delete customer
POST   /api/customers/import-sample  Import demo data
```

### Segments
```
GET    /api/segments              List all segments
POST   /api/segments              Create segment
POST   /api/segments/preview      Preview matching customers (without saving)
GET    /api/segments/:id          Get segment
PUT    /api/segments/:id          Update segment
DELETE /api/segments/:id          Delete segment
POST   /api/segments/:id/evaluate Evaluate and return matching customers
```

### Campaigns
```
GET    /api/campaigns              List campaigns
POST   /api/campaigns              Create campaign
GET    /api/campaigns/:id          Get campaign detail
PUT    /api/campaigns/:id          Update campaign
DELETE /api/campaigns/:id          Delete campaign
POST   /api/campaigns/:id/launch   Launch campaign
GET    /api/campaigns/:id/communications  Get communications with events
```

### AI
```
POST /api/ai/segment-builder      Natural language → filter rules
POST /api/ai/generate-message     Generate campaign copy variants
POST /api/ai/analyze-performance  Deep campaign analysis
POST /api/ai/chat                 AI Copilot conversational interface
GET  /api/ai/audience-suggestions AI-recommended segments
```

### Analytics
```
GET /api/analytics/dashboard   Full dashboard stats
GET /api/analytics/campaigns   Campaign performance analytics
GET /api/analytics/revenue     Revenue breakdown
```

### Channel Callback (internal)
```
POST /api/channel/receipt   Receive delivery events from channel service
```

---

## 🤖 AI Integration Details

All AI features use OpenAI GPT-4o-mini with structured JSON outputs:

### Segment Builder
```
Input:  "Find inactive customers from Delhi who spent more than ₹5000"
Output: {
  "rules": [
    { "field": "city", "operator": "eq", "value": "Delhi" },
    { "field": "totalSpent", "operator": "gt", "value": 5000 },
    { "field": "lastPurchaseDate", "operator": "daysAgo", "value": 30 }
  ],
  "operator": "AND",
  "name": "Inactive Delhi High-Value",
  "description": "..."
}
```

### Campaign Generator
```
Input:  { goal: "Reactivate shoppers", audience: "Inactive 60+ days", tone: "Friendly" }
Output: {
  "subject": "We miss you! Here's 20% off 🎁",
  "headline": "Your exclusive comeback offer is waiting",
  "message": "...",
  "cta": "Claim Your Discount",
  "variants": [...]
}
```

---

## 📡 Channel Service Communication Flow

```
1. CRM Backend → POST /send (channel-service:5000)
2. Channel Service queues the message
3. Simulates delivery with probabilities:
   - DELIVERED: 85% probability
   - FAILED:    15% probability
   - OPENED:    60% of delivered
   - READ:      75% of opened
   - CLICKED:   40% of read
   - CONVERTED: 25% of clicked
4. For each event → POST /api/channel/receipt (backend:4000)
5. Backend updates communication status + campaign aggregates
```

---

## ⚡ Scalability Design

### For 1M Customers
- **Database Indexing**: All filter fields indexed (city, totalSpent, lastPurchaseDate, email)
- **Pagination**: Max 100 records per request
- **Segment Evaluation**: Prisma query pushdown to PostgreSQL
- **Campaign Launch**: Async (non-blocking response), batch processing

### Queue & Delivery
- **Production**: Replace in-memory queue with Bull + Redis
- **Retry Logic**: Exponential backoff (1s, 2s, 4s)
- **Dead Letter Queue**: Failed callbacks logged for analysis

### Caching Strategy (Production)
- Redis cache for segment evaluations (TTL: 5 mins)
- Dashboard stats cached (TTL: 1 min)
- Customer list with stale-while-revalidate

### Horizontal Scaling
- Stateless JWT auth (no session store)
- Channel service independently scalable
- PostgreSQL with read replicas
- Load balancer in front of multiple backend instances

---

## 🧪 Testing

```bash
# Backend unit tests
cd backend
npm test

# With coverage
npm run test -- --coverage
```

Test coverage:
- Auth controller (register, login, JWT validation)
- Segment service (filter rule building)
- Campaign service (launch flow)
- Channel controller (callback handling)

---

## 🐳 Docker

```bash
# Build all services
docker-compose build

# Start
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

---

## 🚀 Render Deployment

### Backend
1. Create new Web Service
2. Connect your repo → `backend/` directory
3. Build command: `npm install && npx prisma generate && npm run build`
4. Start command: `npx prisma migrate deploy && node dist/index.js`
5. Environment variables: (see `.env.example`)

### Channel Service
1. Create new Web Service
2. Connect repo → `channel-service/` directory
3. Build: `npm install && npm run build`
4. Start: `node dist/index.js`
5. Set `BACKEND_CALLBACK_URL` to backend's Render URL

### Frontend
1. Create new Static Site or Web Service
2. Connect repo → `frontend/` directory
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Set `NEXT_PUBLIC_API_URL` to backend's Render URL

### Database
1. Create Render PostgreSQL instance
2. Copy `DATABASE_URL` to backend env vars

---

## 🏆 Design Decisions & Tradeoffs

| Decision | Why | Tradeoff |
|---|---|---|
| Separate Channel Service | Fault isolation, independent scaling | Extra network hop |
| In-memory queue | Simple demo setup | Not persistent across restarts |
| Denormalized campaign stats | Fast dashboard reads | Must sync on each event |
| JWT (stateless) | Horizontally scalable | Can't invalidate instantly |
| GPT-4o-mini | Cost-effective, fast | Less capable than GPT-4o |
| Prisma | Type-safe, migrations | Slightly slower than raw SQL for bulk ops |

---

## 🔮 Future Improvements

- [ ] Real email/SMS delivery via SendGrid / Twilio
- [ ] Redis for caching and Bull queues
- [ ] WebSocket for real-time campaign updates
- [ ] A/B testing framework for campaigns
- [ ] Customer churn prediction ML model
- [ ] Multi-tenant support
- [ ] Webhook integration for Shopify / WooCommerce
- [ ] CSV import/export for customers
- [ ] Campaign scheduling (cron-based)
- [ ] Role-based access control (RBAC)

---

## 👨‍💻 Built for Xeno CRM Interview

This project demonstrates:
1. **Full-stack TypeScript** — Next.js 15, Express, Prisma
2. **AI Integration** — OpenAI GPT-4o-mini with structured outputs
3. **Microservices** — Separate channel service with async callbacks
4. **Event-driven** — Communication event timeline tracking
5. **Production patterns** — Error handling, logging, rate limiting, auth middleware
6. **Database design** — Normalized schema with proper indexes and relationships
