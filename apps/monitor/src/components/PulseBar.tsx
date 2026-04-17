import { type Component, createSignal, onCleanup, onMount, For } from "solid-js";

interface PulseBarProps {
  bars?: number;
  height?: number;
  intervalMs?: number;
}

// Rolling sparkline with a coral-tip — V4 activity indicator.
// Fed by pseudo-random ticks so every pulse is distinct; replace with real
// event rate when the sessions store exposes a per-session cadence signal.
export const PulseBar: Component<PulseBarProps> = (props) => {
  const bars = () => props.bars ?? 18;
  const height = () => props.height ?? 14;
  const intervalMs = () => props.intervalMs ?? 600;
  const [vals, setVals] = createSignal<number[]>(Array.from({ length: bars() }, () => Math.random()));

  onMount(() => {
    const iv = setInterval(() => {
      setVals((prev) => [...prev.slice(1), Math.random() * 0.9 + 0.1]);
    }, intervalMs());
    onCleanup(() => clearInterval(iv));
  });

  return (
    <div class="flex items-end gap-[2px]" style={{ height: `${height()}px` }}>
      <For each={vals()}>
        {(v, i) => (
          <span
            class="block rounded-[1.5px]"
            style={{
              width: "3px",
              height: `${Math.max(10, v * 100)}%`,
              background: i() === vals().length - 1 ? "var(--coral)" : "var(--ink-3)",
              opacity: 0.3 + 0.7 * (i() / vals().length),
              transition: "height 0.5s ease",
            }}
          />
        )}
      </For>
    </div>
  );
};
