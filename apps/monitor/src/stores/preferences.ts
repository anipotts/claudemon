import { createSignal, createEffect, createRoot } from "solid-js";

export type ThemePref = "light" | "dark" | "system";
export type DensityPref = "compact" | "cozy" | "spacious";
export type HeadingPref = "mono" | "serif" | "hand";

const THEME_KEY = "cm_theme";
const DENSITY_KEY = "cm_density";
const HEADINGS_KEY = "cm_headings";

const SYSTEM_MQL = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function readInitial<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return SYSTEM_MQL?.matches ? "dark" : "light";
}

const [theme, setThemeSignal] = createSignal<ThemePref>(
  readInitial<ThemePref>(THEME_KEY, ["light", "dark", "system"], "system"),
);
const [density, setDensitySignal] = createSignal<DensityPref>(
  readInitial<DensityPref>(DENSITY_KEY, ["compact", "cozy", "spacious"], "compact"),
);
const [headings, setHeadingsSignal] = createSignal<HeadingPref>(
  readInitial<HeadingPref>(HEADINGS_KEY, ["mono", "serif", "hand"], "mono"),
);

if (typeof document !== "undefined") {
  const root = document.documentElement;

  createRoot(() => {
    createEffect(() => {
      const pref = theme();
      const effective = resolveTheme(pref);
      root.setAttribute("data-theme", effective);
      root.setAttribute("data-theme-pref", pref);
      localStorage.setItem(THEME_KEY, pref);
    });

    createEffect(() => {
      const d = density();
      root.setAttribute("data-density", d);
      localStorage.setItem(DENSITY_KEY, d);
    });

    createEffect(() => {
      const h = headings();
      root.setAttribute("data-headings", h);
      localStorage.setItem(HEADINGS_KEY, h);
    });
  });

  if (SYSTEM_MQL) {
    SYSTEM_MQL.addEventListener("change", () => {
      if (theme() === "system") {
        root.setAttribute("data-theme", resolveTheme("system"));
      }
    });
  }
}

export function setTheme(v: ThemePref): void {
  setThemeSignal(v);
}
export function setDensity(v: DensityPref): void {
  setDensitySignal(v);
}
export function setHeadings(v: HeadingPref): void {
  setHeadingsSignal(v);
}

export { theme, density, headings };
