import type { StoredTurn } from "./conversations";

export type SpecialistId = "traffic" | "seo" | "github" | "research";

type Specialist = {
  id: SpecialistId;
  label: string;
  tools: string[];
  /** Matched against the question lowercased and without accents. */
  match: RegExp;
};

export const SPECIALISTS: Specialist[] = [
  {
    id: "traffic",
    label: "website traffic (Google Analytics 4)",
    tools: [
      "get_overview",
      "get_top_pages",
      "get_tech_breakdown",
      "get_traffic_sources",
      "get_events",
      "compare_periods",
    ],
    match:
      /\b(?:usuari\w*|users?|visit\w*|sess(?:ao|oes|ions?)|trafego|traffic|acess\w*|paginas?|pages?|landing|origem|origens|fontes? de|sources?|canal|canais|channels?|navegador\w*|browsers?|dispositiv\w*|devices?|pais(?:es)?|countr\w*|cidades?|cit(?:y|ies)|convers\w*|eventos?|events?|leads?|engaj\w*|engag\w*|rejeicao|bounce|views?|visualizac\w*|compar\w*)\b/,
  },
  {
    id: "seo",
    label: "SEO and GEO (PageSpeed Insights and the site crawl)",
    tools: ["get_seo_overview", "get_geo_overview"],
    match:
      /\b(?:seo|geo|pagespeed|lighthouse|core web vitals|cwv|lcp|inp|cls|ttfb|desempenho|performance|velocidade|speed|crawl\w*|rastrea\w*|robots|sitemap|indexa\w*|meta ?tags?|schema|dados estruturados|structured data|llms\.txt|ia|ai|chatgpt|perplexity|copilot|buscadores?|search engines?)\b/,
  },
  {
    id: "github",
    label: "the GitHub repository",
    tools: ["get_github_overview", "get_github_traffic", "get_github_referrers", "get_github_downloads"],
    match: /\b(?:github|repositori\w*|repository|repos?|estrelas?|stars?|forks?|clones?|releases?|downloads?|baixad\w*|watchers?|sdk)\b/,
  },
  {
    id: "research",
    label: "outside research (web search)",
    tools: [],
    match:
      /\b(?:concorr\w*|competid\w*|competitors?|benchmarks?|mercado|market|noticias?|news|tendencias?|trends?|o que (?:e|sao)|what (?:is|are)|boas praticas|best practices?|recomend\w*|recommend\w*|guidelines?|diretriz\w*|documentac\w*|documentation|limites?|thresholds?|ideal)\b/,
  },
];

/** Questions that ask for the whole picture go to every specialist. */
const BROAD = /\b(?:resumo|summary|overview|visao geral|relatorio|report|panorama|tudo|everything|como (?:esta|estamos|foi|vai)|how (?:is|are|did))\b/;

const ALWAYS_TOOLS = ["get_project_context", "search_web"];

export type Route = {
  /** Empty means the general agent: every tool and every rule. */
  specialists: SpecialistId[];
  /** Tool names allowed this turn, or null for all of them. */
  tools: Set<string> | null;
};

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchSpecialists(text: string): SpecialistId[] | "broad" {
  const plain = normalize(text);
  if (BROAD.test(plain)) return "broad";
  return SPECIALISTS.filter((specialist) => specialist.match.test(plain)).map((specialist) => specialist.id);
}

const GENERAL: Route = { specialists: [], tools: null };

/**
 * Picks the specialists for a question. A follow-up with no topic words
 * ("e no mês?") keeps the topic of the previous user message.
 */
export function routeQuestion(question: string, history: StoredTurn[] = []): Route {
  let matched = matchSpecialists(question);
  if (Array.isArray(matched) && matched.length === 0) {
    const previous = [...history].reverse().find((turn) => turn.role === "user");
    if (previous) matched = matchSpecialists(previous.content);
  }
  if (matched === "broad" || matched.length === 0) return GENERAL;

  const tools = new Set(ALWAYS_TOOLS);
  for (const specialist of SPECIALISTS) {
    if (matched.includes(specialist.id)) specialist.tools.forEach((tool) => tools.add(tool));
  }
  return { specialists: matched, tools };
}

export function specialistLabels(ids: SpecialistId[]): string[] {
  return SPECIALISTS.filter((specialist) => ids.includes(specialist.id)).map((specialist) => specialist.label);
}
