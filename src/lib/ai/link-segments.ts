export type LinkSegment = { kind: "text" | "link"; value: string };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const TRAILING = /[.,;:!?)\]]+$/;

/** Split answer text so http(s) URLs can render as links; trailing punctuation stays text. */
export function linkSegments(text: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = match[0].replace(TRAILING, "");
    if (start > cursor) segments.push({ kind: "text", value: text.slice(cursor, start) });
    segments.push({ kind: "link", value: url });
    cursor = start + url.length;
  }
  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
  return segments;
}
