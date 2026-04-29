import type { CallRow } from "@/lib/db";

function formatWhen(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface CallsSummaryListProps {
  calls: CallRow[];
}

export function CallsSummaryList({ calls }: CallsSummaryListProps) {
  return (
    <section className="app-panel p-6 sm:p-8">
      <div className="mb-5">
        <p className="app-label">Recent calls</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">Call summaries</h3>
      </div>

      {calls.length === 0 ? (
        <p className="app-panel-soft p-4 text-sm text-slate-500">No call summaries yet.</p>
      ) : (
        <ul className="space-y-3">
          {calls.map((c) => (
            <li key={c.id} className="app-panel-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">
                  {c.caller_name ?? "Unknown caller"}
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  {formatWhen(c.created_at)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{c.summary ?? "-"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
