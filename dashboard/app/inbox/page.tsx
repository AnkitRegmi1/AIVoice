import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCalls, getAppointments } from "@/lib/db";
import type { CallRow, AppointmentRow } from "@/lib/db";
import { CalendarView } from "@/components/CalendarView";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Group appointments by calendar day (local date string YYYY-MM-DD) */
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

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const tenantId = (session.user as { tenantId?: number }).tenantId ?? 1;
  const [calls, appointments] = await Promise.all([
    getCalls(tenantId),
    getAppointments(tenantId),
  ]);
  const byDay = appointmentsByDay(appointments);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h2 className="text-2xl font-semibold text-slate-100 mb-6">Smart Inbox</h2>

      {/* Calendar view: so the user can see what's booked when */}
      <section className="mb-10">
        <h3 className="text-lg font-medium text-slate-200 mb-3">Calendar</h3>
        <p className="text-slate-500 text-sm mb-4">
          Your schedule at a glance. Same data the voice agent uses to avoid double-booking.
        </p>
        <CalendarView appointments={appointments} byDay={byDay} />
      </section>

      {/* Scheduled appointments: full name + time (list) */}
      <section className="mb-10">
        <h3 className="text-lg font-medium text-slate-200 mb-3">Scheduled appointments</h3>
        <p className="text-slate-500 text-sm mb-4">
          Booked via the voice agent. Each slot can only be scheduled once.
        </p>
        {appointments.length === 0 ? (
          <p className="text-slate-500 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            No appointments yet. Call the Twilio number and ask Sarah to schedule one.
          </p>
        ) : (
          <ul className="space-y-2">
            {appointments.map((a: AppointmentRow) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-medium text-slate-100">{a.caller_name}</span>
                <span className="text-slate-300">{formatDate(a.scheduled_at)}</span>
                <span className="text-slate-500 text-sm w-full">Scheduled from call</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Call logs */}
      <section>
        <h3 className="text-lg font-medium text-slate-200 mb-3">Call logs</h3>
        <p className="text-slate-500 text-sm mb-4">
          Summary and transcript from each call.
        </p>
        {calls.length === 0 ? (
          <p className="text-slate-500 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            No calls yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {calls.map((c: CallRow) => (
              <li
                key={c.id}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-slate-100 font-medium">
                    {c.caller_name ? `Call from ${c.caller_name}` : "Call (no name provided)"}
                  </span>
                  <span className="text-slate-500 text-sm">{formatDate(c.created_at)}</span>
                </div>
                {c.call_sid && (
                  <span className="text-slate-500 text-xs block mb-1">Call ID: {c.call_sid.slice(0, 20)}…</span>
                )}
                <p className="text-slate-200 font-medium mt-1">{c.summary ?? "—"}</p>
                {c.transcript ? (
                  <p className="text-slate-400 text-sm mt-2 whitespace-pre-wrap border-t border-slate-700 pt-2">{c.transcript}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
