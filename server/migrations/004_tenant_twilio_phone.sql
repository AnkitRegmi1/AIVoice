-- Phase 3: add Twilio phone number to tenants for multi-tenant routing

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS twilio_phone TEXT UNIQUE;

