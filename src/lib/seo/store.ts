import { crawlKey, mergePagespeed, pagespeedKey } from "./snapshots";
import type {
  CrawlPageRow,
  CrawlSnapshotRow,
  FindingRow,
  PagespeedRow,
  SeoRunRow,
} from "./types";

export type SeoSnapshotStore = {
  upsertPagespeed(row: PagespeedRow): Promise<void>;
  listPagespeed(projectId: string): Promise<PagespeedRow[]>;
  replaceCrawl(row: CrawlSnapshotRow, pages: CrawlPageRow[]): Promise<void>;
  listCrawls(projectId: string): Promise<CrawlSnapshotRow[]>;
  listCrawlPages(projectId: string, day: string): Promise<CrawlPageRow[]>;
  listFindings(projectId: string): Promise<FindingRow[]>;
  saveFindings(rows: FindingRow[]): Promise<void>;
  addRun(row: SeoRunRow): Promise<void>;
  latestRun(projectId: string, kind: SeoRunRow["kind"]): Promise<SeoRunRow | null>;
};

export function createMemorySeoStore(): SeoSnapshotStore & {
  pagespeedCount(): number;
  crawlCount(): number;
  pageCount(projectId: string, day: string): number;
} {
  const pagespeed = new Map<string, PagespeedRow>();
  const crawls = new Map<string, CrawlSnapshotRow>();
  const pages = new Map<string, CrawlPageRow[]>();
  const findings = new Map<string, FindingRow>();
  const runs: SeoRunRow[] = [];

  return {
    async upsertPagespeed(row) {
      pagespeed.set(pagespeedKey(row), mergePagespeed(row));
    },
    async listPagespeed(projectId) {
      return [...pagespeed.values()]
        .filter((row) => row.projectId === projectId)
        .sort((a, b) => a.day.localeCompare(b.day) || a.pageUrl.localeCompare(b.pageUrl));
    },
    async replaceCrawl(row, pageRows) {
      const key = crawlKey(row.projectId, row.day);
      crawls.set(key, {
        ...row,
        checklist: row.checklist.map((item) => ({ ...item, evidence: { ...item.evidence } })),
        aiBots: row.aiBots.map((bot) => ({ ...bot })),
      });
      pages.set(
        key,
        pageRows.map((page) => ({
          ...page,
          hreflang: page.hreflang.map((link) => ({ ...link })),
          jsonLdTypes: [...page.jsonLdTypes],
        }))
      );
    },
    async listCrawls(projectId) {
      return [...crawls.values()]
        .filter((row) => row.projectId === projectId)
        .sort((a, b) => a.day.localeCompare(b.day));
    },
    async listCrawlPages(projectId, day) {
      return (pages.get(crawlKey(projectId, day)) ?? []).map((page) => ({ ...page }));
    },
    async listFindings(projectId) {
      return [...findings.values()].filter((row) => row.projectId === projectId);
    },
    async saveFindings(rows) {
      for (const row of rows) findings.set(`${row.projectId}\n${row.fingerprint}`, { ...row });
    },
    async addRun(row) {
      runs.push({ ...row });
    },
    async latestRun(projectId, kind) {
      const matches = runs.filter((row) => row.projectId === projectId && row.kind === kind);
      return matches.at(-1) ?? null;
    },
    pagespeedCount() {
      return pagespeed.size;
    },
    crawlCount() {
      return crawls.size;
    },
    pageCount(projectId, day) {
      return pages.get(crawlKey(projectId, day))?.length ?? 0;
    },
  };
}
