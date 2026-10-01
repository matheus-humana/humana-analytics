"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import {
  SettingsDialog,
  type SettingsTab,
} from "@/components/settings/settings-dialog";
import { Dropdown } from "@/components/ui/dropdown";
import { signOutAction } from "@/lib/auth/sign-out-action";
import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { workspaceText } from "@/lib/i18n/workspace-copy";
import type {
  WorkspaceModel,
  WorkspaceProject,
} from "@/lib/workspace/load-workspace";
import {
  useIsClient,
  useLocalString,
  useMediaQuery,
  writeLocalString,
} from "@/lib/workspace/browser-store";
import {
  parseWorkspacePrefs,
  workspacePrefsKey,
  type WorkspaceMode,
  type WorkspacePrefs,
} from "@/lib/workspace/prefs";
import {
  buildStatusLog,
  type ChatSignal,
} from "@/lib/workspace/status-log";

import { IconSettings } from "./icons";
import { WorkspacePanels } from "./workspace-panels";
import type { GithubPanelData } from "@/lib/github/types";
import type { SeoWorkspace } from "@/lib/seo/view";

import type { TrafficSummary } from "./workspace-traffic";

type Props = {
  userId: string;
  userName: string;
  userEmail: string | null;
  model: WorkspaceModel;
  trafficSummary: TrafficSummary | null;
  traffic: React.ReactNode;
  github: GithubPanelData;
  seo: SeoWorkspace;
  chatEnabled: boolean;
};

export function WorkspaceScreen({
  userId,
  userName,
  userEmail,
  model,
  trafficSummary,
  traffic,
  github,
  seo,
  chatEnabled,
}: Props) {
  const { locale, setLocale: setSharedLocale } = useLocale();
  const storedPrefs = useLocalString(workspacePrefsKey(userId));
  const prefs = parseWorkspacePrefs(storedPrefs);
  const mobile = useMediaQuery("(max-width: 1023px)");
  const client = useIsClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [sessionSignals, setSessionSignals] = useState<ChatSignal[]>([]);

  function updatePrefs(partial: Partial<WorkspacePrefs>) {
    const next = { ...prefs, ...partial, open: partial.open ?? prefs.open };
    try {
      writeLocalString(workspacePrefsKey(userId), JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function setLocale(next: ChatLocale) {
    setSharedLocale(next, userId);
  }

  const text = (key: Parameters<typeof workspaceText>[1]) =>
    workspaceText(locale, key);
  const projects = model.projects.filter((project) => project.kind === "project");
  const repositories = model.projects.filter((project) => project.kind === "repository");
  const selectedProject = resolveProject(projects, model.currentProjectId, prefs.projectId);
  const selectedRepository =
    repositories.find((project) => project.id === prefs.repositoryId) ??
    repositories[0] ??
    null;
  const repositoryMode = prefs.mode === "repository";
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
        <Link href="/dashboard" className="shrink-0" aria-label="Humana">
          <Image
            src="/brand/logo-preto-humana.png"
            alt="Humana"
            width={1223}
            height={315}
            loading="eager"
            className="h-7 w-auto"
          />
        </Link>
        <ModeSwitch
          value={prefs.mode}
          onChange={(mode) => updatePrefs({ mode })}
          text={text}
        />
        {repositoryMode ? (
          <ProjectSelect
            label={text("modeRepository")}
            empty={text("repositoryUnavailable")}
            projects={repositories}
            value={selectedRepository?.id ?? ""}
            onChange={(repositoryId) => updatePrefs({ repositoryId })}
            labelFor={(project) => project.repo ?? project.name}
            shortLabelFor={(project) => project.repo?.split("/").pop() ?? project.name}
          />
        ) : (
          <ProjectSelect
            label={text("project")}
            empty={text("projectUnavailable")}
            projects={projects}
            value={selectedProject?.id ?? ""}
            onChange={(projectId) => updatePrefs({ projectId })}
            labelFor={(project) => project.name}
          />
        )}
        <div className="min-w-0 flex-1" />
        <UserMenu
          userName={userName}
          userEmail={userEmail}
          open={menuOpen}
          onToggle={() => setMenuOpen((value) => !value)}
          onSettings={() => {
            setMenuOpen(false);
            setSettingsTab("appearance");
            setSettingsOpen(true);
          }}
          text={text}
        />
      </header>
      <SettingsDialog
        open={settingsOpen}
        tab={settingsTab}
        onTab={setSettingsTab}
        onClose={() => setSettingsOpen(false)}
        locale={locale}
        onLocale={setLocale}
        connections={model.connections}
        activity={status.items}
      />

      <div className="min-h-0 flex-1">
        {client ? (
          <WorkspacePanels
            userId={userId}
            locale={locale}
            mobile={mobile}
            prefs={prefs}
            onPrefs={updatePrefs}
            repository={selectedRepository}
            foreignProject={foreignProject}
            traffic={traffic}
            trafficSummary={trafficSummary}
            github={github}
            seo={seo}
            chatEnabled={chatEnabled}
            chatProjectId={
              (repositoryMode ? selectedRepository?.id : selectedProject?.id) ?? null
            }
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

function resolveProject(
  projects: WorkspaceProject[],
  currentProjectId: string | null,
  projectId: string | null
) {
  if (projectId) {
    const match = projects.find((project) => project.id === projectId);
    if (match) return match;
  }
  return projects.find((project) => project.id === currentProjectId) ?? projects[0] ?? null;
}

function ModeSwitch({
  value,
  onChange,
  text,
}: {
  value: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  text: (key: Parameters<typeof workspaceText>[1]) => string;
}) {
  const modes: Array<{ id: WorkspaceMode; label: string }> = [
    { id: "project", label: text("modeProject") },
    { id: "repository", label: text("modeRepository") },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={text("workspaceMode")}
      className="inline-flex shrink-0 rounded-full bg-secondary p-0.5"
    >
      {modes.map((mode) => {
        const selected = mode.id === value;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selected ? "ha-primary" : "text-muted hover:text-foreground"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

function ProjectSelect({
  label,
  empty,
  projects,
  value,
  onChange,
  labelFor,
  shortLabelFor,
}: {
  label: string;
  empty: string;
  projects: WorkspaceProject[];
  value: string;
  onChange: (projectId: string) => void;
  labelFor: (project: WorkspaceProject) => string;
  shortLabelFor?: (project: WorkspaceProject) => string;
}) {
  if (projects.length === 0) {
    return <p className="shrink-0 text-sm text-muted">{empty}</p>;
  }

  return (
    <Dropdown
      value={value}
      onChange={onChange}
      ariaLabel={label}
      size="sm"
      className="w-[10rem] shrink-0 font-medium sm:w-[16rem]"
      options={projects.map((project) => ({
        value: project.id,
        label: labelFor(project),
        shortLabel: shortLabelFor?.(project),
      }))}
    />
  );
}

function UserMenu({
  userName,
  userEmail,
  open,
  onToggle,
  onSettings,
  text,
}: {
  userName: string;
  userEmail: string | null;
  open: boolean;
  onToggle: () => void;
  onSettings: () => void;
  text: (key: Parameters<typeof workspaceText>[1]) => string;
}) {
  const menuId = useId();
  const initial = userName.trim().charAt(0).toUpperCase() || "H";
  const shortName = userName.trim().split(/\s+/).slice(0, 2).join(" ");

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={text("userMenu")}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-secondary"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-sm font-medium text-white">
          {initial}
        </span>
        <span className="hidden whitespace-nowrap text-sm text-foreground sm:block">
          {shortName}
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 top-full z-40 mt-1 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg shadow-black/10"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-foreground" title={userName}>
              {userName}
            </p>
            {userEmail ? (
              <p className="truncate text-xs text-muted" title={userEmail}>
                {userEmail}
              </p>
            ) : null}
          </div>
          <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1">
            <button
              type="button"
              onClick={onSettings}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-secondary"
            >
              <IconSettings className="h-4 w-4 text-muted" />
              {text("settings")}
            </button>
          </div>
          <form action={signOutAction} className="mt-1 border-t border-border pt-1">
            <button
              type="submit"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-secondary"
            >
              {text("signOut")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
