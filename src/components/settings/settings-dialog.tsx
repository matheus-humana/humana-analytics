"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { AccentPicker } from "@/components/settings/appearance-settings";
import { Disclosure } from "@/components/ui/disclosure";
import { Dropdown } from "@/components/ui/dropdown";
import { IconClose } from "@/components/workspace/icons";
import { ProviderIcon } from "@/components/workspace/provider-icons";
import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import {
  describeConnection,
  type ConnectionProvider,
  type ConnectionSnapshot,
  type StatusItem,
} from "@/lib/workspace/status-log";

export type SettingsTab = "appearance" | "connections";

type Props = {
  open: boolean;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onClose: () => void;
  locale: ChatLocale;
  onLocale: (locale: ChatLocale) => void;
  connections: ConnectionSnapshot[];
  activity: StatusItem[];
};

const PROVIDERS: Record<
  ConnectionProvider,
  { name: string; description: Record<ChatLocale, string> }
> = {
  ga4: {
    name: "Google Analytics 4",
    description: {
      "pt-BR": "Visitantes, páginas mais vistas e conversões do site.",
      en: "Visitors, top pages, and site conversions.",
    },
  },
  clarity: {
    name: "Microsoft Clarity",
    description: {
      "pt-BR": "Comportamento na página: rolagem, cliques e pontos de atrito.",
      en: "On-page behavior: scrolling, clicks, and friction points.",
    },
  },
  vercel: {
    name: "Vercel Analytics",
    description: {
      "pt-BR": "Visitantes, pageviews, países e origens do tráfego.",
      en: "Visitors, pageviews, countries, and traffic sources.",
    },
  },
  github: {
    name: "GitHub",
    description: {
      "pt-BR": "Views, clones, estrelas e downloads do repositório.",
      en: "Repository views, clones, stars, and downloads.",
    },
  },
  pagespeed: {
    name: "PageSpeed Insights",
    description: {
      "pt-BR": "Notas de desempenho, acessibilidade e SEO das páginas.",
      en: "Performance, accessibility, and SEO scores for pages.",
    },
  },
  crawl: {
    name: "Varredura do site",
    description: {
      "pt-BR": "Leitura das páginas do site para os achados de SEO e a nota GEO.",
      en: "Reads the site's pages for SEO findings and the GEO score.",
    },
  },
};

export function SettingsDialog({
  open,
  tab,
  onTab,
  onClose,
  locale,
  onLocale,
  connections,
  activity,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);

  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") onClose();
  });

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "appearance", label: text("settingsAppearance") },
    { id: "connections", label: text("connections") },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-xl shadow-black/10"
      >
        <header className="flex items-start justify-between gap-3 px-6 pt-5">
          <h2 id={titleId} className="font-display text-lg font-semibold text-foreground">
            {text("settings")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={text("close")}
            className="rounded-md p-1 text-muted transition-colors hover:bg-secondary hover:text-foreground"
          >
            <IconClose />
          </button>
        </header>

        <div className="mt-3 flex gap-5 border-b border-border px-6" role="tablist">
          {tabs.map((item) => {
            const selected = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTab(item.id)}
                className={`-mb-px border-b-2 pb-2 text-sm font-medium transition-colors ${
                  selected
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {tab === "appearance" ? (
            <AppearanceTab locale={locale} onLocale={onLocale} text={text} />
          ) : (
            <ConnectionsTab
              locale={locale}
              connections={connections}
              activity={activity}
              text={text}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function AppearanceTab({
  locale,
  onLocale,
  text,
}: {
  locale: ChatLocale;
  onLocale: (locale: ChatLocale) => void;
  text: (key: WorkspaceMessageKey) => string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">{text("language")}</p>
        <Dropdown<ChatLocale>
          value={locale}
          onChange={onLocale}
          ariaLabel={text("language")}
          className="w-full"
          options={[
            { value: "pt-BR", label: text("languagePt") },
            { value: "en", label: text("languageEn") },
          ]}
        />
      </div>
      <AccentPicker label={text("accentColor")} previewLabel={text("accentPreview")} />
      <p className="text-xs text-muted">{text("settingsAppearanceHint")}</p>
    </div>
  );
}

function ConnectionsTab({
  locale,
  connections,
  activity,
  text,
}: {
  locale: ChatLocale;
  connections: ConnectionSnapshot[];
  activity: StatusItem[];
  text: (key: WorkspaceMessageKey) => string;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{text("connectionsIntro")}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {connections.map((connection) => (
          <ConnectionCard
            key={connection.provider}
            connection={connection}
            locale={locale}
            text={text}
          />
        ))}
      </ul>

      {activity.length > 0 ? (
        <Disclosure title={text("recentActivity")}>
          <ol className="space-y-1.5">
            {activity.map((item) => (
              <li key={item.id} className="text-xs text-foreground">
                {item.text}
              </li>
            ))}
          </ol>
        </Disclosure>
      ) : null}

      <Link
        href="/data-sources"
        className="inline-block text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        {text("manageConnectionsAdvanced")}
      </Link>
    </div>
  );
}

function ConnectionCard({
  connection,
  locale,
  text,
}: {
  connection: ConnectionSnapshot;
  locale: ChatLocale;
  text: (key: WorkspaceMessageKey) => string;
}) {
  const info = PROVIDERS[connection.provider];
  const error = connection.status === "error";
  const on = connection.connected && !error;
  const state = error
    ? text("statusError")
    : on
      ? text("statusConnected")
      : text("statusDisconnected");

  return (
    <li className="flex flex-col rounded-xl border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
          <ProviderIcon provider={connection.provider} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">{info.name}</p>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                on
                  ? "bg-positive-bg text-positive"
                  : error
                    ? "bg-negative-bg text-negative"
                    : "bg-secondary text-muted"
              }`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  on ? "bg-status-on" : error ? "bg-negative" : "bg-border"
                }`}
              />
              {state}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{info.description[locale]}</p>
        </div>
      </div>
      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-xs text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
          {text("connectionDetails")}
        </summary>
        <p className="mt-1 break-words text-xs text-foreground">
          {describeConnection(connection, locale)}
        </p>
      </details>
    </li>
  );
}
