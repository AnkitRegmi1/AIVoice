import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getClinicTenantId } from "@/lib/clinic-tenant";
import { saveGoogleTokens } from "@/lib/db";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "demo@test.com").trim().toLowerCase();

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
      token.tenantId = getClinicTenantId();

      const email = (token.email ?? user?.email ?? "").toLowerCase();
      (token as any).isAdmin = email === ADMIN_EMAIL;

      if (account?.provider === "google" && account.refresh_token) {
        await saveGoogleTokens(getClinicTenantId(), account.refresh_token, "primary");
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
