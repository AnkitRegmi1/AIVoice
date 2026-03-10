import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h2 className="text-2xl font-semibold text-slate-100 mb-2">Welcome</h2>
      <p className="text-slate-400 mb-6">
        Sign in to view the Smart Inbox (calls and scheduled appointments) and set your business info for the voice agent.
      </p>
      <div className="flex gap-3">
        <Link
          href="/inbox"
          className="inline-flex rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Go to Smart Inbox
        </Link>
        <Link
          href="/business"
          className="inline-flex rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
        >
          Business info
        </Link>
      </div>
    </main>
  );
}
