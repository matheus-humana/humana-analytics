"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { PeriodFilter } from "@/components/analytics/period-filter";
import { askAiSuggestions } from "@/data/mock/ask-ai";
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

export function AskAiPanel() {
  const searchParams = useSearchParams();
  const periodId = resolveAnalyticsPeriod(searchParams.get("period")).id;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(
    null
  );
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk(nextQuestion?: string) {
    const trimmed = (nextQuestion ?? question).trim();
    if (!trimmed || loading) return;

    setQuestion(trimmed);
    setLoading(true);
    setError(null);
    setAnswer(null);
    setToolsUsed([]);
    setUsage(null);
    setSubmittedQuestion(trimmed);

    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          period: periodId,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        answer?: string;
        error?: string;
        toolsUsed?: string[];
        usage?: UsageInfo;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "Falha ao consultar a IA.");
        return;
      }

      setAnswer(data.answer ?? "");
      setToolsUsed(data.toolsUsed ?? []);
      setUsage(data.usage ?? null);
    } catch {
      setError("Não foi possível falar com a API Ask AI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs text-accent">
            OpenAI · GA4 tools
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Ask AI
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            Pergunte em linguagem natural. A IA consulta o Google Analytics
            com tools — não inventa números.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <PeriodFilter value={periodId as AnalyticsPeriodId} />
          <p className="text-xs text-muted">
            Período padrão:{" "}
            {resolveAnalyticsPeriod(periodId).label ||
              DEFAULT_ANALYTICS_PERIOD}
          </p>
        </div>
      </div>

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
            placeholder="Ex.: Quantos usuários ativos tivemos no período?"
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
            {[
              "Quantos usuários ativos tivemos no período?",
              "Quais páginas tiveram mais visualizações?",
              "Qual navegador concentra mais usuários?",
              ...askAiSuggestions.slice(0, 1),
            ].map((suggestion) => (
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
      </section>

      {error ? (
        <div className="rounded-lg border border-[#cccccc] bg-[#f1f1f1] px-4 py-3 text-sm text-[#151515]">
          {error}
        </div>
      ) : null}

      {submittedQuestion && (answer || loading) ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Pergunta
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {submittedQuestion}
          </p>
          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">
            Resposta
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {loading ? "Consultando GA4 e a OpenAI…" : answer}
          </p>

          {!loading && usage ? (
            <div className="mt-5 rounded-lg border border-border bg-[#f8f8f8] px-3 py-2 text-xs text-muted">
              <p>
                Modelo: <span className="text-foreground">{usage.model}</span>
                {" · "}
                Tokens:{" "}
                <span className="text-foreground">{usage.totalTokens}</span>
                {" · "}
                Custo estimado:{" "}
                <span className="text-foreground">
                  ${usage.estimatedCostUsd.toFixed(5)}
                </span>
              </p>
              {toolsUsed.length > 0 ? (
                <p className="mt-1">
                  Tools: {toolsUsed.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
