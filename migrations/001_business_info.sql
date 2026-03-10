-- Business info per tenant: hours, services, address, etc. Used by the voice agent when callers ask.
-- Run this after schema.sql (e.g. psql $DATABASE_URL -f migrations/001_business_info.sql).

CREATE TABLE IF NOT EXISTS business_info (
  tenant_id    INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  business_hours TEXT,
  services     TEXT,
  address      TEXT,
  phone        TEXT,
  extra_notes  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default so the voice agent has something to say before the business edits it
INSERT INTO business_info (tenant_id, business_hours, services, address, phone, extra_notes)
VALUES (
  1,
  'Monday to Friday 9 AM to 6 PM, Saturday 10 AM to 4 PM. Closed Sunday.',
  'Swedish massage, deep tissue, sports massage, and relaxation massage. We also offer gift cards.',
  '123 Main Street',
  NULL,
  'Callers can book with the agent now over the phone, or call back later.'
)
ON CONFLICT (tenant_id) DO NOTHING;
