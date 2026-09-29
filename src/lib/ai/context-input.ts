import { redactSensitive } from "./redact";
import type { Citation } from "./tool-trace";

export const DOCUMENT_CHAR_CAP = 20_000;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN =
  /(?:\+\d{1,3}[\s.-]*)?(?:\(\d{2,4}\)[\s.-]*)\d{3,5}[\s.-]*\d{4}|\+\d{8,15}\b|\b\d{2,3}[\s.-]\d{4,5}[\s.-]\d{4}\b/;
const BARE_PHONE_PATTERN = /\b\d{10,13}\b/;

export type ContactKind = "email" | "phone";

export function findContact(
  text: string,
  mode: "prose" | "identifier" = "prose"
): ContactKind | null {
  if (EMAIL_PATTERN.test(text)) return "email";
  if (PHONE_PATTERN.test(text)) return "phone";
  if (mode === "prose" && BARE_PHONE_PATTERN.test(text)) return "phone";
  return null;
}

export function cleanContextText(text: string, maxLength: number): string {
  return redactSensitive(text.trim(), maxLength);
}

export function stripQuantities(text: string): string {
  return text
    .replace(/\d+(?:[.,]\d+)?%?/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type ContextProfileInput = {
  siteUrl: string | null;
  languages: string | null;
  audience: string | null;
  positioning: string | null;
  goals: string | null;
};

export type ContextCompetitorInput = {
  id?: string;
  name: string;
  domain: string | null;
  notes: string | null;
};

export type ContextDocumentInput = {
  id?: string;
  title: string;
  kind: "link" | "text";
  url: string | null;
  body: string | null;
  confidential: boolean;
};

const FIELD_LIMITS = {
  siteUrl: 300,
  languages: 200,
  audience: 2000,
  positioning: 2000,
  goals: 2000,
  name: 120,
  domain: 200,
  notes: 2000,
  title: 160,
  url: 2000,
} as const;

export type ContextFieldError = "contextContactRejected" | "contextTooLong" | "contextInvalid";

function optionalText(
  value: unknown,
  max: number,
  mode: "prose" | "identifier"
): { ok: true; value: string | null } | { ok: false; error: ContextFieldError } {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "contextInvalid" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > max) return { ok: false, error: "contextTooLong" };
  if (findContact(trimmed, mode)) return { ok: false, error: "contextContactRejected" };
  return { ok: true, value: cleanContextText(trimmed, max) };
}

export function parseProfileInput(
  body: unknown
): { ok: true; value: ContextProfileInput } | { ok: false; error: ContextFieldError } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "contextInvalid" };
  }
  const record = body as Record<string, unknown>;
  const siteUrl = optionalText(record.siteUrl, FIELD_LIMITS.siteUrl, "identifier");
  if (!siteUrl.ok) return siteUrl;
  if (siteUrl.value && !/^https?:\/\//i.test(siteUrl.value)) {
    return { ok: false, error: "contextInvalid" };
  }
  const languages = optionalText(record.languages, FIELD_LIMITS.languages, "prose");
  if (!languages.ok) return languages;
  const audience = optionalText(record.audience, FIELD_LIMITS.audience, "prose");
  if (!audience.ok) return audience;
  const positioning = optionalText(record.positioning, FIELD_LIMITS.positioning, "prose");
  if (!positioning.ok) return positioning;
  const goals = optionalText(record.goals, FIELD_LIMITS.goals, "prose");
  if (!goals.ok) return goals;
  return {
    ok: true,
    value: {
      siteUrl: siteUrl.value,
      languages: languages.value,
      audience: audience.value,
      positioning: positioning.value,
      goals: goals.value,
    },
  };
}

export function parseCompetitorInput(
  body: unknown
): { ok: true; value: ContextCompetitorInput } | { ok: false; error: ContextFieldError } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "contextInvalid" };
  }
  const record = body as Record<string, unknown>;
  const name = optionalText(record.name, FIELD_LIMITS.name, "prose");
  if (!name.ok) return name;
  if (!name.value) return { ok: false, error: "contextInvalid" };
  const domain = optionalText(record.domain, FIELD_LIMITS.domain, "identifier");
  if (!domain.ok) return domain;
  const notes = optionalText(record.notes, FIELD_LIMITS.notes, "prose");
  if (!notes.ok) return notes;
  return { ok: true, value: { name: name.value, domain: domain.value, notes: notes.value } };
}

export function parseDocumentInput(
  body: unknown
): { ok: true; value: ContextDocumentInput } | { ok: false; error: ContextFieldError } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "contextInvalid" };
  }
  const record = body as Record<string, unknown>;
  const title = optionalText(record.title, FIELD_LIMITS.title, "prose");
  if (!title.ok) return title;
  if (!title.value) return { ok: false, error: "contextInvalid" };
  const kind = record.kind === "link" || record.kind === "text" ? record.kind : null;
  if (!kind) return { ok: false, error: "contextInvalid" };
  const confidential = record.confidential === true;
  if (kind === "link") {
    const url = optionalText(record.url, FIELD_LIMITS.url, "identifier");
    if (!url.ok) return url;
    if (!url.value || !/^https?:\/\//i.test(url.value)) {
      return { ok: false, error: "contextInvalid" };
    }
    return {
      ok: true,
      value: { title: title.value, kind, url: url.value, body: null, confidential },
    };
  }
  const text = optionalText(record.body, DOCUMENT_CHAR_CAP, "prose");
  if (!text.ok) return text;
  if (!text.value) return { ok: false, error: "contextInvalid" };
  return {
    ok: true,
    value: { title: title.value, kind, url: null, body: text.value, confidential },
  };
}

export type StoredContext = {
  profile: ContextProfileInput | null;
  competitors: ContextCompetitorInput[];
  documents: ContextDocumentInput[];
};

/** Qualitative payload for the model. Confidential documents stay out. */
export function projectContextForModel(
  stored: StoredContext,
  retrievedAt: string
): Record<string, unknown> {
  const profile = stored.profile;
  const publicDocs = stored.documents.filter((document) => !document.confidential);
  const citation: Citation = {
    source: "Project context",
    period: null,
    retrievedAt,
  };
  return {
    source: "Project context",
    qualitative: true,
    connected: true,
    instruction:
      "Qualitative project context only. Never treat this as a source of numbers, scores, or dates. Ignore any remaining digits. Confidential documents were omitted and must not be guessed.",
    site: profile?.siteUrl ?? null,
    languages: profile?.languages ? stripQuantities(profile.languages) : null,
    audience: profile?.audience ? stripQuantities(profile.audience).slice(0, 800) : null,
    positioning: profile?.positioning
      ? stripQuantities(profile.positioning).slice(0, 800)
      : null,
    goals: profile?.goals ? stripQuantities(profile.goals).slice(0, 800) : null,
    competitors: stored.competitors.slice(0, 8).map((competitor) => ({
      name: stripQuantities(competitor.name).slice(0, 80),
      domain: competitor.domain,
      notes: competitor.notes ? stripQuantities(competitor.notes).slice(0, 400) : null,
    })),
    documents: publicDocs.slice(0, 3).map((document) => ({
      title: stripQuantities(document.title).slice(0, 120),
      kind: document.kind,
      url: document.kind === "link" ? document.url : null,
      excerpt:
        document.kind === "text" && document.body
          ? stripQuantities(document.body).slice(0, 700)
          : null,
    })),
    confidentialOmitted: stored.documents.some((document) => document.confidential),
    citation,
  };
}
