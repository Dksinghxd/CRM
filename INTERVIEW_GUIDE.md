# SmartReach AI CRM — Interview Guide

> Prepared for Xeno CRM Engineering Interview. Model answers for architectural, technical, and behavioral questions.

---

## 1. Architecture Questions

---

### Q1: Walk me through the overall system architecture.

**Answer:**

SmartReach AI CRM is built as a distributed system with three independent services:

1. **Frontend (Next.js 15)** — Server-side rendered React application with App Router. Communicates with the backend via REST APIs using JWT tokens for auth. Uses Zustand for client-side state and Recharts for data visualization.

2. **Backend API (Express + TypeScript)** — The primary server running on port 4000. Handles all CRM business logic: customer management, segment evaluation, campaign orchestration, analytics aggregation, and AI integration. Uses Prisma ORM to interact with PostgreSQL.

3. **Channel Microservice (Express + TypeScript)** — A completely separate process on port 5000 that simulates message delivery across channels (Email, SMS, WhatsApp, Push). It accepts send requests, queues them, simulates delivery outcomes probabilistically, and fires async callbacks back to the backend.

The flow for a campaign launch:
```
User clicks Launch →
Backend creates Communication records →
Backend fires POST /send to Channel Service →
Channel Service simulates delivery (async) →
Channel Service POSTs /api/channel/receipt for each event →
Backend updates Communication status + Campaign aggregates
```

The key architectural decisions:
- **Separate channel service** for fault isolation and independent scaling
- **Denormalized stats** on Campaign (totalSent, totalDelivered, etc.) for fast dashboard reads
- **Stateless JWT** for horizontal scaling of the backend
- **OpenAI abstraction layer** with fallbacks so the app never crashes if AI is unavailable

---

### Q2: How does the Communication Tracking work?

**Answer:**

Every message sent to a customer creates a `Communication` record. Each status change creates a `CommunicationEvent` record with a timestamp and metadata.

The event timeline looks like:
```
sent (T+0s)
  └─ delivered (T+3s)   [85% chance]
       └─ opened (T+10s) [60% chance]
            └─ read (T+25s) [75% chance]
                 └─ clicked (T+45s) [40% chance]
                      └─ converted (T+90s) [25% chance]
  └─ failed (T+3s)    [15% chance]
```

On each callback from the Channel Service, the backend:
1. Finds the `Communication` record by ID
2. Only upgrades status (never downgrades — converted can't go back to opened)
3. Creates a `CommunicationEvent` record with timestamp and metadata
4. Updates the parent `Campaign`'s aggregated stats (totalDelivered++, etc.)

This two-table design (`Communication` + `CommunicationEvent`) lets you:
- Query current status O(1) from `Communication`
- See full timeline from `CommunicationEvent`
- Calculate rates from `Campaign` denormalized stats without expensive JOINs

---

### Q3: How would you handle 1 million customers?

**Answer:**

**Database:**
- All filter fields are indexed: `city`, `totalSpent`, `lastPurchaseDate`, `email`, `age`
- Pagination (max 100 records/request) prevents full table scans
- Segment evaluation uses Prisma queries that push filters to PostgreSQL
- Read replicas for analytics queries (write to primary, read from replica)

**Segmentation:**
- Complex segments can be precomputed and cached (Redis, TTL: 5 mins)
- For real-time preview, limit to 20 results (COUNT + LIMIT)
- For campaign launch, process in batches of 1000, not all at once

**Campaign Launch:**
- Replace synchronous loop with Bull job queue (Redis-backed)
- Process 1000 customers per job, spawn multiple workers
- Each worker creates Communication records and calls Channel Service
- Progress tracked via Redis, reported to frontend via WebSocket

**Channel Service:**
- Bull queue instead of in-memory array
- Horizontal scaling behind load balancer
- Dead letter queue for failed callbacks

**Analytics:**
- Materialized views for expensive aggregations (revenue by month)
- Background jobs to precompute dashboard stats every 5 minutes
- Cache dashboard response in Redis (TTL: 60s)

---

## 2. Database Questions

---

### Q4: Why did you choose this Prisma schema design?

**Answer:**

Key design decisions:

**Denormalized stats on Campaign:**
```prisma
model Campaign {
  totalSent      Int @default(0)
  totalDelivered Int @default(0)
  totalOpened    Int @default(0)
  totalClicked   Int @default(0)
  totalConverted Int @default(0)
}
```
Rather than `SELECT COUNT(*) FROM communications WHERE campaignId=? AND status='DELIVERED'`, we increment these on every event. This makes dashboard reads O(1). The tradeoff is eventual consistency — if a callback is missed, stats may be slightly off, but the event records remain accurate.

**Segment rules as JSON:**
```prisma
model Segment {
  rules    Json    // Array of filter rules
  operator String  // AND | OR
}
```
Storing rules as JSON in PostgreSQL gives flexibility to add new filter types without migrations. The segment service (`segment.service.ts`) interprets these rules and builds Prisma WHERE clauses dynamically.

**CommunicationEvent as a separate table:**
Separating events from current status allows:
- Fast current status lookup from `Communication.status`
- Complete audit trail from `CommunicationEvent`
- Efficient filtering: "show all opened events today" without scanning Communications

**Indexes:**
```sql
@@index([email])
@@index([city])
@@index([totalSpent])
@@index([lastPurchaseDate])
```
These cover the most common filter patterns in segment building.

---

### Q5: Why PostgreSQL over MongoDB?

**Answer:**

1. **ACID transactions**: Campaign launch creates multiple Communication records atomically. If it fails mid-way, we need rollback guarantee.

2. **Relational integrity**: Customer → Orders → Communications → Events. Foreign keys with `onDelete: Cascade` prevent orphaned records.

3. **Complex queries**: Analytics queries like "revenue grouped by month" are much easier in SQL (`DATE_TRUNC`, `GROUP BY`) than in MongoDB's aggregation pipeline.

4. **JSON support**: PostgreSQL's JSONB column gives us MongoDB-style flexibility for segment rules while keeping relational benefits.

5. **Prisma support**: Prisma's type generation from schema is more mature for PostgreSQL.

**MongoDB would be better if:**
- We needed to store unstructured customer attributes at scale
- We needed horizontal sharding from day 1
- Document size varied dramatically between customers

---

## 3. API Questions

---

### Q6: How does the Segment Evaluation API work?

**Answer:**

`POST /api/segments/:id/evaluate`

1. Fetch the Segment record from DB (includes `rules` JSON and `operator`)
2. Call `evaluateSegmentRules(rules, operator)` in `segment.service.ts`
3. This function maps each rule to a Prisma `WHERE` condition:
   ```typescript
   // Input rule:
   { field: "totalSpent", operator: "gt", value: 5000 }
   
   // Output Prisma condition:
   { totalSpent: { gt: 5000 } }
   
   // Input rule:
   { field: "lastPurchaseDate", operator: "daysAgo", value: 30 }
   
   // Output Prisma condition:
   { lastPurchaseDate: { lt: new Date(Date.now() - 30 * 86400000) } }
   ```
4. All conditions combined with `AND: [...]` or `OR: [...]`
5. Returns matching customers + total count
6. Updates `Segment.customerCount` for display

For `POST /api/segments/preview` — same logic but doesn't save, limits to 20 results.

---

### Q7: How do you prevent race conditions when updating Campaign stats?

**Answer:**

Current approach — Prisma increment operations are atomic at the DB level:
```typescript
await prisma.campaign.update({
  where: { id: campaignId },
  data: { totalDelivered: { increment: 1 } }
});
```

PostgreSQL executes `UPDATE campaigns SET total_delivered = total_delivered + 1 WHERE id = ?` — this is atomic even with concurrent updates.

For production at scale:
1. Use database transactions for bulk updates
2. Use Redis `INCR` for high-frequency counter updates, batch flush to PostgreSQL
3. Use Postgres advisory locks for campaign launch to prevent double-launch

---

## 4. AI Questions

---

### Q8: Explain your OpenAI integration architecture.

**Answer:**

I built an **abstraction layer** (`ai.service.ts`) that:

1. **Structured JSON outputs** — Every OpenAI call uses `response_format: { type: 'json_object' }` to get machine-readable responses. The system prompt specifies the exact JSON schema expected.

2. **Graceful fallbacks** — Every AI function has a non-AI fallback:
   ```typescript
   try {
     const result = await openai.chat.completions.create({...});
     return JSON.parse(result.choices[0].message.content);
   } catch (error) {
     return buildSegmentFallback(prompt); // Rule-based fallback
   }
   ```
   This means the app works 100% even if OpenAI is down or the key is invalid.

3. **Context injection** — The AI Copilot receives live CRM stats (total customers, revenue, recent campaigns) as system context, making responses data-grounded.

4. **Model choice** — `gpt-4o-mini` over `gpt-4o` because:
   - 10x cheaper
   - Much faster (critical for UX)
   - Sufficient for structured JSON extraction
   - For better reasoning, easily swap to `gpt-4o`

5. **Prompt engineering** — System prompts are carefully crafted with examples of the exact JSON format, field names, and operators to minimize hallucinations.

---

### Q9: How would you make the AI Segment Builder more accurate?

**Answer:**

Current approach: zero-shot prompt with field/operator documentation.

Improvements:
1. **Few-shot examples** — Add 5-6 example prompt→rules pairs in the system prompt. This dramatically improves JSON structure accuracy.

2. **Fine-tuning** — Collect user corrections (when AI-generated rules don't match intent) to create training data for a fine-tuned model.

3. **Retrieval-Augmented** — If customer database has many custom fields, use embedding search to find relevant field definitions to include in the prompt.

4. **Validation layer** — After AI generates rules, validate them against the schema and reject invalid fields/operators before showing the user.

5. **Interactive refinement** — Let users say "also add Mumbai customers" and the AI refines the existing rules rather than starting fresh.

---

## 5. Scalability Questions

---

### Q10: How does your queue improve delivery reliability?

**Answer:**

The Channel Service uses an in-memory queue to:

1. **Decouple receiving and processing** — `POST /send` returns immediately (`status: 'queued'`), while the actual simulation happens asynchronously. This means the CRM backend gets fast responses even if delivery takes 2 minutes.

2. **Concurrency control** — Queue processes max 10 messages simultaneously. Without this, 10,000 campaign messages would all fire at once, overwhelming the backend callback endpoint.

3. **Retry on callback failure** — If the backend callback endpoint returns a 5xx error, the queue retries with exponential backoff (1s, 2s, 4s). After 3 failures, moves to dead-letter queue.

4. **Visibility** — `GET /queue/status` shows pending, processing, completed, deadLetter counts — useful for debugging campaign delivery issues.

**Production upgrade path:**
```
In-memory queue → Bull (Redis-backed)
                → Kafka (for massive scale)
```

Bull adds: persistence across restarts, distributed workers, priority queues, rate limiting, cron jobs.

---

### Q11: What caching strategy would you implement?

**Answer:**

```
Layer 1: Browser/React Query cache (60s stale)
  - Customer list, campaign list, dashboard stats

Layer 2: Redis application cache
  - Dashboard stats: TTL 60s (acceptable staleness)
  - Segment evaluation: TTL 5 mins (saves expensive DB queries)
  - AI audience suggestions: TTL 1 hour (doesn't change often)

Layer 3: PostgreSQL materialized views
  - Monthly revenue aggregations (refreshed every 30 mins)
  - Top performing segments/campaigns

Layer 4: Database read replicas
  - All analytics queries → read replica
  - All write operations → primary
```

Cache invalidation strategy:
- Customer CRUD → invalidate customer list cache
- Campaign launch → invalidate campaign + dashboard cache
- New order → invalidate revenue cache

---

## 6. Tradeoffs Discussion

---

### Q12: What are the biggest tradeoffs in your design?

**Answer:**

**1. Denormalized Campaign Stats vs. Consistency**
- **Chose**: Increment stats on each callback event
- **Pro**: O(1) dashboard reads, no expensive COUNT queries
- **Con**: Stats slightly inconsistent if callbacks are lost
- **Alternative**: Always compute from `CommunicationEvent` table (accurate but slow at scale)
- **Mitigation**: Nightly reconciliation job that recomputes stats from events

**2. In-Memory Queue vs. Redis/Bull**
- **Chose**: In-memory queue for simplicity
- **Pro**: Zero infrastructure dependencies, easy to understand
- **Con**: Lost on restart, single-process, not distributed
- **Production path**: Bull + Redis in 1 sprint

**3. JWT over Sessions**
- **Chose**: Stateless JWT
- **Pro**: No session store, horizontally scalable
- **Con**: Can't instantly revoke tokens (only expires naturally)
- **Mitigation**: Short-lived tokens (7d), refresh token pattern for long sessions

**4. Single PostgreSQL vs. CQRS**
- **Chose**: Single PostgreSQL with denormalization
- **Pro**: Simple, consistent, Prisma handles everything
- **Con**: Analytics queries compete with write operations for DB resources
- **Production path**: Separate read replica for analytics queries

---

## 7. Why Separate Channel Service?

---

### Q13: Why did you build the Channel Service as a separate microservice?

**Answer:**

Five reasons:

1. **Fault Isolation** — If the channel service goes down (e.g., external SMS provider is flaky), the CRM backend keeps running. Campaigns are queued and retried. Without separation, a channel failure would crash the entire CRM.

2. **Independent Scaling** — During a massive campaign (10,000 emails), the channel service needs to scale up. With microservice architecture, you can run 5 channel service instances behind a load balancer without scaling the CRM backend.

3. **Provider Abstraction** — In production, each channel would use a different provider:
   - Email → SendGrid
   - SMS → Twilio
   - WhatsApp → Meta Business API
   - Push → Firebase Cloud Messaging
   The channel service hides this complexity from the CRM backend.

4. **Async Callback Pattern** — Real email providers (SendGrid, Mailgun) use webhooks/callbacks for delivery status. The channel service simulates exactly this pattern, making it easy to swap simulation for real providers.

5. **Testability** — You can test campaign logic without hitting real APIs. The channel service can be mocked to return specific events for testing specific campaign scenarios.

---

## 8. Why PostgreSQL?

---

### Q14: Why PostgreSQL over other databases?

**Answer:**

SmartReach has specific needs that PostgreSQL serves exceptionally well:

1. **ACID for financial data** — Customer spend, order amounts must be consistent. A customer's `totalSpent` being incorrect could cause wrong segment targeting and revenue loss.

2. **Complex analytics** — "Show revenue grouped by month" or "find customers who spent more than average" are natural SQL queries. NoSQL would require complex application-level aggregation.

3. **JSON columns** — Segment rules stored as JSONB. PostgreSQL can index and query JSONB efficiently, giving NoSQL-like flexibility with relational benefits.

4. **Full-text search** — Customer search by name/email uses `ILIKE` queries. PostgreSQL supports GIN indexes for fast full-text search if needed.

5. **Prisma compatibility** — Prisma's schema inference and migration system works best with PostgreSQL. Features like `@@index`, relations, and enums map cleanly.

6. **Heroku/Render support** — Managed PostgreSQL is available on all major PaaS platforms, simplifying deployment.

---

## 9. Why Prisma?

---

### Q15: What made you choose Prisma ORM?

**Answer:**

1. **Type Safety** — Prisma generates TypeScript types from the schema. You can't accidentally pass wrong field names or wrong types. Errors are caught at compile time, not runtime.

2. **Schema-First** — The `schema.prisma` file is the single source of truth. It drives migrations, generates the client, and documents the data model simultaneously.

3. **Relation Handling** — Complex queries with `include` (JOIN) and `select` (projection) are clean and readable:
   ```typescript
   await prisma.campaign.findUnique({
     where: { id },
     include: { segment: true, _count: { select: { communications: true } } }
   });
   ```
   Raw SQL equivalent would be much more verbose and error-prone.

4. **Migrations** — `prisma migrate dev` handles schema changes, generates SQL, and applies it. Easy to track in version control.

5. **Prisma Studio** — Built-in GUI to view/edit data during development. Extremely useful for debugging.

**When I'd use raw SQL:**
- Complex analytics queries (window functions, lateral joins)
- Bulk operations (INSERT 10,000 rows — Prisma is slower than raw SQL)
- When Prisma's query planner generates inefficient SQL

---

## 10. Why Next.js?

---

### Q16: Why Next.js 15 for the frontend?

**Answer:**

1. **App Router** — The new App Router enables Server Components, streaming, and nested layouts. The dashboard layout with Sidebar and Header wrapping all protected pages is clean with `layout.tsx`.

2. **TypeScript First** — Next.js 15 has full TypeScript support out of the box with automatic type generation for routes and metadata.

3. **File-based Routing** — `/dashboard/customers/page.tsx` is immediately understandable. Adding a new page requires no router configuration.

4. **Performance** — Automatic code splitting, image optimization, and font optimization (`next/font/google`) give production-grade performance with zero config.

5. **Deployment Ready** — `output: 'standalone'` in `next.config.ts` creates a minimal Docker image. Render, Vercel, and AWS all support Next.js natively.

6. **API Routes** (if needed) — If we wanted to add BFF (Backend For Frontend) patterns or middleware, Next.js API routes are right there without a separate server.

**Alternative considered:** Vite + React Router 7
- Pros: Faster dev server, more flexibility
- Cons: More boilerplate for layouts, no built-in server rendering optimization

---

## Bonus: System Design Interview Walkthrough

### "Design the Campaign Launch Flow for 100,000 customers"

**Step 1 — API Layer**
User clicks "Launch" → `POST /api/campaigns/:id/launch`
- Validate campaign has a segment
- Update status to `RUNNING`
- Return immediately with `202 Accepted` (don't wait for completion)

**Step 2 — Job Queue**
- Enqueue a `LAUNCH_CAMPAIGN` job to Bull/Redis
- Job payload: `{ campaignId, segmentId }`

**Step 3 — Worker Processing**
- Worker picks up job
- Evaluates segment in batches of 1000: `SELECT id FROM customers WHERE ... LIMIT 1000 OFFSET 0`
- For each batch: create 1000 `Communication` records in a DB transaction
- Fire 1000 `POST /send` requests to channel service (with concurrency limit of 50)
- Track progress in Redis: `campaign:${id}:progress = { sent: 500, total: 100000 }`

**Step 4 — Channel Service**
- Receives 1000 messages per batch
- Internal queue processes them asynchronously
- Fires callbacks to backend as events occur over minutes/hours

**Step 5 — Callback Processing**
- `POST /api/channel/receipt` handled by separate Express worker
- Updates `Communication` status and `Campaign` aggregates
- Uses PostgreSQL atomic increments (no race conditions)

**Step 6 — Completion**
- Worker polls progress, marks campaign `COMPLETED` when all customers processed
- Frontend polls campaign status every 5 seconds (or WebSocket push)

**Complexity:** O(n) for customer evaluation, O(n) for Communication creation, O(1) for each event callback
**Throughput:** 10,000 messages/minute with 10 channel service instances
**Failure handling:** Job retries 3 times, failed batches logged separately

---

*End of Interview Guide — Built for Xeno CRM Engineering Interview*
