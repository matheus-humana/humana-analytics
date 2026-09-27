import { readRscPayload } from "./rsc-payload";
import type { HreflangLink, PageSignals } from "./types";
import { resolveInternalUrl } from "./urls";

const MAX_HTML = 2_000_000;
/** Payload prose at or above this, with a thin HTML body, is treated as JS-only text. */
export const PAYLOAD_PROSE_WORDS = 80;

export function parseHtmlPage(input: {
  html: string;
  url: string;
  httpStatus: number;
  origin: string;
  xRobots?: string | null;
  error?: string | null;
}): PageSignals {
  const html = input.html.slice(0, MAX_HTML);
  const visible = withoutScripts(html);
  const title = textContent(visible, "title");
  const description = metaContent(html, "description");
  const robots = metaContent(html, "robots") ?? metaContent(html, "googlebot");
  const hreflang = readHreflang(html);
  const headingLevels = readHeadingLevels(visible);
  const mainText = mainTextOf(visible);
  const reading = readabilityOf(mainText);
  const payload = readRscPayload(html);
  const noindex = /noindex/i.test(`${robots ?? ""} ${input.xRobots ?? ""}`);

  return {
    url: input.url,
    httpStatus: input.httpStatus,
    title,
    description,
    canonical: linkHref(html, "canonical"),
    lang: htmlLang(html),
    hreflang,
    h1: readH1(visible),
    headingLevels,
    imagesMissingAlt: countImagesMissingAlt(html),
    noindex,
    jsonLdTypes: readJsonLdTypes(html),
    internalLinks: readInternalLinks(html, input.url, input.origin),
    wordCount: reading.words,
    sentenceCount: reading.sentences,
    averageSentenceWords: reading.average,
    payloadH1: payload.h1Count,
    payloadWords: payload.wordCount,
    textInPayload:
      payload.wordCount >= PAYLOAD_PROSE_WORDS &&
      reading.words < 120 &&
      payload.wordCount > reading.words,
    error: input.error ?? null,
  };
}

function withoutScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
}

export function headingSkipCount(levels: number[]): number {
  let skips = 0;
  let previous = 0;
  for (const level of levels) {
    if (previous > 0 && level > previous + 1) skips += 1;
    previous = level;
  }
  return skips;
}

export function readabilityOf(text: string): {
  words: number;
  sentences: number;
  average: number | null;
} {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return { words: 0, sentences: 0, average: null };
  const words = cleaned.split(/\s+/).filter(Boolean);
  const sentences = cleaned
    .split(/[.!?…]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return {
    words: words.length,
    sentences: sentences.length,
    average: sentences.length > 0 ? words.length / sentences.length : null,
  };
}

function readH1(html: string): string[] {
  const values: string[] = [];
  for (const match of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const text = stripTags(match[1] ?? "").replace(/\s+/g, " ").trim();
    values.push(text);
  }
  return values;
}

function readHeadingLevels(html: string): number[] {
  const levels: number[] = [];
  for (const match of html.matchAll(/<h([1-6])\b[^>]*>/gi)) {
    levels.push(Number(match[1]));
  }
  return levels;
}

function countImagesMissingAlt(html: string): number {
  let missing = 0;
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const alt = attr(tag, "alt");
    if (alt == null || alt.trim() === "") missing += 1;
  }
  return missing;
}

function readInternalLinks(html: string, pageUrl: string, origin: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attr(tag, "href");
    if (!href) continue;
    const resolved = resolveInternalUrl(href, pageUrl, origin);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    links.push(resolved);
  }
  return links;
}

function readJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const pattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = decodeEntities(match[1] ?? "").trim();
    if (!raw) continue;
    try {
      collectTypes(JSON.parse(raw) as unknown, types);
    } catch {
      // Invalid JSON-LD is ignored. The checklist then reports the type as absent.
    }
  }
  return [...types];
}

function collectTypes(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, into);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") into.add(schemaTypeName(type));
  if (Array.isArray(type)) {
    for (const item of type) {
      if (typeof item === "string") into.add(schemaTypeName(item));
    }
  }
  for (const [key, child] of Object.entries(record)) {
    if (key === "@context" || key === "@type") continue;
    if (child && typeof child === "object") collectTypes(child, into);
  }
}

function schemaTypeName(value: string): string {
  const trimmed = value.trim();
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

function readHreflang(html: string): HreflangLink[] {
  const links: HreflangLink[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    if (!rel.split(/\s+/).includes("alternate")) continue;
    const lang = attr(tag, "hreflang");
    if (!lang) continue;
    links.push({ lang: lang.trim(), href: attr(tag, "href")?.trim() ?? "" });
  }
  return links;
}

function linkHref(html: string, relName: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    if (!rel.split(/\s+/).includes(relName)) continue;
    const href = attr(tag, "href")?.trim();
    if (href) return href;
  }
  return null;
}

function metaContent(html: string, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const metaName = attr(tag, "name")?.toLowerCase();
    if (metaName !== wanted) continue;
    const content = attr(tag, "content");
    if (content != null) return content.trim();
  }
  return null;
}

function htmlLang(html: string): string | null {
  const match = /<html\b[^>]*>/i.exec(html);
  if (!match) return null;
  const lang = attr(match[0], "lang");
  return lang?.trim() || null;
}

function textContent(html: string, tagName: string): string | null {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "i").exec(html);
  if (!match) return null;
  const text = stripTags(match[1] ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function mainTextOf(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ");
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(withoutNoise);
  const article = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(withoutNoise);
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(withoutNoise);
  const source = main?.[1] ?? article?.[1] ?? body?.[1] ?? "";
  return stripTags(source).replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " "));
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "i"
  ).exec(tag);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value == null ? null : decodeEntities(value);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => safeCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)));
}

function safeCodePoint(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return "";
  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
}
