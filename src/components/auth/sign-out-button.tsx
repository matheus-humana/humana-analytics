"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { signOutAction } from "@/lib/auth/sign-out-action";
import { workspaceText } from "@/lib/i18n/workspace-copy";

export function SignOutButton({ label }: { label?: string }) {
  const { locale } = useLocale();
  const text = label ?? workspaceText(locale, "signOut");
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        title={text}
        data-no-collapse-toggle
        className="flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-[#f1f1f1] hover:text-foreground"
      >
        {text}
      </button>
    </form>
  );
}
