-- Add caller_name to calls if you already ran the schema before.
-- From project root with DATABASE_URL set, run: node run-schema.js (schema.sql already has caller_name).
-- If your calls table was created without caller_name, run this in your DB client or:
--   psql $DATABASE_URL -f migrations/add-caller-name-to-calls.sql

ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;
