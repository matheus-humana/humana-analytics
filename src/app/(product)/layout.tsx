import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ensureOrganizationMembership } from "@/lib/analytics/default-scope";
import { getSessionUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  try {
    await ensureOrganizationMembership(user.id);
  } catch {
    // Membership is retried on the next request. Chat still requires a session.
  }

  return (
    <AppShell userName={user.name ?? "Conta"} signOut={<SignOutButton />}>
      {children}
    </AppShell>
  );
}
