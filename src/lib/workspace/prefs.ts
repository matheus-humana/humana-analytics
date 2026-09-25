export const WORKSPACE_PANEL_IDS = [
  "context",
  "analytics",
  "actions",
  "chat",
] as const;

export type WorkspacePanelId = (typeof WORKSPACE_PANEL_IDS)[number];

export type CollapsiblePanelId = Exclude<WorkspacePanelId, "chat">;

export type WorkspaceTab = "traffic" | "seo" | "geo" | "github";

export type MobileColumn = CollapsiblePanelId;

export type WorkspacePrefs = {
  open: Record<CollapsiblePanelId, boolean>;
  layout: Record<WorkspacePanelId, number> | null;
  tab: WorkspaceTab;
  mobileColumn: MobileColumn;
  projectId: string | null;
};

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  open: { context: true, analytics: true, actions: true },
  layout: null,
  tab: "traffic",
  mobileColumn: "analytics",
  projectId: null,
};

const TABS = new Set<WorkspaceTab>(["traffic", "seo", "geo", "github"]);
const MOBILE = new Set<MobileColumn>(["context", "analytics", "actions"]);

export function workspacePrefsKey(userId: string): string {
  return `ha-workspace:${userId}`;
}

export function workspaceLocaleKey(userId: string): string {
  return `ha-locale:${userId}`;
}

export function parseWorkspacePrefs(raw: string | null): WorkspacePrefs {
  if (!raw) return { ...DEFAULT_WORKSPACE_PREFS, open: { ...DEFAULT_WORKSPACE_PREFS.open } };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_WORKSPACE_PREFS, open: { ...DEFAULT_WORKSPACE_PREFS.open } };
  }

  if (!value || typeof value !== "object") {
    return { ...DEFAULT_WORKSPACE_PREFS, open: { ...DEFAULT_WORKSPACE_PREFS.open } };
  }

  const record = value as Record<string, unknown>;
  const openRecord =
    record.open && typeof record.open === "object"
      ? (record.open as Record<string, unknown>)
      : {};

  return {
    open: {
      context: openRecord.context !== false,
      analytics: openRecord.analytics !== false,
      actions: openRecord.actions !== false,
    },
    layout: parseLayout(record.layout),
    tab: typeof record.tab === "string" && TABS.has(record.tab as WorkspaceTab)
      ? (record.tab as WorkspaceTab)
      : "traffic",
    mobileColumn:
      typeof record.mobileColumn === "string" &&
      MOBILE.has(record.mobileColumn as MobileColumn)
        ? (record.mobileColumn as MobileColumn)
        : "analytics",
    projectId:
      typeof record.projectId === "string" && record.projectId.trim()
        ? record.projectId
        : null,
  };
}

function parseLayout(value: unknown): WorkspacePrefs["layout"] {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
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
