import { randomBytes } from "node:crypto";

import type {
  Adapter,
  AdapterAccount,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

function toAdapterUser(row: typeof users.$inferSelect): AdapterUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
  };
}

/**
 * Auth.js database adapter for the `analytics` schema.
 * Google access/refresh/ID tokens are dropped in `linkAccount` and never stored.
 */
export function analyticsAuthAdapter(): Adapter {
  return {
    async createUser(user) {
      const [created] = await db
        .insert(users)
        .values({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
        })
        .returning();

      return toAdapterUser(created);
    },

    async getUser(id) {
      const row = (
        await db.select().from(users).where(eq(users.id, id)).limit(1)
      )[0];
      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email) {
      const row = (
        await db.select().from(users).where(eq(users.email, email)).limit(1)
      )[0];
      return row ? toAdapterUser(row) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const row = (
        await db
          .select({ user: users })
          .from(accounts)
          .innerJoin(users, eq(users.id, accounts.userId))
          .where(
            and(
              eq(accounts.provider, provider),
              eq(accounts.providerAccountId, providerAccountId)
            )
          )
          .limit(1)
      )[0];

      return row ? toAdapterUser(row.user) : null;
    },

    async updateUser(user) {
      const [updated] = await db
        .update(users)
        .set({
          ...(user.name !== undefined ? { name: user.name } : {}),
          ...(user.email !== undefined ? { email: user.email } : {}),
          ...(user.emailVerified !== undefined
            ? { emailVerified: user.emailVerified }
            : {}),
          ...(user.image !== undefined ? { image: user.image } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();

      if (!updated) {
        throw new Error("User not found");
      }

      return toAdapterUser(updated);
    },

    async linkAccount(account: AdapterAccount) {
      if (!account.userId) {
        throw new Error("Cannot link an account without a user id");
      }

      await db
        .insert(accounts)
        .values({
          id: newId(),
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        })
        .onConflictDoNothing({
          target: [accounts.provider, accounts.providerAccountId],
        });
    },

    async createSession(session) {
      await db.insert(sessions).values({
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      });
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const row = (
        await db
          .select({ session: sessions, user: users })
          .from(sessions)
          .innerJoin(users, eq(users.id, sessions.userId))
          .where(eq(sessions.sessionToken, sessionToken))
          .limit(1)
      )[0];

      if (!row) return null;

      if (row.session.expires.getTime() <= Date.now()) {
        await db
          .delete(sessions)
          .where(eq(sessions.sessionToken, sessionToken));
        return null;
      }

      return {
        session: {
          sessionToken: row.session.sessionToken,
          userId: row.session.userId,
          expires: row.session.expires,
        },
        user: toAdapterUser(row.user),
      };
    },

    async updateSession(session) {
      const [updated] = await db
        .update(sessions)
        .set({
          ...(session.expires ? { expires: session.expires } : {}),
          ...(session.userId ? { userId: session.userId } : {}),
        })
        .where(eq(sessions.sessionToken, session.sessionToken))
        .returning();

      if (!updated) return null;

      return {
        sessionToken: updated.sessionToken,
        userId: updated.userId,
        expires: updated.expires,
      };
    },

    async deleteSession(sessionToken) {
      const existing = (
        await db
          .select()
          .from(sessions)
          .where(eq(sessions.sessionToken, sessionToken))
          .limit(1)
      )[0];

      await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));

      if (!existing) return null;

      return {
        sessionToken: existing.sessionToken,
        userId: existing.userId,
        expires: existing.expires,
      };
    },

    async createVerificationToken(verificationToken: VerificationToken) {
      await db.insert(verificationTokens).values(verificationToken);
      return verificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      const existing = (
        await db
          .select()
          .from(verificationTokens)
          .where(
            and(
              eq(verificationTokens.identifier, identifier),
              eq(verificationTokens.token, token)
            )
          )
          .limit(1)
      )[0];

      await db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token)
          )
        );

      return existing ?? null;
    },
  };
}
