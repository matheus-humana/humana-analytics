"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PeriodFilter } from "@/components/analytics/period-filter";
import { useLocale } from "@/components/i18n/locale-provider";
import { Dropdown } from "@/components/ui/dropdown";
import { IconArrowUp } from "@/components/workspace/icons";
import {
  ASSISTANT_STATUS_PENDING,
  isThinkingPlaceholder,
  splitAssistantContent,
  thinkingLabel,
  type ChatLocale,
} from "@/lib/ai/analytics-bot-contract";
import {
  resolveAnalyticsPeriod,
  type AnalyticsPeriodId,
} from "@/lib/analytics/period";
import { localizeKnownCopy } from "@/lib/i18n/known-copy";
import { periodLabel } from "@/lib/i18n/period-label";
import {
  chatSuggestionKeys,
  workspaceText,
  type WorkspaceMessageKey,
} from "@/lib/i18n/workspace-copy";

type UsageInfo = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

type ChatMessage = {
  role: string;
  content: string;
  toolsUsed?: string[];
  usage?: UsageInfo | null;
  pending?: boolean;
};

type ConversationSummary = {
  id: string;
  title: string;
  assistantStatus?: string;
  updatedAt: string;
};

type ConversationDetail = {
  assistantStatus?: string;
  messages: ChatMessage[];
};

export function AskAiPanel({
  variant = "page",
  locale,
  onActivity,
}: {
  variant?: "page" | "column";
  locale?: ChatLocale;
  onActivity?: (kind: "question" | "reply") => void;
} = {}) {
  const { locale: contextLocale } = useLocale();
  const activeLocale = locale ?? contextLocale;
  const text = (key: WorkspaceMessageKey) => workspaceText(activeLocale, key);
  const suggestions = chatSuggestionKeys.map((key) => text(key));
  const router = useRouter();
  const searchParams = useSearchParams();
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);
  const periodId = resolveAnalyticsPeriod(searchParams.get("period")).id;

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [assistantStatus, setAssistantStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const awaitingReply = assistantStatus === ASSISTANT_STATUS_PENDING;
  const busy = loading || awaitingReply;

  async function loadConversations() {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    const data = (await response.json()) as {
      ok?: boolean;
      conversations?: ConversationSummary[];
    };
    if (response.ok && data.ok) {
      setConversations(data.conversations ?? []);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (cancelled) return;
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        conversations?: ConversationSummary[];
      };
      if (!cancelled && response.ok && data.ok) {
        setConversations(data.conversations ?? []);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!awaitingReply || !conversationId) return;
    let cancelled = false;

    async function poll() {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        cache: "no-store",
      });
      if (cancelled) return;
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        conversation?: ConversationDetail;
      };
      if (cancelled || !response.ok || !data.ok || !data.conversation) return;
      if (data.conversation.assistantStatus === ASSISTANT_STATUS_PENDING) return;

      onActivityRef.current?.("reply");
      setAssistantStatus(data.conversation.assistantStatus ?? "idle");
      setMessages(data.conversation.messages ?? []);
      const list = await fetch("/api/conversations", { cache: "no-store" });
      if (cancelled || !list.ok) return;
      const listData = (await list.json()) as {
        ok?: boolean;
        conversations?: ConversationSummary[];
      };
      if (listData.ok) setConversations(listData.conversations ?? []);
    }

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [awaitingReply, conversationId, router]);

  async function openConversation(id: string) {
    setLoadingHistory(true);
    setError(null);
    setConversationId(id);
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        conversation?: ConversationDetail;
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "chatOpenFailed");
        return;
      }
      setAssistantStatus(data.conversation?.assistantStatus ?? "idle");
      setMessages(data.conversation?.messages ?? []);
    } catch {
      setError("chatOpenFailed");
    } finally {
      setLoadingHistory(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setAssistantStatus("idle");
    setMessages([]);
    setError(null);
    setQuestion("");
  }

  async function handleAsk(nextQuestion?: string) {
    const trimmed = (nextQuestion ?? question).trim();
    if (!trimmed || busy) return;

    setQuestion("");
    setLoading(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);

    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          period: periodId,
          conversationId,
        }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json()) as {
        ok: boolean;
        pending?: boolean;
        answer?: string;
        error?: string;
        toolsUsed?: string[];
        usage?: UsageInfo;
        conversationId?: string;
        thinking?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "chatQueryFailed");
        return;
      }

      if (data.conversationId) setConversationId(data.conversationId);
      onActivityRef.current?.("question");

      if (data.pending) {
        setAssistantStatus(ASSISTANT_STATUS_PENDING);
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: data.thinking ?? thinkingLabel(activeLocale),
            pending: true,
          },
        ]);
        await loadConversations();
        return;
      }

      setAssistantStatus("idle");
      onActivityRef.current?.("reply");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer ?? "",
          toolsUsed: data.toolsUsed ?? [],
          usage: data.usage ?? null,
        },
      ]);
      await loadConversations();
    } catch {
      setError("chatSpeakFailed");
    } finally {
      setLoading(false);
    }
  }

  const latestUsage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.usage)?.usage;
  const pendingLabel = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        (message.pending || isThinkingPlaceholder(message.content))
    )?.content;

  const shownError = error ? localizeKnownCopy(error, activeLocale) : null;
  const askLabel = loading
    ? text("chatSending")
    : awaitingReply
      ? pendingLabel && !isThinkingPlaceholder(pendingLabel)
        ? localizeKnownCopy(pendingLabel, activeLocale)
        : thinkingLabel(activeLocale)
      : text("chatAsk");

  if (variant === "column") {

    return (
      <ColumnChat
        text={text}
        periodId={periodId as AnalyticsPeriodId}
        askLabel={askLabel}
        question={question}
        setQuestion={setQuestion}
        busy={busy}
        onAsk={(value) => void handleAsk(value)}
        onNew={startNewConversation}
        conversationId={conversationId}
        conversations={conversations}
        onOpen={(id) => {
          if (!id) {
            startNewConversation();
            return;
          }
          void openConversation(id);
        }}
        loadingHistory={loadingHistory}
        messages={messages}
        assistantStatus={assistantStatus}
        error={shownError}
        suggestions={suggestions}
        locale={activeLocale}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs text-accent">
            GA4 · GitHub · PageSpeed · SEO/GEO
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Humana Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{text("chatPitch")}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <PeriodFilter value={periodId as AnalyticsPeriodId} />
          <p className="text-xs text-muted">
            {text("chatDefaultPeriod")}: {periodLabel(activeLocale, periodId)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-surface p-3 shadow-sm shadow-black/5">
          <button
            type="button"
            onClick={startNewConversation}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-accent hover:bg-accent-soft"
          >
            {text("chatNew")}
          </button>
          <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted">{text("chatEmpty")}</li>
            ) : (
              conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation.id)}
                    className={`w-full rounded-lg px-2 py-2 text-left text-sm ${
                      conversation.id === conversationId
                        ? "bg-accent-soft text-accent"
                        : "text-foreground hover:bg-[#f1f1f1]"
                    }`}
                    title={conversation.title}
                  >
                    <span className="block truncate">{conversation.title}</span>
                    {conversation.assistantStatus === ASSISTANT_STATUS_PENDING ? (
                      <span className="block text-xs text-muted">{thinkingLabel(activeLocale)}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:p-6">
          <label
            htmlFor="ask-ai-question"
            className="block text-sm font-medium text-foreground"
          >
            {text("chatPrompt")}
          </label>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="ask-ai-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleAsk();
              }}
              placeholder={text("chatPlaceholder")}
              disabled={busy}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none ring-accent placeholder:text-muted focus:ring-2 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleAsk()}
              disabled={busy}
              className="ha-primary rounded-lg px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {askLabel}
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
              {text("chatSuggestions")}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAsk(suggestion)}
                  className="rounded-full border border-border bg-[#f1f1f1] px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-lg border border-[#cccccc] bg-[#f1f1f1] px-4 py-3 text-sm text-[#151515]">
              {shownError}
            </div>
          ) : null}

          <div className="mt-6 space-y-4" aria-live="polite">
            {loadingHistory ? (
              <p className="text-sm text-muted">{text("chatLoading")}</p>
            ) : null}
            {messages.map((message, index) => {
              const pendingBubble = isPendingBubble(message, assistantStatus);
              return (
                <article key={`${message.role}-${index}`}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {message.role === "user" ? text("chatYou") : text("chatAssistant")}
                  </p>
                  {message.role === "assistant" ? (
                    <AssistantBody
                      content={displayChatContent(message.content, activeLocale, pendingBubble)}
                      pending={pendingBubble}
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.content}
                    </p>
                  )}
                </article>
              );
            })}
            {loading ? (
              <p className="text-sm text-muted">{text("chatSendingQuestion")}</p>
            ) : null}
          </div>

          {!busy && latestUsage ? (
            <div className="mt-5 rounded-lg border border-border bg-[#f8f8f8] px-3 py-2 text-xs text-muted">
              <p>
                {text("chatUsageModel")}: <span className="text-foreground">{latestUsage.model}</span>
                {" · "}
                {text("chatUsageTokens")}:{" "}
                <span className="text-foreground">{latestUsage.totalTokens}</span>
                {" · "}
                {text("chatUsageCost")}:{" "}
                <span className="text-foreground">
                  ${latestUsage.estimatedCostUsd.toFixed(5)}
                </span>
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ColumnChat({
  text,
  periodId,
  askLabel,
  question,
  setQuestion,
  busy,
  onAsk,
  onNew,
  conversationId,
  conversations,
  onOpen,
  loadingHistory,
  messages,
  assistantStatus,
  error,
  suggestions,
  locale,
}: {
  text: (key: WorkspaceMessageKey) => string;
  periodId: AnalyticsPeriodId;
  askLabel: string;
  question: string;
  setQuestion: (value: string) => void;
  busy: boolean;
  onAsk: (value?: string) => void;
  onNew: () => void;
  conversationId: string | null;
  conversations: ConversationSummary[];
  onOpen: (id: string) => void;
  loadingHistory: boolean;
  messages: ChatMessage[];
  assistantStatus: string;
  error: string | null;
  suggestions: string[];
  locale: ChatLocale;
}) {
  const [suggestionPage, setSuggestionPage] = useState(0);
  const pageSize = 3;
  const suggestionStart = (suggestionPage * pageSize) % suggestions.length;
  const visibleSuggestions = Array.from({ length: pageSize }, (_, index) => {
    return suggestions[(suggestionStart + index) % suggestions.length];
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-secondary px-3">
        <h2 className="shrink-0 text-sm font-medium text-foreground">
          {text("columnChat")}
        </h2>
        <div className="min-w-0 overflow-x-auto">
          <PeriodFilter value={periodId} />
        </div>
      </header>
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onNew}
          className="shrink-0 text-xs text-foreground underline-offset-2 hover:underline"
        >
          {text("chatNew")}
        </button>
        <Dropdown
          value={conversationId ?? ""}
          onChange={onOpen}
          ariaLabel={text("chatNew")}
          size="sm"
          className="min-w-0 flex-1 text-xs"
          options={[
            { value: "", label: text("chatEmpty") },
            ...conversations.map((conversation) => ({
              value: conversation.id,
              label: conversation.title,
            })),
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-2" aria-live="polite">
        {loadingHistory ? (
          <p className="text-sm text-muted">{text("chatLoading")}</p>
        ) : null}
        {messages.map((message, index) => {
          const pendingBubble = isPendingBubble(message, assistantStatus);
          if (message.role === "user") {
            return (
              <div key={`${message.role}-${index}`} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-3 py-2 text-sm text-foreground">
                  <span className="sr-only">{text("chatYou")}: </span>
                  {message.content}
                </p>
              </div>
            );
          }
          return (
            <article key={`${message.role}-${index}`} className="text-sm text-foreground">
              <span className="sr-only">{text("chatAssistant")}</span>
              <AssistantBody
                content={displayChatContent(message.content, locale, pendingBubble)}
                pending={pendingBubble}
                plain
              />
            </article>
          );
        })}
        {error ? <p className="text-sm text-foreground">{error}</p> : null}
      </div>
      <div className="shrink-0 px-3 pb-3 pt-1">
        {messages.length === 0 ? (
          <div className="mb-2 flex flex-col gap-1.5">
            {visibleSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={busy}
                onClick={() => onAsk(suggestion)}
                className="truncate rounded-lg px-1 py-0.5 text-left text-xs text-muted hover:text-foreground disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSuggestionPage((value) => value + 1)}
              className="w-fit px-1 text-left text-xs text-muted underline-offset-2 hover:underline"
            >
              {text("chatSuggestionsMore")}
            </button>
          </div>
        ) : null}
        <label htmlFor="ask-ai-question" className="sr-only">
          {text("chatPrompt")}
        </label>
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-white px-3 py-2">
          <input
            id="ask-ai-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAsk();
            }}
            placeholder={text("chatPlaceholder")}
            disabled={busy}
            className="w-full bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => onAsk()}
            disabled={busy || !question.trim()}
            aria-label={askLabel}
            title={askLabel}
            className="ha-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconArrowUp className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

function displayChatContent(content: string, locale: ChatLocale, pending: boolean): string {
  if (pending && isThinkingPlaceholder(content)) return thinkingLabel(locale);
  return localizeKnownCopy(content, locale);
}

function isPendingBubble(message: ChatMessage, assistantStatus: string) {
  return (
    message.pending === true ||
    (assistantStatus === ASSISTANT_STATUS_PENDING &&
      message.role === "assistant" &&
      isThinkingPlaceholder(message.content))
  );
}

function AssistantBody({
  content,
  pending,
  plain = false,
}: {
  content: string;
  pending: boolean;
  plain?: boolean;
}) {
  if (pending) {
    return <p className={`${plain ? "" : "mt-1"} text-sm italic text-muted`}>{content}</p>;
  }

  const { text, images } = splitAssistantContent(content);
  return (
    <div className={plain ? "space-y-2" : "mt-1 space-y-2"}>
      {text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {text}
        </p>
      ) : null}
      {images.map((src) => (
        // Bot attachment hosts are not known at build time, so this stays a plain image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="max-h-64 rounded-lg border border-border"
        />
      ))}
    </div>
  );
}
