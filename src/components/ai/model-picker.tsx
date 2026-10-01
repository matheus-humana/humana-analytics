"use client";

import { useEffect, useRef, useState } from "react";

import { ProviderIcon } from "@/components/ai/provider-icon";
import { IconCheck, IconChevron } from "@/components/workspace/icons";
import type { ProviderId } from "@/lib/ai/analytics-bot-contract";
import { modelDisplayName, PROVIDER_HOSTS } from "@/lib/ai/model-label";

export type ChatModel = {
  provider: ProviderId;
  model: string;
  configured: boolean;
  role: "primary" | "fallback" | null;
};

export function ModelPicker({
  models,
  value,
  onChange,
  disabled = false,
  label,
  missingKeyLabel,
}: {
  models: ChatModel[];
  value: ProviderId | null;
  onChange: (provider: ProviderId) => void;
  disabled?: boolean;
  label: string;
  missingKeyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = models.find((item) => item.provider === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!current) return null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${modelDisplayName(current.model)}`}
        className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
      >
        <ProviderIcon provider={current.provider} className="size-3.5 shrink-0" />
        <span className="truncate">{modelDisplayName(current.model)}</span>
        <IconChevron direction="down" className="h-3 w-3 shrink-0" />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute bottom-full right-0 z-20 mb-2 w-64 rounded-xl border border-border bg-surface p-1 shadow-lg shadow-black/10"
        >
          {models.map((item) => {
            const selected = item.provider === value;
            return (
              <li key={item.provider}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={!item.configured}
                  onClick={() => {
                    onChange(item.provider);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ProviderIcon provider={item.provider} className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {modelDisplayName(item.model)}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {item.configured ? PROVIDER_HOSTS[item.provider] : missingKeyLabel}
                    </span>
                  </span>
                  {selected ? <IconCheck className="h-4 w-4 shrink-0 text-accent" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
