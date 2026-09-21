import type { DateRange } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function diffUtcDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function parseGa4Date(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (ISO_DATE.test(value)) {
    return value;
  }
  throw new Error(`Unexpected GA4 date value "${value}".`);
}

export function resolveDateRange(input: {
  days?: number;
  startDate?: string;
  endDate?: string;
  now?: Date;
}): DateRange {
  if (input.startDate || input.endDate) {
    if (!input.startDate || !input.endDate) {
      throw new Error("Both startDate and endDate are required when one is set.");
    }
    const start = parseIsoDate(input.startDate);
    const end = parseIsoDate(input.endDate);
    if (start.getTime() > end.getTime()) {
      throw new Error("startDate must be on or before endDate.");
    }
    return { startDate: input.startDate, endDate: input.endDate };
  }

  const days = input.days ?? 7;
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new Error("days must be an integer between 1 and 366.");
  }

  const now = input.now ?? new Date();
  const end = addUtcDays(
    new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ),
    -1,
  );
  const start = addUtcDays(end, -(days - 1));
  return { startDate: formatIsoDate(start), endDate: formatIsoDate(end) };
}

export function previousRange(range: DateRange): DateRange {
  const start = parseIsoDate(range.startDate);
  const end = parseIsoDate(range.endDate);
  const length = diffUtcDays(start, end) + 1;
  const previousEnd = addUtcDays(start, -1);
  const previousStart = addUtcDays(previousEnd, -(length - 1));
  return {
    startDate: formatIsoDate(previousStart),
    endDate: formatIsoDate(previousEnd),
  };
}
