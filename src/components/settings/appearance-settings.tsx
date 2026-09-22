"use client";

import { useEffect, useState } from "react";

import {
  ACCENT_PRESET_OPTIONS,
  type AccentPresetId,
  getAccentPresetSwatchHex,
  isAccentPresetId,
  persistAndApplyAccentPreset,
  readStoredAccentPreset,
} from "@/lib/ui/accent-preset";

const swatchClass =
  "size-3.5 shrink-0 rounded-full border border-border shadow-sm";

type AppearanceSettingsProps = {
  /** Sem card externo — para uso dentro do painel flutuante. */
  compact?: boolean;
};

export function AppearanceSettings({ compact = false }: AppearanceSettingsProps) {
  const [preset, setPreset] = useState<AccentPresetId>("default");

  useEffect(() => {
    const stored = readStoredAccentPreset();
    setPreset(stored);
    persistAndApplyAccentPreset(stored);
  }, []);

  function onChange(value: string) {
    if (!isAccentPresetId(value)) return;
    persistAndApplyAccentPreset(value);
    setPreset(value);
  }

  const body = (
    <>
      <div className={compact ? "mb-4" : "mb-5"}>
        <h2
          className={`font-display font-semibold text-foreground ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          Aparência
        </h2>
        <p className="mt-1 text-sm text-muted">
          Personalize a cor de destaque. A escolha fica salva neste navegador.
        </p>
      </div>

      <div>
        <label
          htmlFor="accent-preset"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Cor de destaque
        </label>
        <div className="relative">
          <span
            aria-hidden
            className={`${swatchClass} pointer-events-none absolute top-1/2 left-3 -translate-y-1/2`}
            style={{ backgroundColor: getAccentPresetSwatchHex(preset) }}
          />
          <select
            id="accent-preset"
            value={preset}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-surface py-2.5 pr-3 pl-9 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25"
          >
            {ACCENT_PRESET_OPTIONS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Prévia das cores">
          {ACCENT_PRESET_OPTIONS.map(({ id, label, swatchHex }) => {
            const selected = id === preset;
            return (
              <li key={id}>
                <button
                  type="button"
                  title={label}
                  aria-label={label}
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
