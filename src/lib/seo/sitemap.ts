export function parseSitemapXml(xml: string): { urls: string[]; indexes: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    decodeXml(match[1] ?? "").trim()
  );
  if (/<sitemapindex\b/i.test(xml)) return { urls: [], indexes: locs.filter(Boolean) };
  return { urls: locs.filter(Boolean), indexes: [] };
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}
