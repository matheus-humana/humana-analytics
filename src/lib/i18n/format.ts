import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";

export function intlLocale(locale: ChatLocale): "pt-BR" | "en-US" {
  return locale === "en" ? "en-US" : "pt-BR";
}

export function formatCount(value: number, locale: ChatLocale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatDecimal(
  value: number,
  locale: ChatLocale,
  digits = 2
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** `rate` is a 0–1 fraction, as GA4 returns bounce rate. */
export function formatRatePercent(rate: number, locale: ChatLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rate);
}

export function formatShare(value: number, total: number, locale: ChatLocale): string {
  const share = total <= 0 ? 0 : Math.round((value / total) * 1000) / 10;
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(share);
}

export function formatSigned(value: number, locale: ChatLocale, digits = 1): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(value);
}

/** Calendar day from `YYYY-MM-DD` or `YYYYMMDD`, without shifting the date. */
export function formatWeekdayShort(day: string, locale: ChatLocale): string {
  const date = calendarDate(day);
  if (!date) return day;
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" }).format(date);
}

export function formatCalendarDay(value: string, locale: ChatLocale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function calendarDate(day: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(day);
  const match = iso ?? compact;
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
