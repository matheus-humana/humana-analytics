import type { FindingView } from "./view";

export type FindingGroup = {
  key: string;
  source: FindingView["source"];
  severity: FindingView["severity"];
  code: string;
  count: number;
  pages: Array<{ url: string; detail: string }>;
  detail: string | null;
  lastSeenOn: string;
};

export function groupFindings(findings: FindingView[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();
  for (const item of findings) {
    const key = `${item.source}:${item.severity}:${item.code}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        key,
        source: item.source,
        severity: item.severity,
        code: item.code,
        count: 1,
        pages: [{ url: item.pageUrl, detail: item.detail }],
        detail: item.detail || null,
        lastSeenOn: item.lastSeenOn,
      });
      continue;
    }
    current.count += 1;
    current.pages.push({ url: item.pageUrl, detail: item.detail });
    if (current.detail !== (item.detail || null)) current.detail = null;
    if (item.lastSeenOn > current.lastSeenOn) current.lastSeenOn = item.lastSeenOn;
  }

  for (const group of groups.values()) {
    group.pages.sort((a, b) => a.url.localeCompare(b.url) || a.detail.localeCompare(b.detail));
  }

  return [...groups.values()].sort(compareGroups);
}

function compareGroups(a: FindingGroup, b: FindingGroup): number {
  if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
  if (a.source !== b.source) return a.source === "geo" ? -1 : 1;
  if (a.count !== b.count) return b.count - a.count;
  return a.code.localeCompare(b.code);
}
