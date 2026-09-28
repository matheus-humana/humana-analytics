import { cookies, headers } from "next/headers";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";

import { LOCALE_COOKIE, resolveRequestLocale } from "./locale";

/** Language for this request: saved cookie, then the browser's Accept-Language. */
export async function getRequestLocale(): Promise<ChatLocale> {
  const [jar, headerList] = await Promise.all([cookies(), headers()]);
  return resolveRequestLocale(jar.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
}
