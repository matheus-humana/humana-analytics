import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";

import type { AiBotReport, GeoRuleResult, VitalOrigin } from "./types";

const FINDINGS = {
  http_error: {
    "pt-BR": {
      title: "Página com erro HTTP",
      fix: "Faça a URL responder 200, ou tire o link e a entrada do sitemap.",
    },
    en: {
      title: "Page returned an HTTP error",
      fix: "Make the URL return 200, or remove the link and the sitemap entry.",
    },
  },
  missing_title: {
    "pt-BR": {
      title: "Title ausente",
      fix: "Adicione um <title> único, entre 30 e 60 caracteres.",
    },
    en: {
      title: "Missing title",
      fix: "Add a unique <title> between 30 and 60 characters.",
    },
  },
  title_length: {
    "pt-BR": {
      title: "Title fora do tamanho",
      fix: "Ajuste o title para ficar entre 30 e 60 caracteres.",
    },
    en: {
      title: "Title length is outside the range",
      fix: "Adjust the title so it stays between 30 and 60 characters.",
    },
  },
  duplicate_title: {
    "pt-BR": {
      title: "Title repetido",
      fix: "Use um title diferente nesta página.",
    },
    en: {
      title: "Duplicate title",
      fix: "Give this page a title that no other crawled page uses.",
    },
  },
  missing_description: {
    "pt-BR": {
      title: "Meta description ausente",
      fix: "Adicione meta description entre 50 e 160 caracteres.",
    },
    en: {
      title: "Missing meta description",
      fix: "Add a meta description between 50 and 160 characters.",
    },
  },
  description_length: {
    "pt-BR": {
      title: "Meta description fora do tamanho",
      fix: "Ajuste a meta description para ficar entre 50 e 160 caracteres.",
    },
    en: {
      title: "Meta description length is outside the range",
      fix: "Adjust the meta description so it stays between 50 and 160 characters.",
    },
  },
  duplicate_description: {
    "pt-BR": {
      title: "Meta description repetida",
      fix: "Escreva uma description específica para esta página.",
    },
    en: {
      title: "Duplicate meta description",
      fix: "Write a description that is specific to this page.",
    },
  },
  h1_missing: {
    "pt-BR": {
      title: "H1 ausente",
      fix: "Inclua um único H1 no HTML da resposta. A varredura não executa JavaScript.",
    },
    en: {
      title: "Missing H1",
      fix: "Include a single H1 in the HTML response. The crawl does not run JavaScript.",
    },
  },
  h1_multiple: {
    "pt-BR": {
      title: "Mais de um H1",
      fix: "Mantenha um único H1 e use H2 para as seções.",
    },
    en: {
      title: "More than one H1",
      fix: "Keep a single H1 and use H2 for sections.",
    },
  },
  missing_canonical: {
    "pt-BR": {
      title: "Canonical ausente",
      fix: "Adicione link rel=canonical apontando para a própria URL.",
    },
    en: {
      title: "Missing canonical",
      fix: "Add a rel=canonical link that points at this URL.",
    },
  },
  canonical_mismatch: {
    "pt-BR": {
      title: "Canonical aponta para outra URL",
      fix: "Aponte o canonical para a URL canônica desta página, sem barra ou parâmetro a mais.",
    },
    en: {
      title: "Canonical points at a different URL",
      fix: "Point canonical at this page's own URL, without an extra slash or parameter.",
    },
  },
  missing_hreflang: {
    "pt-BR": {
      title: "hreflang ausente",
      fix: "Adicione link rel=alternate hreflang para as versões de idioma.",
    },
    en: {
      title: "Missing hreflang",
      fix: "Add rel=alternate hreflang links for the language versions.",
    },
  },
  hreflang_invalid: {
    "pt-BR": {
      title: "hreflang sem href",
      fix: "Preencha o href de cada alternate hreflang.",
    },
    en: {
      title: "hreflang is missing an href",
      fix: "Fill in the href of each hreflang alternate.",
    },
  },
  image_missing_alt: {
    "pt-BR": {
      title: "Imagem sem alt",
      fix: "Preencha alt nas imagens de conteúdo. Alt vazio só em imagem decorativa.",
    },
    en: {
      title: "Image without alt",
      fix: "Add alt text on content images. Leave alt empty only for decorative images.",
    },
  },
  broken_internal_link: {
    "pt-BR": {
      title: "Link interno quebrado",
      fix: "Corrija o destino ou remova o link. O detalhe traz o status e a URL.",
    },
    en: {
      title: "Broken internal link",
      fix: "Fix the target or remove the link. The detail has the status and URL.",
    },
  },
  noindex: {
    "pt-BR": {
      title: "Página com noindex",
      fix: "Remova noindex se esta URL deve aparecer na busca.",
    },
    en: {
      title: "Page is noindex",
      fix: "Remove noindex if this URL should be indexed.",
    },
  },
  geo_llms_present: {
    "pt-BR": {
      title: "/llms.txt ausente ou inválido",
      fix: "Publique /llms.txt em texto, com HTTP 200, sem HTML de erro.",
    },
    en: {
      title: "/llms.txt is missing or not plain text",
      fix: "Publish /llms.txt as text, with HTTP 200, and without an HTML error page.",
    },
  },
  geo_llms_valid: {
    "pt-BR": {
      title: "/llms.txt sem validade básica",
      fix: "Inclua um título markdown (# ) ou uma URL https, com pelo menos 40 caracteres.",
    },
    en: {
      title: "/llms.txt failed the basic check",
      fix: "Include a markdown heading (# ) or an https URL, and at least 40 characters.",
    },
  },
  geo_robots_ai: {
    "pt-BR": {
      title: "robots.txt bloqueia robôs de IA",
      fix: "Tire o Disallow: / dos user-agents de IA que devem poder ler o site.",
    },
    en: {
      title: "robots.txt blocks AI crawlers",
      fix: "Remove Disallow: / from the AI user-agents that should be allowed to read the site.",
    },
  },
  geo_jsonld_organization: {
    "pt-BR": {
      title: "JSON-LD Organization ausente",
      fix: "Adicione um script application/ld+json com @type Organization.",
    },
    en: {
      title: "JSON-LD Organization is missing",
      fix: "Add an application/ld+json script with @type Organization.",
    },
  },
  geo_jsonld_website: {
    "pt-BR": {
      title: "JSON-LD WebSite ausente",
      fix: "Adicione um script application/ld+json com @type WebSite.",
    },
    en: {
      title: "JSON-LD WebSite is missing",
      fix: "Add an application/ld+json script with @type WebSite.",
    },
  },
  geo_jsonld_product: {
    "pt-BR": {
      title: "JSON-LD Product ou SoftwareApplication ausente",
      fix: "Marque o produto com @type Product ou SoftwareApplication.",
    },
    en: {
      title: "JSON-LD Product or SoftwareApplication is missing",
      fix: "Mark the product with @type Product or SoftwareApplication.",
    },
  },
  geo_jsonld_faq: {
    "pt-BR": {
      title: "JSON-LD FAQPage ausente",
      fix: "Se houver perguntas frequentes, publique @type FAQPage.",
    },
    en: {
      title: "JSON-LD FAQPage is missing",
      fix: "If the site has a FAQ, publish @type FAQPage.",
    },
  },
  geo_headings: {
    "pt-BR": {
      title: "Estrutura de títulos da home",
      fix: "Na home, use um único H1 e não pule níveis (H1, depois H2).",
    },
    en: {
      title: "Homepage heading structure",
      fix: "On the homepage, use one H1 and do not skip levels (H1, then H2).",
    },
  },
  geo_readability: {
    "pt-BR": {
      title: "Texto principal da home curto ou denso",
      fix: "Escreva pelo menos 120 palavras, em 2 frases ou mais, com média de 8 a 32 palavras por frase.",
    },
    en: {
      title: "Homepage main text is thin or dense",
      fix: "Write at least 120 words, in 2 or more sentences, averaging 8 to 32 words per sentence.",
    },
  },
} as const;

export type FindingCode = keyof typeof FINDINGS;

export function findingCodes(): FindingCode[] {
  return Object.keys(FINDINGS) as FindingCode[];
}

export function explainFinding(
  locale: ChatLocale,
  code: string
): { title: string; fix: string } | null {
  const entry = FINDINGS[code as FindingCode];
  if (!entry) return null;
  return entry[locale];
}

export function explainGeoRule(locale: ChatLocale, rule: GeoRuleResult): string {
  const evidence = rule.evidence;
  if (locale === "en") return explainGeoEn(rule.id, evidence, rule.passed, rule.earnedPoints, rule.weightPoints);
  return explainGeoPt(rule.id, evidence, rule.passed, rule.earnedPoints, rule.weightPoints);
}

export function explainBot(locale: ChatLocale, bot: AiBotReport): string {
  if (locale === "en") {
    if (bot.via === "missing_robots") return `${bot.bot}: allowed, because /robots.txt was not found`;
    if (bot.access === "blocked") return `${bot.bot}: blocked by robots.txt (${bot.via})`;
    return `${bot.bot}: allowed by robots.txt (${bot.via})`;
  }
  if (bot.via === "missing_robots") return `${bot.bot}: liberado, porque /robots.txt não foi encontrado`;
  if (bot.access === "blocked") return `${bot.bot}: bloqueado no robots.txt (${bot.via})`;
  return `${bot.bot}: liberado no robots.txt (${bot.via})`;
}

export function explainVitalOrigin(locale: ChatLocale, origin: VitalOrigin): string {
  if (locale === "en") {
    if (origin === "field-url") return "field data (CrUX for this URL)";
    if (origin === "field-origin") return "field data (CrUX for the origin)";
    return "lab data (Lighthouse). Real users can differ.";
  }
  if (origin === "field-url") return "dado de campo (CrUX desta URL)";
  if (origin === "field-origin") return "dado de campo (CrUX da origem)";
  return "dado de laboratório (Lighthouse). Usuários reais podem variar.";
}

export function formatScorePoints(points: number): string {
  const value = points / 100;
  if (Number.isInteger(value)) return value.toFixed(1);
  const text = value.toFixed(2);
  return text.endsWith("0") ? text.slice(0, -1) : text;
}

function explainGeoPt(
  id: GeoRuleResult["id"],
  evidence: GeoRuleResult["evidence"],
  passed: boolean,
  earned: number,
  weight: number
): string {
  const score = `${formatScorePoints(earned)}/${formatScorePoints(weight)}`;
  if (id === "llms_present") {
    return passed
      ? `/llms.txt respondeu 200 em texto (${evidence.bytes} bytes).`
      : `/llms.txt não passou: HTTP ${evidence.status ?? "sem resposta"}, ${evidence.bytes ?? 0} bytes, html=${evidence.html}.`;
  }
  if (id === "llms_valid") {
    return passed
      ? `/llms.txt tem conteúdo básico (${evidence.bytes} bytes, ${evidence.reason}).`
      : `/llms.txt falhou a validade básica (${evidence.reason}, ${evidence.bytes ?? 0} bytes).`;
  }
  if (id === "robots_ai") {
    const blocked = String(evidence.blocked ?? "");
    return blocked
      ? `${score}. Bloqueados: ${blocked}. Liberados: ${evidence.allowed}/${evidence.total}.`
      : `${score}. Nenhum dos robôs listados está bloqueado.`;
  }
  if (id.startsWith("jsonld_")) {
    return passed
      ? `Encontrado em ${evidence.page}.`
      : `Não encontrado nas páginas varridas (${evidence.types}).`;
  }
  if (id === "headings") {
    if (evidence.fetched === false) return "A home não entrou nesta varredura.";
    return `H1=${evidence.h1}, saltos de nível=${evidence.skips}. ${score}.`;
  }
  if (evidence.fetched === false) return "A home não entrou nesta varredura.";
  return `Palavras=${evidence.words}, frases=${evidence.sentences}, média=${evidence.average ?? "—"}. ${score}.`;
}

function explainGeoEn(
  id: GeoRuleResult["id"],
  evidence: GeoRuleResult["evidence"],
  passed: boolean,
  earned: number,
  weight: number
): string {
  const score = `${formatScorePoints(earned)}/${formatScorePoints(weight)}`;
  if (id === "llms_present") {
    return passed
      ? `/llms.txt returned 200 as text (${evidence.bytes} bytes).`
      : `/llms.txt did not pass: HTTP ${evidence.status ?? "no response"}, ${evidence.bytes ?? 0} bytes, html=${evidence.html}.`;
  }
  if (id === "llms_valid") {
    return passed
      ? `/llms.txt has the basic content (${evidence.bytes} bytes, ${evidence.reason}).`
      : `/llms.txt failed the basic check (${evidence.reason}, ${evidence.bytes ?? 0} bytes).`;
  }
  if (id === "robots_ai") {
    const blocked = String(evidence.blocked ?? "");
    return blocked
      ? `${score}. Blocked: ${blocked}. Allowed: ${evidence.allowed}/${evidence.total}.`
      : `${score}. None of the listed crawlers are blocked.`;
  }
  if (id.startsWith("jsonld_")) {
    return passed
      ? `Found on ${evidence.page}.`
      : `Not found on the crawled pages (${evidence.types}).`;
  }
  if (id === "headings") {
    if (evidence.fetched === false) return "The homepage was not part of this crawl.";
    return `H1=${evidence.h1}, skipped levels=${evidence.skips}. ${score}.`;
  }
  if (evidence.fetched === false) return "The homepage was not part of this crawl.";
  return `Words=${evidence.words}, sentences=${evidence.sentences}, average=${evidence.average ?? "—"}. ${score}.`;
}
