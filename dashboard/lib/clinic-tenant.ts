/**
 * Dashboard reads/writes one clinic row for now (same default as the voice server).
 * Not tied to login email — override with CLINIC_TENANT_ID when you add multi-tenant UI.
 */
export function getClinicTenantId(): number {
  const raw = process.env.CLINIC_TENANT_ID?.trim() ?? "1";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
