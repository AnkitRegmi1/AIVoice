-- Google Calendar: store OAuth refresh token per tenant so the voice server can create events.
CREATE TABLE IF NOT EXISTS tenant_google_tokens (
  tenant_id     INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  calendar_id   TEXT NOT NULL DEFAULT 'primary',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
