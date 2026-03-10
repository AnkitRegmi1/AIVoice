import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { saveGoogleTokens } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const pw = credentials?.password?.trim().toLowerCase();
        if (!credentials?.email || pw !== "demo") return null;
        return {
          id: "1",
          email: credentials.email.trim(),
          name: credentials.email.split("@")[0],
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: "https://www.googleapis.com/auth/calendar openid email profile",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) token.tenantId = 1;

      // Simple admin flag: if ADMIN_EMAILS is set, only those emails are admins.
      // If not set, treat all users as admins (dev mode).
      const adminEnv = process.env.ADMIN_EMAILS ?? "";
      const adminEmails = adminEnv
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const email = (token.email ?? user?.email ?? "").toLowerCase();
      if (adminEmails.length > 0) {
        (token as any).isAdmin = adminEmails.includes(email);
      } else {
        (token as any).isAdmin = true;
      }

      if (account?.provider === "google" && account.refresh_token) {
        await saveGoogleTokens(1, account.refresh_token, "primary");
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { tenantId?: number; isAdmin?: boolean }).tenantId = token.tenantId as number;
        (session.user as { tenantId?: number; isAdmin?: boolean }).isAdmin = (token as any).isAdmin === true;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
};
