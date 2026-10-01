export type RecordedCall = { name: string; args: Record<string, unknown> };

export type EvalExpectation = {
  /** Every listed tool must be called at least once. */
  tools?: string[];
  /** None of these tools may be called. */
  forbidTools?: string[];
  /** The answer must not call any tool. */
  noTools?: boolean;
  /** Every call that takes a period must use this one. */
  period?: string;
  /** Patterns the answer must match (all of them). */
  says?: RegExp[];
  /** Patterns the answer must not match. */
  never?: RegExp[];
};

export type CheckFailure = { check: string; detail: string };

const PERIOD_CODE = /\b(?:24h|3d|7d|28d|90d)\b/;
const MARKDOWN = /\*\*|__|^#{1,6}\s|\$\\|\\\(|\\\[|^\|.*\|$/m;
const NUMBER = /\d+(?:[.,]\d+)*/g;
const SOURCES_HEADING = /\n\n(?:Fontes|Sources)\n[\s\S]*$/;

/** The answer without the server-added sources block. */
export function answerBody(answer: string): string {
  return answer.replace(SOURCES_HEADING, "").trim();
}

function collectNumbers(value: unknown, into: number[]): void {
  if (typeof value === "number" && Number.isFinite(value)) into.push(value);
  else if (typeof value === "string") {
    for (const match of value.matchAll(NUMBER)) into.push(...readings(match[0]));
  } else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, into));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectNumbers(item, into));
  }
}

/** Every way a written number can be read: 1.234 (pt thousands), 1,234 (en thousands), 2,5 (pt decimal). */
export function readings(token: string): number[] {
  const values = new Set<number>();
  const plain = Number(token);
  if (Number.isFinite(plain)) values.add(plain);
  const ptStyle = Number(token.replace(/\./g, "").replace(",", "."));
  if (Number.isFinite(ptStyle)) values.add(ptStyle);
  const enStyle = Number(token.replace(/,/g, ""));
  if (Number.isFinite(enStyle)) values.add(enStyle);
  return [...values];
}

function close(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  return diff < 0.051 || diff <= Math.abs(b) * 0.005;
}

/** Numbers the model may write: tool values, simple unit conversions, and figures from the question. */
export function groundedNumbers(toolResults: unknown[], question: string): number[] {
  const raw: number[] = [];
  toolResults.forEach((result) => collectNumbers(result, raw));
  collectNumbers(question, raw);
  const allowed = new Set<number>();
  for (const value of raw) {
    allowed.add(value);
    allowed.add(value / 1000);
    allowed.add(value * 100);
    allowed.add(value / 60);
  }
  return [...allowed];
}

const ALWAYS_ALLOWED = (value: number) =>
  (Number.isInteger(value) && value >= 0 && value <= 10) ||
  [14, 24, 28, 30, 90].includes(value) ||
  (Number.isInteger(value) && value >= 2000 && value <= 2100);

export function ungroundedNumbers(body: string, allowed: number[]): string[] {
  const misses: string[] = [];
  for (const match of body.matchAll(NUMBER)) {
    const options = readings(match[0]);
    if (options.some(ALWAYS_ALLOWED)) continue;
    if (options.some((value) => allowed.some((candidate) => close(value, candidate)))) continue;
    misses.push(match[0]);
  }
  return [...new Set(misses)];
}

export function checkAnswer(input: {
  answer: string;
  question: string;
  calls: RecordedCall[];
  toolResults: unknown[];
  expect: EvalExpectation;
}): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const { expect, calls } = input;
  const body = answerBody(input.answer);
  const called = new Set(calls.map((call) => call.name));

  for (const tool of expect.tools ?? []) {
    if (!called.has(tool)) failures.push({ check: "tool", detail: `did not call ${tool}` });
  }
  for (const tool of expect.forbidTools ?? []) {
    if (called.has(tool)) failures.push({ check: "forbidden tool", detail: `called ${tool}` });
  }
  if (expect.noTools && calls.length > 0) {
    failures.push({ check: "no tools", detail: `called ${[...called].join(", ")}` });
  }
  if (expect.period) {
    const wrong = calls.filter(
      (call) => typeof call.args.period === "string" && call.args.period !== expect.period
    );
    const missing = calls.filter(
      (call) => call.name !== "search_web" && call.name !== "get_project_context" && call.args.period === undefined
    );
    for (const call of wrong) {
      failures.push({ check: "period", detail: `${call.name} used ${String(call.args.period)}, expected ${expect.period}` });
    }
    if (expect.period !== "7d") {
      for (const call of missing) {
        failures.push({ check: "period", detail: `${call.name} had no period, expected ${expect.period}` });
      }
    }
  }
  for (const pattern of expect.says ?? []) {
    if (!pattern.test(body)) failures.push({ check: "says", detail: `missing ${pattern}` });
  }
  for (const pattern of expect.never ?? []) {
    if (pattern.test(input.answer)) failures.push({ check: "never", detail: `matched ${pattern}` });
  }

  if (PERIOD_CODE.test(body)) failures.push({ check: "period code", detail: "shows a code such as 7d" });
  if (MARKDOWN.test(body)) failures.push({ check: "plain text", detail: "uses Markdown or LaTeX" });
  const misses = ungroundedNumbers(body, groundedNumbers(input.toolResults, input.question));
  if (misses.length > 0) {
    failures.push({ check: "grounded numbers", detail: `not in tool data: ${misses.join(", ")}` });
  }
  return failures;
}
