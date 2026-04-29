import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getClinicTenantId } from "@/lib/clinic-tenant";
import { getAppointments, getCalls } from "@/lib/db";
import type { AppointmentRow } from "@/lib/db";
import { getGoogleCalendarEventsForMonth } from "@/lib/google-calendar";
import { CalendarView } from "@/components/CalendarView";
import { CallsSummaryList } from "@/components/CallsSummaryList";

function appointmentsByDay(appointments: AppointmentRow[]): Map<string, AppointmentRow[]> {
  const map = new Map<string, AppointmentRow[]>();
  for (const a of appointments) {
    const d = new Date(a.scheduled_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return map;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function CalendarPage() {
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
            You need to sign in to view the appointment calendar.
          </p>
          <div className="mt-6">
            <Link href="/login?callbackUrl=%2Fcalendar" className="app-button-primary">
              Go to sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const tenantId = getClinicTenantId();
  const now = new Date();
  const [appointments, calls, googleEvents] = await Promise.all([
    getAppointments(tenantId, 120),
    getCalls(tenantId, 30),
    getGoogleCalendarEventsForMonth(tenantId, now.getFullYear(), now.getMonth()),
  ]);
  const byDay = appointmentsByDay(appointments);
  const sortedChronological = [...appointments].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  return (
    <main className="app-shell space-y-6">
      <section className="app-panel px-6 py-8 sm:px-8">
        <p className="app-label">Schedule</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
          Appointment calendar
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Scan upcoming bookings at a glance and review the call context that led to each
          appointment.
        </p>
      </section>

      <CalendarView appointments={appointments} byDay={byDay} googleEvents={googleEvents} />

      <section className="app-panel p-6 sm:p-8">
        <div className="mb-5">
          <p className="app-label">Timeline</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            Upcoming appointments
          </h3>
        </div>

        {appointments.length === 0 ? (
          <p className="app-panel-soft p-4 text-sm text-slate-500">No appointments yet.</p>
        ) : (
          <ul className="space-y-3">
            {sortedChronological.map((a) => (
              <li key={a.id} className="app-panel-soft p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{a.caller_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-indigo-600">
                      {formatDate(a.scheduled_at)}
                    </p>
                  </div>
                </div>
                {a.call_summary?.trim() ? (
                  <p className="mt-3 text-sm leading-7 text-slate-600">{a.call_summary.trim()}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <CallsSummaryList calls={calls} />
    </main>
  );
}
