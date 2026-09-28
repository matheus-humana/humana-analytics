import { AI_BOTS } from "./types";
import type {
  AiBotReport,
  GeoRuleId,
  GeoRuleResult,
  IncomingFinding,
  PageSignals,
} from "./types";
import { finding } from "./findings";
import { headingSkipCount } from "./html-parse";

export const GEO_WEIGHTS: Record<GeoRuleId, number> = {
  llms_present: 100,
  llms_valid: 100,
  robots_ai: 200,
  jsonld_organization: 75,
  jsonld_website: 75,
  jsonld_product: 75,
  jsonld_faq: 75,
  headings: 150,
  readability: 150,
};

const READABILITY_SLICE = 50;
const HEADING_SLICE = 75;

export function geoWeightTotal(): number {
  return Object.values(GEO_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
}

export function buildGeoChecklist(input: {
  projectId: string;
  siteUrl: string;
  llmsStatus: number | null;
  llmsBody: string;
  llmsContentType: string | null;
  bots: AiBotReport[];
  pages: PageSignals[];
  homePage?: PageSignals | null;
}): { scorePoints: number; rules: GeoRuleResult[]; findings: IncomingFinding[] } {
  const home =
    input.homePage ?? input.pages.find((page) => page.url === input.siteUrl) ?? null;
  const rules: GeoRuleResult[] = [
    llmsPresent(input.llmsStatus, input.llmsBody, input.llmsContentType),
    llmsValid(input.llmsStatus, input.llmsBody, input.llmsContentType),
    robotsRule(input.bots),
    jsonLdRule("jsonld_organization", ["Organization"], input.pages),
    jsonLdRule("jsonld_website", ["WebSite"], input.pages),
    jsonLdRule("jsonld_product", ["Product", "SoftwareApplication"], input.pages),
    jsonLdRule("jsonld_faq", ["FAQPage"], input.pages),
    headingsRule(home),
    readabilityRule(home),
  ];
  const scorePoints = rules.reduce((sum, rule) => sum + rule.earnedPoints, 0);
  const ruleFindings = rules.flatMap((rule) => ruleFinding(input.projectId, input.siteUrl, rule));
  const jsOnly = input.pages
    .filter((page) => page.httpStatus >= 200 && page.httpStatus < 400)
    .flatMap((page) => jsOnlyFinding(input.projectId, page));
  return {
    scorePoints,
    rules,
    findings: [...ruleFindings, ...jsOnly],
  };
}

function rule(
  id: GeoRuleId,
  earnedPoints: number,
  evidence: GeoRuleResult["evidence"]
): GeoRuleResult {
  const weightPoints = GEO_WEIGHTS[id];
  const earned = Math.max(0, Math.min(weightPoints, earnedPoints));
  return {
    id,
    weightPoints,
    earnedPoints: earned,
    passed: earned === weightPoints,
    evidence,
  };
}

function llmsPresent(
  status: number | null,
  body: string,
  contentType: string | null
): GeoRuleResult {
  const bytes = byteLength(body);
  const html = looksLikeHtml(body, contentType);
  const present = status === 200 && bytes > 0 && !html;
  return rule("llms_present", present ? GEO_WEIGHTS.llms_present : 0, {
    status,
    bytes,
    html,
  });
}

function llmsValid(
  status: number | null,
  body: string,
  contentType: string | null
): GeoRuleResult {
  const trimmed = body.trim();
  const bytes = byteLength(trimmed);
  const html = looksLikeHtml(trimmed, contentType);
  const hasMarker = /^#\s+\S/m.test(trimmed) || /https?:\/\/\S+/i.test(trimmed);
  const valid = status === 200 && !html && bytes >= 40 && hasMarker;
  let reason = "ok";
  if (status !== 200) reason = "http";
  else if (html) reason = "html";
  else if (bytes < 40) reason = "short";
  else if (!hasMarker) reason = "no_marker";
  return rule("llms_valid", valid ? GEO_WEIGHTS.llms_valid : 0, {
    status,
    bytes,
    reason,
  });
}

function robotsRule(bots: AiBotReport[]): GeoRuleResult {
  const blocked = bots.filter((bot) => bot.access === "blocked").map((bot) => bot.bot);
  const allowed = bots.length - blocked.length;
  const earned =
    bots.length === 0 ? 0 : Math.round((GEO_WEIGHTS.robots_ai * allowed) / bots.length);
  return rule("robots_ai", earned, {
    allowed,
    total: bots.length || AI_BOTS.length,
    blocked: blocked.join(", "),
  });
}

function jsonLdRule(id: GeoRuleId, types: string[], pages: PageSignals[]): GeoRuleResult {
  const wanted = new Set(types);
  const foundOn = pages.find((page) => page.jsonLdTypes.some((type) => wanted.has(type)));
  return rule(id, foundOn ? GEO_WEIGHTS[id] : 0, {
    found: Boolean(foundOn),
    page: foundOn?.url ?? null,
    types: types.join("|"),
  });
}

function headingsRule(home: PageSignals | null): GeoRuleResult {
  if (!home || home.httpStatus < 200 || home.httpStatus >= 400) {
    return rule("headings", 0, { page: home?.url ?? null, h1: 0, skips: 0, fetched: false });
  }
  const skips = headingSkipCount(home.headingLevels);
  const jsOnly = home.h1.length === 0 && home.payloadH1 > 0;
  const single = home.h1.length === 1 ? HEADING_SLICE : 0;
  const ordered = skips === 0 && home.headingLevels.length > 0 ? HEADING_SLICE : 0;
  let reason = "ok";
  if (jsOnly) reason = "js_only";
  else if (home.h1.length === 0) reason = "missing";
  else if (home.h1.length > 1) reason = "multiple";
  else if (skips > 0) reason = "skips";
  return rule("headings", jsOnly ? 0 : single + ordered, {
    page: home.url,
    h1: home.h1.length,
    skips,
    fetched: true,
    reason,
    payloadH1: home.payloadH1,
  });
}

function readabilityRule(home: PageSignals | null): GeoRuleResult {
  if (!home || home.httpStatus < 200 || home.httpStatus >= 400) {
    return rule("readability", 0, {
      page: home?.url ?? null,
      words: 0,
      sentences: 0,
      average: null,
      fetched: false,
    });
  }
  const words = home.wordCount >= 120 ? READABILITY_SLICE : 0;
  const sentences = home.sentenceCount >= 2 ? READABILITY_SLICE : 0;
  const average =
    home.averageSentenceWords != null &&
    home.averageSentenceWords >= 8 &&
    home.averageSentenceWords <= 32
      ? READABILITY_SLICE
      : 0;
  const earned = words + sentences + average;
  const reason = home.textInPayload && earned < GEO_WEIGHTS.readability ? "js_only" : earned === GEO_WEIGHTS.readability ? "ok" : "short";
  return rule("readability", home.textInPayload ? 0 : earned, {
    page: home.url,
    words: home.wordCount,
    sentences: home.sentenceCount,
    average:
      home.averageSentenceWords == null
        ? null
        : Math.round(home.averageSentenceWords * 10) / 10,
    fetched: true,
    reason,
    payloadWords: home.payloadWords,
  });
}

function jsOnlyFinding(projectId: string, page: PageSignals): IncomingFinding[] {
  const h1 = page.h1.length === 0 && page.payloadH1 > 0;
  const text = page.textInPayload;
  if (!h1 && !text) return [];
  const parts = [h1 ? "h1" : null, text ? "text" : null].filter((part): part is string => Boolean(part));
  return [
    finding(projectId, "geo", "critical", "geo_js_only", page.url, parts.join(","), page.url),
  ];
}

function ruleFinding(
  projectId: string,
  siteUrl: string,
  item: GeoRuleResult
): IncomingFinding[] {
  if (item.passed) return [];
  if (
    (item.id === "headings" || item.id === "readability") &&
    item.evidence.reason === "js_only"
  ) {
    return [];
  }
  const blocked = String(item.evidence.blocked ?? "");
  const severity =
    item.id === "robots_ai" && blocked.length > 0 && item.earnedPoints === 0
      ? "critical"
      : "warning";
  return [
    finding(
      projectId,
      "geo",
      severity,
      `geo_${item.id}`,
      siteUrl,
      evidenceDetail(item),
      item.id
    ),
  ];
}

function evidenceDetail(item: GeoRuleResult): string {
  if (item.id === "robots_ai") return String(item.evidence.blocked ?? "");
  if (item.id === "headings") {
    return `h1=${item.evidence.h1};skips=${item.evidence.skips};reason=${item.evidence.reason ?? ""}`;
  }
  if (item.id === "readability") {
    return `words=${item.evidence.words};sentences=${item.evidence.sentences};reason=${item.evidence.reason ?? ""}`;
  }
  if (String(item.id).startsWith("jsonld")) return String(item.evidence.types ?? "");
  if (item.id === "llms_present" || item.id === "llms_valid") {
    return `status=${item.evidence.status ?? "none"};reason=${item.evidence.reason ?? ""}`;
  }
  return "";
}

export function looksLikeHtml(body: string, contentType: string | null): boolean {
  if (contentType && /text\/html|application\/xhtml/i.test(contentType)) return true;
  return /^\s*(<!doctype html|<html\b)/i.test(body);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function llmsIsValid(
  status: number | null,
  body: string,
  contentType: string | null
): boolean {
  return llmsValid(status, body, contentType).passed;
}
