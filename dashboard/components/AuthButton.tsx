"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Loading</span>;
  }

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full bg-slate-900/[0.04] px-3 py-2 sm:flex">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {(session.user?.email?.[0] ?? "U").toUpperCase()}
          </span>
          <span className="max-w-[170px] truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {session.user?.email ?? "Signed in"}
          </span>
        </div>
        <button onClick={() => signOut()} className="app-button-primary px-4 py-2.5">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link href="/login" className="app-button-primary px-4 py-2.5">
      Sign in
    </Link>
  );
}
