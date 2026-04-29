import Link from "next/link";
import { getServerSession } from "next-auth";
import { BusinessInfoForm } from "@/components/BusinessInfoForm";
import { ConnectGoogleCalendar } from "@/components/ConnectGoogleCalendar";
import { DocumentKnowledgePanel } from "@/components/DocumentKnowledgePanel";
import { authOptions } from "@/lib/auth";
import { getClinicTenantId } from "@/lib/clinic-tenant";
import {
  getBusinessInfo,
  getDocuments,
  getGoogleCalendarConnection,
} from "@/lib/db";

export default async function BusinessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <main className="app-shell">
        <section className="app-panel px-6 py-8 sm:px-8">
          <p className="app-label">Authentication required</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
            Please sign in first
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            You need to sign in to manage business info and knowledge documents.
          </p>
          <div className="mt-6">
            <Link href="/login?callbackUrl=%2Fbusiness" className="app-button-primary">
              Go to sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const tenantId = getClinicTenantId();
  const [initial, documents, googleCalendarConnection] = await Promise.all([
    getBusinessInfo(tenantId),
    getDocuments(tenantId),
    getGoogleCalendarConnection(tenantId),
  ]);

  const hasGoogleOAuthConfig = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  );

  return (
    <main className="app-shell space-y-6">
      <section className="app-panel px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <p className="app-label">Business module</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
              Business info
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Manage the hours, service details, uploaded documents, and optional integrations that
              shape how the voice receptionist answers callers.
            </p>
          </div>
          <Link href="/inbox" className="app-button-secondary">
            Back to inbox
          </Link>
        </div>
      </section>

      <BusinessInfoForm initial={initial} />
      <DocumentKnowledgePanel initialDocuments={documents} />

      <ConnectGoogleCalendar
        connected={Boolean(googleCalendarConnection)}
        connectedAt={googleCalendarConnection?.updated_at ?? null}
        hasGoogleOAuthConfig={hasGoogleOAuthConfig}
      />
    </main>
  );
}
