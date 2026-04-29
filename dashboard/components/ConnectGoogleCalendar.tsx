"use client";

import { signIn } from "next-auth/react";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ConnectGoogleCalendar({
  connected,
  connectedAt,
  hasGoogleOAuthConfig,
}: {
  connected: boolean;
  connectedAt?: Date | string | null;
  hasGoogleOAuthConfig: boolean;
}) {
  const formattedConnectedAt = formatDate(connectedAt);

  return (
    <section className="app-panel p-6 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="app-label">Optional integration</p>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            connected
              ? "bg-emerald-100 text-emerald-700"
              : hasGoogleOAuthConfig
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-200 text-slate-600"
          }`}
        >
          {connected ? "Connected" : hasGoogleOAuthConfig ? "Ready to connect" : "Setup needed"}
        </span>
      </div>

      <h3 className="app-card-title text-slate-900">Google Calendar</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        When enabled, phone bookings can also create a calendar event for the connected tenant.
      </p>

      {connected ? (
        <p className="mt-4 text-sm font-medium text-emerald-700">
          Calendar connection saved{formattedConnectedAt ? ` on ${formattedConnectedAt}` : ""}.
        </p>
      ) : null}

      {!hasGoogleOAuthConfig ? (
        <p className="mt-4 text-sm leading-7 text-amber-700">
          Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to both
          <code> dashboard/.env.local</code> and <code> server/.env</code> before connecting.
        </p>
      ) : null}

      <div className="mt-6">
        <button
          type="button"
          disabled={!hasGoogleOAuthConfig}
          onClick={() => signIn("google", { callbackUrl: "/business" })}
          className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {connected ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </button>
      </div>
    </section>
  );
}
