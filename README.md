---
title: ChatVibe AI
description: Instant AI image analysis in under 5 seconds — powered by Groq + Llama 3.2 Vision
tags:
  - nextjs
  - groq
  - llama
  - ocr
  - ai
  - saas
aliases:
  - chatvibe
  - chatvibeapp-ai
author: Abdul Rafey
github: https://github.com/rafeyy-sxk
status: active
version: 1.0.0
---

# ChatVibe AI

> **Image → Result in under 5 seconds. Powered by Groq + Llama 3.2 Vision. No setup required.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)](https://nextjs.org)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.2%20Vision-E84025?style=flat-square)](https://groq.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square)](https://prisma.io)
[![BullMQ](https://img.shields.io/badge/BullMQ-queue-red?style=flat-square)](https://docs.bullmq.io)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

Upload any image — chat screenshot, document, receipt, medical record. ChatVibe AI sends it directly to **Groq's Llama 3.2 Vision** model for instant analysis. No setup. No local install. Results in under 5 seconds.

Built by **Abdul Rafey** · Senior AI/ML & CV Engineer · [github.com/rafeyy-sxk](https://github.com/rafeyy-sxk)

---

## Why Groq + Llama 3.2?

> [!success] Instant, no setup
> Groq's inference hardware runs `meta-llama/llama-4-scout-17b-16e-instruct` at sub-second token latency. **Median analysis time: under 3 seconds.** No local install required — just drop an image.

---

## Features

- **⚡ Under 5 seconds** — Groq + Llama 3.2 Vision reads images directly
- **🚀 No setup** — no local install, no model downloads
- **💬 Chat with results** — follow-up questions powered by Groq
- **📦 Batch analysis** — up to 10 images queued simultaneously  
- **📤 Multi-format export** — PDF, Word, CSV, JSON, Markdown
- **🔍 History & search** — full-text search across all past analyses
- **🔗 Shareable links** — privacy-toggled public result sharing
- **🌐 REST & WebSocket API** — Pro plan programmatic access
- **🔔 Webhooks** — Slack, Discord, or any HTTP endpoint
- **🌍 Multi-language OCR** — English, Arabic, Urdu, Spanish, French
- **🛡️ PII Redaction** — auto-detect and blur emails, phones, IDs
- **⚖️ Compare mode** — side-by-side analysis of two images
- **📱 Mobile PWA** — direct camera upload on phones
- **⌨️ Keyboard shortcuts** — `⌘U` upload · `⌘H` history · `?` help



---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| AI Engine | **Groq** (`meta-llama/llama-4-scout-17b-16e-instruct`) — cloud inference, ~2s |
| OCR | Tesseract.js — browser + Node |
| Database | PostgreSQL via Prisma ORM (Neon serverless) |
| Queue | BullMQ + Redis (ioredis) |
| Payments | Stripe (webhooks, subscriptions) |
| Image | Sharp (preprocessing, resize, sharpen) |
| Auth | JWT (access + refresh tokens) + bcrypt |
| Monitoring | Sentry + OpenTelemetry |

---

## Quick Start

> [!tip] Prerequisites
> - Node.js 18+
> - PostgreSQL (or Neon connection string)
> - Redis (local or Upstash)
> - Groq API key (free at [console.groq.com](https://console.groq.com))

### 1. Clone & Install

```bash
git clone https://github.com/rafeyy-sxk/chatvibeapp-ai
cd chatvibeapp-ai
npm install
```

### 3. Environment Variables

```bash
cp .env.example .env.local
```

```env
# Database (required)
DATABASE_URL="postgresql://user:pass@localhost:5432/chatvibe"

# Redis (required for job queue)
REDIS_URL="redis://localhost:6379"

# JWT (required — generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."

# Groq (required — get free key at console.groq.com)
GROQ_API_KEY="gsk_..."
```

### 4. Database Setup

```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Start

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Analysis worker
npm run worker

# Terminal 3: Email worker (optional)
npm run worker:email
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Reference

> [!abstract] Authentication
> All endpoints require `Authorization: Bearer <access_token>`.
> Get tokens via `POST /api/auth/login`.

### Core Endpoints

```http
POST   /api/analyze              Queue an analysis job
GET    /api/analyze/stream       Stream Groq tokens (SSE)
POST   /api/analyze/batch        Queue up to 10 images
GET    /api/export               Download result (pdf|json|md|csv)
POST   /api/chat                 Chat with an analysis result
GET    /api/history              Paginated history + search
GET    /api/jobs/[id]/status     Poll job status
GET    /api/jobs/[id]/stream     Stream job progress (SSE)
GET    /api/health               System health check
```

### Analyze an Image

```http
POST /api/analyze
Content-Type: application/json
Authorization: Bearer <token>

{
  "text": "<OCR-extracted text>",
  "customPrompt": "Focus on emotional tone"
}
```

**Response `202`:**
```json
{
  "data": { "jobId": "clx...", "status": "QUEUED" },
  "status": "ok",
  "error": null
}
```

### Stream Analysis

```http
GET /api/analyze/stream?jobId=clx...
Authorization: Bearer <token>
```

Returns `text/event-stream`. Events: `start` → `token` (×N) → `done`.

### Export Results

```http
GET /api/export?jobId=clx...&format=pdf
Authorization: Bearer <token>
```

Supported formats: `pdf`, `json`, `markdown`, `csv`.

---

## Pricing

| Plan | Analyses | Key Features | Price |
|---|---|---|---|
| **Free** | 10/month | OCR + JSON export | $0 |
| **Basic** | 200/month | Batch + PDF/Word export + history | $9/mo |
| **Pro** | Unlimited | API + webhooks + compare + priority | $29/mo |

---

## Project Structure

```
chatvibeapp-ai/
├── app/
│   ├── page.js                  # Landing page (editorial redesign)
│   ├── layout.js                # Fraunces + DM Sans fonts, OG metadata
│   └── api/
│       ├── analyze/             # Queue + stream + batch
│       ├── auth/                # login, signup, refresh, logout, reset
│       ├── billing/             # Stripe webhooks, subscribe, portal
│       ├── chat/                # Groq conversation per job
│       ├── export/              # PDF, CSV, JSON, Markdown
│       ├── history/             # Paginated + searchable
│       ├── share/               # Shareable public links
│       ├── webhooks/            # Outbound webhook delivery
│       └── health/              # System status
├── lib/
│   ├── ai.js                    # Groq client (generate + stream + healthCheck)
│   ├── prisma.js                # Prisma singleton
│   ├── redis.js                 # ioredis client
│   ├── confidence.js            # OCR + AI confidence scoring
│   ├── redaction.js             # PII detection + auto-redaction
│   └── billing/                 # Stripe, feature gating, usage tracking
├── components/
│   └── ThemeToggle.jsx          # Dark/Light/System theme switch
├── hooks/
│   └── useKeyboardShortcuts.js  # ⌘U/⌘H/⌘B global shortcuts
├── server/workers/              # BullMQ analysis + email workers
├── prisma/schema.prisma         # Full schema
└── marketing/                   # Launch assets, SEO, pitch deck
```

---

## Deployment

> [!tip] Groq runs on Vercel serverless out of the box
> No persistent compute required. Set `GROQ_API_KEY` in Vercel environment variables and deploy.

```bash
# Build + verify
npm run build
npm run verify:deploy

# Deploy to Vercel
vercel --prod
```

See [[next-steps]] for the complete deployment runbook with env vars and Stripe setup.

---

## Security

> [!info] Security features
> - **JWT rotation** — 15-min access tokens, 7-day httpOnly refresh cookies
> - **bcrypt** — passwords hashed at cost 12
> - **Account lockout** — 3 failed logins → 15-minute lockout
> - **PII redaction** — emails, phones, SSNs auto-redacted before AI analysis
> - **Rate limiting** — per-IP and per-user on all endpoints
> - **Security headers** — HSTS, CSP, X-Frame-Options on all responses
> - **File validation** — MIME sniffing + magic bytes + 10MB limit

---

## Contributing

1. Fork the repo
2. `git checkout -b feature/my-feature`
3. `git commit -m "feat: add my feature"`
4. `git push origin feature/my-feature`
5. Open a PR

---

## License

MIT — use it, fork it, build on it.

---

*Built by [Abdul Rafey](https://github.com/rafeyy-sxk) — Senior AI/ML & CV Engineer*  
*Powered by Groq + Llama 3.2 Vision · Built by Abdul Rafey*
