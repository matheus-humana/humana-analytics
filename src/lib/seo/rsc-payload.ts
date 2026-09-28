/**
 * Reads the Next.js RSC flight (`self.__next_f`) without running JavaScript.
 * Host elements look like ["$","h1",key,props]. The router also inlines the
 * not-found boundary, so that subtree is ignored.
 */

const PROSE_STRING_MIN = 20;

export type RscPayloadSignals = {
  h1Count: number;
  wordCount: number;
};

export function readRscPayload(html: string): RscPayloadSignals {
  const decoded = decodeFlight(html);
  if (!decoded) return { h1Count: 0, wordCount: 0 };
  const page = stripRouterBoundaries(decoded);
  return {
    h1Count: countHostElements(page, "h1"),
    wordCount: proseWordCount(page),
  };
}

function decodeFlight(html: string): string {
  const parts: string[] = [];
  const pattern =
    /self\.__next_f\.push\(\[\s*1\s*,\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')\s*\]\)/g;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1] ?? match[2] ?? "";
    parts.push(unescapeJsString(raw));
  }
  return parts.join("");
}

function stripRouterBoundaries(text: string): string {
  const keys = ["notFound", "forbidden", "unauthorized"];
  let rest = text;
  for (const key of keys) {
    rest = stripKeyValues(rest, key);
  }
  return rest;
}

function stripKeyValues(text: string, key: string): string {
  const pattern = new RegExp(`"${key}"\\s*:`);
  let cursor = 0;
  let result = "";
  while (cursor < text.length) {
    const slice = text.slice(cursor);
    const match = pattern.exec(slice);
    if (!match) {
      result += slice;
      break;
    }
    result += slice.slice(0, match.index);
    let valueAt = cursor + match.index + match[0].length;
    while (valueAt < text.length && /\s/.test(text[valueAt] ?? "")) valueAt += 1;
    cursor = skipValue(text, valueAt);
  }
  return result;
}

function skipValue(text: string, index: number): number {
  const start = text[index];
  if (start == null) return index;
  if (start === '"') return skipString(text, index);
  if (start === "[" || start === "{") return skipBracket(text, index);
  let end = index;
  while (end < text.length && !",[}]".includes(text[end] ?? "")) end += 1;
  return end;
}

function skipString(text: string, index: number): number {
  let cursor = index + 1;
  while (cursor < text.length) {
    if (text[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (text[cursor] === '"') return cursor + 1;
    cursor += 1;
  }
  return cursor;
}

function skipBracket(text: string, index: number): number {
  const pairs: Record<string, string> = { "[": "]", "{": "}" };
  const closing = pairs[text[index] ?? ""] ?? "";
  let depth = 0;
  let cursor = index;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === '"') {
      cursor = skipString(text, cursor);
      continue;
    }
    if (char === "[" || char === "{") depth += 1;
    else if (char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0 && char === closing) return cursor + 1;
    }
    cursor += 1;
  }
  return cursor;
}

function countHostElements(text: string, tag: string): number {
  const pattern = new RegExp(`\\[\\s*"\\$"\\s*,\\s*"${tag}"\\s*[,\\]]`, "g");
  return text.match(pattern)?.length ?? 0;
}

function proseWordCount(text: string): number {
  const seen = new Set<string>();
  let words = 0;
  for (const match of text.matchAll(/"((?:\\.|[^"\\])*)"/g)) {
    const value = unescapeJsString(match[1] ?? "").replace(/\s+/g, " ").trim();
    if (!isProse(value)) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words += value.split(/\s+/).filter(Boolean).length;
  }
  return words;
}

function isProse(value: string): boolean {
  if (value.length < PROSE_STRING_MIN) return false;
  if (!/\s/.test(value)) return false;
  if (/^[{[<]/.test(value)) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.includes("/_next/") || value.includes("static/chunks")) return false;
  const letters = value.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 12;
}

function unescapeJsString(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\" || index + 1 >= value.length) {
      result += char ?? "";
      continue;
    }
    const next = value[index + 1];
    const simple: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      '"': '"',
      "'": "'",
      "\\": "\\",
      "/": "/",
    };
    if (next && simple[next]) {
      result += simple[next];
      index += 1;
      continue;
    }
    if (next === "u" && index + 5 < value.length) {
      const code = Number.parseInt(value.slice(index + 2, index + 6), 16);
      if (Number.isFinite(code)) {
        result += safeCodePoint(code);
        index += 5;
        continue;
      }
    }
    result += next ?? "";
    index += 1;
  }
  return result;
}

function safeCodePoint(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return "";
  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
}
