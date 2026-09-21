"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/ask-ai", label: "Ask AI", icon: AskAiIcon },
  { href: "/data-sources", label: "Data Sources", icon: DataSourcesIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/simbolo-preto-humana.png"
            alt="Humana AI"
            width={28}
            height={28}
            className="h-7 w-auto"
            priority
          />
          <div>
            <p className="font-display text-sm font-semibold tracking-tight text-foreground">
              Humana Analytics
            </p>
            <p className="text-xs text-muted">Demo</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground"
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          Menu
        </button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="hidden border-b border-border px-5 py-5 lg:block">
          <Image
            src="/brand/logo-preto-humana.png"
            alt="Humana Artificial Intelligence"
            width={160}
            height={42}
            className="h-9 w-auto"
            priority
          />
          <p className="mt-3 font-display text-sm font-semibold text-foreground">
            Humana Analytics
          </p>
          <p className="mt-1 text-sm text-muted">
            Website analytics with AI
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:bg-[#f1f1f1] hover:text-foreground"
                }`}
              >
                <Icon active={active} />
                <span className={active ? "font-display" : undefined}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border bg-navy px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/icone-branco-humana.png"
              alt=""
              width={24}
              height={24}
              className="h-6 w-auto"
            />
            <div>
              <p className="font-display text-sm font-medium">Humana AI</p>
              <div className="mt-1 inline-flex items-center rounded-full border border-white/20 px-2.5 py-0.5 text-xs text-white/80">
                Demo
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 ${active ? "stroke-accent" : "stroke-current"}`}
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" strokeWidth="1.5" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" strokeWidth="1.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" strokeWidth="1.5" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" strokeWidth="1.5" />
    </svg>
  );
}

function AskAiIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 ${active ? "stroke-accent" : "stroke-current"}`}
      aria-hidden
    >
      <path
        d="M4 12.5c0-3.3 2.7-6 6-6s6 2.7 6 6v1.5H4V12.5Z"
        strokeWidth="1.5"
      />
      <path
        d="M8 6.5 9 4l1 2.5L12.5 7.5 10 8.5 9 11 8 8.5 5.5 7.5 8 6.5Z"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function DataSourcesIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 ${active ? "stroke-accent" : "stroke-current"}`}
      aria-hidden
    >
      <ellipse cx="10" cy="5" rx="6" ry="2.5" strokeWidth="1.5" />
      <path
        d="M4 5v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5"
        strokeWidth="1.5"
      />
      <path
        d="M4 10v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 ${active ? "stroke-accent" : "stroke-current"}`}
      aria-hidden
    >
      <circle cx="10" cy="10" r="2.5" strokeWidth="1.5" />
      <path
        d="M10 2.75v1.5M10 15.75v1.5M2.75 10h1.5M15.75 10h1.5M4.8 4.8l1.06 1.06M14.14 14.14l1.06 1.06M15.2 4.8l-1.06 1.06M5.86 14.14 4.8 15.2"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
