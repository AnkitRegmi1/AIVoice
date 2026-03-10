import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL!;
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("amazonaws.com") ? { rejectUnauthorized: false } : undefined,
    })
  : null;

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
}

export interface BusinessInfoRow {
  tenant_id: number;
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

export async function getBusinessInfo(tenantId: number): Promise<BusinessInfoRow | null> {
  if (!pool) return null;
  try {
    const result = await pool.query<BusinessInfoRow>(
      `SELECT tenant_id, business_hours, services, address, phone, extra_notes, custom_instructions, updated_at
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
    businessHours?: string | null;
    services?: string | null;
    address?: string | null;
    phone?: string | null;
    extraNotes?: string | null;
    customInstructions?: string | null;
  }
): Promise<BusinessInfoRow | null> {
  if (!pool) return null;
  try {
    await pool.query(
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

export async function getCalls(tenantId: number, limit = 50): Promise<CallRow[]> {
  if (!pool) return [];
  const result = await pool.query<CallRow>(
    `SELECT id, call_sid, caller_name, summary, transcript, created_at
     FROM calls WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit]
  );
  return result.rows;
}

export async function getAppointments(tenantId: number, limit = 50): Promise<AppointmentRow[]> {
  if (!pool) return [];
  try {
    const result = await pool.query<AppointmentRow>(
      `SELECT id, caller_name, scheduled_at, call_sid, created_at
       FROM appointments WHERE tenant_id = $1
       ORDER BY scheduled_at DESC LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  } catch {
    return [];
  }
}

export async function getTenants(): Promise<TenantRow[]> {
  if (!pool) return [];
  const result = await pool.query<TenantRow>(
    `SELECT id, name, twilio_phone, created_at
     FROM tenants
     ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function createTenant(name: string, twilioPhone?: string | null): Promise<TenantRow | null> {
  if (!pool || !name.trim()) return null;
  const result = await pool.query<TenantRow>(
    `INSERT INTO tenants (name, twilio_phone)
     VALUES ($1, $2)
     RETURNING id, name, twilio_phone, created_at`,
    [name.trim(), twilioPhone?.trim() || null]
  );
  return result.rows[0] ?? null;
}
