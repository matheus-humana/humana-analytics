import type { FindingRow, IncomingFinding, PagespeedRow } from "./types";

export function pagespeedKey(row: Pick<PagespeedRow, "projectId" | "pageUrl" | "strategy" | "day">): string {
  return `${row.projectId}\n${row.pageUrl}\n${row.strategy}\n${row.day}`;
}

export function crawlKey(projectId: string, day: string): string {
  return `${projectId}\n${day}`;
}

/**
 * Re-running a collect for the same page, strategy, and day replaces the row.
 * It does not insert a second snapshot.
 */
export function mergePagespeed(next: PagespeedRow): PagespeedRow {
  return { ...next };
}

export function reconcileFindings(input: {
  existing: FindingRow[];
  incoming: IncomingFinding[];
  day: string;
  checkedPages: ReadonlySet<string>;
  resolveSiteLevel: boolean;
  preserveCodes?: ReadonlySet<string>;
}): FindingRow[] {
  const preserve = input.preserveCodes ?? new Set<string>();
  const map = new Map<string, FindingRow>();
  for (const row of input.existing) map.set(row.fingerprint, { ...row });

  const seen = new Set<string>();
  for (const item of input.incoming) {
    seen.add(item.fingerprint);
    const previous = map.get(item.fingerprint);
    map.set(item.fingerprint, {
      ...item,
      status: "open",
      firstSeenOn: previous?.firstSeenOn ?? input.day,
      lastSeenOn: input.day,
      resolvedOn: null,
    });
  }

  for (const [fingerprint, row] of map) {
    if (seen.has(fingerprint) || row.status === "resolved") continue;
    if (preserve.has(row.code)) continue;
    const siteLevel = row.source === "geo";
    const checked = input.checkedPages.has(row.pageUrl) || (siteLevel && input.resolveSiteLevel);
    if (!checked) continue;
    map.set(fingerprint, {
      ...row,
      status: "resolved",
      resolvedOn: input.day,
    });
  }

  return [...map.values()];
}
