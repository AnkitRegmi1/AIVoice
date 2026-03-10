## B2B AI Voice Agent SaaS — Master Checklist

Track progress across all four phases. This file is **for your local planning only** — do not commit it to Git if you want to keep your public repo minimal.

---

## Phase 1: The Core Voice Engine (Node.js)

**Goal:** A server that receives voice webhooks, returns TwiML `<Connect><Stream>`, and proxies audio bidirectionally between the telephony provider and the AI Realtime API.

- [ ] 1.1 Project initialized: `package.json`, `.env.example`, dependencies installed  
- [ ] 1.2 Fastify (or similar) server runs with HTTP and WebSocket routes  
- [ ] 1.3 Voice webhook endpoint returns valid TwiML (`<Connect><Stream url="wss://...">`)  
- [ ] 1.4 Media Stream WebSocket: handle `connected`, `start`, `media` (inbound), `stop`  
- [ ] 1.5 AI Realtime WebSocket: connect with API key, send `session.update`, receive `session.updated`  
- [ ] 1.6 Audio pipeline: telephony μ-law 8 kHz ↔ PCM 24 kHz (both directions)  
- [ ] 1.7 Inbound: `media` → convert → `input_audio_buffer.append` to AI  
- [ ] 1.8 Outbound: AI audio deltas → convert → telephony `media` messages  
- [ ] 1.9 End-to-end: call number → AI answers and responds with voice  
- [ ] 1.10 Local dev setup: tunnel running, webhook URL set and tested  

**Deliverables:** `server.js`, `package.json`, `.env.example`, telephony setup notes

---

## Phase 2: Database & AI Memory (SQL)

**Goal:** Persist tenants (businesses) and calls (call logs). Use AI function calling so the assistant can INSERT a call summary when the conversation ends.

- [ ] 2.1 Database instance created (dev/small), security rules allow app access  
- [ ] 2.2 DB schema: `tenants`, `calls`, `appointments` in `schema.sql`  
- [ ] 2.3 Node app: DB client, `lib/db.js`, `DATABASE_URL` in `.env`  
- [ ] 2.4 AI Realtime: tools `save_call_summary`, `end_call`, `get_booked_slots`, `schedule_appointment` registered  
- [ ] 2.5 On tool call: parse args, INSERT into `calls` / `appointments`, confirm to AI  
- [ ] 2.6 Verify: after a test call, a row appears in `calls` with summary (and optional transcript)  

**Deliverables:** `schema.sql`, `lib/db.js`, local DB / connection notes

---

## Phase 3: The SaaS Dashboard (Next.js)

**Goal:** Multi-tenant web app for business owners: sign-in, Smart Inbox (call transcripts), Knowledge Base (system prompt), calendar-aware scheduling, and tenant/phone-number management.

- [ ] 3.1 Next.js app with App Router, Tailwind (or similar), and auth configured  
- [ ] 3.2 Auth: owners can log in (credentials or OAuth)  
- [ ] 3.3 Smart Inbox: page that fetches calls from DB (per tenant), displays summaries/transcripts  
- [ ] 3.4 Knowledge Base Manager: form to update AI system prompt / business rules per tenant  
- [ ] 3.5 Calendar integration: store calendar tokens/ID, optional “book appointment” sync  
- [ ] 3.6 Tenant isolation: session includes `tenantId`; all queries scoped to that ID  
- [ ] 3.7 Admin dashboard: create tenants, attach telephony numbers, see tenant list  

**Deliverables:** Next.js app, auth flow, Smart Inbox UI, Knowledge Base form, admin `/admin` page

---

## Phase 4: Cloud Infrastructure & Deployment

**Goal:** Backend containerized; infrastructure defined as code; CI/CD to deploy to a cloud provider.

- [ ] 4.1 Dockerfile for Node.js voice server; build and run locally  
- [ ] 4.2 Infrastructure-as-code: network, security groups/firewall rules  
- [ ] 4.3 Managed SQL database defined in IaC (networked correctly)  
- [ ] 4.4 Container registry for voice server image  
- [ ] 4.5 Orchestrator / app service: task definition, service (with env/secrets for API keys, DB URL)  
- [ ] 4.6 Load balancer or public endpoint, HTTPS if needed, service wired behind it  
- [ ] 4.7 CI/CD: workflow to build image, push to registry, and update the running service  
- [ ] 4.8 Telephony webhook URL updated to point to the public URL of the voice server  
- [ ] 4.9 Smoke test: calls and dashboard work in production  

**Deliverables:** `Dockerfile`, IaC files, CI pipeline config, runbook for deployment

---

## Notes

- Keep all real credentials and connection strings only in environment variables (`.env`, deployment secrets).  
- If you want to avoid committing this checklist, you can either:
  - Leave it untracked (do not `git add` it), or
  - Add `MASTER_CHECKLIST.md` to `.gitignore`.

