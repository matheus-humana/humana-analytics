"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ModelPicker, type ChatModel } from "@/components/ai/model-picker";
import { ChatHistoryPanel } from "@/components/ask-ai/chat-history-panel";
import { ThinkingIndicator, thinkingText } from "@/components/ask-ai/thinking-indicator";
import { useLocale } from "@/components/i18n/locale-provider";
import { IconArrowUp, IconClock, IconPlus } from "@/components/workspace/icons";
import {
  ASSISTANT_STATUS_PENDING,
  isThinkingPlaceholder,
  splitAssistantContent,
  thinkingLabel,
  type ChatLocale,
  type ProviderId,
} from "@/lib/ai/analytics-bot-contract";
import { linkSegments } from "@/lib/ai/link-segments";
import { PROVIDER_NAMES } from "@/lib/ai/model-label";
import { toolSources, type ThinkingSource } from "@/lib/ai/thinking-stage";
import { localizeKnownCopy } from "@/lib/i18n/known-copy";
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
  streaming?: boolean;
  usedFallback?: boolean;
  provider?: string | null;
};

const MODEL_STORAGE_KEY = "ha-chat-model";

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
  projectId = null,
  chatEnabled = false,
  onActivity,
}: {
  variant?: "page" | "column";
  locale?: ChatLocale;
  projectId?: string | null;
  chatEnabled?: boolean;
  onActivity?: (kind: "question" | "reply") => void;
} = {}) {
  const { locale: contextLocale } = useLocale();
  const activeLocale = locale ?? contextLocale;
  const text = (key: WorkspaceMessageKey) => workspaceText(activeLocale, key);
  const suggestions = chatSuggestionKeys.map((key) => text(key));
  const router = useRouter();
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  const [models, setModels] = useState<ChatModel[]>([]);
  const [model, setModel] = useState<ProviderId | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [assistantStatus, setAssistantStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [thinking, setThinking] = useState<ThinkingSource[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const awaitingReply = assistantStatus === ASSISTANT_STATUS_PENDING;
  const busy = loading || streaming || awaitingReply;

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
      if (!chatEnabled) return;
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
  }, [router, chatEnabled]);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      if (!chatEnabled) return;
      const response = await fetch("/api/ai/models", { cache: "no-store" });
      if (cancelled || !response.ok) return;
      const data = (await response.json()) as {
        ok?: boolean;
        selectable?: boolean;
        models?: ChatModel[];
      };
      if (cancelled || !data.ok || !data.selectable) return;
      const list = data.models ?? [];
      const usable = list.filter((item) => item.configured);
      const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
      const initial =
        usable.find((item) => item.provider === stored) ??
        usable.find((item) => item.role === "primary") ??
        usable[0];
      setModels(list);
      setModel(initial?.provider ?? null);
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [chatEnabled]);

  function chooseModel(provider: ProviderId) {
    setModel(provider);
    window.localStorage.setItem(MODEL_STORAGE_KEY, provider);
  }

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

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
    setLoading(false);
    setThinking(null);
  }

  async function handleAsk(nextQuestion?: string) {
    const trimmed = (nextQuestion ?? question).trim();
    if (!trimmed || busy) return;

    setQuestion("");
    setLoading(true);
    setThinking([]);
    setError(null);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question: trimmed,
          conversationId,
          locale: activeLocale,
          projectId,
          provider: model ?? undefined,
        }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") && response.body) {
        setLoading(false);
        setStreaming(true);
        onActivityRef.current?.("question");
        await readEventStream(response.body, {
          onDelta: (textChunk) => {
            setThinking(null);
            setMessages((current) => appendDelta(current, textChunk));
          },
          onReset: (tools) => {
            setThinking(toolSources(tools));
            setMessages((current) => clearStreamingDraft(current));
          },
          onDone: (data) => {
            setThinking(null);
            if (data.conversationId) setConversationId(data.conversationId);
            setAssistantStatus("idle");
            onActivityRef.current?.("reply");
            setMessages((current) =>
              finishStream(current, {
                content: data.answer ?? "",
                toolsUsed: data.toolsUsed ?? [],
                usage: data.usage ?? null,
                usedFallback: data.usedFallback,
                provider: data.provider,
              })
            );
          },
          onError: (message) => {
            setThinking(null);
            setError(message);
          },
        });
        await loadConversations();
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
        usedFallback?: boolean;
        provider?: string | null;
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
          usedFallback: data.usedFallback,
          provider: data.provider,
        },
      ]);
      await loadConversations();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("chatSpeakFailed");
    } finally {
      setLoading(false);
      setStreaming(false);
      setThinking(null);
      abortRef.current = null;
    }
  }

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

  if (!chatEnabled) {
    return (
      <div className="px-3 py-4">
        <p className="text-sm font-medium text-foreground">{text("chatConfigureTitle")}</p>
        <p className="mt-1 text-sm text-muted">{text("chatConfigureBody")}</p>
      </div>
    );
  }

  if (variant === "column") {
    return (
      <ColumnChat
        text={text}
        models={models}
        model={model}
        onModelChange={chooseModel}
        askLabel={askLabel}
        question={question}
        setQuestion={setQuestion}
        busy={busy}
        streaming={streaming}
        onStop={stopStreaming}
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
        thinking={thinking}
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
            <ModelPicker
              models={models}
              value={model}
              onChange={chooseModel}
              disabled={busy}
              label={text("chatModel")}
              missingKeyLabel={text("chatModelMissingKey")}
            />
            <button
              type="button"
              onClick={() => (streaming ? stopStreaming() : void handleAsk())}
              disabled={busy && !streaming}
              className="ha-primary rounded-lg px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {streaming ? text("chatStop") : askLabel}
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
                      note={fallbackNote(message, text)}
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.content}
                    </p>
                  )}
                </article>
              );
            })}
            {thinking ? (
              <ThinkingIndicator
                sources={thinking}
                model={model}
                label={thinkingText(thinking, text)}
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function ColumnChat({
  text,
  models,
  model,
  onModelChange,
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
  thinking,
  assistantStatus,
  error,
  suggestions,
  locale,
  streaming,
  onStop,
}: {
  text: (key: WorkspaceMessageKey) => string;
  models: ChatModel[];
  model: ProviderId | null;
  onModelChange: (provider: ProviderId) => void;
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
  thinking: ThinkingSource[] | null;
  assistantStatus: string;
  error: string | null;
  suggestions: string[];
  locale: ChatLocale;
  streaming: boolean;
  onStop: () => void;
}) {
  const [suggestionPage, setSuggestionPage] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const pageSize = 3;
  const suggestionStart = (suggestionPage * pageSize) % suggestions.length;
  const visibleSuggestions = Array.from({ length: pageSize }, (_, index) => {
    return suggestions[(suggestionStart + index) % suggestions.length];
  });

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-surface">
      {historyOpen ? (
        <ChatHistoryPanel
          conversations={conversations}
          activeId={conversationId}
          locale={locale}
          text={text}
          onOpen={onOpen}
          onNew={onNew}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-secondary px-3">
        <h2 className="shrink-0 text-sm font-medium text-foreground">
          {text("columnChat")}
        </h2>
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label={text("chatHistory")}
            aria-haspopup="dialog"
            aria-expanded={historyOpen}
            title={text("chatHistory")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-secondary hover:text-foreground"
          >
            <IconClock className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNew}
            aria-label={text("chatNew")}
            title={text("chatNew")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-secondary hover:text-foreground"
          >
            <IconPlus className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3" aria-live="polite">
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
                note={fallbackNote(message, text)}
                plain
              />
            </article>
          );
        })}
        {thinking ? (
          <ThinkingIndicator sources={thinking} model={model} label={thinkingText(thinking, text)} />
        ) : null}
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
        <div className="rounded-2xl border border-border bg-white px-3 pb-2 pt-2.5 shadow-sm shadow-black/5 transition-colors focus-within:border-foreground/25">
          <textarea
            id="ask-ai-question"
            rows={2}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onAsk();
              }
            }}
            placeholder={text("chatPlaceholder")}
            disabled={busy}
            className="block max-h-40 min-h-10 w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none [field-sizing:content] placeholder:text-muted disabled:opacity-60"
          />
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            <ModelPicker
              models={models}
              value={model}
              onChange={onModelChange}
              disabled={busy}
              label={text("chatModel")}
              missingKeyLabel={text("chatModelMissingKey")}
            />
            <button
              type="button"
              onClick={() => (streaming ? onStop() : onAsk())}
              disabled={!streaming && (busy || !question.trim())}
              aria-label={streaming ? text("chatStop") : askLabel}
              title={streaming ? text("chatStop") : askLabel}
              className="ha-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {streaming ? (
                <span className="block h-2.5 w-2.5 rounded-[2px] bg-current" />
              ) : (
                <IconArrowUp className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />
              )}
            </button>
          </div>
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

function fallbackNote(
  message: ChatMessage,
  text: (key: WorkspaceMessageKey) => string
): string | null {
  if (!message.usedFallback) return null;
  const provider = message.provider ?? "";
  const name = provider in PROVIDER_NAMES ? PROVIDER_NAMES[provider as ProviderId] : provider;
  return text("chatFallbackNote").replace("{provider}", name);
}

function appendDelta(current: ChatMessage[], textChunk: string): ChatMessage[] {
  const next = [...current];
  const last = next[next.length - 1];
  if (last?.role === "assistant" && last.streaming) {
    next[next.length - 1] = { ...last, content: last.content + textChunk };
    return next;
  }
  next.push({ role: "assistant", content: textChunk, streaming: true });
  return next;
}

function clearStreamingDraft(current: ChatMessage[]): ChatMessage[] {
  const next = [...current];
  const last = next[next.length - 1];
  if (last?.role === "assistant" && last.streaming) next.pop();
  return next;
}

function finishStream(
  current: ChatMessage[],
  message: Omit<ChatMessage, "role">
): ChatMessage[] {
  const next = clearStreamingDraft(current);
  next.push({ role: "assistant", ...message, streaming: false });
  return next;
}

async function readEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onDelta: (text: string) => void;
    onReset: (tools: string[]) => void;
    onDone: (data: {
      answer?: string;
      conversationId?: string;
      toolsUsed?: string[];
      usage?: UsageInfo | null;
      usedFallback?: boolean;
      provider?: string | null;
    }) => void;
    onError: (message: string) => void;
  }
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((item) => item.trim())
        .find((item) => item.startsWith("data:"));
      if (!line) continue;
      const data = JSON.parse(line.slice(5).trim()) as {
        type?: string;
        text?: string;
        tools?: string[];
        error?: string;
        answer?: string;
        conversationId?: string;
        toolsUsed?: string[];
        usage?: UsageInfo | null;
        usedFallback?: boolean;
        provider?: string | null;
      };
      if (data.type === "delta") handlers.onDelta(data.text ?? "");
      else if (data.type === "reset") handlers.onReset(data.tools ?? []);
      else if (data.type === "done") handlers.onDone(data);
      else if (data.type === "error") handlers.onError(data.error ?? "chatQueryFailed");
    }
  }
}

function AssistantBody({
  content,
  pending,
  note,
  plain = false,
}: {
  content: string;
  pending: boolean;
  note?: string | null;
  plain?: boolean;
}) {
  if (pending) {
    return (
      <div className={plain ? "" : "mt-1"}>
        <ThinkingIndicator sources={[]} model={null} label={content} />
      </div>
    );
  }

  const { text, images } = splitAssistantContent(content);
  return (
    <div className={plain ? "space-y-2" : "mt-1 space-y-2"}>
      {text ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {linkSegments(text).map((segment, index) =>
            segment.kind === "link" ? (
              <a
                key={index}
                href={segment.value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2 hover:opacity-80"
              >
                {segment.value}
              </a>
            ) : (
              segment.value
            )
          )}
        </p>
      ) : null}
      {note ? <p className="text-xs text-muted">{note}</p> : null}
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
