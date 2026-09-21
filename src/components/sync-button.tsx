"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncButtonProps = {
  fixtureEnabled: boolean;
};

export function SyncButton({ fixtureEnabled }: SyncButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runSync(fixture: boolean) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/sync/ga4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7, fixture }),
      });
      const payload = (await response.json()) as {
        error?: string;
        counts?: {
          daily: number;
          pages: number;
          events: number;
          trafficSources: number;
        };
      };
      if (!response.ok) {
        throw new Error(payload.error || "Sync failed");
      }
      setMessage(
        `Synced ${payload.counts?.daily ?? 0} daily rows, ${payload.counts?.pages ?? 0} pages, ${payload.counts?.events ?? 0} events.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3 md:items-end">
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => runSync(false)}
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {pending ? "Syncing…" : "Sync last 7 days"}
        </button>
        {fixtureEnabled ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => runSync(true)}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
          >
            Load sample fixture
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      ) : null}
    </div>
  );
}
