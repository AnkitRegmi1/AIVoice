import type { AppointmentRow } from "@/lib/db";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";

function formatTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function groupByDay(appointments: AppointmentRow[]): Map<string, AppointmentRow[]> {
  const map = new Map<string, AppointmentRow[]>();
  for (const a of appointments) {
    const key = getDayKey(new Date(a.scheduled_at));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return map;
}

function monthDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const result: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) result.push(null);
  for (let d = 1; d <= daysInMonth; d++) result.push(d);
  return result;
}

function googleEventsByDay(events: GoogleCalendarEvent[]): Map<string, GoogleCalendarEvent[]> {
  const map = new Map<string, GoogleCalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

interface CalendarViewProps {
  appointments: AppointmentRow[];
  byDay?: Map<string, AppointmentRow[]>;
  googleEvents?: GoogleCalendarEvent[];
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ appointments, byDay: byDayProp, googleEvents = [] }: CalendarViewProps) {
  const byDay = byDayProp ?? groupByDay(appointments);
  const gcalByDay = googleEventsByDay(googleEvents);
  const now = new Date();
  const viewYear = now.getFullYear();
  const viewMonth = now.getMonth();
  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const days = monthDays(viewYear, viewMonth);

  const dayCell = (day: number | null, index: number) => {
    if (day === null) {
      return (
        <div
          key={`empty-${viewYear}-${viewMonth}-${index}`}
          className="min-h-[116px] rounded-[20px] border border-dashed border-slate-200 bg-white/30"
        />
      );
    }

    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayAppointments = byDay.get(key) ?? [];
    const dayGcal = gcalByDay.get(key) ?? [];
    const isToday =
      now.getFullYear() === viewYear &&
      now.getMonth() === viewMonth &&
      now.getDate() === day;

    const totalCount = dayAppointments.length + dayGcal.length;

    return (
      <div
        key={key}
        className={`min-h-[116px] rounded-[20px] border p-3 ${
          isToday
            ? "border-indigo-300 bg-indigo-50 shadow-[0_12px_28px_rgba(91,79,241,0.12)]"
            : "border-slate-200 bg-white/80"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{day}</span>
          {totalCount > 0 ? (
            <span className="rounded-full bg-slate-900/[0.05] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {totalCount} event{totalCount !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        <div className="space-y-1.5">
          {dayAppointments.slice(0, 2).map((a) => {
            const summary = a.call_summary?.trim() || null;
            const tip = [
              `${formatTime(a.scheduled_at)} - ${a.caller_name}`,
              summary ? `Call: ${summary}` : a.call_sid ? "Summary saves when the call ends." : "",
            ]
              .filter(Boolean)
              .join("\n\n");
            return (
              <div key={a.id} className="rounded-2xl bg-indigo-50 px-3 py-2" title={tip}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">
                  {formatTime(a.scheduled_at)}
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-900">{a.caller_name}</p>
                <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-slate-500">
                  {summary ?? "Phone booking"}
                </p>
              </div>
            );
          })}

          {dayGcal.slice(0, 2).map((e) => (
            <div
              key={e.id}
              className="rounded-2xl bg-emerald-50 px-3 py-2"
              title={`${e.allDay ? "All day" : formatTime(e.start)} – ${e.summary}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {e.allDay ? "All day" : formatTime(e.start)}
              </p>
              <p className="mt-0.5 line-clamp-1 text-sm font-medium text-slate-900">{e.summary}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">Google Calendar</p>
            </div>
          ))}

          {totalCount > 4 ? (
            <p className="pl-1 text-[10px] text-slate-400">+{totalCount - 4} more</p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="app-panel p-5 sm:p-6">
      <div className="mb-5 text-center">
        <p className="app-label">Calendar</p>
        <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-900">{monthLabel}</h4>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-2">
        {WEEK_DAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">{days.map((day, i) => dayCell(day, i))}</div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-indigo-200" />
          <span className="text-[11px] text-slate-500">Phone bookings</span>
        </div>
        {googleEvents.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-200" />
            <span className="text-[11px] text-slate-500">Google Calendar</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
