import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TITLE_MAX,
  TITLE_MIN,
} from "./config";
import type { FindingSeverity, IncomingFinding, PageSignals } from "./types";
import { normalizePageUrl } from "./urls";

const BROKEN_LINK_CAP = 25;

export function buildSeoFindings(input: {
  projectId: string;
  pages: PageSignals[];
  linkStatus: Map<string, number>;
}): IncomingFinding[] {
  const findings: IncomingFinding[] = [];
  const indexable = input.pages.filter((page) => page.httpStatus >= 200 && page.httpStatus < 400);

  for (const page of input.pages) {
    if (page.httpStatus < 200 || page.httpStatus >= 400) {
      findings.push(
        finding(input.projectId, "seo", "critical", "http_error", page.url, page.error ?? String(page.httpStatus), page.url)
      );
      continue;
    }

    if (!page.title) {
      findings.push(finding(input.projectId, "seo", "critical", "missing_title", page.url, "", page.url));
    } else if (page.title.length < TITLE_MIN || page.title.length > TITLE_MAX) {
      findings.push(
        finding(input.projectId, "seo", "warning", "title_length", page.url, String(page.title.length), page.url)
      );
    }

    if (!page.description) {
      findings.push(
        finding(input.projectId, "seo", "warning", "missing_description", page.url, "", page.url)
      );
    } else if (
      page.description.length < DESCRIPTION_MIN ||
      page.description.length > DESCRIPTION_MAX
    ) {
      findings.push(
        finding(
          input.projectId,
          "seo",
          "warning",
          "description_length",
          page.url,
          String(page.description.length),
          page.url
        )
      );
    }

    if (page.h1.length === 0) {
      findings.push(finding(input.projectId, "seo", "critical", "h1_missing", page.url, "", page.url));
    } else if (page.h1.length > 1) {
      findings.push(
        finding(input.projectId, "seo", "warning", "h1_multiple", page.url, String(page.h1.length), page.url)
      );
    }

    if (!page.canonical) {
      findings.push(
        finding(input.projectId, "seo", "warning", "missing_canonical", page.url, "", page.url)
      );
    } else {
      const canonical = normalizePageUrl(page.canonical, page.url);
      const self = normalizePageUrl(page.url);
      if (!canonical || canonical !== self) {
        findings.push(
          finding(
            input.projectId,
            "seo",
            "warning",
            "canonical_mismatch",
            page.url,
            page.canonical,
            `${page.url}:${canonical ?? page.canonical}`
          )
        );
      }
    }

    const usableHreflang = page.hreflang.filter((link) => link.href.trim() && link.lang.trim());
    if (page.hreflang.length === 0) {
      findings.push(
        finding(input.projectId, "seo", "warning", "missing_hreflang", page.url, "", page.url)
      );
    } else if (usableHreflang.length === 0) {
      findings.push(
        finding(input.projectId, "seo", "warning", "hreflang_invalid", page.url, "", page.url)
      );
    }

    if (page.imagesMissingAlt > 0) {
      findings.push(
        finding(
          input.projectId,
          "seo",
          "warning",
          "image_missing_alt",
          page.url,
          String(page.imagesMissingAlt),
          page.url
        )
      );
    }

    if (page.noindex) {
      findings.push(finding(input.projectId, "seo", "critical", "noindex", page.url, "noindex", page.url));
    }
  }

  const titles = groupBy(indexable.filter((page) => page.title), (page) => normalizeText(page.title ?? ""));
  for (const [title, pages] of titles) {
    if (!title || pages.length < 2) continue;
    for (const page of pages) {
      findings.push(
        finding(input.projectId, "seo", "warning", "duplicate_title", page.url, page.title ?? "", title)
      );
    }
  }

  const descriptions = groupBy(
    indexable.filter((page) => page.description),
    (page) => normalizeText(page.description ?? "")
  );
  for (const [description, pages] of descriptions) {
    if (!description || pages.length < 2) continue;
    for (const page of pages) {
      findings.push(
        finding(
          input.projectId,
          "seo",
          "warning",
          "duplicate_description",
          page.url,
          page.description ?? "",
          description
        )
      );
    }
  }

  const broken: IncomingFinding[] = [];
  for (const page of indexable) {
    for (const target of page.internalLinks) {
      if (target === page.url) continue;
      const status = input.linkStatus.get(target);
      if (status == null || (status >= 200 && status < 400)) continue;
      broken.push(
        finding(
          input.projectId,
          "seo",
          "critical",
          "broken_internal_link",
          page.url,
          `${status} ${target}`,
          target
        )
      );
    }
  }
  broken.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  findings.push(...broken.slice(0, BROKEN_LINK_CAP));

  return dedupe(findings);
}

export function finding(
  projectId: string,
  source: "seo" | "geo",
  severity: FindingSeverity,
  code: string,
  pageUrl: string,
  detail: string,
  qualifier: string
): IncomingFinding {
  return {
    projectId,
    source,
    severity,
    code,
    pageUrl,
    detail: detail.replace(/\s+/g, " ").trim().slice(0, 180),
    fingerprint: `${source}:${code}:${pageUrl}:${qualifier}`.slice(0, 500),
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

function dedupe(findings: IncomingFinding[]): IncomingFinding[] {
  const seen = new Set<string>();
  const unique: IncomingFinding[] = [];
  for (const item of findings) {
    if (seen.has(item.fingerprint)) continue;
    seen.add(item.fingerprint);
    unique.push(item);
  }
  return unique;
}
