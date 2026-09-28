"use client";

import { useSyncExternalStore } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import { Dropdown } from "@/components/ui/dropdown";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import {
  ACCENT_PRESET_OPTIONS,
  type AccentPresetId,
  getAccentPresetSwatchHex,
  isAccentPresetId,
  persistAndApplyAccentPreset,
  readStoredAccentPreset,
} from "@/lib/ui/accent-preset";

const ACCENT_LABELS: Record<AccentPresetId, WorkspaceMessageKey> = {
  default: "accentDefault",
  blue: "accentBlue",
  indigo: "accentIndigo",
  violet: "accentViolet",
  emerald: "accentEmerald",
  rose: "accentRose",
  amber: "accentAmber",
  orange: "accentOrange",
};

const swatchClass =
  "size-3.5 shrink-0 rounded-full border border-border shadow-sm";

const ACCENT_EVENT = "ha-accent-change";

function subscribeAccent(onChange: () => void) {
  window.addEventListener(ACCENT_EVENT, onChange);
  return () => window.removeEventListener(ACCENT_EVENT, onChange);
}

type AppearanceSettingsProps = {
  /** Sem card externo — para uso dentro do painel flutuante. */
  compact?: boolean;
};

export function AccentPicker({
  label,
  previewLabel,
}: {
  label?: string;
  previewLabel?: string;
}) {
  const { locale } = useLocale();
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const heading = label ?? text("accentColor");
  const preview = previewLabel ?? text("accentPreview");
  const preset = useSyncExternalStore(
    subscribeAccent,
    readStoredAccentPreset,
    (): AccentPresetId => "default"
  );

  function onChange(value: string) {
    if (!isAccentPresetId(value)) return;
    persistAndApplyAccentPreset(value);
    window.dispatchEvent(new Event(ACCENT_EVENT));
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{heading}</p>
      <Dropdown<AccentPresetId>
        value={preset}
        onChange={onChange}
        ariaLabel={heading}
        className="w-full"
        options={ACCENT_PRESET_OPTIONS.map(({ id }) => ({
          value: id,
          label: text(ACCENT_LABELS[id]),
          icon: (
            <span
              aria-hidden
              className={swatchClass}
              style={{ backgroundColor: getAccentPresetSwatchHex(id) }}
            />
          ),
        }))}
      />

      <ul className="mt-4 flex flex-wrap gap-2" aria-label={preview}>
        {ACCENT_PRESET_OPTIONS.map(({ id, swatchHex }) => {
          const selected = id === preset;
          const optionLabel = text(ACCENT_LABELS[id]);
          return (
            <li key={id}>
              <button
                type="button"
                title={optionLabel}
                aria-label={optionLabel}
                aria-pressed={selected}
                onClick={() => onChange(id)}
                className={`flex size-8 items-center justify-center rounded-full border transition-shadow ${
                  selected
                    ? "border-foreground/40 ring-2 ring-accent/40 ring-offset-2 ring-offset-surface"
                    : "border-border hover:border-foreground/30"
                }`}
                style={{ backgroundColor: swatchHex }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AppearanceSettings({ compact = false }: AppearanceSettingsProps) {
  const { locale } = useLocale();
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const body = (
    <>
      <div className={compact ? "mb-4" : "mb-5"}>
        <h2
          className={`font-display font-semibold text-foreground ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          {text("settingsAppearance")}
        </h2>
        <p className="mt-1 text-sm text-muted">{text("appearanceBody")}</p>
      </div>

      <AccentPicker />
    </>
  );

  if (compact) {
    return <div>{body}</div>;
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm shadow-black/5">
      {body}
    </section>
  );
}
