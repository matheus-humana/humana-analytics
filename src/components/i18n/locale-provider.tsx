"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { htmlLang, persistLocaleChoice } from "@/lib/i18n/locale";

type LocaleContextValue = {
  locale: ChatLocale;
  setLocale: (locale: ChatLocale, userId?: string) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: ChatLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale(next, userId) {
        persistLocaleChoice(next, userId);
        setLocaleState(next);
      },
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value) return value;
  return {
    locale: "pt-BR",
    setLocale() {
      // Screens outside the provider keep the product default.
    },
  };
}
