-- Add business_name to business_info so Sarah can use the real clinic name when greeting callers.
ALTER TABLE business_info ADD COLUMN IF NOT EXISTS business_name TEXT;
