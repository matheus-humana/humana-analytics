import { and, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";

export function chatRateLimitPerHour(raw?: string | null): number {
  if (raw == null || raw.trim() === "") return 30;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 30;
  return Math.floor(value);
}

export async function checkChatRateLimit(
  userId: string,
  rawLimit = process.env.CHAT_RATE_LIMIT_PER_HOUR
): Promise<{ ok: true } | { ok: false; limit: number }> {
  const limit = chatRateLimitPerHour(rawLimit);
  if (limit === 0) return { ok: true };
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(messages.role, "user"),
        gte(messages.createdAt, since)
      )
    )
    .limit(limit);

  if (rows.length >= limit) return { ok: false, limit };
  return { ok: true };
}
