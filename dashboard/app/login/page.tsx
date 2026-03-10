"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/inbox";

  return (
    <main className="mx-auto max-w-sm px-6 py-12">
      <h2 className="text-xl font-semibold text-slate-100 mb-4">Sign in</h2>
      <p className="text-slate-500 text-sm mb-4">
        Demo: use any email and password <strong>demo</strong> (lowercase).
      </p>
      {error && (
        <p className="mb-4 rounded bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setLoading(true);
          const result = await signIn("credentials", {
            email,
            password,
            callbackUrl,
            redirect: false,
          });
          setLoading(false);
          if (result?.error) {
            setError("Invalid email or password. Use password: demo");
            return;
          }
          if (result?.ok) {
            router.push(callbackUrl);
            router.refresh();
            return;
          }
        }}
      >
        <div>
          <label htmlFor="email" className="block text-sm text-slate-400 mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-slate-400 mb-1">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
