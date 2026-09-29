import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  text,
} from 'drizzle-orm/pg-core';

import type { Citation, ToolCallRecord } from '@/lib/ai/tool-trace';

import { analyticsSchema, timestamptz } from './analytics-schema';
import { projects } from './projects';
import { users } from './users';

export const conversations = analyticsSchema.table(
  'conversations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    assistantStatus: text('assistant_status')
      .$type<'idle' | 'pending'>()
      .notNull()
      .default('idle'),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('conversations_user_id_idx').on(table.userId),
    index('conversations_project_id_idx').on(table.projectId),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export const messages = analyticsSchema.table(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    toolsUsed: jsonb('tools_used').$type<string[] | ToolCallRecord[]>(),
    provider: text('provider'),
    locale: text('locale'),
    citations: jsonb('citations').$type<Citation[]>(),
    usedFallback: boolean('used_fallback').notNull().default(false),
    model: text('model'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    estimatedCostUsd: doublePrecision('estimated_cost_usd'),
    replyToMessageId: text('reply_to_message_id'),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [index('messages_conversation_id_idx').on(table.conversationId)]
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
