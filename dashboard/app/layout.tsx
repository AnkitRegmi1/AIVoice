import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { AuthButton } from "@/components/AuthButton";

export const metadata: Metadata = {
  title: "AI Voice — Dashboard",
  description: "Call transcripts and appointments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SessionProvider>
          <header className="border-b border-slate-700 bg-slate-900/50 px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-100">AI Voice — Dashboard</h1>
            <nav className="flex items-center gap-4">
              <Link href="/inbox" className="text-slate-300 hover:text-slate-100 text-sm">Inbox</Link>
              <Link href="/business" className="text-slate-300 hover:text-slate-100 text-sm">Business info</Link>
              <AuthButton />
            </nav>
          </header>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
