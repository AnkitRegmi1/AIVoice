import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getTenants, type TenantRow } from "@/lib/db";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string; isAdmin?: boolean } | null;

  if (!user?.isAdmin) {
    return (
      <main className="app-shell">
        <section className="app-panel px-6 py-8 sm:px-8">
          <p className="app-label">Admin access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
            Admin access required
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This page is only available to admin users.
          </p>
          <div className="mt-6">
            <Link href="/login?callbackUrl=%2Fadmin" className="app-button-primary">
              Go to sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const tenants: TenantRow[] = await getTenants();

  return (
    <main className="app-shell space-y-6">
      <section className="app-panel px-6 py-8 sm:px-8">
        <p className="app-label">Admin controls</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
          Tenants and phone routing
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Create new business tenants, assign Twilio numbers, and keep the voice server pointed at
          the right business rules and dashboard data.
        </p>
      </section>

      <section className="app-panel p-6 sm:p-8">
        <div className="mb-5">
          <p className="app-label">Onboarding</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">Create tenant</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This form inserts a tenant record, then you can open the Business module to fill in its
            service details, hours, knowledge documents, and phone behavior.
          </p>
        </div>

        <form className="grid gap-4 md:grid-cols-[1.2fr_1fr_auto]" action="/api/admin/tenants" method="post">
          <div>
            <label className="app-field-label" htmlFor="name">
              Business name
            </label>
            <input
              id="name"
              name="name"
              required
              className="app-input"
              placeholder="Acme Massage Clinic"
            />
          </div>
          <div>
            <label className="app-field-label" htmlFor="twilioPhone">
              Twilio phone
            </label>
            <input
              id="twilioPhone"
              name="twilioPhone"
              className="app-input"
              placeholder="+15551234567"
            />
          </div>
          <div className="md:self-end">
            <button type="submit" className="app-button-primary w-full md:w-auto">
              Add tenant
            </button>
          </div>
        </form>
      </section>

      <section className="app-panel p-6 sm:p-8">
        <div className="mb-5">
          <p className="app-label">Directory</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">Existing tenants</h3>
        </div>

        {tenants.length === 0 ? (
          <p className="app-panel-soft p-4 text-sm text-slate-500">No tenants yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white/80">
            <table className="w-full min-w-[640px] text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Twilio phone</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 text-slate-500">{t.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                    <td className="px-4 py-3">{t.twilio_phone ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(t.created_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
