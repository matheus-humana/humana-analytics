/**
 * Runs the chat evaluation cases against a real model with fixed tool data.
 *
 *   pnpm eval:chat                       # Gemini, every case
 *   pnpm eval:chat --provider groq       # Groq
 *   pnpm eval:chat --only traffic-       # cases whose id starts with "traffic-"
 *   pnpm eval:chat --general             # skip the router, every tool on every question
 *
 * Needs GEMINI_API_KEY / GROQ_API_KEY in `.env.local`. No GA4, database, or
 * Tavily calls are made: every tool answers from src/lib/ai/evals/fixtures.ts.
 */
import { existsSync, readFileSync } from "node:fs";

import type { ProviderId } from "../src/lib/ai/analytics-bot-contract";
import type { EvalArea, EvalCase } from "../src/lib/ai/evals/cases";
import type { CheckFailure, RecordedCall } from "../src/lib/ai/evals/checks";

type CaseOutcome = {
  id: string;
  area: EvalArea;
  failures: CheckFailure[];
  calls: RecordedCall[];
  answer: string;
  error?: string;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function readFlag(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function parseArgs(rawArgs: string): Record<string, unknown> {
  try {
    const parsed = rawArgs ? JSON.parse(rawArgs) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimit(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 429);
}

async function main() {
  loadEnvFile(".env.local");
  const provider = (readFlag("provider") ?? "gemini") as ProviderId;
  const only = readFlag("only");
  const delayMs = Number(readFlag("delay") ?? 1500);
  const general = process.argv.includes("--general");
  let totalTokens = 0;

  const { runAskAiAgent } = await import("../src/lib/ai/agent");
  const { EVAL_CASES } = await import("../src/lib/ai/evals/cases");
  const { checkAnswer } = await import("../src/lib/ai/evals/checks");
  const { fixtureTool } = await import("../src/lib/ai/evals/fixtures");

  const cases = EVAL_CASES.filter((item: EvalCase) => !only || item.id.startsWith(only));
  console.info = () => {};

  console.log(`Chat eval · ${provider} · ${general ? "general agent only" : "specialists"} · ${cases.length} cases\n`);
  const outcomes: CaseOutcome[] = [];

  for (const item of cases) {
    const calls: RecordedCall[] = [];
    const results: unknown[] = [];
    const fixture = fixtureTool(item.overrides);
    let answer = "";
    let route = "";
    let draft = "";
    let error: string | undefined;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      calls.length = 0;
      results.length = 0;
      draft = "";
      try {
        const result = await runAskAiAgent({
          question: item.question,
          locale: item.locale ?? "pt-BR",
          history: item.history,
          projectId: null,
          sources: { ga4: true, github: true, seo: true, geo: true, web: item.web !== false },
          selection: { engine: "native", primary: provider, fallback: null },
          specialists: !general,
          onDelta: (text) => {
            draft += text;
          },
          onToolRound: () => {
            draft = "";
          },
          executeTool: async (name, rawArgs, defaultPeriod) => {
            const value = fixture(name, rawArgs, defaultPeriod);
            calls.push({ name, args: parseArgs(rawArgs) });
            results.push(value);
            return value;
          },
        });
        answer = result.answer;
        route = result.specialists.join("+") || "general";
        totalTokens += result.usage.totalTokens;
        error = undefined;
        break;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
        if (!isRateLimit(caught)) break;
        await sleep(20_000 * (attempt + 1));
      }
    }

    const failures = error
      ? [{ check: "error", detail: error }]
      : checkAnswer({ answer, question: item.question, calls, toolResults: results, expect: item.expect });
    outcomes.push({ id: item.id, area: item.area, failures, calls, answer, error });

    const tools = calls.map((call) => (call.args.period ? `${call.name}(${String(call.args.period)})` : call.name));
    console.log(
      `${failures.length === 0 ? "PASS" : "FAIL"}  ${item.id}  {${route || "-"}}  [${tools.join(", ") || "no tools"}]`
    );
    for (const failure of failures) console.log(`      - ${failure.check}: ${failure.detail}`);
    if (failures.length > 0 && answer) {
      console.log(`      answer: ${answer.replace(/\s+/g, " ").slice(0, 320)}`);
      const firstLine = draft.trim().split("\n")[0] ?? "";
      if (draft.trim() && !answer.includes(firstLine)) {
        console.log(`      model draft (replaced by the server): ${draft.replace(/\s+/g, " ").slice(0, 320)}`);
      }
    }
    await sleep(delayMs);
  }

  const passed = outcomes.filter((outcome) => outcome.failures.length === 0).length;
  console.log(`\nScore: ${passed}/${outcomes.length} (${Math.round((passed / Math.max(outcomes.length, 1)) * 100)}%)`);
  console.log(`Tokens: ${totalTokens.toLocaleString("en-US")} total`);
  const areas = [...new Set(outcomes.map((outcome) => outcome.area))];
  for (const area of areas) {
    const inArea = outcomes.filter((outcome) => outcome.area === area);
    const ok = inArea.filter((outcome) => outcome.failures.length === 0).length;
    console.log(`  ${area.padEnd(10)} ${ok}/${inArea.length}`);
  }
  process.exit(passed === outcomes.length ? 0 : 1);
}

void main();
