/**
 * Presets de cor de destaque (Settings → Aparência).
 * Ajusta --accent / --accent-soft via `data-accent` no <html>.
 * Padrão = marca Humana (azul), sem atributo.
 */

export const ACCENT_PRESET_STORAGE_KEY = "ha-ui-accent";

export const ACCENT_PRESET_IDS = [
  "default",
  "blue",
  "indigo",
  "violet",
  "emerald",
  "rose",
  "amber",
  "orange",
] as const;

export type AccentPresetId = (typeof ACCENT_PRESET_IDS)[number];

const ALLOWED = new Set<string>(ACCENT_PRESET_IDS);

export const ACCENT_PRESET_OPTIONS: {
  id: AccentPresetId;
  label: string;
  swatchHex: string;
}[] = [
  { id: "default", label: "Padrão (Humana)", swatchHex: "#6074c8" },
  { id: "blue", label: "Azul", swatchHex: "#2563eb" },
  { id: "indigo", label: "Indigo", swatchHex: "#4f46e5" },
  { id: "violet", label: "Violeta", swatchHex: "#9333ea" },
  { id: "emerald", label: "Esmeralda", swatchHex: "#059669" },
  { id: "rose", label: "Rosa", swatchHex: "#e11d48" },
  { id: "amber", label: "Âmbar", swatchHex: "#d97706" },
  { id: "orange", label: "Laranja", swatchHex: "#ea580c" },
];

export function getAccentPresetSwatchHex(id: AccentPresetId): string {
  return (
    ACCENT_PRESET_OPTIONS.find((x) => x.id === id)?.swatchHex ?? "#6074c8"
  );
}

export function isAccentPresetId(v: string): v is AccentPresetId {
  return ALLOWED.has(v);
}

export function readStoredAccentPreset(): AccentPresetId {
  if (typeof window === "undefined") return "default";
  try {
    const raw = localStorage.getItem(ACCENT_PRESET_STORAGE_KEY);
    if (raw && isAccentPresetId(raw)) return raw;
  } catch {
    // ignore
  }
  return "default";
}

export function applyAccentPresetToDocument(id: AccentPresetId): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (id === "default") {
    el.removeAttribute("data-accent");
  } else {
    el.setAttribute("data-accent", id);
  }
}

export function persistAndApplyAccentPreset(id: AccentPresetId): void {
  try {
    localStorage.setItem(ACCENT_PRESET_STORAGE_KEY, id);
  } catch {
    // quota / private mode
  }
  applyAccentPresetToDocument(id);
}

/** Aplicar antes da primeira pintura para evitar flash da cor padrão. */
export function getAccentPresetBootstrapScript(): string {
  const k = JSON.stringify(ACCENT_PRESET_STORAGE_KEY);
  return `(function(){try{var k=${k};var a={default:1,blue:1,indigo:1,violet:1,emerald:1,rose:1,amber:1,orange:1};var v=localStorage.getItem(k)||'default';if(!a[v])v='default';if(v==='default')document.documentElement.removeAttribute('data-accent');else document.documentElement.setAttribute('data-accent',v);}catch(_e){}})();`;
}
