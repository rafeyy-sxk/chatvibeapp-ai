# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Next.js on localhost:3000 (webpack, not turbopack)
npm run worker        # BullMQ analysis worker (requires Redis)
npm run worker:email  # BullMQ email worker

# Database
npm run db:migrate    # prisma migrate dev (development)
npm run db:migrate:prod  # node scripts/migrate-production.js
npx prisma generate   # regenerate client after schema changes
npm run db:studio     # Prisma Studio GUI

# Tests
npm test              # Jest (cross-env NODE_ENV=test jest --runInBand)
npm run test:watch    # Jest watch mode
npm run test:e2e      # Playwright end-to-end
npm run test:security # Rate limit + security tests only

# Quality
npm run lint          # ESLint
npm run verify        # node scripts/verify-production.js
npm run verify:deploy # node scripts/deployment-verification.js
npm run build         # prisma generate + next build
```

## Architecture

### Request → Response flow

1. Client calls an API route in `app/api/`
2. Route verifies auth via `extractUserFromRequest(request)` from `lib/auth/tokens.js` (returns `{sub: userId}` or null)
3. Route applies rate limiting via `lib/rateLimit/tierAware.js`
4. For analysis: route creates a `prisma.analysisJob` record and enqueues it via `lib/queue/index.js` → BullMQ → Redis
5. Worker in `server/workers/analysisWorker.js` picks up the job and calls the AI engine
6. Results streamed to client via SSE at `app/api/jobs/[id]/stream/route.js`

All API responses must follow: `{ data: ..., error: ..., status: "ok"|"error" }`.
All responses go through `applySecurityHeaders()` from `lib/security/headers.js`.

### AI engine (unified Groq)

- **All AI calls**: `lib/ai.js` → `generate()` / `generateStream()` → Groq API (`meta-llama/llama-4-scout-17b-16e-instruct`). Requires `GROQ_API_KEY`.
- **Vision analysis**: `app/api/analyze-vision/route.js` uses `lib/ai.js` — accepts base64 images, returns structured JSON analysis.
- **Text streaming**: `app/api/analyze/stream/route.js` uses `lib/ai.js` — streams tokens to client via SSE.
- **Chat**: `app/api/chat/route.js` uses `lib/ai.js` — conversational follow-up on analysis results.
- `geminiSummary` field on `AnalysisReport` is the JSON analysis blob — do not rename without a migration (legacy column name).
- `server/src/services/analysisEngine.js` runs local heuristics synchronously — no external AI call.

### Auth

- JWT access tokens (15 min) verified by `verifyAccessToken()` in `lib/auth/tokens.js`
- Refresh tokens (7 days) stored as hashed values in `RefreshToken` table, via httpOnly cookies
- Use `extractUserFromRequest(request)` as the canonical auth helper in all new routes — do not inline the Bearer extraction pattern
- Account lockout after 3 failed logins (`lib/auth/lockout.js`)

### Database schema key points

- `AnalysisJob` is the job tracking record (status enum: `QUEUED → PROCESSING → COMPLETED/FAILED`)
- `AnalysisReport` holds the final output — linked 1:1 to `AnalysisJob` via `jobId`
- `BillingSubscription.creditsRemaining` is the per-user monthly credit counter
- `credits` column on `User` model is the primary credit gate checked before queuing
- Do **not** modify migration files in `prisma/migrations/` — use `prisma migrate dev` to create new ones

### Worker processes

`server/workers/` must run as a **separate Node.js process** (`npm run worker`) — they are not loaded by Next.js. On Vercel/serverless, these workers must run on a persistent host (Railway, Fly.io, EC2). The workers connect to the same Redis and PostgreSQL.

### Billing / feature gating

- `lib/billing/featureGating.js` — `isSubscriptionActive(userId)` — call before consuming credits
- `lib/billing/usage.js` — credit deduction and overage tracking
- Stripe webhooks arrive at `app/api/billing/webhook/route.js` — events update `BillingSubscription` and `BillingEvent`

### Redis / caching

- `lib/redis.js` — singleton ioredis client with graceful fallback (features degrade if Redis is unavailable, app does not crash)
- `lib/cache/analysisCache.js` — wraps Redis for analysis result caching (1h TTL for OCR, 24h for identical image hashes)
- Chat conversation history stored at key `chat:{userId}:{jobId}` (24h TTL)

### Key environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL (use pooler URL in production) |
| `REDIS_URL` | ioredis connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing |
| `GROQ_API_KEY` | Required — all AI calls go through Groq (`meta-llama/llama-4-scout-17b-16e-instruct`) |
| `QUEUE_NAME` | BullMQ queue name (default: `analysis-queue`) |

### Pending migrations (TODO before launch)

- Add `Webhook` model (see `app/api/webhooks/outbound/route.js` for the schema comment)
- Remove `@google-ai/generativelanguage` from `package.json`

### New utilities added (2026-05-06)

- `lib/ai.js` — Groq client (`generate`, `generateStream`, `healthCheck`, `vibePrompt`)
- `lib/confidence.js` — OCR + AI confidence scoring
- `lib/redaction.js` — PII detection + redaction (supersedes duplicate logic in `server/src/services/analysisEngine.js`)
- `lib/ocr/languages.js` — Multi-language Tesseract config
- `hooks/useKeyboardShortcuts.js` — Global keyboard shortcuts
- `components/ThemeToggle.jsx` — Dark/Light/System theme toggle
