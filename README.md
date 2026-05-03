# ChatVibe AI

**Decode every conversation.** Upload chat screenshots, extract text via browser-side OCR, and get AI-powered psychological insights — emotional metrics, behavioral flags, personality traits, and actionable advice — powered by Groq (LLaMA 3.3 70B).

🚀 **Live:** [chatvibeapp-ai.vercel.app](https://chatvibeapp-ai.vercel.app)

---

## What it does

1. **Upload** chat screenshots (WhatsApp, iMessage, Instagram DMs, Telegram — any platform)
2. **OCR** runs entirely in your browser via Tesseract.js — images never leave your device during text extraction
3. **Groq AI** (LLaMA 3.3 70B) analyses the extracted text and returns:
   - Overall conversation vibe
   - 7 emotional metrics (flirty, passive-aggressive, friendly, romantic, dry energy, angry, confused)
   - Personality traits detected
   - Behavioral flags (avoidance, manipulation, clinginess, etc.)
   - Honest relationship advice
4. **Results** are saved to your account and viewable anytime with full analytics charts

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19 |
| Styling | Tailwind CSS 4, Framer Motion |
| AI Analysis | Groq API — LLaMA 3.3 70B Versatile |
| OCR | Tesseract.js 6 (runs in browser) |
| Database | PostgreSQL via Neon (serverless) |
| Auth | JWT (access tokens 15min) + httpOnly refresh cookies (7 days) |
| Security | CSRF protection, bcrypt password hashing, account lockout |
| Deployment | Vercel (serverless) |

---

## Getting started locally

### Prerequisites
- Node.js 18+
- PostgreSQL (local) OR a Neon database URL

### 1. Clone the repo
```bash
git clone https://github.com/rafeyys/chatvibeapp-ai.git
cd chatvibeapp-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env.local` file in the root:
```env
# Database — use your own PostgreSQL or get a free one at neon.tech
DATABASE_URL="postgresql://user:password@localhost:5432/chatvibe"

# Groq API — free at console.groq.com
GROQ_API_KEY="gsk_your_key_here"

# Auth secrets — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
JWT_SECRET="your_32_char_minimum_secret"
REFRESH_TOKEN_SECRET="another_32_char_minimum_secret"

# Optional
REDIS_URL="redis://localhost:6379"
PAYMENTS_ENABLED="false"
```

### 4. Set up the database
```bash
npx prisma db push
```

### 5. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Link and deploy
```bash
vercel login
vercel --prod
```

### 3. Add environment variables in Vercel dashboard
Go to **Project Settings → Environment Variables** and add:

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | ✅ | [neon.tech](https://neon.tech) — free PostgreSQL |
| `GROQ_API_KEY` | ✅ | [console.groq.com](https://console.groq.com) — free |
| `JWT_SECRET` | ✅ | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `REFRESH_TOKEN_SECRET` | ✅ | Same as above, different value |
| `PAYMENTS_ENABLED` | ✅ | Set to `false` unless using Stripe |

### 4. Push schema to production database
```bash
npx prisma db push --url="your_neon_url"
```

### 5. Redeploy
```bash
vercel --prod
```

---

## Project structure

```
chatvibeapp-ai/
├── app/
│   ├── (auth)/              # Login, signup, forgot/reset password
│   ├── analysis/            # Results page + [id] detail view with charts
│   ├── billing/             # Subscription & usage page
│   ├── upload/              # Main upload interface
│   └── api/
│       ├── analyze-text/    # ✨ Core endpoint: receives OCR text → Groq → saves report
│       ├── auth/            # Login, signup, logout, refresh, reset
│       ├── billing/         # Stripe webhooks, usage, portal
│       ├── jobs/            # Async job queue (BullMQ, when Redis available)
│       ├── reports/         # Fetch saved reports
│       └── health/          # Database + Redis health check
├── components/
│   ├── UploadAreaV2.jsx     # Drop zone + browser OCR + Groq call
│   ├── Navbar.js            # Auth-aware responsive navbar
│   ├── JobStatusStream.jsx  # Real-time job progress via polling
│   ├── CreditMeter.jsx      # Usage display
│   └── UpgradeModal.jsx     # Billing upgrade flow
├── lib/
│   ├── auth/                # JWT tokens, refresh store, lockout
│   ├── billing/             # Stripe config, subscription, usage
│   ├── cache/               # Redis caching layer (graceful fallback)
│   ├── queue/               # BullMQ job queue (lazy init, optional)
│   ├── rateLimit.js         # In-memory rate limiting (no Redis required)
│   ├── env.js               # Centralized env var loading
│   └── prisma.js            # PrismaClient singleton
├── prisma/
│   └── schema.prisma        # Full data model (User, Reports, Billing, etc.)
├── server/
│   ├── src/services/
│   │   └── analysisEngine.js # Internal analytics (sentiment, toxicity, dominance)
│   └── workers/
│       └── analysisWorker.js # BullMQ worker (for self-hosted deployments)
└── middleware/
    └── csrf.js              # CSRF double-submit cookie protection
```

---

## How the analysis works

```
User uploads images
       ↓
Browser runs Tesseract.js OCR on each image (no server involved)
       ↓
Extracted text sent to POST /api/analyze-text
       ↓
Internal analytics engine runs (sentiment timeline, toxicity, dominance, keywords, behavior flags)
       ↓
Groq API (LLaMA 3.3 70B) analyses the conversation text
       ↓
Results saved to PostgreSQL (AnalysisReport)
       ↓
User redirected to /analysis/[reportId] — full charts and insights
```

---

## API reference

### POST `/api/analyze-text`
Analyses OCR-extracted conversation text.

**Auth:** Bearer token required

**Body:**
```json
{
  "text": "extracted conversation text",
  "customPrompt": "focus on passive aggression (optional)"
}
```

**Response:**
```json
{
  "reportId": "cuid",
  "analysis": {
    "summary": "...",
    "overall_vibe": "Flirtatious with emotional distance",
    "metrics": {
      "flirty": 72,
      "passive_aggressive": 28,
      "friendly": 85,
      "romantic": 55,
      "dry_energy": 40,
      "angry": 12,
      "confused": 18
    },
    "personality_traits": ["Direct communicator", "Emotionally guarded"],
    "behavior_flags": ["Mixed signals", "Avoidant patterns"],
    "advice": "..."
  }
}
```

### POST `/api/auth/signup`
```json
{ "username": "string", "email": "string (optional)", "password": "string (min 8)" }
```

### POST `/api/auth/login`
```json
{ "username": "string", "password": "string" }
```

### GET `/api/reports/[id]`
Returns a saved analysis report (auth required, user must own the report).

### GET `/api/health`
Returns database, Redis, and queue status.

---

## Security features

- **CSRF protection** — double-submit cookie pattern on all mutation endpoints
- **JWT rotation** — 15-minute access tokens, 7-day httpOnly refresh cookies
- **Account lockout** — 3 failed logins triggers a 15-minute lockout
- **Bcrypt** — passwords hashed with 12 rounds
- **PII detection** — phone numbers, emails, credit cards auto-redacted before Groq analysis
- **Rate limiting** — in-memory per-IP and per-user limits on all endpoints
- **Security headers** — HSTS, CSP, X-Frame-Options, X-Content-Type-Options on all responses

---

## Subscription tiers

| Feature | Free | Basic ($2.99/mo) | Pro ($5.99/mo) |
|---|---|---|---|
| Analyses per month | 10 | 30 | 100 |
| Images per job | 5 | 8 | 10 |
| Analytics charts | ✅ | ✅ | ✅ |
| Report history | ✅ | ✅ | ✅ |

> Payments are disabled by default (`PAYMENTS_ENABLED=false`). Enable with a Stripe account.

---

## License

MIT — use it, fork it, build on it.

---

Built by **Abdul Rafey** · Powered by [Groq](https://groq.com) · Deployed on [Vercel](https://vercel.com)
