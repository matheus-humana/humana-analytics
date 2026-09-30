"use client";

import { useEffect, useState } from "react";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { DOCUMENT_CHAR_CAP } from "@/lib/ai/context-input";
import { localizeKnownCopy } from "@/lib/i18n/known-copy";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import type { ConnectionSnapshot } from "@/lib/workspace/status-log";

import { ProviderIcon } from "./provider-icons";

type Profile = {
  siteUrl: string | null;
  languages: string | null;
  audience: string | null;
  positioning: string | null;
  goals: string | null;
};

type Competitor = {
  id?: string;
  name: string;
  domain: string | null;
  notes: string | null;
};

type DocumentRow = {
  id?: string;
  title: string;
  kind: "link" | "text";
  url: string | null;
  body: string | null;
  confidential: boolean;
};

type StoredContext = {
  profile: Profile | null;
  competitors: Competitor[];
  documents: DocumentRow[];
};

const emptyProfile = {
  siteUrl: "",
  languages: "",
  audience: "",
  positioning: "",
  goals: "",
};

export function ContextPanel({
  locale,
  projectId,
  connections,
}: {
  locale: ChatLocale;
  projectId: string;
  connections: ConnectionSnapshot[];
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const [stored, setStored] = useState<StoredContext | null>(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [competitor, setCompetitor] = useState({ name: "", domain: "", notes: "" });
  const [documentKind, setDocumentKind] = useState<"link" | "text">("link");
  const [documentDraft, setDocumentDraft] = useState({
    title: "",
    url: "",
    body: "",
    confidential: false,
  });

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/context`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { ok?: boolean; error?: string; context?: StoredContext };
        if (cancelled) return;
        if (!response.ok || !data.ok || !data.context) {
          setNotice(data.error ?? "contextSaveFailed");
          return;
        }
        setStored(data.context);
        setProfile({
          siteUrl: data.context.profile?.siteUrl ?? "",
          languages: data.context.profile?.languages ?? "",
          audience: data.context.profile?.audience ?? "",
          positioning: data.context.profile?.positioning ?? "",
          goals: data.context.profile?.goals ?? "",
        });
      })
      .catch(() => {
        if (!cancelled) setNotice("contextSaveFailed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function send(url: string, method: string, body?: unknown) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; context?: StoredContext };
      if (!response.ok || !data.ok || !data.context) {
        setNotice(data.error ?? "contextSaveFailed");
        return false;
      }
      setStored(data.context);
      setNotice("contextSaved");
      return true;
    } catch {
      setNotice("contextSaveFailed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const shownNotice = notice ? localizeKnownCopy(notice, locale) : null;

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
      <p className="text-xs text-muted">{text("contextQualitativeNote")}</p>
      {loading ? <p className="text-sm text-muted">{text("contextLoading")}</p> : null}
      {shownNotice ? <p className="text-sm text-foreground">{shownNotice}</p> : null}

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(`/api/projects/${projectId}/context`, "PUT", profile);
        }}
      >
        <Field label={text("contextSite")} value={profile.siteUrl} onChange={(siteUrl) => setProfile({ ...profile, siteUrl })} />
        <Field label={text("contextLanguages")} value={profile.languages} onChange={(languages) => setProfile({ ...profile, languages })} />
        <Field label={text("contextAudience")} value={profile.audience} onChange={(audience) => setProfile({ ...profile, audience })} multiline />
        <Field label={text("contextPositioning")} value={profile.positioning} onChange={(positioning) => setProfile({ ...profile, positioning })} multiline />
        <Field label={text("contextGoals")} value={profile.goals} onChange={(goals) => setProfile({ ...profile, goals })} multiline />
        <button type="submit" disabled={saving} className="ha-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          {saving ? text("contextSaving") : text("contextSave")}
        </button>
      </form>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">{text("contextCompetitors")}</h3>
        {stored && stored.competitors.length === 0 ? (
          <p className="text-xs text-muted">{text("contextEmptyCompetitors")}</p>
        ) : null}
        <ul className="space-y-2">
          {stored?.competitors.map((item) => (
            <li key={item.id} className="rounded-xl border border-secondary p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">
                  {item.name}
                  {item.domain ? <span className="font-normal text-muted"> · {item.domain}</span> : null}
                </p>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-foreground"
                  onClick={() => void send(`/api/projects/${projectId}/competitors/${item.id}`, "DELETE")}
                >
                  {text("contextRemove")}
                </button>
              </div>
              {item.notes ? <p className="mt-1 text-xs text-muted">{item.notes}</p> : null}
            </li>
          ))}
        </ul>
        <form
          className="space-y-2 rounded-xl border border-secondary p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(`/api/projects/${projectId}/competitors`, "POST", competitor).then((ok) => {
              if (ok) setCompetitor({ name: "", domain: "", notes: "" });
            });
          }}
        >
          <Field label={text("contextCompetitorName")} value={competitor.name} onChange={(name) => setCompetitor({ ...competitor, name })} />
          <Field label={text("contextCompetitorDomain")} value={competitor.domain} onChange={(domain) => setCompetitor({ ...competitor, domain })} />
          <Field label={text("contextCompetitorNotes")} value={competitor.notes} onChange={(notes) => setCompetitor({ ...competitor, notes })} multiline />
          <button type="submit" disabled={saving || !competitor.name.trim()} className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50">
            {text("contextAdd")}
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">{text("contextDocuments")}</h3>
        <p className="text-xs text-muted">{text("contextConfidentialHint")}</p>
        {stored && stored.documents.length === 0 ? (
          <p className="text-xs text-muted">{text("contextEmptyDocuments")}</p>
        ) : null}
        <ul className="space-y-2">
          {stored?.documents.map((item) => (
            <li key={item.id} className="rounded-xl border border-secondary p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">
                  {item.title}
                  {item.confidential ? (
                    <span className="ml-2 text-xs font-normal text-muted">{text("contextConfidential")}</span>
                  ) : null}
                </p>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-foreground"
                  onClick={() => void send(`/api/projects/${projectId}/documents/${item.id}`, "DELETE")}
                >
                  {text("contextRemove")}
                </button>
              </div>
              {item.kind === "link" && item.url ? (
                <a href={item.url} className="mt-1 block truncate text-xs text-accent" target="_blank" rel="noreferrer">
                  {item.url}
                </a>
              ) : null}
              {item.kind === "text" && item.body ? (
                <p className="mt-1 line-clamp-3 text-xs text-muted">{item.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <form
          className="space-y-2 rounded-xl border border-secondary p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const payload =
              documentKind === "link"
                ? {
                    title: documentDraft.title,
                    kind: "link" as const,
                    url: documentDraft.url,
                    confidential: documentDraft.confidential,
                  }
                : {
                    title: documentDraft.title,
                    kind: "text" as const,
                    body: documentDraft.body,
                    confidential: documentDraft.confidential,
                  };
            void send(`/api/projects/${projectId}/documents`, "POST", payload).then((ok) => {
              if (ok) {
                setDocumentDraft({ title: "", url: "", body: "", confidential: false });
              }
            });
          }}
        >
          <Field
            label={text("contextDocumentTitle")}
            value={documentDraft.title}
            onChange={(title) => setDocumentDraft({ ...documentDraft, title })}
          />
          <div className="flex gap-2 text-xs">
            {(["link", "text"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setDocumentKind(kind)}
                className={`rounded-full px-2.5 py-1 ${documentKind === kind ? "ha-primary" : "text-muted"}`}
              >
                {text(kind === "link" ? "contextDocumentLink" : "contextDocumentText")}
              </button>
            ))}
          </div>
          {documentKind === "link" ? (
            <Field label={text("contextDocumentLink")} value={documentDraft.url} onChange={(url) => setDocumentDraft({ ...documentDraft, url })} />
          ) : (
            <label className="block text-xs text-muted">
              {text("contextPaste")}
              <textarea
                value={documentDraft.body}
                maxLength={DOCUMENT_CHAR_CAP}
                onChange={(event) => setDocumentDraft({ ...documentDraft, body: event.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-foreground outline-none"
                rows={4}
              />
              <span className="mt-1 block tabular-nums">
                {documentDraft.body.length}/{DOCUMENT_CHAR_CAP}
              </span>
            </label>
          )}
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={documentDraft.confidential}
              onChange={(event) =>
                setDocumentDraft({ ...documentDraft, confidential: event.target.checked })
              }
            />
            {text("contextConfidential")}
          </label>
          <button type="submit" disabled={saving || !documentDraft.title.trim()} className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50">
            {text("contextAdd")}
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">{text("connections")}</h3>
        <ul className="space-y-2">
          {connections.map((connection) => (
            <li key={connection.provider} className="flex items-center gap-2 text-sm">
              <ProviderIcon provider={connection.provider} className="h-4 w-4 shrink-0" />
              <span className="text-foreground">{providerLabel(connection.provider, text)}</span>
              <span className="text-xs text-muted">
                {connection.connected ? text("sourcesConnected") : text("sourcesDisconnected")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function providerLabel(
  provider: ConnectionSnapshot["provider"],
  text: (key: WorkspaceMessageKey) => string
) {
  if (provider === "ga4") return text("contextProviderGa4");
  if (provider === "github") return text("contextProviderGithub");
  if (provider === "pagespeed") return text("contextProviderPagespeed");
  return text("connCrawlName");
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const className =
    "mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-foreground outline-none";
  return (
    <label className="block text-xs text-muted">
      {label}
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className={className} rows={3} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} className={className} />
      )}
    </label>
  );
}
