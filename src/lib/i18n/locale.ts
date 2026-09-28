import { normalizeChatLocale, type ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { guestLocaleKey, workspaceLocaleKey } from "@/lib/workspace/prefs";

/** Chosen language. Read on the server so the first paint matches the choice. */
export const LOCALE_COOKIE = "ha-locale";

const YEAR_SECONDS = 60 * 60 * 24 * 365;
const LEGACY_PREFIX = "ha-locale:";

export function htmlLang(locale: ChatLocale): "en" | "pt-BR" {
  return locale === "en" ? "en" : "pt-BR";
}

/**
 * Cookie wins. Without one, the first matching language in Accept-Language
 * is used. Anything else stays Brazilian Portuguese, the product default.
 */
export function resolveRequestLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined
): ChatLocale {
  return normalizeChatLocale(cookieValue) ?? localeFromAcceptLanguage(acceptLanguage);
}

export function localeFromAcceptLanguage(
  header: string | null | undefined
): ChatLocale {
  if (!header) return "pt-BR";

  const ranked = header
    .split(",")
    .map((part, index) => parseLanguage(part, index))
    .filter((item): item is RankedLanguage => item != null && item.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const item of ranked) {
    const locale = matchLanguage(item.tag);
    if (locale) return locale;
  }
  return "pt-BR";
}

export function writeLocaleCookie(locale: ChatLocale): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${YEAR_SECONDS}; SameSite=Lax${secure}`;
}

/**
 * Copies a language saved before the cookie existed. It does not change the
 * page already sent: the next request is the one that renders that choice.
 */
export function getLocaleCookieBootstrapScript(): string {
  const guest = JSON.stringify(guestLocaleKey());
  return `(function(){try{var n=${JSON.stringify(LOCALE_COOKIE)};var parts=document.cookie.split("; ");for(var i=0;i<parts.length;i++){if(parts[i].indexOf(n+"=")===0)return;}var guest=${guest};var ranked=[];for(var j=0;j<localStorage.length;j++){var key=localStorage.key(j);if(key&&key.indexOf(${JSON.stringify(LEGACY_PREFIX)})===0&&key!==guest)ranked.push(key);}ranked.push(guest);var found=null;for(var k=0;k<ranked.length;k++){var raw=(localStorage.getItem(ranked[k])||"").trim().toLowerCase();if(raw==="en"||raw==="en-us"){found="en";break;}if(raw==="pt"||raw==="pt-br"){found="pt-BR";break;}}if(!found)return;var secure=location.protocol==="https:"?"; Secure":"";document.cookie=n+"="+found+"; Path=/; Max-Age=${YEAR_SECONDS}; SameSite=Lax"+secure;}catch(e){}})();`;
}

/** Keep the old localStorage keys in step with the cookie. */
export function persistLocaleChoice(locale: ChatLocale, userId?: string): void {
  writeLocaleCookie(locale);
  if (typeof window === "undefined") return;
  try {
    const keys = new Set<string>([guestLocaleKey()]);
    if (userId) keys.add(workspaceLocaleKey(userId));
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(LEGACY_PREFIX)) keys.add(key);
    }
    for (const key of keys) window.localStorage.setItem(key, locale);
  } catch {
    // Private mode can block storage. The cookie still carries the choice.
  }
}

type RankedLanguage = { tag: string; q: number; index: number };

function parseLanguage(part: string, index: number): RankedLanguage | null {
  const [tagRaw, ...params] = part.trim().split(";");
  const tag = tagRaw?.trim().toLowerCase() ?? "";
  if (!tag || tag === "*") return null;
  let q = 1;
  for (const param of params) {
    const [key, value] = param.trim().split("=");
    if (key?.trim() !== "q") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) q = parsed;
  }
  return { tag, q, index };
}

function matchLanguage(tag: string): ChatLocale | null {
  const base = tag.split("-")[0];
  if (base === "en") return "en";
  if (base === "pt") return "pt-BR";
  return null;
}
