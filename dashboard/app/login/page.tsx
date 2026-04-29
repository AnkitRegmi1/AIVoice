"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/inbox";

  return (
    <main className="app-shell">
      <section className="mx-auto max-w-lg app-panel px-6 py-8 sm:px-8">
        <p className="app-label">Secure access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
          Sign in
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Enter your business email and password to open the Tranquil AI dashboard.
        </p>

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        ) : null}

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setLoading(true);
            const result = await signIn("credentials", {
              email,
              password,
              callbackUrl,
              redirect: true,
            });
            setLoading(false);
            if (result?.error) {
              setError("Invalid email or password.");
              return;
            }
          }}
        >
          <div>
            <label htmlFor="email" className="app-field-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="app-input"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="app-field-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="app-input"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading} className="app-button-primary w-full disabled:opacity-60">
            {loading ? "Signing in" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell">
          <section className="mx-auto max-w-lg app-panel px-6 py-8 text-sm text-slate-500">Loading login...</section>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
