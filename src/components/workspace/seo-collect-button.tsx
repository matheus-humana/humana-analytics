"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SeoCollectButton({
  label,
  pendingLabel,
  doneLabel,
  failedLabel,
}: {
  label: string;
  pendingLabel: string;
  doneLabel: string;
  failedLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function collect() {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/seo/collect", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) {
        setFeedback(data.error || failedLabel);
      } else {
        setFeedback(doneLabel);
        router.refresh();
      }
    } catch {
      setFeedback(failedLabel);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void collect()}
        disabled={pending}
        className="rounded-lg bg-accent px-3 py-1.5 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? pendingLabel : label}
      </button>
      {feedback ? <p className="text-xs leading-relaxed text-muted">{feedback}</p> : null}
    </div>
  );
}
