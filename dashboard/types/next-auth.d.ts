import type { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    tenantId?: number;
    isAdmin?: boolean;
  }
  interface Session {
    user: { tenantId?: number; isAdmin?: boolean } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: number;
    isAdmin?: boolean;
  }
}
