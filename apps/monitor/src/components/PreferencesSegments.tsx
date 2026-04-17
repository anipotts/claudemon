import { type Component, For } from "solid-js";
import {
  theme,
  density,
  headings,
  setTheme,
  setDensity,
  setHeadings,
  type ThemePref,
  type DensityPref,
  type HeadingPref,
} from "../stores/preferences";
import { Sun, Moon, Desktop } from "./Icons";

const SEG_BASE =
  "inline-flex items-center gap-0 border border-panel-border rounded-full p-[2px] bg-transparent text-[11px] font-mono";
const BTN_BASE =
  "px-2.5 py-[3px] rounded-full text-text-dim cursor-pointer transition-colors hover:text-text-primary flex items-center gap-1 leading-none";
const BTN_ON = "bg-text-primary text-bg";

interface SegOption<T extends string> {
  val: T;
  label: string;
  icon?: Component<{ size?: number }>;
  title?: string;
}

interface SegProps<T extends string> {
  label: string;
  options: readonly SegOption<T>[];
  current: T;
  onSelect: (v: T) => void;
}

function Seg<T extends string>(props: SegProps<T>) {
  return (
    <div class="flex items-center gap-1.5">
      <span class="text-[9px] uppercase tracking-[0.08em] text-text-sub hidden lg:inline">{props.label}</span>
      <div class={SEG_BASE}>
        <For each={props.options}>
          {(opt) => {
            const Icon = opt.icon;
            const on = () => props.current === opt.val;
            return (
              <button
                type="button"
                class={`${BTN_BASE} ${on() ? BTN_ON : ""}`}
                onClick={() => props.onSelect(opt.val)}
                title={opt.title || opt.label}
                aria-pressed={on()}
                aria-label={`${props.label}: ${opt.label}`}
              >
                {Icon ? <Icon size={11} /> : null}
                <span class={Icon ? "hidden xl:inline" : ""}>{opt.label}</span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
}

const THEME_OPTS: readonly SegOption<ThemePref>[] = [
  { val: "light", label: "Light", icon: Sun, title: "Light theme" },
  { val: "dark", label: "Dark", icon: Moon, title: "Dark theme" },
  { val: "system", label: "Sys", icon: Desktop, title: "Follow system theme" },
];

const DENSITY_OPTS: readonly SegOption<DensityPref>[] = [
  { val: "compact", label: "Compact" },
  { val: "cozy", label: "Cozy" },
  { val: "spacious", label: "Spacious" },
];

const HEADING_OPTS: readonly SegOption<HeadingPref>[] = [
  { val: "mono", label: "Mono" },
  { val: "serif", label: "Serif" },
  { val: "hand", label: "Hand" },
];

export const PreferencesSegments: Component = () => {
  return (
    <div class="flex items-center gap-3">
      <Seg label="Theme" options={THEME_OPTS} current={theme()} onSelect={setTheme} />
      <Seg label="Density" options={DENSITY_OPTS} current={density()} onSelect={setDensity} />
      <Seg label="Headings" options={HEADING_OPTS} current={headings()} onSelect={setHeadings} />
    </div>
  );
};
