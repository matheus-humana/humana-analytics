"use client";

import { usePathname } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";

export function ProductChrome({
  userName,
  signOut,
  children,
}: {
  userName: string;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/dashboard") {
    return (
      <div className="h-dvh overflow-hidden bg-background">{children}</div>
    );
  }

  return (
    <AppShell userName={userName} signOut={signOut}>
      {children}
    </AppShell>
  );
}
