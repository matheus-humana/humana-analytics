import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { ensureOrganizationMembership } from "@/lib/analytics/default-scope";

import { analyticsAuthAdapter } from "./adapter";

const secret =
  process.env.AUTH_SECRET?.trim() ||
  process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();

/**
 * Auth.js (NextAuth v5) with Google sign-in.
 * Reuses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Sessions live in Postgres.
 * Login scopes stay on OpenID (email + profile) and do not request GA4 access.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: analyticsAuthAdapter(),
  secret,
  trustHost: true,
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 14,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      if (!profile?.email || typeof profile.email !== "string") return false;
      return true;
    },
    async session({ session, user }) {
      return {
        expires: session.expires,
        user: {
          id: user.id,
          name: user.name ?? null,
        },
      };
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await ensureOrganizationMembership(user.id);
      } catch {
        console.error("[humana-analytics] could not attach organization membership");
      }
    },
  },
});
