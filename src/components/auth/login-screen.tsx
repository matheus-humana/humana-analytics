"use client";

import Image from "next/image";

import { signOutAction } from "@/lib/auth/sign-out-action";
import { signInWithGoogle } from "@/lib/auth/sign-in-google";
import {
  normalizeChatLocale,
  type ChatLocale,
} from "@/lib/ai/analytics-bot-contract";
import { loginText, type LoginMessageKey } from "@/lib/i18n/login-copy";
import { useLocalString, writeLocalString } from "@/lib/workspace/browser-store";
import { guestLocaleKey } from "@/lib/workspace/prefs";
import { ProviderIcon } from "@/components/workspace/provider-icons";
import type { ConnectionProvider } from "@/lib/workspace/status-log";

type Props = {
  denied: boolean;
  otherError: boolean;
  missingEnv: string[];
  blockedSession: boolean;
  allowedDomains: string[];
};

const SOURCES: Array<{ provider: ConnectionProvider; key: LoginMessageKey }> = [
  { provider: "ga4", key: "sourceGa4" },
  { provider: "github", key: "sourceGithub" },
  { provider: "pagespeed", key: "sourcePagespeed" },
  { provider: "crawl", key: "sourceSeo" },
];

export function LoginScreen({
  denied,
  otherError,
  missingEnv,
  blockedSession,
  allowedDomains,
}: Props) {
  const stored = useLocalString(guestLocaleKey());
  const locale: ChatLocale = normalizeChatLocale(stored) ?? "pt-BR";
  const text = (key: LoginMessageKey) => loginText(locale, key);

  function setLocale(next: ChatLocale) {
    try {
      writeLocalString(guestLocaleKey(), next);
    } catch {
      // The toggle still updates this render through the store when it works.
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-6 sm:py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-xl shadow-black/10 md:grid-cols-2">
        <section className="flex flex-col px-6 py-8 sm:px-10 sm:py-12">
          <div className="flex items-start justify-between gap-4">
            <Image
              src="/brand/logo-preto-humana.png"
              alt="Humana"
              width={1223}
              height={315}
              priority
              className="h-8 w-auto"
            />
            <div
              className="inline-flex rounded-full bg-secondary p-0.5"
              role="group"
              aria-label={text("language")}
            >
              {(["pt-BR", "en"] as const).map((option) => {
                const selected = option === locale;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setLocale(option)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      selected ? "ha-primary" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {option === "pt-BR" ? text("languagePt") : text("languageEn")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-10 flex flex-1 flex-col">
            <h1 className="max-w-sm font-display text-3xl font-semibold tracking-tight text-foreground">
              {text("title")}
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              {text("subtitle")}
            </p>

            {denied ? (
              <div className="mt-6 rounded-xl border border-border bg-[#f1f1f1] px-3 py-3 text-sm text-foreground">
                <p>{text("denied")}</p>
                {allowedDomains.length > 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    {text("deniedDomains")}: {allowedDomains.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {otherError ? (
              <p className="mt-6 rounded-xl border border-border bg-[#f1f1f1] px-3 py-3 text-sm text-foreground">
                {text("genericError")}
              </p>
            ) : null}

            {missingEnv.length > 0 ? (
              <p className="mt-6 rounded-xl border border-border bg-[#f1f1f1] px-3 py-3 text-sm text-foreground">
                {text("missingEnv")}: {missingEnv.join(", ")}.
              </p>
            ) : blockedSession ? (
              <form className="mt-8" action={signOutAction}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-[#151515] bg-[#151515] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black"
                >
                  {text("signOut")}
                </button>
              </form>
            ) : (
              <form className="mt-8" action={signInWithGoogle}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-[#f1f1f1]"
                >
                  <GoogleMark />
                  {text("continueGoogle")}
                </button>
              </form>
            )}
          </div>
        </section>

        <aside className="flex flex-col bg-[#151515] px-6 py-8 text-white sm:px-10 sm:py-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Humana Analytics
          </h2>
          <p className="mt-1 font-display text-xl italic text-white/80">{text("tagline")}</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">{text("pitch")}</p>
          <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">
            {text("sourcesLabel")}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {SOURCES.map((source) => (
              <li key={source.provider} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#151515]">
                  <ProviderIcon provider={source.provider} className="h-4 w-4" />
                </span>
                <span className="text-sm">{text(source.key)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72A5.4 5.4 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.02-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
