"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useGroupRef,
  usePanelRef,
  type Layout,
  type PanelSize,
} from "react-resizable-panels";

import { AskAiPanel } from "@/components/ask-ai/ask-ai-panel";
import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { workspaceText } from "@/lib/i18n/workspace-copy";
import {
  WORKSPACE_PANEL_IDS,
  type CollapsiblePanelId,
  type MobileColumn,
  type WorkspacePrefs,
  type WorkspaceTab,
} from "@/lib/workspace/prefs";
import type { ChatSignal, ConnectionSnapshot } from "@/lib/workspace/status-log";
import type { WorkspaceProject } from "@/lib/workspace/load-workspace";

import {
  ActionsColumn,
  ActionsRail,
  AnalyticsColumn,
  AnalyticsRail,
  ContextColumn,
  ContextRail,
} from "./column-views";
import { IconChat } from "./icons";
import type { TrafficSummary } from "./workspace-traffic";

const COLLAPSED_PX = 48;

type OpenState = WorkspacePrefs["open"];

type Props = {
  userId: string;
  locale: ChatLocale;
  mobile: boolean;
  prefs: WorkspacePrefs;
  onPrefs: (partial: Partial<WorkspacePrefs>) => void;
  project: WorkspaceProject | null;
  foreignProject: boolean;
  connections: ConnectionSnapshot[];
  traffic: React.ReactNode;
  trafficSummary: TrafficSummary | null;
  onChatActivity: (signal: ChatSignal) => void;
  mobileChatOpen: boolean;
  onMobileChatOpen: (open: boolean) => void;
};

export function WorkspacePanels(props: Props) {
  if (props.mobile) {
    return <MobileWorkspace {...props} />;
  }
  return <DesktopWorkspace {...props} />;
}

function DesktopWorkspace({
  userId,
  locale,
  prefs,
  onPrefs,
  project,
  foreignProject,
  connections,
  traffic,
  trafficSummary,
  onChatActivity,
}: Props) {
  const groupRef = useGroupRef();
  const contextRef = usePanelRef();
  const analyticsRef = usePanelRef();
  const actionsRef = usePanelRef();
  const layoutBeforeToggle = useRef<Layout | null>(null);
  const groupElementRef = useRef<HTMLDivElement | null>(null);
  const [groupWidth, setGroupWidth] = useState(1280);

  useEffect(() => {
    const node = groupElementRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setGroupWidth(node.offsetWidth || 1280);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const refs = {
      context: contextRef,
      analytics: analyticsRef,
      actions: actionsRef,
    };
    for (const id of ["context", "analytics", "actions"] as const) {
      const handle = refs[id].current;
      if (!handle) continue;
      if (!prefs.open[id] && !handle.isCollapsed()) handle.collapse();
      if (prefs.open[id] && handle.isCollapsed()) handle.expand();
    }
    // Restore collapsed rails once, after the group has measured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: CollapsiblePanelId) {
    const handle =
      id === "context"
        ? contextRef.current
        : id === "analytics"
          ? analyticsRef.current
          : actionsRef.current;
    const previousOpen = prefs.open;
    const opening = !previousOpen[id];
    layoutBeforeToggle.current = groupRef.current?.getLayout() ?? null;
    if (opening) handle?.expand();
    else handle?.collapse();

    const nextOpen = { ...previousOpen, [id]: opening };
    onPrefs({ open: nextOpen });

    requestAnimationFrame(() => {
      const group = groupRef.current;
      const before = layoutBeforeToggle.current;
      const current = group?.getLayout();
      if (!group || !before || !current) return;
      const balanced = rebalanceLayout(before, current, previousOpen, nextOpen);
      const applied = group.setLayout(balanced);
      if (isCompleteLayout(applied)) onPrefs({ open: nextOpen, layout: applied });
    });
  }

  function onResize(id: CollapsiblePanelId) {
    return (size: PanelSize) => {
      const collapsed = size.inPixels <= COLLAPSED_PX + 8;
      if (prefs.open[id] === !collapsed) return;
      onPrefs({ open: { ...prefs.open, [id]: !collapsed } });
    };
  }

  const text = (key: Parameters<typeof workspaceText>[1]) =>
    workspaceText(locale, key);
  const mins = minimumsFor(groupWidth);

  return (
    <Group
      id={`ha-panels-${userId.replace(/[^A-Za-z0-9_-]/g, "")}`}
      groupRef={groupRef}
      elementRef={groupElementRef}
      orientation="horizontal"
      defaultLayout={prefs.layout ?? undefined}
      className="h-full"
      onLayoutChanged={(layout, meta) => {
        if (!meta.isUserInteraction) return;
        if (!isCompleteLayout(layout)) return;
        onPrefs({ layout });
      }}
    >
      <Panel
        id="context"
        panelRef={contextRef}
        collapsible
        collapsedSize={COLLAPSED_PX}
        collapsedThreshold={140}
        minSize={mins.context}
        onResize={onResize("context")}
        className="h-full bg-surface"
        style={{ overflow: "hidden" }}
      >
        {prefs.open.context ? (
          <ContextColumn
            locale={locale}
            project={project}
            foreign={foreignProject}
            connections={connections}
            onCollapse={() => toggle("context")}
          />
        ) : (
          <ContextRail
            locale={locale}
            connections={foreignProject ? [] : connections}
            onExpand={() => toggle("context")}
          />
        )}
      </Panel>
      <PanelSeparator label={text("resizeColumns")} />
      <Panel
        id="analytics"
        panelRef={analyticsRef}
        collapsible
        collapsedSize={COLLAPSED_PX}
        collapsedThreshold={140}
        minSize={mins.analytics}
        onResize={onResize("analytics")}
        className="h-full bg-surface"
        style={{ overflow: "hidden" }}
      >
        {prefs.open.analytics ? (
          <AnalyticsColumn
            locale={locale}
            tab={prefs.tab}
            onTab={(tab: WorkspaceTab) => onPrefs({ tab })}
            onCollapse={() => toggle("analytics")}
            traffic={traffic}
            blocked={foreignProject}
            blockedTitle={text("otherProjectTitle")}
            blockedBody={text("otherProjectBody")}
          />
        ) : (
          <AnalyticsRail
            locale={locale}
            summary={foreignProject ? null : trafficSummary}
            onExpand={() => toggle("analytics")}
          />
        )}
      </Panel>
      <PanelSeparator label={text("resizeColumns")} />
      <Panel
        id="actions"
        panelRef={actionsRef}
        collapsible
        collapsedSize={COLLAPSED_PX}
        collapsedThreshold={140}
        minSize={mins.actions}
        onResize={onResize("actions")}
        className="h-full bg-surface"
        style={{ overflow: "hidden" }}
      >
        {prefs.open.actions ? (
          <ActionsColumn locale={locale} onCollapse={() => toggle("actions")} />
        ) : (
          <ActionsRail locale={locale} onExpand={() => toggle("actions")} />
        )}
      </Panel>
      <PanelSeparator label={text("resizeColumns")} />
      <Panel
        id="chat"
        minSize={mins.chat}
        className="h-full bg-surface"
        style={{ overflow: "hidden" }}
      >
        <ChatColumn locale={locale} onChatActivity={onChatActivity} />
      </Panel>
    </Group>
  );
}

function minimumsFor(width: number) {
  if (width >= 1280) {
    return { context: 240, analytics: 360, actions: 220, chat: 360 };
  }
  const scale = Math.max(0.62, width / 1280);
  return {
    context: Math.round(240 * scale),
    analytics: Math.max(220, Math.round(360 * scale)),
    actions: Math.round(220 * scale),
    chat: Math.max(220, Math.round(360 * scale)),
  };
}

function PanelSeparator({ label }: { label: string }) {
  return (
    <Separator
      aria-label={label}
      className="w-2 bg-[#f1f1f1] outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/50"
    />
  );
}

function isCompleteLayout(layout: Layout): layout is Record<
  (typeof WORKSPACE_PANEL_IDS)[number],
  number
> {
  return WORKSPACE_PANEL_IDS.every((id) => {
    const value = layout[id];
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
}

function rebalanceLayout(
  before: Layout,
  current: Layout,
  previousOpen: OpenState,
  nextOpen: OpenState
): Layout {
  let collapsedSum = 0;
  for (const id of ["context", "analytics", "actions"] as const) {
    if (nextOpen[id]) continue;
    const measured = current[id] ?? 0;
    collapsedSum += measured > 0 && measured < 12 ? measured : 1;
  }
  const available = Math.max(0, 100 - collapsedSum);
  const openIds = WORKSPACE_PANEL_IDS.filter(
    (id) => id === "chat" || nextOpen[id]
  );
  const newly = openIds.filter(
    (id) => id !== "chat" && !previousOpen[id]
  );
  const staying = openIds.filter((id) => !newly.includes(id));
  const slice = openIds.length > 0 ? available / openIds.length : 0;
  const stayingAvailable = available - slice * newly.length;
  const stayingWeight = staying.reduce(
    (sum, id) => sum + Math.max(before[id] ?? 1, 0.01),
    0
  );
  const layout: Layout = {};
  for (const id of WORKSPACE_PANEL_IDS) {
    if (id !== "chat" && !nextOpen[id]) {
      const measured = current[id] ?? 0;
      layout[id] = measured > 0 && measured < 12 ? measured : 1;
    } else if (newly.includes(id)) {
      layout[id] = slice;
    } else {
      layout[id] =
        (Math.max(before[id] ?? 1, 0.01) / stayingWeight) * stayingAvailable;
    }
  }
  return layout;
}

function MobileWorkspace({
  locale,
  prefs,
  onPrefs,
  project,
  foreignProject,
  connections,
  traffic,
  onChatActivity,
  mobileChatOpen,
  onMobileChatOpen,
}: Props) {
  const text = (key: Parameters<typeof workspaceText>[1]) =>
    workspaceText(locale, key);
  const columns: Array<{ id: MobileColumn; label: string }> = [
    { id: "context", label: text("columnContext") },
    { id: "analytics", label: text("columnAnalytics") },
    { id: "actions", label: text("columnActions") },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 gap-1 border-b border-border bg-surface px-3 py-2"
        role="tablist"
        aria-label={text("mobileColumns")}
      >
        {columns.map((column) => {
          const selected = prefs.mobileColumn === column.id && !mobileChatOpen;
          return (
            <button
              key={column.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                onMobileChatOpen(false);
                onPrefs({ mobileColumn: column.id });
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                selected
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-[#f1f1f1]"
              }`}
            >
              {column.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {prefs.mobileColumn === "context" ? (
          <ContextColumn
            locale={locale}
            project={project}
            foreign={foreignProject}
            connections={connections}
          />
        ) : null}
        {prefs.mobileColumn === "analytics" ? (
          <AnalyticsColumn
            locale={locale}
            tab={prefs.tab}
            onTab={(tab) => onPrefs({ tab })}
            traffic={traffic}
            blocked={foreignProject}
            blockedTitle={text("otherProjectTitle")}
            blockedBody={text("otherProjectBody")}
          />
        ) : null}
        {prefs.mobileColumn === "actions" ? (
          <ActionsColumn locale={locale} />
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onMobileChatOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 font-display text-sm font-medium text-white shadow-lg shadow-black/15"
      >
        <IconChat className="h-5 w-5" />
        {text("openChat")}
      </button>
      {mobileChatOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
            <h2 className="font-display text-sm font-semibold">
              {text("columnChat")}
            </h2>
            <button
              type="button"
              onClick={() => onMobileChatOpen(false)}
              className="rounded-md border border-border px-2.5 py-1 text-sm text-foreground"
            >
              {text("closeChat")}
            </button>
          </header>
          <div className="min-h-0 flex-1">
            <ChatColumn locale={locale} onChatActivity={onChatActivity} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChatColumn({
  locale,
  onChatActivity,
}: {
  locale: ChatLocale;
  onChatActivity: (signal: ChatSignal) => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex h-11 shrink-0 items-center border-b border-border px-3">
        <h2 className="font-display text-sm font-semibold text-foreground">
          {workspaceText(locale, "columnChat")}
        </h2>
      </header>
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <p className="px-3 py-3 text-sm text-muted">
              {locale === "en" ? "Loading chat…" : "Carregando o chat…"}
            </p>
          }
        >
          <AskAiPanel
            variant="column"
            locale={locale}
            onActivity={(kind) =>
              onChatActivity({
                id: `session-${kind}-${Date.now()}`,
                kind,
                at: new Date().toISOString(),
              })
            }
          />
        </Suspense>
      </div>
    </section>
  );
}
