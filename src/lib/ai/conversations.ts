import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, or } from "drizzle-orm";

import {
  ensureDefaultProject,
  ensureOrganizationMembership,
} from "@/lib/analytics/default-scope";
import { db } from "@/lib/db";
import { conversations, messages, projects } from "@/lib/db/schema";

import {
  ASSISTANT_STATUS_IDLE,
  ASSISTANT_STATUS_PENDING,
  assertReplyOwnership,
  composeAssistantContent,
  isThinkingPlaceholder,
  replyWritePlan,
  THINKING_EN,
  THINKING_PT,
} from "./analytics-bot-contract";
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
      assistantStatus: conversations.assistantStatus,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(30);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    assistantStatus: row.assistantStatus,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getOwnedConversation(userId: string, conversationId: string) {
  const conversation = (
    await db
      .select({
        id: conversations.id,
        title: conversations.title,
        assistantStatus: conversations.assistantStatus,
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
    assistantStatus: conversation.assistantStatus,
    messages: rows.map(toPublicMessage),
  };
}

export type UserTurn = {
  conversationId: string;
  messageId: string;
  userId: string;
  organizationId: string;
  projectId: string;
  createdAt: string;
  history: StoredTurn[];
};

export async function beginUserTurn(input: {
  userId: string;
  conversationId?: string | null;
  question: string;
}): Promise<UserTurn | null> {
  const { organization } = await ensureOrganizationMembership(input.userId);
  const defaultProject = await ensureDefaultProject(organization.id);
  const question = input.question.trim();
  let conversationId = input.conversationId?.trim() || null;
  let projectId = defaultProject.id;
  let organizationId = organization.id;

  if (conversationId) {
    const owned = (
      await db
        .select({
          id: conversations.id,
          projectId: conversations.projectId,
        })
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
    projectId = owned.projectId;
    const project = (
      await db
        .select({ organizationId: projects.organizationId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)
    )[0];
    if (project) organizationId = project.organizationId;
  } else {
    conversationId = newId();
    await db.insert(conversations).values({
      id: conversationId,
      userId: input.userId,
      projectId,
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

  const messageId = newId();
  const createdAt = new Date();
  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: "user",
    content: question,
    createdAt,
  });

  await db
    .update(conversations)
    .set({ updatedAt: createdAt })
    .where(eq(conversations.id, conversationId));

  const history: StoredTurn[] = prior
    .filter((row) => row.role === "user" || row.role === "assistant")
    .filter(
      (row) => !(row.role === "assistant" && isThinkingPlaceholder(row.content))
    )
    .slice(-8)
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

  return {
    conversationId,
    messageId,
    userId: input.userId,
    organizationId,
    projectId,
    createdAt: createdAt.toISOString(),
    history,
  };
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
    .set({
      assistantStatus: ASSISTANT_STATUS_IDLE,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, input.conversationId));
}

async function setConversationIdle(conversationId: string) {
  await db
    .update(conversations)
    .set({
      assistantStatus: ASSISTANT_STATUS_IDLE,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));
}

export async function markConversationPending(input: {
  conversationId: string;
  replyToMessageId: string;
  thinking: string;
}): Promise<{ state: "pending" } | { state: "answered"; answer: string }> {
  const existing = (
    await db
      .select({ id: messages.id, content: messages.content })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, input.conversationId),
          eq(messages.replyToMessageId, input.replyToMessageId),
          eq(messages.role, "assistant")
        )
      )
      .limit(1)
  )[0];

  if (existing && !isThinkingPlaceholder(existing.content)) {
    await setConversationIdle(input.conversationId);
    return { state: "answered", answer: existing.content };
  }

  if (!existing) {
    await db.insert(messages).values({
      id: newId(),
      conversationId: input.conversationId,
      role: "assistant",
      content: input.thinking,
      replyToMessageId: input.replyToMessageId,
    });
  }

  await db
    .update(conversations)
    .set({
      assistantStatus: ASSISTANT_STATUS_PENDING,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, input.conversationId));

  return { state: "pending" };
}

export async function clearConversationPending(input: {
  conversationId: string;
  replyToMessageId: string;
}) {
  await db
    .delete(messages)
    .where(
      and(
        eq(messages.conversationId, input.conversationId),
        eq(messages.replyToMessageId, input.replyToMessageId),
        eq(messages.role, "assistant"),
        or(eq(messages.content, THINKING_PT), eq(messages.content, THINKING_EN))
      )
    );

  await db
    .update(conversations)
    .set({
      assistantStatus: ASSISTANT_STATUS_IDLE,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversations.id, input.conversationId),
        eq(conversations.assistantStatus, ASSISTANT_STATUS_PENDING)
      )
    );
}

export async function appendAnalyticsBotReply(input: {
  conversationId: string;
  messageId: string | null;
  text: string;
  source: string;
  userId: string | null;
  organizationId: string | null;
  projectId: string | null;
  imageUrls: string[];
}): Promise<
  | { ok: true; duplicate: boolean }
  | { ok: false; status: number; error: string }
> {
  const conversation = (
    await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        projectId: conversations.projectId,
        organizationId: projects.organizationId,
      })
      .from(conversations)
      .innerJoin(projects, eq(projects.id, conversations.projectId))
      .where(eq(conversations.id, input.conversationId))
      .limit(1)
  )[0];

  if (!conversation) {
    return { ok: false, status: 404, error: "Conversation not found." };
  }

  const ownership = assertReplyOwnership({
    conversationUserId: conversation.userId,
    conversationProjectId: conversation.projectId,
    conversationOrganizationId: conversation.organizationId,
    userId: input.userId,
    projectId: input.projectId,
    organizationId: input.organizationId,
  });
  if (!ownership.ok) {
    return { ok: false, status: 403, error: ownership.error };
  }

  if (input.messageId) {
    const userMessage = (
      await db
        .select({ id: messages.id, role: messages.role })
        .from(messages)
        .where(
          and(
            eq(messages.id, input.messageId),
            eq(messages.conversationId, input.conversationId)
          )
        )
        .limit(1)
    )[0];
    if (!userMessage || userMessage.role !== "user") {
      return {
        ok: false,
        status: 400,
        error: "messageId does not belong to this conversation.",
      };
    }
  }

  const content = composeAssistantContent(input.text, input.imageUrls);
  const placeholder = input.messageId
    ? (
        await db
          .select({ id: messages.id, content: messages.content })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, input.conversationId),
              eq(messages.replyToMessageId, input.messageId),
              eq(messages.role, "assistant")
            )
          )
          .limit(1)
      )[0]
    : (
        await db
          .select({ id: messages.id, content: messages.content })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, input.conversationId),
              eq(messages.role, "assistant"),
              or(
                eq(messages.content, THINKING_PT),
                eq(messages.content, THINKING_EN)
              )
            )
          )
          .orderBy(desc(messages.createdAt))
          .limit(1)
      )[0];

  const plan = replyWritePlan(placeholder?.content ?? null);
  if (plan === "duplicate") {
    await setConversationIdle(input.conversationId);
    return { ok: true, duplicate: true };
  }

  if (plan === "replace" && placeholder) {
    const updated = await db
      .update(messages)
      .set({
        content,
        toolsUsed: [input.source],
      })
      .where(
        and(
          eq(messages.id, placeholder.id),
          or(eq(messages.content, THINKING_PT), eq(messages.content, THINKING_EN))
        )
      )
      .returning({ id: messages.id });

    if (updated.length > 0) {
      await setConversationIdle(input.conversationId);
      return { ok: true, duplicate: false };
    }

    const current = (
      await db
        .select({ content: messages.content })
        .from(messages)
        .where(eq(messages.id, placeholder.id))
        .limit(1)
    )[0];
    if (current && !isThinkingPlaceholder(current.content)) {
      await setConversationIdle(input.conversationId);
      return { ok: true, duplicate: true };
    }
  }

  const latestMessage = (
    await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, input.conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(1)
  )[0];
  if (
    latestMessage?.role === "assistant" &&
    latestMessage.content === content &&
    !isThinkingPlaceholder(latestMessage.content)
  ) {
    await setConversationIdle(input.conversationId);
    return { ok: true, duplicate: true };
  }

  await db.insert(messages).values({
    id: newId(),
    conversationId: input.conversationId,
    role: "assistant",
    content,
    toolsUsed: [input.source],
    replyToMessageId: input.messageId,
  });
  await setConversationIdle(input.conversationId);
  return { ok: true, duplicate: false };
}
