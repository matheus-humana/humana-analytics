import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";

/**
 * Copy introduced by the single-screen workspace.
 * Existing dashboard and chat strings stay in their current components.
 */
export const workspaceCopy = {
  "pt-BR": {
    project: "Projeto",
    projectUnavailable: "Projeto indisponível",
    statusLog: "Status log",
    statusLogEmpty: "Nenhum evento ainda",
    statusConnected: "conectado",
    statusDisconnected: "desconectado",
    statusError: "erro",
    statusUpdated: "atualizado",
    eventQuestion: "Pergunta enviada",
    eventReply: "Resposta recebida",
    expandStatusLog: "Abrir o status log",
    collapseStatusLog: "Recolher o status log",
    userMenu: "Menu do usuário",
    language: "Idioma",
    languagePt: "Português",
    languageEn: "English",
    dataSources: "Fontes de dados",
    fullChat: "Chat em página inteira",
    signOut: "Sair",
    close: "Fechar",
    columnContext: "Contexto",
    columnAnalytics: "Analytics",
    columnActions: "Ações",
    columnChat: "Chat",
    tabTraffic: "Tráfego",
    tabSeo: "SEO",
    tabGeo: "GEO",
    collapseColumn: "Recolher",
    expandColumn: "Expandir",
    resizeColumns: "Redimensionar colunas",
    connections: "Conexões",
    slug: "Identificador",
    openDataSources: "Gerenciar conexões",
    futureSources:
      "PageSpeed e Search Console ainda não estão conectados.",
    otherProjectTitle: "Painel deste projeto ainda não está separado",
    otherProjectBody:
      "Os números carregados pertencem ao projeto com as fontes conectadas. Nada foi copiado para este projeto.",
    connectionsNotLoaded:
      "As conexões não foram listadas para este projeto.",
    seoEmptyTitle: "SEO em breve",
    seoEmptyBody:
      "A fonte ainda não está conectada. Notas de PageSpeed e o crawler entram numa etapa seguinte. Nenhum número é mostrado no lugar.",
    geoEmptyTitle: "GEO em breve",
    geoEmptyBody:
      "A fonte ainda não está conectada. O checklist de prontidão para IAs entra numa etapa seguinte. Nenhum número é mostrado no lugar.",
    actionsEmptyTitle: "Nenhuma ação em aberto",
    actionsEmptyBody:
      "As auditorias de SEO, GEO e as quedas de tráfego ainda não geram itens. A lista fica vazia até existir uma fonte real.",
    trafficUnavailableTitle: "Tráfego sem dados ao vivo",
    trafficUnavailableBody:
      "Não há métricas para mostrar. Conecte a fonte ou tente de novo. Números de exemplo não entram aqui.",
    mobileColumns: "Colunas",
    openChat: "Abrir chat",
    closeChat: "Fechar chat",
    analyticsUsers: "usuários",
    chatNew: "Nova conversa",
    chatEmpty: "Nenhuma conversa ainda.",
    chatPrompt: "O que você quer saber?",
    chatPlaceholder: "Ex.: De onde veio o tráfego nos últimos 7 dias?",
    chatAsk: "Perguntar",
    chatSending: "Enviando…",
    chatSuggestions: "Sugestões",
    chatYou: "Você",
    chatAssistant: "Humana Analytics",
    chatLoading: "Carregando conversa…",
    chatPeriod: "Período",
  },
  en: {
    project: "Project",
    projectUnavailable: "Project unavailable",
    statusLog: "Status log",
    statusLogEmpty: "No events yet",
    statusConnected: "connected",
    statusDisconnected: "disconnected",
    statusError: "error",
    statusUpdated: "updated",
    eventQuestion: "Question sent",
    eventReply: "Reply received",
    expandStatusLog: "Expand status log",
    collapseStatusLog: "Collapse status log",
    userMenu: "User menu",
    language: "Language",
    languagePt: "Português",
    languageEn: "English",
    dataSources: "Data sources",
    fullChat: "Full-page chat",
    signOut: "Sign out",
    close: "Close",
    columnContext: "Context",
    columnAnalytics: "Analytics",
    columnActions: "Actions",
    columnChat: "Chat",
    tabTraffic: "Traffic",
    tabSeo: "SEO",
    tabGeo: "GEO",
    collapseColumn: "Collapse",
    expandColumn: "Expand",
    resizeColumns: "Resize columns",
    connections: "Connections",
    slug: "Identifier",
    openDataSources: "Manage connections",
    futureSources: "PageSpeed and Search Console are not connected yet.",
    otherProjectTitle: "This project does not have its own panel yet",
    otherProjectBody:
      "The loaded numbers belong to the project with connected sources. Nothing was copied onto this project.",
    connectionsNotLoaded: "Connections were not listed for this project.",
    seoEmptyTitle: "SEO coming soon",
    seoEmptyBody:
      "The source is not connected yet. PageSpeed scores and the crawler come in a later step. No number is shown in their place.",
    geoEmptyTitle: "GEO coming soon",
    geoEmptyBody:
      "The source is not connected yet. The AI-readiness checklist comes in a later step. No number is shown in its place.",
    actionsEmptyTitle: "No open actions",
    actionsEmptyBody:
      "SEO, GEO, and traffic-drop audits do not create items yet. The list stays empty until a real source exists.",
    trafficUnavailableTitle: "Traffic has no live data",
    trafficUnavailableBody:
      "There are no metrics to show. Connect the source or try again. Example numbers are not shown here.",
    mobileColumns: "Columns",
    openChat: "Open chat",
    closeChat: "Close chat",
    analyticsUsers: "users",
    chatNew: "New conversation",
    chatEmpty: "No conversations yet.",
    chatPrompt: "What do you want to know?",
    chatAsk: "Ask",
    chatSending: "Sending…",
    chatPlaceholder: "Example: Where did traffic come from in the last 7 days?",
    chatSuggestions: "Suggestions",
    chatYou: "You",
    chatAssistant: "Humana Analytics",
    chatLoading: "Loading conversation…",
    chatPeriod: "Period",
  },
} as const;

export type WorkspaceMessageKey = keyof (typeof workspaceCopy)["pt-BR"];

export function workspaceText(
  locale: ChatLocale,
  key: WorkspaceMessageKey
): string {
  return workspaceCopy[locale][key];
}
