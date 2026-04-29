import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { authOptions } from "@/lib/auth";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Tranquil AI Dashboard",
  description: "AI voice receptionist inbox, scheduling, and business controls",
};

const baseNavItems = [
  { href: "/inbox", label: "Inbox" },
  { href: "/business", label: "Business" },
  { href: "/calendar", label: "Schedule" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const navItems = isAdmin
    ? [...baseNavItems, { href: "/admin", label: "Admin" }]
    : baseNavItems;

  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="min-h-screen antialiased" style={{ fontFamily: "var(--font-body)" }}>
        <div className="relative pb-16 pt-6 sm:pt-8">
          <header className="app-shell sticky top-3 z-40 mb-8">
            <div className="app-panel flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-3">
                <span className="app-logo-badge">T</span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    TranquilAI
                  </p>
                  <p
                    className="text-sm font-semibold tracking-[-0.03em] text-slate-900"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Voice automation control
                  </p>
                </div>
              </Link>

              <div className="flex min-w-0 max-w-full flex-1 items-center gap-1 overflow-x-auto rounded-full bg-slate-900/[0.03] p-1 md:flex-initial">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="app-nav-link whitespace-nowrap">
                    {item.label}
                  </Link>
                ))}
              </div>

              {session?.user ? (
                <div className="flex items-center gap-2">
                  <div className="hidden items-center gap-2 rounded-full bg-slate-900/[0.04] px-3 py-2 sm:flex">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                      {(session.user.email?.[0] ?? "U").toUpperCase()}
                    </span>
                    <span className="max-w-[170px] truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {session.user.email ?? "Signed in"}
                    </span>
                  </div>
                  <Link href="/api/auth/signout" className="app-button-primary px-4 py-2.5">
                    Sign out
                  </Link>
                </div>
              ) : (
                <Link href="/login" className="app-button-primary px-4 py-2.5">
                  Sign in
                </Link>
              )}
            </div>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
