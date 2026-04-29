import pg from "pg";

const { Pool } = pg;
type PgPool = InstanceType<typeof Pool>;

/** Match voice engine: TLS for RDS + Supabase; not for localhost. */
function usePostgresSsl(connectionString: string) {
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return undefined;
  if (
    connectionString.includes("amazonaws.com") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com")
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

let poolInstance: PgPool | null = null;

/** Lazy pool so DATABASE_URL is read when requests run (not only at first module load). */
function getPool(): PgPool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: url,
      ssl: usePostgresSsl(url),
    });
  }
  return poolInstance;
}

/** True when DATABASE_URL is set (pool is created on first query). */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export interface CallRow {
  id: number;
  call_sid: string | null;
  caller_name: string | null;
  summary: string | null;
  transcript: string | null;
  created_at: Date;
}

export interface AppointmentRow {
  id: number;
  caller_name: string;
  scheduled_at: Date;
  call_sid: string | null;
  created_at: Date;
  /** From the call log when this booking was made (same Twilio Call SID). */
  call_summary: string | null;
}

export interface BusinessInfoRow {
  tenant_id: number;
  business_name: string | null;
  business_hours: string | null;
  services: string | null;
  address: string | null;
  phone: string | null;
  extra_notes: string | null;
  custom_instructions: string | null;
  updated_at: Date;
}

export interface TenantRow {
  id: number;
  name: string;
  twilio_phone: string | null;
  created_at: Date;
}

export interface DocumentRow {
  id: number;
  filename: string;
  mime_type: string | null;
  uploaded_at: Date;
  chunk_count: number;
  raw_text_length: number;
}

export interface GoogleCalendarConnectionRow {
  tenant_id: number;
  calendar_id: string | null;
  updated_at: Date;
}

export async function getBusinessInfo(tenantId: number): Promise<BusinessInfoRow | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const result = await pool.query<BusinessInfoRow>(
      `SELECT tenant_id, business_name, business_hours, services, address, phone, extra_notes, custom_instructions, updated_at
       FROM business_info WHERE tenant_id = $1`,
      [tenantId]
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function updateBusinessInfo(
  tenantId: number,
  data: {
    businessName?: string | null;
    businessHours?: string | null;
    services?: string | null;
    address?: string | null;
    phone?: string | null;
    extraNotes?: string | null;
    customInstructions?: string | null;
  }
): Promise<BusinessInfoRow | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    await pool.query(
      `INSERT INTO business_info (tenant_id, business_name, business_hours, services, address, phone, extra_notes, custom_instructions, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         business_name = EXCLUDED.business_name,
         business_hours = EXCLUDED.business_hours,
         services = EXCLUDED.services,
         address = EXCLUDED.address,
         phone = EXCLUDED.phone,
         extra_notes = EXCLUDED.extra_notes,
         custom_instructions = EXCLUDED.custom_instructions,
         updated_at = NOW()`,
      [
        tenantId,
        data.businessName ?? null,
        data.businessHours ?? null,
        data.services ?? null,
        data.address ?? null,
        data.phone ?? null,
        data.extraNotes ?? null,
        data.customInstructions ?? null,
      ]
    );
    return getBusinessInfo(tenantId);
  } catch {
    return null;
  }
}

export async function saveGoogleTokens(
  tenantId: number,
  refreshToken: string,
  calendarId = "primary"
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO tenant_google_tokens (tenant_id, refresh_token, calendar_id, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         refresh_token = EXCLUDED.refresh_token,
         calendar_id = EXCLUDED.calendar_id,
         updated_at = NOW()`,
      [tenantId, refreshToken, calendarId]
    );
  } catch {
    // ignore
  }
}

export async function getGoogleTokens(
  tenantId: number
): Promise<{ refresh_token: string; calendar_id: string | null } | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const result = await pool.query<{ refresh_token: string; calendar_id: string | null }>(
      `SELECT refresh_token, calendar_id FROM tenant_google_tokens WHERE tenant_id = $1`,
      [tenantId]
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getGoogleCalendarConnection(
  tenantId: number
): Promise<GoogleCalendarConnectionRow | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const result = await pool.query<GoogleCalendarConnectionRow>(
      `SELECT tenant_id, calendar_id, updated_at
       FROM tenant_google_tokens
       WHERE tenant_id = $1`,
      [tenantId]
    );
    return result.rows[0] ?? null;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[dashboard/db] getGoogleCalendarConnection failed:", e);
    }
    return null;
  }
}

export async function getCalls(tenantId: number, limit = 50): Promise<CallRow[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const result = await pool.query<CallRow>(
      `SELECT id, call_sid, caller_name, summary, transcript, created_at
       FROM calls WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.error("[dashboard/db] getCalls failed:", e);
    return [];
  }
}

export async function getAppointments(tenantId: number, limit = 200): Promise<AppointmentRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const withSummary = `SELECT a.id, a.caller_name, a.scheduled_at, a.call_sid, a.created_at,
              (SELECT c.summary FROM calls c
               WHERE c.tenant_id = a.tenant_id AND c.call_sid IS NOT NULL
                 AND a.call_sid IS NOT NULL AND c.call_sid = a.call_sid
               ORDER BY c.created_at DESC NULLS LAST
               LIMIT 1) AS call_summary
       FROM appointments a
       WHERE a.tenant_id = $1
       ORDER BY a.scheduled_at DESC LIMIT $2`;
  const simple = `SELECT id, caller_name, scheduled_at, call_sid, created_at
       FROM appointments WHERE tenant_id = $1
       ORDER BY scheduled_at DESC LIMIT $2`;
  try {
    const result = await pool.query<AppointmentRow>(withSummary, [tenantId, limit]);
    return result.rows;
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.error("[dashboard/db] getAppointments (with summary) failed:", e);
    try {
      type SimpleRow = Omit<AppointmentRow, "call_summary"> & { call_summary?: null };
      const result = await pool.query<SimpleRow>(simple, [tenantId, limit]);
      return result.rows.map((r: SimpleRow): AppointmentRow => ({ ...r, call_summary: null }));
    } catch (e2) {
      if (process.env.NODE_ENV === "development") console.error("[dashboard/db] getAppointments (simple) failed:", e2);
      return [];
    }
  }
}

export async function getTenants(): Promise<TenantRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const result = await pool.query<TenantRow>(
    `SELECT id, name, twilio_phone, created_at
     FROM tenants
     ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function createTenant(name: string, twilioPhone?: string | null): Promise<TenantRow | null> {
  const pool = getPool();
  if (!pool || !name.trim()) return null;
  const result = await pool.query<TenantRow>(
    `INSERT INTO tenants (name, twilio_phone)
     VALUES ($1, $2)
     RETURNING id, name, twilio_phone, created_at`,
    [name.trim(), twilioPhone?.trim() || null]
  );
  return result.rows[0] ?? null;
}

export async function getDocuments(tenantId: number): Promise<DocumentRow[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const result = await pool.query<DocumentRow>(
      `SELECT d.id, d.filename, d.mime_type, d.uploaded_at,
              COALESCE(COUNT(dc.id), 0)::int AS chunk_count,
              LENGTH(d.raw_text)::int AS raw_text_length
       FROM documents d
       LEFT JOIN document_chunks dc ON dc.document_id = d.id
       WHERE d.tenant_id = $1
       GROUP BY d.id
       ORDER BY d.uploaded_at DESC`,
      [tenantId]
    );
    return result.rows;
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.error("[dashboard/db] getDocuments failed:", e);
    return [];
  }
}

export async function saveDocumentWithChunks(
  tenantId: number,
  data: {
    filename: string;
    mimeType?: string | null;
    rawText: string;
    chunks: string[];
  }
): Promise<DocumentRow | null> {
  const pool = getPool();
  if (!pool || !data.filename.trim() || !data.rawText.trim() || data.chunks.length === 0) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO documents (tenant_id, filename, mime_type, raw_text)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tenantId, data.filename.trim(), data.mimeType ?? null, data.rawText]
    );
    const documentId = inserted.rows[0]?.id;
    if (!documentId) throw new Error("Document insert failed");

    for (let index = 0; index < data.chunks.length; index++) {
      await client.query(
        `INSERT INTO document_chunks (document_id, tenant_id, chunk_index, content)
         VALUES ($1, $2, $3, $4)`,
        [documentId, tenantId, index, data.chunks[index]]
      );
    }

    await client.query("COMMIT");
    const docs = await getDocuments(tenantId);
    return docs.find((doc) => doc.id === documentId) ?? null;
  } catch (e) {
    await client.query("ROLLBACK");
    if (process.env.NODE_ENV === "development") console.error("[dashboard/db] saveDocumentWithChunks failed:", e);
    return null;
  } finally {
    client.release();
  }
}
