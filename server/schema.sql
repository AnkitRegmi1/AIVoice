-- Businesses that use the voice agent (one per phone number / account)
CREATE TABLE IF NOT EXISTS tenants (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  -- Optional: Twilio phone number in E.164 format (e.g. +15551234567).
  
  twilio_phone TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Call logs: one row per call, with summary/transcript for the dashboard
CREATE TABLE IF NOT EXISTS calls (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
  call_sid    TEXT,                    -- Twilio Call SID 
  caller_name TEXT,                    -- Caller's full name 
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


INSERT INTO tenants (id, name) VALUES (1, 'Default Clinic')
ON CONFLICT (id) DO NOTHING;

-- Add caller_name to calls if table already existed without it
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;


ALTER TABLE tenants ADD COLUMN IF NOT EXISTS twilio_phone TEXT UNIQUE;

-- Stored Google Calendar connection per tenant
CREATE TABLE IF NOT EXISTS tenant_google_tokens (
  tenant_id     INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  calendar_id   TEXT NOT NULL DEFAULT 'primary',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uploaded documents for business knowledge / RAG
CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  mime_type     TEXT,
  raw_text      TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS document_chunks (
  id            SERIAL PRIMARY KEY,
  document_id   INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_id ON document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_document_chunks_search
  ON document_chunks
  USING GIN (to_tsvector('english', content));
