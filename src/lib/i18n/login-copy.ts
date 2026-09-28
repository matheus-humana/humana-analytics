import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";

export const loginCopy = {
  "pt-BR": {
    title: "Vamos olhar os dados.",
    subtitle: "Entre com a conta Google da Humana.",
    continueGoogle: "Continuar com Google",
    tagline: "para o marketing",
    pitch: "Tráfego do site, repositório e qualidade das páginas, num só lugar.",
    sourcesLabel: "Fontes",
    sourceGa4: "GA4",
    sourceGithub: "GitHub",
    sourcePagespeed: "PageSpeed",
    sourceSeo: "SEO/GEO",
    language: "Idioma",
    languagePt: "PT",
    languageEn: "EN",
    denied:
      "Esta conta Google não pertence a um domínio autorizado da Humana. Entre com o e-mail da empresa.",
    deniedDomains: "Domínios aceitos",
    signOut: "Sair desta conta",
    genericError: "Não foi possível entrar com Google. Tente novamente.",
    missingEnv: "Login ainda não está configurado neste ambiente. Defina no servidor",
  },
  en: {
    title: "Let's look at the data.",
    subtitle: "Sign in with your Humana Google account.",
    continueGoogle: "Continue with Google",
    tagline: "for marketing",
    pitch: "Site traffic, the repository, and page quality, in one place.",
    sourcesLabel: "Sources",
    sourceGa4: "GA4",
    sourceGithub: "GitHub",
    sourcePagespeed: "PageSpeed",
    sourceSeo: "SEO/GEO",
    language: "Language",
    languagePt: "PT",
    languageEn: "EN",
    denied:
      "This Google account is not on an allowed Humana domain. Sign in with your company email.",
    deniedDomains: "Allowed domains",
    signOut: "Sign out of this account",
    genericError: "Google sign-in failed. Try again.",
    missingEnv: "Sign-in is not configured in this environment. Set on the server",
  },
} as const;

export type LoginMessageKey = keyof (typeof loginCopy)["pt-BR"];

export function loginText(locale: ChatLocale, key: LoginMessageKey): string {
  return loginCopy[locale][key];
}
