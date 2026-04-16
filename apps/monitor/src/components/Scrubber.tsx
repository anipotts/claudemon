import { type Component, Show, createMemo } from "solid-js";
import type { SessionState } from "../../../../packages/types/monitor";

interface ScrubberProps {
  sessions: Record<string, SessionState>;
  scrubberTime: () => number | null;
  setScrubberTime: (t: number | null) => void;
}

/**
 * Time-travel scrubber — drag to rewind the entire canvas.
 *
 * `null` scrubber time = LIVE mode (real-time updates).
 * Any other value caps derived state (smart_status, fileEdges, hiveStream)
 * to events with timestamp ≤ scrubberTime.
 *
 * The store exposes `scrubberTime` as a signal consumed by `createMemo`s
 * in sessions.ts — all derivation is already time-aware.
 */
export const Scrubber: Component<ScrubberProps> = (props) => {
  // Range: earliest event across all sessions → now
  const earliest = createMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    for (const s of Object.values(props.sessions)) {
      if (s.started_at && s.started_at < min) min = s.started_at;
      for (const e of s.events) {
        if (e.timestamp < min) min = e.timestamp;
      }
    }
    return Number.isFinite(min) ? min : Date.now() - 60 * 60 * 1000;
  });

  const now = createMemo(() => Date.now());

  // Current scrubber value in ms
  const value = createMemo(() => {
    const t = props.scrubberTime();
    return t === null ? now() : t;
  });

  const isLive = () => props.scrubberTime() === null;

  const displayLabel = createMemo(() => {
    if (isLive()) return "LIVE";
    const ago = now() - value();
    if (ago < 60_000) return `Viewing: ${Math.floor(ago / 1000)}s ago`;
    if (ago < 3_600_000) return `Viewing: ${Math.floor(ago / 60_000)}m ago`;
    if (ago < 86_400_000) return `Viewing: ${Math.floor(ago / 3_600_000)}h ago`;
    return `Viewing: ${new Date(value()).toLocaleString()}`;
  });

  function onInput(e: InputEvent) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    // Snap back to LIVE when at max
    props.setScrubberTime(v >= now() - 1000 ? null : v);
  }

  function snapToLive() {
    props.setScrubberTime(null);
  }

  return (
    <div
      class="flex items-center gap-3 px-4 py-2 border-t border-panel-border/30"
      style={{ background: "var(--panel)" }}
    >
      <button
        type="button"
        onClick={snapToLive}
        disabled={isLive()}
        class="shrink-0 text-[10px] font-mono px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-default"
        style={{
          color: isLive() ? "var(--safe)" : "var(--text-label)",
          "background-color": isLive() ? "rgba(163, 177, 138, 0.12)" : "transparent",
          border: `1px solid ${isLive() ? "rgba(163, 177, 138, 0.3)" : "var(--panel-border)"}`,
        }}
        title={isLive() ? "Currently live" : "Snap back to live"}
      >
        <Show when={isLive()} fallback={<>⟳ Live</>}>
          <span class="flex items-center gap-1.5">
            <span
              class="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--safe)", "box-shadow": "0 0 4px var(--safe)" }}
            />
            LIVE
          </span>
        </Show>
      </button>

      <input
        type="range"
        min={earliest()}
        max={now()}
        value={value()}
        step={1000}
        onInput={onInput}
        onDblClick={snapToLive}
        class="flex-1 h-1 cursor-pointer accent-current"
        style={{ color: isLive() ? "var(--safe)" : "var(--suspicious)" }}
        title="Drag to rewind. Double-click to snap back to live."
      />

      <div
        class="shrink-0 text-[10px] font-mono tabular-nums min-w-[120px] text-right"
        style={{ color: isLive() ? "var(--text-dim)" : "var(--suspicious)" }}
      >
        {displayLabel()}
      </div>
    </div>
  );
};
