import { isDatabaseConfigured } from "@/lib/db";

export function DatabaseStatusBanner() {
  if (isDatabaseConfigured()) return null;

  return (
    <div className="app-panel border-amber-300/80 bg-amber-50/90 px-5 py-4" role="alert">
      <p className="text-sm font-medium leading-6 text-amber-900">
        Database not connected. Appointments, uploads, and call logs will stay empty until the
        dashboard restarts with a valid database connection.
      </p>
    </div>
  );
}
