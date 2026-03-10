"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-slate-400 text-sm">Loading…</span>;
  }

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm">{session.user?.email ?? "Signed in"}</span>
        <Link
          href="/inbox"
          className="rounded bg-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-500"
        >
          Inbox
        </Link>
        <button
          onClick={() => signOut()}
          className="rounded bg-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-500"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
    >
      Sign in
    </Link>
  );
}
