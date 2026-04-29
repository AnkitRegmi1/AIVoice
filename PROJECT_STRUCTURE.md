# Project Structure

This repo is a B2B SaaS AI voice receptionist split into two independent services.

```
AIVoice/
├── server/                         # Voice engine — Fastify + Node.js
│   ├── server.js                   # Entry point: Twilio ↔ OpenAI Realtime bridge
│   ├── lib/
│   │   ├── db.js                   # PostgreSQL client (calls, appointments, tenants)
│   │   └── google-calendar.js      # Google Calendar event creation
│   ├── migrations/                 # Incremental SQL migrations (run in order)
│   │   ├── 001_business_info.sql
│   │   ├── 002_add_custom_instructions.sql
│   │   ├── 003_tenant_google_tokens.sql
│   │   ├── 004_tenant_twilio_phone.sql
│   │   └── add-caller-name-to-calls.sql
│   ├── tests/
│   │   └── db.test.js              # DB integration tests
│   ├── schema.sql                  # Full baseline schema (initial setup only)
│   ├── run-schema.js               # Apply schema.sql to DB (first-time setup)
│   ├── run-migration.js            # Run all migrations in migrations/
│   ├── check-db.js                 # Sanity check: list tables, rows, recent calls
│   ├── package.json                # Server dependencies (fastify, openai, twilio, pg)
│   ├── Dockerfile                  # Container build for the voice engine
│   ├── .dockerignore
│   └── .env                        # Server environment variables (gitignored)
│
├── dashboard/                      # Next.js 14 operator dashboard
│   ├── app/
│   │   ├── layout.tsx              # Root layout (auth session provider)
│   │   ├── page.tsx                # Home / redirect
│   │   ├── login/page.tsx          # Login page
│   │   ├── inbox/page.tsx          # Smart Inbox — call summaries
│   │   ├── calendar/page.tsx       # Appointment calendar view
│   │   ├── business/page.tsx       # Business info editor
│   │   ├── admin/page.tsx          # Operator admin panel (tenant management)
│   │   └── api/
│   │       ├── auth/[...nextauth]/ # NextAuth.js route handler
│   │       ├── business-info/      # GET/POST business info for current tenant
│   │       └── admin/tenants/      # Admin API: list/create tenants
│   ├── components/
│   │   ├── AuthButton.tsx          # Sign in / sign out button
│   │   ├── BusinessInfoForm.tsx    # Business info edit form
│   │   ├── CalendarView.tsx        # Appointment calendar
│   │   ├── CallsSummaryList.tsx    # Call summaries list
│   │   ├── ConnectGoogleCalendar.tsx  # Google Calendar OAuth connect
│   │   ├── DatabaseStatusBanner.tsx   # DB connectivity status banner
│   │   └── SessionProvider.tsx    # NextAuth session provider wrapper
│   ├── lib/
│   │   ├── auth.ts                 # NextAuth config (providers, callbacks)
│   │   ├── db.ts                   # Dashboard PostgreSQL client
│   │   └── clinic-tenant.ts        # Tenant resolution helpers
│   ├── types/
│   │   ├── next-auth.d.ts          # NextAuth session type extensions
│   │   └── pg.d.ts                 # pg module type overrides
│   ├── package.json                # Dashboard dependencies (next, react, next-auth)
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   └── .env.local                  # Dashboard environment variables (gitignored)
│
├── .gitignore
└── README.md
```

## Running Locally

### Voice Engine
```bash
cd server
npm install
npm run dev          # node --watch server.js  (port 3000 by default)
```

### Dashboard
```bash
cd dashboard
npm install
npm run dev          # next dev  (port 3001 by default)
```

## Database Setup (first time)

```bash
cd server
node run-schema.js       # apply baseline schema
node run-migration.js    # run incremental migrations
node check-db.js         # verify tables and rows
```

## Environment Variables

| File | Used by | Key variables |
|------|---------|---------------|
| `server/.env` | Voice engine | `DATABASE_URL`, `OPENAI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `BASE_URL`, `PORT` |
| `dashboard/.env.local` | Next.js dashboard | `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
