import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getTenants, type TenantRow } from "@/lib/db";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string; isAdmin?: boolean } | null;

  if (!user?.isAdmin) {
    redirect("/");
  }

  const tenants: TenantRow[] = await getTenants();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h2 className="text-2xl font-semibold text-slate-100 mb-4">Admin – Tenants & Numbers</h2>
      <p className="text-slate-400 mb-6 text-sm">
        Onboard new customers by creating a tenant and attaching their Twilio phone number (E.164, e.g. +15551234567).
        The voice engine will use this to route calls to the right business and load their business info + AI rules.
      </p>

      <section className="mb-8 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="text-lg font-medium text-slate-100 mb-3">Create tenant</h3>
        <p className="text-slate-500 text-sm mb-4">
          This simple form just calls an API route that inserts into the <code>tenants</code> table. After adding a tenant,
          go to the Business info page and fill in their hours, services, and custom instructions.
        </p>
        <form
          className="flex flex-wrap gap-3 items-end"
          action="/api/admin/tenants"
          method="post"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="name">
              Business name
            </label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Acme Massage Clinic"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="twilioPhone">
              Twilio phone (E.164)
            </label>
            <input
              id="twilioPhone"
              name="twilioPhone"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="+15551234567"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Add tenant
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="text-lg font-medium text-slate-100 mb-3">Existing tenants</h3>
        {tenants.length === 0 ? (
          <p className="text-slate-500 text-sm">No tenants yet. Create one above.</p>
        ) : (
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="border-b border-slate-700 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Twilio phone</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-slate-800 last:border-b-0">
                  <td className="py-2 pr-4 text-slate-400">{t.id}</td>
                  <td className="py-2 pr-4">{t.name}</td>
                  <td className="py-2 pr-4">{t.twilio_phone ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-400">
                    {new Date(t.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

