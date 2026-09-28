import { redirect } from "next/navigation";

import { LoginScreen } from "@/components/auth/login-screen";
import { allowedDomainsFromEnv, isAllowedCompanyEmail } from "@/lib/auth/allowed-domains";
import { getSessionUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getSessionUser();
  const allowed = isAllowedCompanyEmail(user?.email);
  if (user && allowed) redirect("/dashboard");

  const params = await searchParams;
  const googleId =
    process.env.AUTH_GOOGLE_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim();
  const googleSecret =
    process.env.AUTH_GOOGLE_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim();
  const missingEnv = [
    googleId ? null : "GOOGLE_CLIENT_ID",
    googleSecret ? null : "GOOGLE_CLIENT_SECRET",
    (
      process.env.AUTH_SECRET?.trim() ||
      process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()
    )
      ? null
      : "AUTH_SECRET",
  ].filter((item): item is string => Boolean(item));

  return (
    <LoginScreen
      denied={params.error === "AccessDenied" || Boolean(user && !allowed)}
      otherError={Boolean(params.error && params.error !== "AccessDenied")}
      missingEnv={missingEnv}
      blockedSession={Boolean(user && !allowed)}
      allowedDomains={allowedDomainsFromEnv()}
    />
  );
}
