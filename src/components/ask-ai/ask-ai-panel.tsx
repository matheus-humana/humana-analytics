"use client";

import { useState } from "react";

import {
  askAiDemoResponses,
  askAiFallbackResponse,
  askAiSuggestions,
} from "@/data/mock/ask-ai";

export function AskAiPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(
    null
  );

  function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed) return;

    setSubmittedQuestion(trimmed);
    setAnswer(askAiDemoResponses[trimmed] ?? askAiFallbackResponse);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted">
          Demo data
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ask AI
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Ask questions about your website data in plain language.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:p-6">
        <label
          htmlFor="ask-ai-question"
          className="block text-sm font-medium text-foreground"
        >
          What would you like to know?
        </label>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="ask-ai-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAsk();
            }}
            placeholder="Ask about traffic, pages, or acquisition..."
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none ring-accent placeholder:text-muted focus:ring-2"
          />
          <button
            type="button"
            onClick={handleAsk}
            className="rounded-lg bg-accent px-4 py-2.5 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0]"
          >
            Ask
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {askAiSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuestion(suggestion)}
                className="rounded-full border border-border bg-[#f1f1f1] px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:border-accent hover:bg-accent-soft"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>

      {answer && submittedQuestion ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <div className="mb-3 inline-flex items-center rounded-full border border-[#cccccc] bg-[#f1f1f1] px-2.5 py-1 text-xs text-[#5f5f5f]">
            Demo data
          </div>
          <p className="text-sm text-muted">Question</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {submittedQuestion}
          </p>
          <p className="mt-4 text-sm text-muted">Answer</p>
          <p className="mt-1 text-base leading-7 text-foreground">{answer}</p>
        </section>
      ) : null}
    </div>
  );
}
