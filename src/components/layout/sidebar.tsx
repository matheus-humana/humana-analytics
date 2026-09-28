"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";

const navItems = [
  {
    href: "/dashboard",
    labelKey: "navDashboard",
    iconSrc: "/icons/black-icons/bar-chart.png",
  },
  {
    href: "/ask-ai",
    labelKey: "navAskAi",
    iconSrc: "/icons/black-icons/ai.png",
  },
  {
    href: "/data-sources",
    labelKey: "dataSources",
    iconSrc: "/icons/black-icons/layer.png",
  },
] as const satisfies ReadonlyArray<{
  href: string;
  labelKey: WorkspaceMessageKey;
  iconSrc: string;
}>;

const STORAGE_KEY = "ha-sidebar-collapsed";
const SIDEBAR_EVENT = "ha-sidebar-change";

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeSidebar(onChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onChange);
}

export function Sidebar({
  userName,
  signOut,
}: {
  userName: string;
  signOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    readSidebarCollapsed,
    () => false
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  function toggleCollapsed() {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  function handleSidebarAreaClick(event: React.MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, a, input, select, textarea, [role='dialog'], [data-no-collapse-toggle]"
      )
    ) {
      return;
    }
    toggleCollapsed();
  }

  const settingsActive = settingsOpen;

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Image
          src="/brand/logo-preto-humana.png"
          alt="Humana Artificial Intelligence"
          width={140}
          height={36}
          className="h-8 w-auto"
          priority
        />
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground"
          aria-expanded={mobileOpen}
          aria-label={text("navOpen")}
        >
          {text("navMenu")}
        </button>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          aria-label={text("navClose")}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        onClick={handleSidebarAreaClick}
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh flex-col border-r border-border bg-surface transition-[width,transform] duration-200 ease-out lg:sticky lg:top-0 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-[4.5rem]" : "w-64"}`}
      >
        <div
          className={`flex border-b border-border py-3 ${
            collapsed
              ? "flex-col items-center gap-2 px-2"
              : "items-center px-4"
          }`}
        >
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`rounded-md transition-colors hover:bg-[#f1f1f1] ${
              collapsed ? "p-1.5" : "p-1"
            }`}
            aria-label={collapsed ? text("navExpand") : text("navCollapse")}
            title={collapsed ? text("navExpand") : text("navCollapse")}
          >
            {collapsed ? (
              <Image
                src="/brand/simbolo-preto-humana.png"
                alt="Humana"
                width={28}
                height={28}
                className="h-7 w-auto"
                priority
              />
            ) : (
              <Image
                src="/brand/logo-preto-humana.png"
                alt="Humana Artificial Intelligence"
                width={150}
                height={40}
                className="h-8 w-auto"
                priority
              />
            )}
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
          {navItems.map((item) => {
            const label = text(item.labelKey);
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={label}
                onClick={() => {
                  setSettingsOpen(false);
                  setMobileOpen(false);
                }}
                className={`flex items-center rounded-lg py-2.5 text-sm transition-colors ${
                  collapsed ? "justify-center px-2" : "gap-3 px-3"
                } ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-foreground/80 hover:bg-[#f1f1f1] hover:text-foreground"
                }`}
              >
                <NavIcon src={item.iconSrc} active={active} />
                {!collapsed ? (
                  <span className={active ? "font-display" : undefined}>
                    {label}
                  </span>
                ) : (
                  <span className="sr-only">{label}</span>
                )}
              </Link>
            );
          })}

          <button
            type="button"
            title={text("settings")}
            data-no-collapse-toggle
            onClick={() => {
              setSettingsOpen((value) => !value);
              setMobileOpen(false);
            }}
            className={`flex items-center rounded-lg py-2.5 text-sm transition-colors ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            } ${
              settingsActive
                ? "bg-accent-soft font-medium text-accent"
                : "text-foreground/80 hover:bg-[#f1f1f1] hover:text-foreground"
            }`}
          >
            <NavIcon
              src="/icons/black-icons/cogwheel.png"
              active={settingsActive}
            />
            {!collapsed ? (
              <span className={settingsActive ? "font-display" : undefined}>
                {text("settings")}
              </span>
            ) : (
              <span className="sr-only">{text("settings")}</span>
            )}
          </button>
        </nav>

        <div className="border-t border-border px-2 py-3">
          {!collapsed ? (
            <p className="truncate px-3 pb-2 text-xs text-muted" title={userName}>
              {userName}
            </p>
          ) : (
            <p className="sr-only">{userName}</p>
          )}
          {signOut}
        </div>
      </aside>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sidebarCollapsed={collapsed}
      />
    </>
  );
}

/** PNG como máscara para herdar cor ativa (accent) / corrente. */
function NavIcon({ src, active }: { src: string; active: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-5 w-5 shrink-0 ${
        active ? "bg-accent" : "bg-foreground"
      }`}
      style={{
        maskImage: `url(${src})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
