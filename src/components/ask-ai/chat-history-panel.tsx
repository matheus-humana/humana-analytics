"use client";

import { useEffect, useRef, useState } from "react";

import { IconClose, IconPlus, IconSearch } from "@/components/workspace/icons";
import {
  ASSISTANT_STATUS_PENDING,
  thinkingLabel,
  type ChatLocale,
} from "@/lib/ai/analytics-bot-contract";
import {
  groupConversationsByDate,
  type ConversationGroupKey,
} from "@/lib/ai/conversation-groups";
import type { WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";

type HistoryConversation = {
  id: string;
  title: string;
  assistantStatus?: string;
  updatedAt: string;
};

const GROUP_LABELS: Record<ConversationGroupKey, WorkspaceMessageKey> = {
  today: "chatHistoryToday",
  yesterday: "chatHistoryYesterday",
  week: "chatHistoryWeek",
  month: "chatHistoryMonth",
  older: "chatHistoryOlder",
};

export function ChatHistoryPanel({
  conversations,
  activeId,
  locale,
  text,
  onOpen,
  onNew,
  onClose,
}: {
  conversations: HistoryConversation[];
  activeId: string | null;
  locale: ChatLocale;
  text: (key: WorkspaceMessageKey) => string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? conversations.filter((item) => item.title.toLowerCase().includes(needle))
    : conversations;
  const groups = groupConversationsByDate(filtered);
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });

  return (
    <div
      role="dialog"
      aria-label={text("chatHistory")}
      className="absolute inset-0 z-30 flex flex-col bg-surface"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-secondary px-3">
        <h2 className="text-sm font-medium text-foreground">{text("chatHistory")}</h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onNew();
              onClose();
            }}
            aria-label={text("chatNew")}
            title={text("chatNew")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-secondary hover:text-foreground"
          >
            <IconPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={text("close")}
            title={text("close")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-secondary hover:text-foreground"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="shrink-0 px-3 pt-3">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-1.5 focus-within:border-foreground/25">
          <IconSearch className="h-4 w-4 shrink-0 text-muted" />
          <span className="sr-only">{text("chatHistorySearch")}</span>
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text("chatHistorySearch")}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted">
            {needle ? text("chatHistoryNoResults") : text("chatEmpty")}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="mb-4 last:mb-0">
              <h3 className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                {text(GROUP_LABELS[group.key])}
              </h3>
              <ul>
                {group.items.map((item) => {
                  const active = item.id === activeId;
                  const updated = new Date(item.updatedAt);
                  const when =
                    group.key === "today" ? timeFormat.format(updated) : dateFormat.format(updated);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpen(item.id);
                          onClose();
                        }}
                        aria-current={active ? "true" : undefined}
                        title={item.title}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                          active ? "bg-accent-soft" : "hover:bg-secondary"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm ${active ? "text-accent" : "text-foreground"}`}
                          >
                            {item.title}
                          </span>
                          {item.assistantStatus === ASSISTANT_STATUS_PENDING ? (
                            <span className="block text-xs text-muted">{thinkingLabel(locale)}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{when}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
