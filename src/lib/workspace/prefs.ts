export const WORKSPACE_PANEL_IDS = [
  "context",
  "analytics",
  "chat",
] as const;

export type WorkspacePanelId = (typeof WORKSPACE_PANEL_IDS)[number];

export type CollapsiblePanelId = Exclude<WorkspacePanelId, "chat">;

export const COLLAPSIBLE_PANEL_IDS: readonly CollapsiblePanelId[] = ["context", "analytics"];

export type WorkspaceTab = "traffic" | "seo" | "geo";

export type WorkspaceMode = "project" | "repository";

export type MobileColumn = CollapsiblePanelId;

export type WorkspacePrefs = {
  open: Record<CollapsiblePanelId, boolean>;
  layout: Record<WorkspacePanelId, number> | null;
  tab: WorkspaceTab;
  mode: WorkspaceMode;
  mobileColumn: MobileColumn;
  projectId: string | null;
  repositoryId: string | null;
};

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  open: { context: true, analytics: true },
  layout: null,
  tab: "traffic",
  mode: "project",
  mobileColumn: "analytics",
  projectId: null,
  repositoryId: null,
};

const TABS = new Set<WorkspaceTab>(["traffic", "seo", "geo"]);
const MOBILE = new Set<MobileColumn>(["context", "analytics"]);

export function workspacePrefsKey(userId: string): string {
  return `ha-workspace:${userId}`;
}

export function workspaceLocaleKey(userId: string): string {
  return `ha-locale:${userId}`;
}

/** Language chosen on the login screen, before a user id exists. */
export function guestLocaleKey(): string {
  return "ha-locale:guest";
}

function defaults(): WorkspacePrefs {
  return { ...DEFAULT_WORKSPACE_PREFS, open: { ...DEFAULT_WORKSPACE_PREFS.open } };
}

function readId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function parseWorkspacePrefs(raw: string | null): WorkspacePrefs {
  if (!raw) return defaults();

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return defaults();
  }

  if (!value || typeof value !== "object") return defaults();

  const record = value as Record<string, unknown>;
  const openRecord =
    record.open && typeof record.open === "object"
      ? (record.open as Record<string, unknown>)
      : {};

  return {
    open: {
      context: openRecord.context !== false,
      analytics: openRecord.analytics !== false,
    },
    layout: parseLayout(record.layout),
    tab: typeof record.tab === "string" && TABS.has(record.tab as WorkspaceTab)
      ? (record.tab as WorkspaceTab)
      : "traffic",
    mode: record.mode === "repository" ? "repository" : "project",
    mobileColumn:
      typeof record.mobileColumn === "string" &&
      MOBILE.has(record.mobileColumn as MobileColumn)
        ? (record.mobileColumn as MobileColumn)
        : "analytics",
    projectId: readId(record.projectId),
    repositoryId: readId(record.repositoryId),
  };
}

function parseLayout(value: unknown): WorkspacePrefs["layout"] {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const ids = Object.keys(record);
  if (ids.length !== WORKSPACE_PANEL_IDS.length) return null;
  const layout = {} as Record<WorkspacePanelId, number>;
  for (const id of WORKSPACE_PANEL_IDS) {
    const size = record[id];
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
      return null;
    }
    layout[id] = size;
  }
  return layout;
}

export function readWorkspacePrefs(storage: Storage, userId: string): WorkspacePrefs {
  try {
    return parseWorkspacePrefs(storage.getItem(workspacePrefsKey(userId)));
  } catch {
    return parseWorkspacePrefs(null);
  }
}

export function writeWorkspacePrefs(
  storage: Storage,
  userId: string,
  prefs: WorkspacePrefs
): void {
  storage.setItem(workspacePrefsKey(userId), JSON.stringify(prefs));
}
