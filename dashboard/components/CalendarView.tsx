import type { AppointmentRow } from "@/lib/db";

function formatTime(d: Date | string) {
  return new Date(d).toLocaleTimeString(undefined, {
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

/** Build calendar days for a month (with leading empty slots for grid) */
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

interface CalendarViewProps {
  appointments: AppointmentRow[];
  byDay?: Map<string, AppointmentRow[]>;
}

export function CalendarView({ appointments, byDay: byDayProp }: CalendarViewProps) {
  const byDay = byDayProp ?? groupByDay(appointments);
  const now = new Date();
  const thisMonth = monthDays(now.getFullYear(), now.getMonth());
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1);
  const nextMonthDays = monthDays(nextMonth.getFullYear(), nextMonth.getMonth());

  const monthLabel = (year: number, month: number) =>
    new Date(year, month).toLocaleString(undefined, { month: "long", year: "numeric" });

  const dayCell = (year: number, month: number, day: number | null, index: number) => {
    if (day === null)
      return (
        <div key={`empty-${year}-${month}-${index}`} className="rounded bg-slate-800/30 p-2 min-h-[80px]" />
      );
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayAppointments = byDay.get(key) ?? [];
    const isToday =
      now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
    return (
      <div
        key={key}
        className={`rounded border p-2 min-h-[80px] ${
          isToday ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700 bg-slate-800/50"
        }`}
      >
        <div className="text-slate-400 text-sm font-medium mb-1">{day}</div>
        <div className="space-y-1">
          {dayAppointments.map((a) => (
            <div key={a.id} className="text-xs text-slate-200 truncate" title={a.caller_name}>
              <span className="font-medium">{formatTime(a.scheduled_at)}</span> {a.caller_name}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-slate-300 font-medium mb-2">
          {monthLabel(now.getFullYear(), now.getMonth())}
        </h4>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((w) => (
            <div key={w} className="text-center text-slate-500 text-xs font-medium py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {thisMonth.map((day, i) => dayCell(now.getFullYear(), now.getMonth(), day, i))}
        </div>
      </div>
      <div>
        <h4 className="text-slate-300 font-medium mb-2">
          {monthLabel(nextMonth.getFullYear(), nextMonth.getMonth())}
        </h4>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((w) => (
            <div key={w} className="text-center text-slate-500 text-xs font-medium py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {nextMonthDays.map((day, i) =>
            dayCell(nextMonth.getFullYear(), nextMonth.getMonth(), day, i)
          )}
        </div>
      </div>
    </div>
  );
}
