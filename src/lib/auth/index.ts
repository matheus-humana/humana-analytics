import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { ensureOrganizationMembership } from "@/lib/analytics/default-scope";

import { analyticsAuthAdapter } from "./adapter";

const secret =
  process.env.AUTH_SECRET?.trim() ||
  process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();

const googleClientId =
  process.env.AUTH_GOOGLE_ID?.trim() ||
  process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET?.trim() ||
  process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!secret) {
  console.error("[humana-analytics] AUTH_SECRET is missing");
}
if (!googleClientId || !googleClientSecret) {
  console.error("[humana-analytics] Google OAuth client env is missing");
}

/**
 * Auth.js (NextAuth v5) with Google sign-in.
 * Prefers AUTH_GOOGLE_* then falls back to GOOGLE_CLIENT_*.
 * Sessions live in Postgres. Login scopes stay on OpenID (no GA4).
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
      clientId: googleClientId,
      clientSecret: googleClientSecret,
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
          email: user.email,
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
