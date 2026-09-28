"use client";

import { useEffect, useId, useRef } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { workspaceText } from "@/lib/i18n/workspace-copy";

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Largura da sidebar, para ancorar o painel ao lado. */
  sidebarCollapsed: boolean;
};

export function SettingsPanel({
  open,
  onClose,
  sidebarCollapsed,
}: SettingsPanelProps) {
  const { locale } = useLocale();
  const text = (key: Parameters<typeof workspaceText>[1]) => workspaceText(locale, key);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button, select")?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/20"
        aria-label={text("closeSettings")}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-no-collapse-toggle
        className={`absolute top-16 z-10 w-[min(calc(100vw-1.5rem),22rem)] rounded-xl border border-border bg-surface shadow-xl shadow-black/15 transition-[left] duration-200 ease-out ${
          sidebarCollapsed
            ? "left-3 sm:left-[5.25rem]"
            : "left-3 sm:left-[17rem]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2
            id={titleId}
            className="font-display text-base font-semibold text-foreground"
          >
            {text("settings")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2.5 py-1 text-sm text-muted transition-colors hover:bg-[#f1f1f1] hover:text-foreground"
            aria-label={text("close")}
          >
            {text("close")}
          </button>
        </div>

        <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-4">
          <AppearanceSettings compact />
        </div>
      </div>
    </div>
  );
}
