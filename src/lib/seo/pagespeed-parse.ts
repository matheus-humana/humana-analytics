import type { ParsedPagespeed, VitalOrigin } from "./types";

const CATEGORIES = [
  ["performance", "performance"],
  ["accessibility", "accessibility"],
  ["best-practices", "bestPractices"],
  ["seo", "seo"],
] as const;

type Experience = {
  metrics?: Record<string, { percentile?: unknown; category?: unknown }>;
  origin_fallback?: boolean;
};

/**
 * Reads a PageSpeed Insights v5 JSON body.
 * Category scores are Lighthouse's 0–1 values, stored as 0–100.
 * CrUX CLS percentile is the score times 100 (0.10 arrives as 10) and is
 * stored as thousandths. Field data wins over lab for each vital.
 */
export function parsePagespeedResponse(
  body: unknown
): { ok: true; data: ParsedPagespeed } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "PageSpeed response was empty." };
  }
  const record = body as Record<string, unknown>;
  const apiError = readApiError(record.error);
  if (apiError) return { ok: false, error: apiError };

  const lighthouse = record.lighthouseResult;
  if (!lighthouse || typeof lighthouse !== "object") {
    return { ok: false, error: "PageSpeed response did not include lighthouseResult." };
  }
  const lh = lighthouse as Record<string, unknown>;
  const categories = lh.categories;
  const audits = lh.audits;

  const scores = {
    performance: null as number | null,
    accessibility: null as number | null,
    bestPractices: null as number | null,
    seo: null as number | null,
  };
  for (const [key, field] of CATEGORIES) {
    scores[field] = categoryScore(categories, key);
  }

  const loading = asExperience(record.loadingExperience);
  const origin = asExperience(record.originLoadingExperience);
  const lcp = pickVital(loading, origin, audits, {
    fieldKey: "LARGEST_CONTENTFUL_PAINT_MS",
    auditKeys: ["largest-contentful-paint"],
    scale: "ms",
  });
  const cls = pickVital(loading, origin, audits, {
    fieldKey: "CUMULATIVE_LAYOUT_SHIFT_SCORE",
    auditKeys: ["cumulative-layout-shift"],
    scale: "cls",
  });
  const inp = pickVital(loading, origin, audits, {
    fieldKey: "INTERACTION_TO_NEXT_PAINT",
    auditKeys: ["interaction-to-next-paint", "experimental-interaction-to-next-paint"],
    scale: "ms",
  });

  return {
    ok: true,
    data: {
      ...scores,
      lcpMs: lcp?.value ?? null,
      lcpOrigin: lcp?.origin ?? null,
      clsThousandths: cls?.value ?? null,
      clsOrigin: cls?.origin ?? null,
      inpMs: inp?.value ?? null,
      inpOrigin: inp?.origin ?? null,
    },
  };
}

function readApiError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return message.trim().slice(0, 400);
  const status = (error as { status?: unknown }).status;
  if (typeof status === "string" && status.trim()) return status.trim().slice(0, 400);
  return "PageSpeed request failed.";
}

function categoryScore(categories: unknown, key: string): number | null {
  if (!categories || typeof categories !== "object") return null;
  const category = (categories as Record<string, unknown>)[key];
  if (!category || typeof category !== "object") return null;
  const score = (category as { score?: unknown }).score;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
    return null;
  }
  return Math.round(score * 100);
}

function asExperience(value: unknown): Experience | null {
  if (!value || typeof value !== "object") return null;
  return value as Experience;
}

function pickVital(
  loading: Experience | null,
  originExperience: Experience | null,
  audits: unknown,
  spec: { fieldKey: string; auditKeys: string[]; scale: "ms" | "cls" }
): { value: number; origin: VitalOrigin } | null {
  const urlField = fieldPercentile(loading, spec.fieldKey);
  if (urlField != null && loading?.origin_fallback !== true) {
    return { value: scaleField(urlField, spec.scale), origin: "field-url" };
  }
  const fallbackField =
    loading?.origin_fallback === true ? fieldPercentile(loading, spec.fieldKey) : null;
  const originField = fallbackField ?? fieldPercentile(originExperience, spec.fieldKey);
  if (originField != null) {
    return { value: scaleField(originField, spec.scale), origin: "field-origin" };
  }
  const lab = labValue(audits, spec.auditKeys);
  if (lab == null) return null;
  return { value: scaleLab(lab, spec.scale), origin: "lab" };
}

function fieldPercentile(experience: Experience | null, key: string): number | null {
  const metric = experience?.metrics?.[key];
  if (!metric) return null;
  const percentile = typeof metric.percentile === "number"
    ? metric.percentile
    : typeof metric.percentile === "string"
      ? Number(metric.percentile)
      : Number.NaN;
  if (!Number.isFinite(percentile) || percentile < 0) return null;
  return percentile;
}

function scaleField(percentile: number, scale: "ms" | "cls"): number {
  if (scale === "ms") return Math.round(percentile);
  return Math.round(percentile * 10);
}

function scaleLab(value: number, scale: "ms" | "cls"): number {
  if (scale === "ms") return Math.round(value);
  return Math.round(value * 1000);
}

function labValue(audits: unknown, keys: string[]): number | null {
  if (!audits || typeof audits !== "object") return null;
  const record = audits as Record<string, unknown>;
  for (const key of keys) {
    const audit = record[key];
    if (!audit || typeof audit !== "object") continue;
    const numeric = (audit as { numericValue?: unknown }).numericValue;
    if (typeof numeric === "number" && Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
  }
  return null;
}
