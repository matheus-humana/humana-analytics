export type ConversationGroupKey = "today" | "yesterday" | "week" | "month" | "older";

const GROUP_ORDER: ConversationGroupKey[] = ["today", "yesterday", "week", "month", "older"];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function conversationGroupKey(updatedAt: string, now: Date): ConversationGroupKey {
  const time = new Date(updatedAt).getTime();
  if (!Number.isFinite(time)) return "older";
  const days = Math.floor((startOfDay(now) - startOfDay(new Date(time))) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return "week";
  if (days < 30) return "month";
  return "older";
}

/** Groups conversations by last update, newest first, skipping empty groups. */
export function groupConversationsByDate<T extends { updatedAt: string }>(
  conversations: T[],
  now: Date = new Date()
): { key: ConversationGroupKey; items: T[] }[] {
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return GROUP_ORDER.map((key) => ({
    key,
    items: sorted.filter((item) => conversationGroupKey(item.updatedAt, now) === key),
  })).filter((group) => group.items.length > 0);
}
