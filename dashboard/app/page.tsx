import Link from "next/link";
import { DatabaseStatusBanner } from "@/components/DatabaseStatusBanner";

const stats = [
  { value: "99.9%", label: "System operational" },
  { value: "180", label: "Calls summarized" },
  { value: "10,000", label: "Audio events processed" },
  { value: "50", label: "Bookings coordinated" },
];

const cards = [
  {
    title: "Smart inbox",
    copy: "See call summaries, appointment outcomes, and what the receptionist handled most recently.",
    href: "/inbox",
  },
  {
    title: "Business controls",
    copy: "Update business hours, service details, uploaded knowledge, and the rules the voice agent follows.",
    href: "/business",
  },
  {
    title: "Tenant admin",
    copy: "Create business tenants and map Twilio numbers without changing the voice engine logic.",
    href: "/admin",
  },
];

export default function HomePage() {
  return (
    <main className="app-shell space-y-8">
      <DatabaseStatusBanner />

      <section className="app-panel overflow-hidden">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-12">
          <div className="space-y-6">
            <span className="app-chip">System control center</span>
            <div className="max-w-xl space-y-4">
              <h1 className="app-title max-w-lg" style={{ fontFamily: "var(--font-display)" }}>
                Intelligent voice automation for calls, booking, and business answers.
              </h1>
              <p className="app-subtitle max-w-xl">
                Tranquil AI gives your team one place to review receptionist calls, manage appointment
                flow, and keep the live voice assistant aligned with real business information.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/inbox" className="app-button-primary">
                Open dashboard
              </Link>
              <Link href="/business" className="app-button-secondary">
                Manage business info
              </Link>
            </div>
          </div>

          <div className="app-panel-soft flex flex-col justify-between gap-6 p-6">
            <div>
              <p className="app-label">Live workflow</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                Caller, AI, and schedule data stay in one simple flow.
              </h2>
            </div>
            <div className="space-y-3">
              {[
                "Inbound call reaches the voice server through Twilio.",
                "The agent retrieves business knowledge and checks available times.",
                "Summaries and appointments appear in the dashboard immediately after the call.",
              ].map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl bg-white/80 px-4 py-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="app-stat">
            <span className="app-stat-value" style={{ fontFamily: "var(--font-display)" }}>
              {stat.value}
            </span>
            <span className="app-stat-label">{stat.label}</span>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className="app-panel p-6">
            <p className="app-label mb-3">Module</p>
            <h3 className="app-card-title text-slate-900">{card.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{card.copy}</p>
            <div className="mt-6">
              <Link href={card.href} className="app-button-ghost">
                Open section
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
