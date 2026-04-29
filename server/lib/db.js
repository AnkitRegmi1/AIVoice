/**
 * Phase 2: PostgreSQL client for tenants and calls.
 * If DATABASE_URL is not set, the pool is null and save_call_summary no-ops.
 */

import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;

/** RDS and Supabase require TLS; local Postgres typically does not. */
export function usePostgresSsl(connectionString) {
  if (!connectionString || /localhost|127\.0\.0\.1/.test(connectionString)) return undefined;
  if (
    connectionString.includes("amazonaws.com") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com")
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: usePostgresSsl(DATABASE_URL),
  });
  pool.on("error", (err) => console.error("DB pool error", err));
}

/**
 * Execute a parameterized query. Returns rows or empty array. No-op if no DB.
 */
export async function query(text, params = []) {
  if (!pool) return { rows: [], rowCount: 0 };
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Insert a call record. tenant_id defaults to 1. Returns inserted id or null.
 */
export async function insertCall({ tenantId = 1, callSid, callerName, summary, transcript }) {
  if (!pool) return null;
  const result = await query(
    `INSERT INTO calls (tenant_id, call_sid, caller_name, summary, transcript)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [tenantId, callSid ?? null, callerName ?? null, summary ?? null, transcript ?? null]
  );
  return result.rows[0]?.id ?? null;
}

/** Slot window in minutes: no two appointments within this many minutes */
const APPOINTMENT_SLOT_MINUTES = 30;

/**
 * Check if the given time slot is already taken for this tenant (within APPOINTMENT_SLOT_MINUTES).
 * Returns the existing appointment row if taken, null if free.
 */
export async function getAppointmentAt(tenantId, scheduledAt) {
  if (!pool) return null;
  const result = await query(
    `SELECT id, caller_name, scheduled_at FROM appointments
     WHERE tenant_id = $1 AND scheduled_at BETWEEN $2::timestamptz - ($3::text || ' minutes')::interval
       AND $2::timestamptz + ($3::text || ' minutes')::interval
     LIMIT 1`,
    [tenantId, scheduledAt, APPOINTMENT_SLOT_MINUTES]
  );
  return result.rows[0] ?? null;
}

/**
 * Insert an appointment. Returns inserted id or null. Does NOT check conflict — caller must use getAppointmentAt first.
 */
export async function insertAppointment({ tenantId = 1, callerName, scheduledAt, callSid }) {
  if (!pool) return null;
  const result = await query(
    `INSERT INTO appointments (tenant_id, caller_name, scheduled_at, call_sid)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [tenantId, callerName, scheduledAt, callSid ?? null]
  );
  return result.rows[0]?.id ?? null;
}

/**
 * List appointments for a tenant, most recent first (by scheduled_at).
 */
export async function getAppointments(tenantId, limit = 100) {
  if (!pool) return [];
  const result = await query(
    `SELECT id, caller_name, scheduled_at, call_sid, created_at
     FROM appointments WHERE tenant_id = $1
     ORDER BY scheduled_at DESC LIMIT $2`,
    [tenantId, limit]
  );
  return result.rows;
}

/**
 * Get already-booked times for a given calendar date (so the AI can suggest available slots).
 * dateStr = YYYY-MM-DD. Returns array of { time: "HH:MM", datetime: ISO } for that day.
 */
export async function getBookedSlotsForDate(tenantId, dateStr) {
  if (!pool) return [];
  const start = `${dateStr}T00:00:00.000Z`;
  const end = `${dateStr}T23:59:59.999Z`;
  const result = await query(
    `SELECT scheduled_at FROM appointments
     WHERE tenant_id = $1 AND scheduled_at >= $2::timestamptz AND scheduled_at <= $3::timestamptz
     ORDER BY scheduled_at`,
    [tenantId, start, end]
  );
  return result.rows.map((row) => {
    const d = new Date(row.scheduled_at);
    return {
      time: d.toTimeString().slice(0, 5), // "HH:MM"
      datetime: d.toISOString(),
    };
  });
}

/**
 * Get business info for a tenant (hours, services, address, etc.). Used by the voice agent.
 * Returns null if no row or no DB.
 */
export async function getBusinessInfo(tenantId = 1) {
  if (!pool) return null;
  const result = await query(
    `SELECT tenant_id, business_name, business_hours, services, address, phone, extra_notes, custom_instructions, updated_at
     FROM business_info WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] ?? null;
}

/**
 * Update business info for a tenant. Upserts one row per tenant.
 */
export async function updateBusinessInfo(tenantId = 1, { businessHours, services, address, phone, extraNotes, customInstructions }) {
  if (!pool) return null;
  await query(
    `INSERT INTO business_info (tenant_id, business_hours, services, address, phone, extra_notes, custom_instructions, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       business_hours = EXCLUDED.business_hours,
       services = EXCLUDED.services,
       address = EXCLUDED.address,
       phone = EXCLUDED.phone,
       extra_notes = EXCLUDED.extra_notes,
       custom_instructions = EXCLUDED.custom_instructions,
       updated_at = NOW()`,
    [
      tenantId,
      businessHours ?? null,
      services ?? null,
      address ?? null,
      phone ?? null,
      extraNotes ?? null,
      customInstructions ?? null,
    ]
  );
  return getBusinessInfo(tenantId);
}

/**
 * Get Google Calendar tokens for a tenant (for creating events after booking).
 */
export async function getGoogleTokens(tenantId = 1) {
  if (!pool) return null;
  const result = await query(
    `SELECT tenant_id, refresh_token, calendar_id FROM tenant_google_tokens WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] ?? null;
}

/**
 * Look up a tenant by its Twilio phone number (E.164, e.g. +15551234567).
 * Returns the tenant row or null if not found.
 */
export async function getTenantByPhone(twilioPhone) {
  if (!pool || !twilioPhone) return null;
  const result = await query(
    `SELECT id, name, twilio_phone, created_at
     FROM tenants
     WHERE twilio_phone = $1`,
    [twilioPhone]
  );
  return result.rows[0] ?? null;
}

/**
 * Simple helper to create a tenant with optional Twilio phone (used by admin tooling).
 * Returns inserted tenant id or null.
 */
export async function insertTenant({ name, twilioPhone = null }) {
  if (!pool || !name) return null;
  const result = await query(
    `INSERT INTO tenants (name, twilio_phone)
     VALUES ($1, $2)
     RETURNING id`,
    [name, twilioPhone]
  );
  return result.rows[0]?.id ?? null;
}

/**
 * Search uploaded knowledge chunks for a tenant using PostgreSQL full-text search.
 * Returns top matches with filename for grounding AI answers.
 */
export async function searchKnowledge(tenantId, question, limit = 4) {
  if (!pool || !question?.trim()) return [];
  const normalized = question.trim();

  try {
    const result = await query(
      `SELECT dc.content, dc.chunk_index, d.filename,
              ts_rank_cd(to_tsvector('english', dc.content), plainto_tsquery('english', $2)) AS rank
       FROM document_chunks dc
       INNER JOIN documents d ON d.id = dc.document_id
       WHERE dc.tenant_id = $1
         AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', $2)
       ORDER BY rank DESC, dc.chunk_index ASC
       LIMIT $3`,
      [tenantId, normalized, limit]
    );
    if (result.rows.length > 0) return result.rows;
  } catch {
    // Fall through to simple keyword matching below.
  }

  const terms = normalized
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((term) => term.length >= 3)
    .slice(0, 6);

  if (terms.length === 0) return [];

  const likeClauses = terms.map((_, index) => `LOWER(dc.content) LIKE $${index + 2}`);
  const params = [tenantId, ...terms.map((term) => `%${term}%`), limit];
  const limitIndex = params.length;

  const fallback = await query(
    `SELECT dc.content, dc.chunk_index, d.filename
     FROM document_chunks dc
     INNER JOIN documents d ON d.id = dc.document_id
     WHERE dc.tenant_id = $1
       AND (${likeClauses.join(" OR ")})
     ORDER BY dc.created_at DESC, dc.chunk_index ASC
     LIMIT $${limitIndex}`,
    params
  );
  return fallback.rows;
}

export { pool };
