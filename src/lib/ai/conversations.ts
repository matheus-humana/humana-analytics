import { randomBytes } from "node:crypto";

import { and, asc, desc, eq } from "drizzle-orm";

import {
  ensureDefaultProject,
  ensureOrganizationMembership,
} from "@/lib/analytics/default-scope";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";

import type { UsageSummary } from "./usage";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

export type StoredTurn = {
  role: "user" | "assistant";
  content: string;
};

export type PublicMessage = {
  role: string;
  content: string;
  createdAt: string;
  toolsUsed: string[];
  usage: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  } | null;
};

function toPublicMessage(row: typeof messages.$inferSelect): PublicMessage {
  const hasUsage = row.role === "assistant" && Boolean(row.model);
  return {
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    toolsUsed: row.toolsUsed ?? [],
    usage: hasUsage
      ? {
          model: row.model ?? "",
          promptTokens: row.promptTokens ?? 0,
          completionTokens: row.completionTokens ?? 0,
          totalTokens: row.totalTokens ?? 0,
          estimatedCostUsd: row.estimatedCostUsd ?? 0,
        }
      : null,
  };
}

export async function listConversationsForUser(userId: string) {
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(30);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getOwnedConversation(userId: string, conversationId: string) {
  const conversation = (
    await db
      .select({
        id: conversations.id,
        title: conversations.title,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, userId)
        )
      )
      .limit(1)
  )[0];

  if (!conversation) return null;

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(100);

  return {
    id: conversation.id,
    title: conversation.title,
    messages: rows.map(toPublicMessage),
  };
}

export async function beginUserTurn(input: {
  userId: string;
  conversationId?: string | null;
  question: string;
}): Promise<{ conversationId: string; history: StoredTurn[] } | null> {
  const { organization } = await ensureOrganizationMembership(input.userId);
  const project = await ensureDefaultProject(organization.id);
  const question = input.question.trim();
  let conversationId = input.conversationId?.trim() || null;

  if (conversationId) {
    const owned = (
      await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, input.userId)
          )
        )
        .limit(1)
    )[0];
    if (!owned) return null;
  } else {
    conversationId = newId();
    await db.insert(conversations).values({
      id: conversationId,
      userId: input.userId,
      projectId: project.id,
      title: question.replace(/\s+/g, " ").slice(0, 80) || "Nova conversa",
    });
  }

  const prior = await db
    .select({
      role: messages.role,
      content: messages.content,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(100);

  await db.insert(messages).values({
    id: newId(),
    conversationId,
    role: "user",
    content: question,
  });

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  const history: StoredTurn[] = prior
    .filter((row) => row.role === "user" || row.role === "assistant")
    .slice(-8)
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

  return { conversationId, history };
}

export async function saveAssistantTurn(input: {
  conversationId: string;
  content: string;
  toolsUsed: string[];
  usage: UsageSummary;
}) {
  await db.insert(messages).values({
    id: newId(),
    conversationId: input.conversationId,
    role: "assistant",
    content: input.content,
    toolsUsed: input.toolsUsed,
    model: input.usage.model,
    promptTokens: input.usage.promptTokens,
    completionTokens: input.usage.completionTokens,
    totalTokens: input.usage.totalTokens,
    estimatedCostUsd: input.usage.estimatedCostUsd,
  });

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, input.conversationId));
}
