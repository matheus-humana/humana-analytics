import assert from "node:assert/strict";
import test from "node:test";

import { EVAL_CASES } from "./evals/cases.ts";
import { buildHumanaAnalyticsPrompt } from "./prompts.ts";
import { routeQuestion } from "./specialists.ts";
import { chatToolDefinitions } from "./tools/index.ts";

test("every eval case can reach the tools it is expected to call", () => {
  for (const item of EVAL_CASES) {
    const route = routeQuestion(item.question, item.history);
    for (const tool of item.expect.tools ?? []) {
      assert.ok(!route.tools || route.tools.has(tool), `${item.id} cannot call ${tool}`);
    }
  }
});

test("topic questions go to their specialist", () => {
  assert.deepEqual(routeQuestion("Quantos usuários tivemos na semana?").specialists, ["traffic"]);
  assert.deepEqual(routeQuestion("Qual a performance mobile no PageSpeed?").specialists, ["seo"]);
  assert.deepEqual(routeQuestion("Quantas estrelas o repositório tem?").specialists, ["github"]);
  assert.deepEqual(routeQuestion("O que os concorrentes estão fazendo?").specialists, ["research"]);
});

test("a question spanning areas gets the tools of each", () => {
  const route = routeQuestion("Compare nosso LCP com o valor recomendado pelo Google");
  assert.ok(route.specialists.includes("seo"));
  assert.ok(route.specialists.includes("research"));
  assert.ok(route.tools?.has("get_seo_overview"));
  assert.ok(route.tools?.has("search_web"));
});

test("broad or unknown questions use the general agent", () => {
  assert.deepEqual(routeQuestion("Me dá um resumo do mês"), { specialists: [], tools: null });
  assert.deepEqual(routeQuestion("Olá, tudo bem?"), { specialists: [], tools: null });
  assert.deepEqual(routeQuestion("Mostre os dados do Clarity"), { specialists: [], tools: null });
});

test("a follow-up without topic words keeps the previous topic", () => {
  const route = routeQuestion("E nos últimos 90 dias?", [
    { role: "user", content: "Quais estrelas e forks o repositório tem?" },
    { role: "assistant", content: "O repositório tem 412 estrelas." },
  ]);
  assert.deepEqual(route.specialists, ["github"]);
});

test("a specialist sees only its tools and rules", () => {
  const route = routeQuestion("Quantas estrelas o repositório tem?");
  const names = chatToolDefinitions({ web: false, only: route.tools }).map((tool) => tool.function.name);
  assert.ok(names.includes("get_github_overview"));
  assert.equal(names.includes("get_overview"), false);

  const prompt = buildHumanaAnalyticsPrompt({
    periodLabel: "Últimos 7 dias",
    sources: { ga4: true, github: true, seo: true, geo: true },
    focus: route.specialists,
  });
  assert.match(prompt, /specialist for the GitHub repository/);
  assert.match(prompt, /GitHub views and clones/);
  assert.equal(prompt.includes("PageSpeed category scores"), false);
  assert.equal(prompt.includes("compare_periods compares"), false);
});
