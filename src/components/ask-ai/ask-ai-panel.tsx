"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PeriodFilter } from "@/components/analytics/period-filter";
import { humanaAnalyticsSuggestions } from "@/data/mock/ask-ai";
import {
  DEFAULT_ANALYTICS_PERIOD,
  resolveAnalyticsPeriod,
  type AnalyticsPeriodId,
} from "@/lib/analytics/period";

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
};

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export function AskAiPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodId = resolveAnalyticsPeriod(searchParams.get("period")).id;

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function loadConversations() {
    const response = await fetch("/api/conversations");
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
      const response = await fetch("/api/conversations");
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

  async function openConversation(id: string) {
    setLoadingHistory(true);
    setError(null);
    setConversationId(id);
    try {
      const response = await fetch(`/api/conversations/${id}`);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        conversation?: { messages: ChatMessage[] };
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Não foi possível abrir a conversa.");
        return;
      }
      setMessages(data.conversation?.messages ?? []);
    } catch {
      setError("Não foi possível abrir a conversa.");
    } finally {
      setLoadingHistory(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setQuestion("");
  }

  async function handleAsk(nextQuestion?: string) {
    const trimmed = (nextQuestion ?? question).trim();
    if (!trimmed || loading) return;

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
        answer?: string;
        error?: string;
        toolsUsed?: string[];
        usage?: UsageInfo;
        conversationId?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "Falha ao consultar o Humana Analytics.");
        return;
      }

      if (data.conversationId) setConversationId(data.conversationId);
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
      setError("Não foi possível falar com o Humana Analytics.");
    } finally {
      setLoading(false);
    }
  }

  const latestUsage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.usage)?.usage;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs text-accent">
            GA4 · Clarity · Vercel
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Humana Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            Pergunte em português ou inglês. A resposta usa só os números das
            fontes conectadas e cita o período e a origem.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <PeriodFilter value={periodId as AnalyticsPeriodId} />
          <p className="text-xs text-muted">
            Período padrão:{" "}
            {resolveAnalyticsPeriod(periodId).label || DEFAULT_ANALYTICS_PERIOD}
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
            Nova conversa
          </button>
          <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted">
                Nenhuma conversa ainda.
              </li>
            ) : (
              conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation.id)}
                    className={`w-full truncate rounded-lg px-2 py-2 text-left text-sm ${
                      conversation.id === conversationId
                        ? "bg-accent-soft text-accent"
                        : "text-foreground hover:bg-[#f1f1f1]"
                    }`}
                    title={conversation.title}
                  >
                    {conversation.title}
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
            O que você quer saber?
          </label>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="ask-ai-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleAsk();
              }}
              placeholder="Ex.: De onde veio o tráfego nos últimos 7 dias?"
              disabled={loading}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none ring-accent placeholder:text-muted focus:ring-2 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleAsk()}
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2.5 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Consultando…" : "Perguntar"}
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
              Sugestões
            </p>
            <div className="flex flex-wrap gap-2">
              {humanaAnalyticsSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={loading}
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
              {error}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {loadingHistory ? (
              <p className="text-sm text-muted">Carregando conversa…</p>
            ) : null}
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {message.role === "user" ? "Você" : "Humana Analytics"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {message.content}
                </p>
              </article>
            ))}
            {loading ? (
              <p className="text-sm text-muted">
                Consultando as fontes conectadas…
              </p>
            ) : null}
          </div>

          {!loading && latestUsage ? (
            <div className="mt-5 rounded-lg border border-border bg-[#f8f8f8] px-3 py-2 text-xs text-muted">
              <p>
                Modelo: <span className="text-foreground">{latestUsage.model}</span>
                {" · "}
                Tokens:{" "}
                <span className="text-foreground">{latestUsage.totalTokens}</span>
                {" · "}
                Custo estimado:{" "}
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
