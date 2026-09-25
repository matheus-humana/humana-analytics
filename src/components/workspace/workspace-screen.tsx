"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { signOutAction } from "@/lib/auth/sign-out-action";
import {
  normalizeChatLocale,
  type ChatLocale,
} from "@/lib/ai/analytics-bot-contract";
import { workspaceText } from "@/lib/i18n/workspace-copy";
import type { WorkspaceModel } from "@/lib/workspace/load-workspace";
import {
  useIsClient,
  useLocalString,
  useMediaQuery,
  writeLocalString,
} from "@/lib/workspace/browser-store";
import {
  parseWorkspacePrefs,
  workspaceLocaleKey,
  workspacePrefsKey,
  type WorkspacePrefs,
} from "@/lib/workspace/prefs";
import {
  buildStatusLog,
  type ChatSignal,
} from "@/lib/workspace/status-log";

import { IconChevron } from "./icons";
import { WorkspacePanels } from "./workspace-panels";
import type { GithubPanelData } from "@/lib/github/types";

import type { TrafficSummary } from "./workspace-traffic";

type Props = {
  userId: string;
  userName: string;
  model: WorkspaceModel;
  trafficSummary: TrafficSummary | null;
  traffic: React.ReactNode;
  github: GithubPanelData;
};

export function WorkspaceScreen({
  userId,
  userName,
  model,
  trafficSummary,
  traffic,
  github,
}: Props) {
  const storedLocale = useLocalString(workspaceLocaleKey(userId));
  const locale = normalizeChatLocale(storedLocale) ?? "pt-BR";
  const storedPrefs = useLocalString(workspacePrefsKey(userId));
  const prefs = parseWorkspacePrefs(storedPrefs);
  const mobile = useMediaQuery("(max-width: 1023px)");
  const client = useIsClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [sessionSignals, setSessionSignals] = useState<ChatSignal[]>([]);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "pt-BR";
  }, [locale]);

  function updatePrefs(partial: Partial<WorkspacePrefs>) {
    const next = { ...prefs, ...partial, open: partial.open ?? prefs.open };
    try {
      writeLocalString(workspacePrefsKey(userId), JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function setLocale(next: ChatLocale) {
    try {
      writeLocalString(workspaceLocaleKey(userId), next);
    } catch {
      // ignore
    }
  }

  const text = (key: Parameters<typeof workspaceText>[1]) =>
    workspaceText(locale, key);
  const selectedProject = resolveProject(model, prefs?.projectId ?? null);
  const foreignProject = Boolean(
    selectedProject &&
      model.currentProjectId &&
      selectedProject.id !== model.currentProjectId
  );
  const status = buildStatusLog(
    model.connections,
    [...model.chatSignals, ...sessionSignals],
    locale
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <Link
          href="/dashboard"
          className="hidden shrink-0 font-display text-sm font-semibold tracking-tight text-foreground sm:inline"
        >
          Humana
        </Link>
        <ProjectSelect
          locale={locale}
          projects={model.projects}
          value={selectedProject?.id ?? ""}
          onChange={(projectId) => updatePrefs({ projectId })}
        />
        <StatusLog
          label={text("statusLog")}
          empty={text("statusLogEmpty")}
          line={status.line}
          items={status.items}
          open={statusOpen}
          onToggle={() => {
            setMenuOpen(false);
            setStatusOpen((value) => !value);
          }}
          expandLabel={text("expandStatusLog")}
          collapseLabel={text("collapseStatusLog")}
        />
        <UserMenu
          locale={locale}
          userName={userName}
          open={menuOpen}
          onToggle={() => {
            setStatusOpen(false);
            setMenuOpen((value) => !value);
          }}
          onLocale={setLocale}
          text={text}
        />
      </header>

      <div className="min-h-0 flex-1">
        {client ? (
          <WorkspacePanels
            userId={userId}
            locale={locale}
            mobile={mobile}
            prefs={prefs}
            onPrefs={updatePrefs}
            project={selectedProject}
            foreignProject={foreignProject}
            connections={model.connections}
            traffic={traffic}
            trafficSummary={trafficSummary}
            github={github}
            mobileChatOpen={mobileChatOpen}
            onMobileChatOpen={setMobileChatOpen}
            onChatActivity={(signal) =>
              setSessionSignals((current) => [...current, signal])
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function resolveProject(model: WorkspaceModel, projectId: string | null) {
  if (projectId) {
    const match = model.projects.find((project) => project.id === projectId);
    if (match) return match;
  }
  return (
    model.projects.find((project) => project.id === model.currentProjectId) ??
    model.projects[0] ??
    null
  );
}

function ProjectSelect({
  locale,
  projects,
  value,
  onChange,
}: {
  locale: ChatLocale;
  projects: WorkspaceModel["projects"];
  value: string;
  onChange: (projectId: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <p className="shrink-0 text-sm text-muted">
        {workspaceText(locale, "projectUnavailable")}
      </p>
    );
  }

  return (
    <label className="shrink-0">
      <span className="sr-only">{workspaceText(locale, "project")}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[12rem] rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm font-medium text-foreground sm:max-w-[16rem]"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusLog({
  label,
  empty,
  line,
  items,
  open,
  onToggle,
  expandLabel,
  collapseLabel,
}: {
  label: string;
  empty: string;
  line: string | null;
  items: Array<{ id: string; text: string }>;
  open: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? collapseLabel : expandLabel}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted hover:bg-[#f1f1f1] hover:text-foreground"
      >
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
        <span className="min-w-0 flex-1 truncate text-foreground/80">
          {line ?? empty}
        </span>
        <IconChevron direction="down" className={`h-4 w-4 shrink-0 ${open ? "-rotate-90" : ""}`} />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-[#f8f8f8] p-3 shadow-lg shadow-black/10">
          {items.length === 0 ? (
            <p className="font-mono text-xs text-muted">{empty}</p>
          ) : (
            <ol className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="font-mono text-xs text-foreground">
                  {item.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({
  locale,
  userName,
  open,
  onToggle,
  onLocale,
  text,
}: {
  locale: ChatLocale;
  userName: string;
  open: boolean;
  onToggle: () => void;
  onLocale: (locale: ChatLocale) => void;
  text: (key: Parameters<typeof workspaceText>[1]) => string;
}) {
  const menuId = useId();
  const initial = userName.trim().charAt(0).toUpperCase() || "H";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={text("userMenu")}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-[#f1f1f1]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate text-sm text-foreground sm:block">
          {userName}
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg shadow-black/10"
        >
          <p className="truncate px-1 text-sm font-medium text-foreground">{userName}</p>
          <div className="mt-3 px-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {text("language")}
            </p>
            <div className="mt-1 flex gap-1">
              <LocaleButton
                active={locale === "pt-BR"}
                onClick={() => onLocale("pt-BR")}
              >
                {text("languagePt")}
              </LocaleButton>
              <LocaleButton
                active={locale === "en"}
                onClick={() => onLocale("en")}
              >
                {text("languageEn")}
              </LocaleButton>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
            <Link
              href="/data-sources"
              className="rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-[#f1f1f1]"
            >
              {text("dataSources")}
            </Link>
            <Link
              href="/ask-ai"
              className="rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-[#f1f1f1]"
            >
              {text("fullChat")}
            </Link>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <AppearanceSettings compact />
          </div>
          <form action={signOutAction} className="mt-3 border-t border-border pt-3">
            <button
              type="submit"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-[#f1f1f1]"
            >
              {text("signOut")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function LocaleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
        active ? "bg-accent text-white" : "border border-border text-muted"
      }`}
    >
      {children}
    </button>
  );
}
