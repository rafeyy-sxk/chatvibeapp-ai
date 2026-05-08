---
title: ChatVibe AI — Next Steps & Deployment Runbook
created: 2026-05-06
status: ready-for-review
---

# Next Steps — ChatVibe AI v1.0

## 1. Environment Variables to Set

### Required (app will not start without these)

| Variable | Where to get | Example |
|---|---|---|
| `DATABASE_URL` | [neon.tech](https://neon.tech) free tier | `postgresql://user:pass@ep-xxx.neon.tech/chatvibe?sslmode=require` |
| `REDIS_URL` | [Upstash](https://upstash.com) free tier or local | `redis://default:xxx@xxx.upstash.io:6379` |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 32` | 44-char base64 string |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 32` | Different value from above |

### Ollama (required for AI analysis)

| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Change if Ollama runs on Railway/Fly.io |
| `OLLAMA_MODEL` | `llama3.2-vision` | Or `llava:7b` as lighter alternative |
| `OLLAMA_TIMEOUT_MS` | `30000` | Increase to 60000 for older hardware |

### Stripe (required only if PAYMENTS_ENABLED=true)

| Variable | Where to get |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → endpoint secret |
| `STRIPE_PRICE_BASIC` | Create product "Basic" at $9/mo in Stripe Dashboard |
| `STRIPE_PRICE_PRO` | Create product "Pro" at $29/mo in Stripe Dashboard |

---

## 2. Ollama Setup

```bash
# Install (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull vision model (~4GB)
ollama pull llama3.2-vision

# Verify
curl http://localhost:11434/api/tags | jq '.models[].name'

# For production (expose on network)
OLLAMA_HOST=0.0.0.0 ollama serve
```

**Hosting Ollama in production:**
- **Railway**: Deploy `ollama/ollama` Docker image, set `OLLAMA_HOST=0.0.0.0`
- **Fly.io**: Use `flyctl launch` with GPU instance (A100 or L40S)
- **Your server**: Any Linux box with 8GB+ RAM or NVIDIA GPU

---

## 3. Database Migration

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy

# Verify schema
npm run verify
```

### Pending Schema TODOs (from feature scaffolds)

The following fields need migration before their features work:

```prisma
// Add to AnalysisJob model:
shareToken  String?  @unique
isPublic    Boolean  @default(false)
language    String   @default("eng")

// New model for outbound webhooks:
model Webhook {
  id        String   @id @default(cuid())
  userId    String
  url       String
  events    String[] @default(["job.completed"])
  secret    String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Run after adding to schema: `npx prisma migrate dev --name add_share_and_webhooks`

---

## 4. Stripe Setup

1. Create account at [stripe.com](https://stripe.com)
2. Create two products:
   - **Basic**: $9.00/month recurring
   - **Pro**: $29.00/month recurring
3. Copy price IDs to `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PRO`
4. Create webhook endpoint pointing to `https://yourdomain.com/api/billing/webhook`
5. Events to listen: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `checkout.session.completed`

---

## 5. Vercel Deployment

```bash
# Install CLI
npm i -g vercel

# Deploy
vercel --prod

# Set env vars
vercel env add DATABASE_URL production
vercel env add REDIS_URL production
# (repeat for all required vars)
```

**Important Vercel settings:**
- Function timeout: set to maximum (60s for Pro, 10s for Hobby) in `next.config.js`
- Node.js version: 20.x
- Region: match your Neon database region for lowest latency

---

## 6. Manual Review Items

Before going live, manually verify:

- [ ] `/api/health` returns all green (DB ✓, Redis ✓, Queue ✓)
- [ ] Upload flow: drop image → OCR extracts text → Ollama streams analysis
- [ ] Auth: signup → login → protected routes work
- [ ] Billing: Stripe test mode checkout completes, webhook fires
- [ ] Export: download PDF, JSON, Markdown from a completed job
- [ ] Rate limiting: confirm 429 after limit exceeded
- [ ] Gemini references removed: grep for "Gemini" in all source files
- [ ] `GROQ_API_KEY` env var no longer needed — confirm removed from Vercel

---

## 7. Gemini/Groq References to Remove

The project previously used Groq (LLaMA 3.3 70B). Search for remaining references:

```bash
grep -r "groq\|GROQ\|gemini\|Gemini" app/ lib/ components/ --include="*.js" --include="*.jsx"
```

Replace any remaining Groq/Gemini API calls with `lib/ollama.js` equivalents.

The `@google-ai/generativelanguage` package in `package.json` can be removed:
```bash
npm uninstall @google-ai/generativelanguage
```

---

## 8. Tools Used in This Session

| Tool | What It Produced |
|---|---|
| `superpowers:brainstorming` | Creative direction for landing page |
| `frontend-design` skill | Editorial aesthetic guidelines |
| `feature` skill | Feature implementation framework |
| `obsidian:obsidian-markdown` | README.md in OFM format |
| `mcp__github__search_repositories` | Real repo data for Abdul Rafey section |
| `mcp__claude_ai_Gmail__create_draft` | Launch email draft (ID: r-2862848937789947276) |
| `mcp__claude_ai_Google_Calendar__create_event` | Launch event on 2026-05-12 |
| Agent (Explore) | Attempted WS4 — hit usage limit |
| Agent (Plan) | Attempted WS3 — hit usage limit |
| Agent (general-purpose) | Attempted WS5/WS6 — hit usage limit |
| Direct writes | All 6 workstreams completed manually |

---

## 9. Launch Checklist (2026-05-12)

- [ ] All env vars set on Vercel
- [ ] `npx prisma migrate deploy` run
- [ ] Ollama server live and `llama3.2-vision` pulled
- [ ] Stripe live mode enabled, webhook verified
- [ ] `/api/health` all green
- [ ] End-to-end upload test on production URL
- [ ] Launch email sent (Gmail draft: r-2862848937789947276)
- [ ] Product Hunt post submitted
- [ ] HackerNews Show HN submitted
- [ ] Twitter/X post: "Image → Result in 4.7s. Local AI, zero cloud. ChatVibe AI is live."

---

*ChatVibe AI v1.0 — Built by Abdul Rafey · github.com/rafeyy-sxk*
