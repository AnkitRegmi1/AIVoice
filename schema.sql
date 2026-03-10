-- Run this once against your PostgreSQL database (e.g. RDS).

-- Businesses that use the voice agent (one per phone number / account)
CREATE TABLE IF NOT EXISTS tenants (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  -- Optional: Twilio phone number in E.164 format (e.g. +15551234567).
  -- Used in Phase 3+ to route calls to the correct tenant.
  twilio_phone TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Call logs: one row per call, with summary/transcript for the dashboard
CREATE TABLE IF NOT EXISTS calls (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
  call_sid    TEXT,                    -- Twilio Call SID (e.g. CA...)
  caller_name TEXT,                    -- Caller's full name if they provided it
  summary     TEXT,                    -- Full summary of the call
  transcript  TEXT,                    -- Optional full or partial transcript
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);

-- Appointments: full name + scheduled time from voice agent; one per slot (no double-booking)
CREATE TABLE IF NOT EXISTS appointments (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id),
  caller_name  TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  call_sid     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(tenant_id, scheduled_at);

-- Default tenant for Phase 2 (single-tenant); Phase 3 will add more
INSERT INTO tenants (id, name) VALUES (1, 'Default Clinic')
ON CONFLICT (id) DO NOTHING;

-- Add caller_name to calls if table already existed without it
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;

-- Phase 3: ensure twilio_phone exists on tenants for multi-number routing
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS twilio_phone TEXT UNIQUE;
