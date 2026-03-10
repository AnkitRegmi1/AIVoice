-- Knowledge Base: custom instructions per tenant (injected into Sarah's system prompt).
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS custom_instructions TEXT;
