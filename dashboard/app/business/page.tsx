import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getBusinessInfo } from "@/lib/db";
import { BusinessInfoForm } from "@/components/BusinessInfoForm";
import { ConnectGoogleCalendar } from "@/components/ConnectGoogleCalendar";

export default async function BusinessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");
  const tenantId = (session.user as { tenantId?: number }).tenantId ?? 1;
  const initial = await getBusinessInfo(tenantId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-slate-200 text-sm">
          ← Back
        </Link>
      </div>
      <h2 className="text-2xl font-semibold text-slate-100 mb-2">Business info</h2>
      <p className="text-slate-400 mb-6">
        Update what Sarah tells callers when they ask about your business (hours, services, location). Changes apply to the next call.
      </p>
      <BusinessInfoForm initial={initial} />

      <div className="mt-10">
        <ConnectGoogleCalendar />
      </div>
    </main>
  );
}
